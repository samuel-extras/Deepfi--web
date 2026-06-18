/**
 * Option-pricing primitives for the vault backtest.
 *
 * DeepBook Predict prices every strike/range off a live SVI vol surface and a
 * PLP vault takes the other side. For a historical backtest we don't have the
 * past SVI params, so we use the standard proxy: price each cycle's range/binary
 * with a Black-Scholes lognormal model driven by *rolling realized volatility*,
 * then settle against the *actual* next price. This is the conventional way to
 * backtest short-dated options PnL and makes the assumptions explicit.
 *
 * Horizon is one expiry cycle, so we work in per-cycle vol units (no annualized
 * round-trip): a cycle's price ratio is lognormal with stdev = per-cycle vol.
 */

/** Standard normal CDF via the Abramowitz & Stegun erf approximation. */
export function normCdf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-z * z);
  return 0.5 * (1 + sign * y);
}

/**
 * Risk-neutral (drift 0 over a short cycle) probability that the settlement
 * price lands in [low, high], given spot S and per-cycle vol σ.
 * Under lognormal: ln(S_T/S) ~ N(-σ²/2, σ²).
 */
export function rangeProbability(
  S: number,
  low: number,
  high: number,
  sigma: number,
): number {
  if (sigma <= 0 || S <= 0) return low <= S && S <= high ? 1 : 0;
  const d = (K: number) => (Math.log(K / S) + 0.5 * sigma * sigma) / sigma;
  const p = normCdf(d(high)) - normCdf(d(low));
  return Math.min(1, Math.max(0, p));
}

/** Probability the settlement price is above (isUp) / below a strike K. */
export function binaryProbability(
  S: number,
  K: number,
  isUp: boolean,
  sigma: number,
): number {
  if (sigma <= 0 || S <= 0) return (isUp ? S > K : S < K) ? 1 : 0;
  const d = (Math.log(K / S) + 0.5 * sigma * sigma) / sigma;
  const pBelow = normCdf(d); // P(S_T <= K)
  const p = isUp ? 1 - pBelow : pBelow;
  return Math.min(1, Math.max(0, p));
}

/**
 * Empirical probability that a log return falls in [lo, hi], measured from a
 * trailing sample. Used to price ranges/binaries off BTC's *actual* (fat-tailed)
 * return distribution instead of a lognormal assumption — so a strategy's edge
 * reflects the vault spread, not a Black-Scholes mispricing artifact.
 */
export function empiricalBetween(returns: number[], lo: number, hi: number): number {
  if (!returns.length) return 0;
  let c = 0;
  for (const r of returns) if (r >= lo && r <= hi) c++;
  return c / returns.length;
}

/** Empirical tail probability: P(r > x) if upper, else P(r < x). */
export function empiricalTail(returns: number[], x: number, upper: boolean): number {
  if (!returns.length) return 0;
  let c = 0;
  for (const r of returns) if (upper ? r > x : r < x) c++;
  return c / returns.length;
}

/** Per-cycle log returns from a price series. */
export function logReturns(prices: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < prices.length; i++) out.push(Math.log(prices[i] / prices[i - 1]));
  return out;
}

/** Sample standard deviation of a series (per-cycle vol when fed log returns). */
export function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const v = xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - 1);
  return Math.sqrt(v);
}

/** Annualize a per-cycle vol given cycles per year (for display only). */
export function annualizeVol(perCycleVol: number, cyclesPerYear: number): number {
  return perCycleVol * Math.sqrt(cyclesPerYear);
}
