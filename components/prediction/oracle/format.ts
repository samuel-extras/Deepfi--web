// Client-safe formatters for the single-oracle page sections. (Type-only import
// of OracleDetail is erased at build, so this never pulls in the server lib.)
import type { OracleDetail } from "@/lib/predict";

export const usd0 = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

/** "Jun 17, 8:00 PM UTC" */
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

/** Remaining time as "11m" · "2h 5m" · "3d" · "expired". */
export function countdown(ms: number): string {
  if (ms <= 0) return "expired";
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d`;
}

export const ASSET_NAME: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
};

export function assetGlyph(asset: string): string {
  return asset === "BTC" ? "₿" : asset.slice(0, 1);
}

export function oracleTitle(d: OracleDetail): string {
  return `${ASSET_NAME[d.asset] ?? d.asset} ${d.live ? "Up or Down" : "settlement"}`;
}
