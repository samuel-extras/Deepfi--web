/**
 * PLP vault stress engine (#10).
 *
 * The vault is the counterparty to every Predict position, so it OWES a payout
 * whenever an open position settles in-the-money. This computes the vault's
 * settlement payout liability across a grid of BTC price shocks ("what if BTC
 * moves ±kσ?"), which is the core "is PLP safe?" question.
 *
 * Payouts are computed as a FRACTION of open exposure (by contract weight) and
 * multiplied by the authoritative `totalMaxPayout` from the vault summary — so
 * the result is robust to on-chain contract-unit scaling.
 */

export type OpenPos = {
  kind: "binary" | "range";
  /** binary: true = pays when settle ≥ strike (Up), false = pays when settle < strike (Down). */
  isUp?: boolean;
  strike?: number;
  lower?: number;
  higher?: number;
  /** relative size weight (raw contract quantity). */
  weight: number;
};

/** Does this position pay out (vault loses) at a given settlement price? */
export function inTheMoney(p: OpenPos, settle: number): boolean {
  if (p.kind === "range") {
    return settle > (p.lower ?? -Infinity) && settle <= (p.higher ?? Infinity);
  }
  const k = p.strike ?? 0;
  return p.isUp ? settle >= k : settle < k;
}

export type StressPoint = {
  shockPct: number; // BTC move applied, %
  settle: number; // shocked settlement price
  triggeredFrac: number; // 0..1 of open exposure that pays
  payout: number; // vault payout liability ($)
  pnl: number; // premium kept − payout ($)
};

/**
 * Vault payout liability + PnL across a grid of price shocks.
 * @param positions open positions with relative weights
 * @param spot current BTC price
 * @param totalMaxPayout authoritative max payout from vault summary ($)
 * @param premium premium collected on the open book ($)
 * @param shockPcts grid of % moves to evaluate (e.g. [-15..15])
 */
export function stressCurve(
  positions: OpenPos[],
  spot: number,
  totalMaxPayout: number,
  premium: number,
  shockPcts: number[],
): StressPoint[] {
  const totalWeight = positions.reduce((s, p) => s + (p.weight || 0), 0);
  return shockPcts.map((shockPct) => {
    const settle = spot * (1 + shockPct / 100);
    const triggered = positions.reduce(
      (s, p) => s + (inTheMoney(p, settle) ? p.weight || 0 : 0),
      0,
    );
    const triggeredFrac = totalWeight > 0 ? triggered / totalWeight : 0;
    const payout = triggeredFrac * totalMaxPayout;
    return { shockPct, settle, triggeredFrac, payout, pnl: premium - payout };
  });
}

/** 1σ move as a % of spot, from an annualized IV (%) over `tYears`. */
export function sigmaMovePct(atmIvPct: number, tYears: number): number {
  return (atmIvPct / 100) * Math.sqrt(Math.max(tYears, 0)) * 100;
}

/** Symmetric shock grid spanning ±maxPct with `steps` points. */
export function shockGrid(maxPct: number, steps = 49): number[] {
  return Array.from(
    { length: steps },
    (_, i) => -maxPct + (2 * maxPct * i) / (steps - 1),
  );
}

/** Running peak-to-trough drawdown series from a share-price history. */
export function drawdownSeries(
  points: { t: number; sharePrice: number }[],
): { t: number; sharePrice: number; drawdownPct: number }[] {
  let peak = -Infinity;
  return points.map((p) => {
    peak = Math.max(peak, p.sharePrice);
    const drawdownPct = peak > 0 ? ((p.sharePrice - peak) / peak) * 100 : 0;
    return { t: p.t, sharePrice: p.sharePrice, drawdownPct };
  });
}
