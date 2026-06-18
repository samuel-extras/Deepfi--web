/**
 * Single-oracle detail for the /prediction/[oracleId] page. Server-only (uses
 * the indexer). Finds the exact oracle from the route param — active OR settled
 * — and enriches live ones with the SVI surface so the page shows that oracle's
 * own numbers, not a fallback.
 */
import {
  indexer,
  type OracleRow,
  type SviLatestRow,
  type PriceLatestRow,
} from "@/lib/indexer";
import { fromPriceU64 } from "@/lib/deepbook";
import { normalizeRawSvi, ivFromRawSvi, probInRange } from "@/lib/svi";

const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;

function first<T>(v: T | T[]): T {
  return Array.isArray(v) ? v[0] : v;
}

function snapToTick(price: number, minStrike: number, tick: number): number {
  if (!(tick > 0)) return Math.round(price);
  return minStrike + Math.round((price - minStrike) / tick) * tick;
}

export type OracleDetail = {
  oracleId: string;
  asset: string;
  expiry: number; // epoch ms
  status: string;
  live: boolean; // active && not past expiry
  minStrike: number; // USD
  tickSize: number; // USD
  settlementPrice: number | null; // USD, settled only
  atmStrike: number | null; // USD
  aboveProb: number | null; // 0..1
  atmIv: number | null; // annualized %
  forward: number | null; // USD spot/forward
  activatedAt: number | null;
  settledAt: number | null;
};

export async function getOracleDetail(
  oracleId: string,
): Promise<OracleDetail | null> {
  let rows: OracleRow[];
  try {
    rows = await indexer.oracles();
  } catch {
    return null;
  }
  const o = rows.find(r => r.oracle_id === oracleId);
  if (!o) return null;

  const minStrike = fromPriceU64(o.min_strike);
  const tick = fromPriceU64(o.tick_size);
  const settlementPrice =
    o.settlement_price != null ? fromPriceU64(o.settlement_price) : null;
  const live = o.status === "active" && o.expiry > Date.now();

  const base: OracleDetail = {
    oracleId: o.oracle_id,
    asset: o.underlying_asset,
    expiry: o.expiry,
    status: o.status,
    live,
    minStrike,
    tickSize: tick,
    settlementPrice,
    atmStrike: settlementPrice, // settled → ATM ≈ settlement; overwritten if live
    aboveProb: null,
    atmIv: null,
    forward: null,
    activatedAt: o.activated_at ?? null,
    settledAt: o.settled_at ?? null,
  };

  if (!live) return base;

  try {
    const [sviRaw, priceRaw] = await Promise.all([
      indexer.oracleSviLatest(o.oracle_id).then(first<SviLatestRow>),
      indexer
        .oraclePriceLatest(o.oracle_id)
        .then(first<PriceLatestRow>)
        .catch(() => null),
    ]);
    const fwdRaw = priceRaw?.forward ?? priceRaw?.spot ?? priceRaw?.price;
    if (!fwdRaw) return base;

    const params = normalizeRawSvi(sviRaw as Required<SviLatestRow>);
    const forward = fromPriceU64(fwdRaw);
    const tYears = Math.max(1e-6, (o.expiry - Date.now()) / MS_PER_YEAR);
    const atmStrike = snapToTick(forward, minStrike, tick);
    const iv = ivFromRawSvi(atmStrike, forward, params, tYears);

    return {
      ...base,
      forward,
      atmStrike,
      aboveProb: probInRange(forward, atmStrike, Infinity, iv, tYears),
      atmIv: ivFromRawSvi(forward, forward, params, tYears),
    };
  } catch {
    return base;
  }
}
