/**
 * Shared, dependency-light formatters that turn the raw PredictManager position
 * shape returned by /api/portfolio into the Polymarket-style card shape the
 * portfolio UI renders. Pure functions — safe on both server (activity route)
 * and client (PredictPortfolio).
 */
import { DUSDC_SCALE } from "@/lib/deepbook";

/** Raw on-chain quantity is 1e6 base units per whole contract (= dUSDC scale). */
export const CONTRACT_SCALE = DUSDC_SCALE;

const ASSET_FULL: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  SUI: "Sui",
};

export function assetLabel(asset?: string): string {
  const sym = (asset || "").toUpperCase();
  return ASSET_FULL[sym] ?? sym ?? "Market";
}

const usdWhole = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

/** Shape of a position row from /api/portfolio (dollars already de-scaled). */
export interface ApiPosition {
  oracleId: string;
  asset?: string;
  expiry: number; // epoch ms
  kind: "binary" | "range";
  strike?: number; // binary, USD
  isUp?: boolean; // binary
  lowerStrike?: number; // range, USD
  higherStrike?: number; // range, USD
  openQty: number; // RAW on-chain u64
  cost: number; // USD
  markValue: number; // USD
  unrealizedPnl: number; // USD
  realizedPnl: number; // USD
  status: string;
}

/** "BTC above $63,848" / "BTC between $70,000 and $70,500". */
export function positionTitle(p: ApiPosition): string {
  const a = assetLabel(p.asset);
  if (p.kind === "range") {
    return `${a} between ${usdWhole(p.lowerStrike ?? 0)} and ${usdWhole(p.higherStrike ?? 0)}`;
  }
  return `${a} ${p.isUp ? "above" : "below"} ${usdWhole(p.strike ?? 0)}`;
}

/** "Up" / "Down" / "In Range". */
export function positionOutcome(p: Pick<ApiPosition, "kind" | "isUp">): string {
  if (p.kind === "range") return "In Range";
  return p.isUp ? "Up" : "Down";
}

/** "Jun 17, 8:00 PM UTC" — used as the card's sub-label / event title. */
export function expiryLabel(ms: number): string {
  const t = new Date(ms).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
  return `${t} UTC`;
}

/** A position is done with the live market: settled, redeemable, or redeemed. */
export function isSettledStatus(status: string): boolean {
  return (
    status === "redeemable" ||
    status === "settled" ||
    status === "closed" ||
    status === "redeemed"
  );
}

/**
 * Map an /api/portfolio position into the card shape consumed by
 * Active/ClosedPositionCard. `managerId` is threaded through so the redeem/sell
 * handlers have everything they need to build the PTB.
 */
export function toCardPosition(p: ApiPosition, managerId: string) {
  const contracts = (p.openQty ?? 0) / CONTRACT_SCALE;
  const cost = p.cost ?? 0;
  const currentValue = p.markValue ?? 0;
  const avgPrice = contracts > 0 ? cost / contracts : 0;
  const curPrice = contracts > 0 ? currentValue / contracts : 0;
  const cashPnl = p.unrealizedPnl ?? currentValue - cost;
  const realizedPnl = p.realizedPnl ?? 0;
  const settled = isSettledStatus(p.status);
  // Settled positions still in the feed have un-redeemed payout to collect.
  const redeemablePnl = settled ? currentValue - cost : cashPnl;
  const denom = cost !== 0 ? cost : 1;
  const percentPnl = ((settled ? redeemablePnl : cashPnl) / denom) * 100;

  return {
    ...p,
    managerId,
    href: `/prediction/${p.oracleId}`,
    eventSlug: p.oracleId,
    slug: p.oracleId,
    eventTitle: `${assetLabel(p.asset)} · ${expiryLabel(p.expiry)}`,
    title: positionTitle(p),
    outcome: positionOutcome(p),
    size: String(contracts),
    avgPrice,
    curPrice,
    currentValue,
    initialValue: cost,
    cashPnl: settled ? redeemablePnl : cashPnl,
    percentPnl,
    realizedPnl,
    // Drives the Redeem button: settled markets with payout still on the table.
    redeemable: settled && contracts > 0,
    // Raw u64 quantity for the redeem PTB.
    quantityRaw: p.openQty,
  };
}

export type CardPosition = ReturnType<typeof toCardPosition>;
