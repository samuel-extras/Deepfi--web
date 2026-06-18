// Lightweight SVI smile + binary/range pricing math.
// Used to make mock data and the Combo Summary feel real. Not a pricing oracle.

import type { SviPoint } from "./types";

/** Standard normal CDF (Abramowitz & Stegun 7.1.26). */
export function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

/**
 * Smile parameters (SVI-flavored, expressed directly in annualized vol terms so
 * short rolling expiries don't blow up). atmIv is annualized IV at-the-money (%);
 * skew tilts the put/call wing; curv adds convexity in log-moneyness.
 */
export interface SviParams {
  atmIv: number;
  skew: number;
  curv: number;
}

/** Annualized IV (%) at a strike. tYears kept for API symmetry / term structure. */
export function ivFromSvi(
  strike: number,
  spot: number,
  _tYears: number,
  p: SviParams,
): number {
  const k = Math.log(strike / spot); // log-moneyness
  const iv = p.atmIv * (1 - p.skew * k + p.curv * k * k);
  return Math.max(1, iv);
}

// ---------- real on-chain SVI (raw total-variance parameterization) ----------

const SVI_PARAM_SCALE = 1_000_000_000; // indexer SVI params are 1e9 fixed-point

export interface RawSviParams {
  a: number;
  b: number;
  rho: number;
  m: number;
  sigma: number;
}

/** Normalize an indexer svi/latest row (sign flags + 1e9 scale) to floats. */
export function normalizeRawSvi(row: {
  a: number;
  b: number;
  rho: number;
  rho_negative?: boolean;
  m: number;
  m_negative?: boolean;
  sigma: number;
}): RawSviParams {
  const s = SVI_PARAM_SCALE;
  return {
    a: row.a / s,
    b: row.b / s,
    rho: (row.rho / s) * (row.rho_negative ? -1 : 1),
    m: (row.m / s) * (row.m_negative ? -1 : 1),
    sigma: row.sigma / s,
  };
}

/** Raw SVI total variance w(k), k = log-moneyness vs forward. */
export function rawTotalVariance(k: number, p: RawSviParams): number {
  const w = p.a + p.b * (p.rho * (k - p.m) + Math.sqrt((k - p.m) ** 2 + p.sigma ** 2));
  return Math.max(1e-8, w);
}

/** Annualized IV (%) from raw on-chain SVI at a strike. */
export function ivFromRawSvi(
  strike: number,
  forward: number,
  p: RawSviParams,
  tYears: number,
): number {
  const k = Math.log(strike / forward);
  const w = rawTotalVariance(k, p);
  return Math.sqrt(w / Math.max(tYears, 1e-9)) * 100;
}

/** Sample a smile from real on-chain SVI params. */
export function buildSmileFromRaw(
  forward: number,
  p: RawSviParams,
  tYears: number,
  widthPct = 0.06,
  steps = 41,
): SviPoint[] {
  const out: SviPoint[] = [];
  for (let i = 0; i < steps; i++) {
    const f = -widthPct + (2 * widthPct * i) / (steps - 1);
    const strike = forward * (1 + f);
    out.push({ strike, iv: ivFromRawSvi(strike, forward, p, tYears) });
  }
  return out;
}

/** Build a smile (strike -> IV%) sampled around spot. */
export function buildSmile(
  spot: number,
  tYears: number,
  p: SviParams,
  widthPct = 0.06,
  steps = 41,
): SviPoint[] {
  const out: SviPoint[] = [];
  for (let i = 0; i < steps; i++) {
    const f = -widthPct + (2 * widthPct * i) / (steps - 1);
    const strike = spot * (1 + f);
    out.push({ strike, iv: ivFromSvi(strike, spot, tYears, p) });
  }
  return out;
}

/**
 * Risk-neutral probability the underlying lands in [low, high] at expiry under
 * a driftless lognormal with annualized vol `ivPct` over `tYears`.
 */
export function probInRange(
  spot: number,
  low: number,
  high: number,
  ivPct: number,
  tYears: number,
): number {
  const sigma = (ivPct / 100) * Math.sqrt(tYears);
  if (sigma <= 0) return spot >= low && spot <= high ? 1 : 0;
  const dK = (K: number) =>
    (Math.log(K / spot) + 0.5 * sigma * sigma) / sigma; // P(S_T < K) = N(dK)
  const pHigh = high === Infinity ? 1 : normCdf(dK(high));
  const pLow = low <= 0 ? 0 : normCdf(dK(low));
  return Math.max(0, Math.min(1, pHigh - pLow));
}

/**
 * Quote a range binary. Stake `sizeDusdc` to win `payout` if the underlying
 * settles in [low, high]. Premium ~ prob * payout, with a small protocol vig.
 */
export function quoteRangeBinary(
  spot: number,
  low: number,
  high: number,
  ivPct: number,
  tYears: number,
  sizeDusdc: number,
  vig = 0.02,
): { prob: number; payout: number; maxLoss: number; multiple: number } {
  const prob = probInRange(spot, low, high, ivPct, tYears);
  const fairMultiple = prob > 0 ? 1 / prob : 0;
  const multiple = fairMultiple * (1 - vig);
  const payout = sizeDusdc * multiple;
  return { prob, payout, maxLoss: sizeDusdc, multiple };
}
