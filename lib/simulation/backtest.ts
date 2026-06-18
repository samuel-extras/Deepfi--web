/**
 * Vault-strategy backtester for DeepBook Predict.
 *
 * Replays historical BTC candles through three strategies and reports honest
 * risk/return metrics. Each candle is one expiry cycle: we estimate per-cycle
 * volatility from a trailing window, price the cycle's range/binary with
 * Black-Scholes (see pricing.ts), then settle against the *actual* next close.
 *
 * Strategies:
 *   1. Range Ladder (buyer)  — buys a strip of ATM ranges each cycle (idea #1).
 *   2. PLP (seller)          — takes the other side, earning the vault spread.
 *   3. PLP + Hedge           — #2 plus an OTM crash binary to cap the left tail.
 *
 * Honesty notes (surfaced in the UI methodology box):
 *   - Pricing uses *trailing* realized vol, so vol spikes are underpriced at
 *     entry — that's the real risk that hammers the seller and that the hedge
 *     addresses. Good: it's modeled, not assumed away.
 *   - The spread is captured without adverse-selection / inventory modeling, so
 *     seller Sharpe is optimistic. Treat figures as indicative, not live PnL.
 */

import {
  empiricalBetween,
  empiricalTail,
  logReturns,
  stdev,
  annualizeVol,
} from "./pricing";

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface EquityPoint {
  t: number;
  equity: number;
}

export interface Metrics {
  startEquity: number;
  endEquity: number;
  totalReturn: number; // fraction
  cagr: number; // fraction, annualized
  sharpe: number; // annualized
  maxDrawdown: number; // fraction (positive number)
  winRate: number; // fraction of cycles with positive PnL
  numCycles: number;
  avgCyclePnl: number; // in equity units
  annualizedVol: number; // of cycle returns
}

export interface BacktestResult {
  name: string;
  blurb: string;
  metrics: Metrics;
  equity: EquityPoint[]; // downsampled for charting
}

export interface SimConfig {
  startEquity: number;
  volWindow: number; // candles used to estimate per-cycle vol
  spread: number; // vault spread on top of fair value (e.g. 0.05)
  stakeFraction: number; // fraction of equity deployed/underwritten per cycle
  rungs: number[]; // σ-multiples of the range ladder
  hedgeK: number; // σ-multiple of the OTM crash strike
  hedgeFraction: number; // hedge notional as fraction of underwritten notional
  cyclesPerYear: number; // 15m → 35040
}

export const DEFAULT_CONFIG: SimConfig = {
  startEquity: 10_000,
  // Longer (2-day) window → a smooth, near-unbiased vol estimate. Short windows
  // overestimate the next 15m move in mean-reverting markets and hand the range
  // *buyer* a spurious edge; smoothing makes each strategy's edge come from the
  // spread, which is what we actually want to measure.
  volWindow: 192, // 2 days of 15m candles
  spread: 0.02, // vault spread on fair value (realistic for short-dated)
  stakeFraction: 0.02, // capital deployed/underwritten per cycle
  rungs: [0.5, 1.0, 1.5],
  hedgeK: 2.5,
  hedgeFraction: 0.5,
  cyclesPerYear: 365 * 24 * 4,
};

interface CycleCtx {
  S: number;
  S_T: number;
  sigma: number;
  returns: number[]; // trailing log-return sample (for empirical pricing)
  equity: number;
  cfg: SimConfig;
}

type Decide = (ctx: CycleCtx) => number; // returns cycle PnL in equity units

/** $ cost per $1 of payout, capped below 1 (premium can't exceed payout). */
function pricePerPayout(prob: number, spread: number): number {
  return Math.min(0.999, Math.max(0, prob * (1 + spread)));
}

// ── Strategy decisions ──────────────────────────────────────────────────────

const rangeLadderBuyer: Decide = ({ S, S_T, sigma, returns, equity, cfg }) => {
  const stake = cfg.stakeFraction * equity;
  const per = stake / cfg.rungs.length;
  let pnl = 0;
  for (const k of cfg.rungs) {
    const lo = -k * sigma, hi = k * sigma; // thresholds in log-return space
    const low = S * Math.exp(lo), high = S * Math.exp(hi);
    const price = pricePerPayout(empiricalBetween(returns, lo, hi), cfg.spread);
    if (price <= 0) continue;
    const payout = per / price; // claims bought
    const win = S_T >= low && S_T <= high;
    pnl += win ? payout - per : -per;
  }
  return pnl;
};

/**
 * PLP as a short OTM strangle ladder: each cycle it writes an up-binary and a
 * down-binary at each rung's σ-distance, collecting the vault spread. This is
 * SHORT gamma — it earns premium in calm markets and pays out on big moves, so
 * its left tail is a large directional break (and a crash binary genuinely
 * hedges it).
 */
function plpStrangle(withHedge: boolean): Decide {
  return ({ S, S_T, sigma, returns, equity, cfg }) => {
    const notional = cfg.stakeFraction * equity;
    const per = notional / (cfg.rungs.length * 2); // per binary leg
    let pnl = 0;
    for (const w of cfg.rungs) {
      const thrUp = w * sigma, thrDn = -w * sigma;
      const Kup = S * Math.exp(thrUp), Kdn = S * Math.exp(thrDn);
      // write up-binary: collect premium, pay if breached up
      pnl += pricePerPayout(empiricalTail(returns, thrUp, true), cfg.spread) * per
        - (S_T > Kup ? per : 0);
      // write down-binary: collect premium, pay if breached down
      pnl += pricePerPayout(empiricalTail(returns, thrDn, false), cfg.spread) * per
        - (S_T < Kdn ? per : 0);
    }
    // Hedge: buy a further-OTM downside crash binary to cap the left tail.
    if (withHedge) {
      const thr = -cfg.hedgeK * sigma;
      const K = S * Math.exp(thr);
      const hedgeNotional = cfg.hedgeFraction * notional;
      const cost = pricePerPayout(empiricalTail(returns, thr, false), cfg.spread) * hedgeNotional;
      pnl += (S_T < K ? hedgeNotional : 0) - cost;
    }
    return pnl;
  };
}

// ── Engine ──────────────────────────────────────────────────────────────────

/** Daily PnL as a fraction of the (constant) capital base — additive, no compounding. */
function dailyReturns(curve: EquityPoint[], base: number): number[] {
  const byDay = new Map<number, number>();
  for (const p of curve) byDay.set(Math.floor(p.t / 86_400_000), p.equity); // last of day wins
  const eqs = [...byDay.values()];
  const out: number[] = [];
  for (let i = 1; i < eqs.length; i++) out.push(base > 0 ? (eqs[i] - eqs[i - 1]) / base : 0);
  return out;
}

function computeMetrics(
  curve: EquityPoint[],
  wins: number,
  nCycles: number,
  cfg: SimConfig,
): Metrics {
  const start = curve[0].equity;
  const end = curve[curve.length - 1].equity;
  const base = cfg.startEquity;

  // Sharpe / vol on DAILY returns over the constant base (standard, interpretable) —
  // not per-15m-cycle, which would annualize by √35040 into misleading numbers.
  const daily = dailyReturns(curve, base);
  const meanD = daily.length ? daily.reduce((a, b) => a + b, 0) / daily.length : 0;
  const sdD = stdev(daily);
  const sharpe = sdD > 0 ? (meanD / sdD) * Math.sqrt(365) : 0;

  let peak = start, maxDd = 0;
  for (const p of curve) {
    if (p.equity > peak) peak = p.equity;
    const dd = peak > 0 ? (peak - p.equity) / peak : 0;
    if (dd > maxDd) maxDd = dd;
  }

  return {
    startEquity: start,
    endEquity: end,
    totalReturn: base > 0 ? (end - start) / base : 0,
    cagr: meanD * 365, // simple annualized return (additive, not compounded)
    sharpe,
    maxDrawdown: maxDd,
    winRate: nCycles ? wins / nCycles : 0,
    numCycles: nCycles,
    avgCyclePnl: nCycles ? (end - start) / nCycles : 0,
    annualizedVol: annualizeVol(sdD, 365),
  };
}

/** Downsample an equity curve to ~maxPts points for charting. */
function downsample(curve: EquityPoint[], maxPts = 180): EquityPoint[] {
  if (curve.length <= maxPts) return curve;
  const step = curve.length / maxPts;
  const out: EquityPoint[] = [];
  for (let i = 0; i < maxPts; i++) out.push(curve[Math.floor(i * step)]);
  out.push(curve[curve.length - 1]);
  return out;
}

function runOne(name: string, blurb: string, candles: Candle[], cfg: SimConfig, decide: Decide): BacktestResult {
  const closes = candles.map(c => c.close);
  let equity = cfg.startEquity;
  const curve: EquityPoint[] = [{ t: candles[cfg.volWindow].time, equity }];
  let wins = 0, nCycles = 0;

  for (let i = cfg.volWindow; i < candles.length - 1; i++) {
    const trailing = logReturns(closes.slice(i - cfg.volWindow, i + 1));
    const sigma = stdev(trailing);
    // Size off a CONSTANT base (no compounding) so the curve reflects the
    // strategy's edge, not a reinvestment explosion over thousands of cycles.
    const pnl = decide({
      S: closes[i], S_T: closes[i + 1], sigma, returns: trailing,
      equity: cfg.startEquity, cfg,
    });
    equity = Math.max(0, equity + pnl);
    nCycles++;
    if (pnl > 0) wins++;
    curve.push({ t: candles[i + 1].time, equity });
    if (equity <= 0) break; // strategy blew up
  }

  return {
    name,
    blurb,
    metrics: computeMetrics(curve, wins, nCycles, cfg),
    equity: downsample(curve),
  };
}

/** Run all three strategies over the same candle series. */
export function runBacktests(candles: Candle[], cfg: SimConfig = DEFAULT_CONFIG): BacktestResult[] {
  if (candles.length < cfg.volWindow + 2) {
    throw new Error(`need at least ${cfg.volWindow + 2} candles, got ${candles.length}`);
  }
  return [
    runOne(
      "Range Ladder",
      "Buys a strip of ATM ranges each expiry — long 'stays in range'.",
      candles, cfg, rangeLadderBuyer,
    ),
    runOne(
      "PLP Supply",
      "Short OTM strangle ladder — earns the vault spread; short gamma.",
      candles, cfg, plpStrangle(false),
    ),
    runOne(
      "PLP + Hedge",
      "PLP yield plus an OTM crash binary that pays on a downside break.",
      candles, cfg, plpStrangle(true),
    ),
  ];
}
