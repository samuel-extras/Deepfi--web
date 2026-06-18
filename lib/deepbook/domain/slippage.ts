/**
 * Market-order slippage bound. DeepBook market orders carry no price bound of
 * their own, so the UI expresses "max slippage" as an IOC limit at
 * mark ± slippage. Single source of truth shared by spot and margin tickets.
 */

/**
 * Limit price that bounds a market order to `slippagePct` away from `mark`.
 * Rounds outward to the nearest `tick` so the bound stays inclusive of the
 * intended tolerance.
 */
export function slippageLimitPrice(
  mark: number,
  isBid: boolean,
  slippagePct: number,
  tick: number
): number {
  const raw = isBid ? mark * (1 + slippagePct / 100) : mark * (1 - slippagePct / 100);
  if (!tick || tick <= 0) return raw;
  // round outward so the bound is inclusive of the intended tolerance
  const n = isBid ? Math.ceil(raw / tick - 1e-9) : Math.floor(raw / tick + 1e-9);
  const dp = tick >= 1 ? 0 : Math.min(9, Math.round(-Math.log10(tick)));
  return Number((n * tick).toFixed(dp));
}
