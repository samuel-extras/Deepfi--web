import { NextResponse } from "next/server";
import {
  indexer,
  type OracleRow,
  type SviLatestRow,
  type PriceLatestRow,
} from "@/lib/indexer";
import { fromPriceU64 } from "@/lib/deepbook";
import { normalizeRawSvi, ivFromRawSvi, probInRange } from "@/lib/svi";

export const revalidate = 5;

/**
 * Card-ready DeepBook prediction markets for /prediction/ui-check.
 *
 * One row per oracle (one underlying + one expiry). Active oracles are enriched
 * with the live SVI surface so each card can show its ATM strike and the price
 * of the "above" binary (≈ implied probability). The indexer returns the whole
 * oracle history, so settled rows are capped to the most recent few.
 */

const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;
const MAX_SETTLED = 24;

function first<T>(v: T | T[]): T {
  return Array.isArray(v) ? v[0] : v;
}

/** Snap a price onto the oracle's strike grid (min_strike + n·tick). */
function snapToTick(price: number, minStrike: number, tick: number): number {
  if (!(tick > 0)) return Math.round(price);
  return minStrike + Math.round((price - minStrike) / tick) * tick;
}

export type PredictMarketDTO = {
  oracleId: string;
  asset: string;
  expiry: number; // epoch ms
  status: string; // "active" | "settled" | ...
  minStrike: number; // USD
  tickSize: number; // USD
  settlementPrice: number | null; // USD, settled oracles only
  atmStrike: number | null; // USD, nearest-spot strike
  aboveProb: number | null; // 0..1, price of the $1 "above ATM" contract
  atmIv: number | null; // annualized %
  volume: number; // USD, recent mint flow
};

/** Enrich an active oracle with ATM strike + above-binary price from the SVI surface. */
async function enrichActive(
  o: OracleRow,
  volume: number,
): Promise<PredictMarketDTO> {
  const minStrike = fromPriceU64(o.min_strike);
  const tick = fromPriceU64(o.tick_size);
  const base: PredictMarketDTO = {
    oracleId: o.oracle_id,
    asset: o.underlying_asset,
    expiry: o.expiry,
    status: o.status,
    minStrike,
    tickSize: tick,
    settlementPrice:
      o.settlement_price != null ? fromPriceU64(o.settlement_price) : null,
    atmStrike: null,
    aboveProb: null,
    atmIv: null,
    volume,
  };

  try {
    const [sviRaw, priceRaw] = await Promise.all([
      indexer.oracleSviLatest(o.oracle_id).then(first<SviLatestRow>),
      indexer
        .oraclePriceLatest(o.oracle_id)
        .then(first<PriceLatestRow>)
        .catch(() => null),
    ]);

    const fwdRaw = priceRaw?.forward ?? priceRaw?.spot ?? priceRaw?.price;
    if (!fwdRaw) return base; // no live price feed yet → list without a quote

    const params = normalizeRawSvi(sviRaw as Required<SviLatestRow>);
    const forward = fromPriceU64(fwdRaw);
    const tYears = Math.max(1e-6, (o.expiry - Date.now()) / MS_PER_YEAR);

    const atmStrike = snapToTick(forward, minStrike, tick);
    const iv = ivFromRawSvi(atmStrike, forward, params, tYears);
    const aboveProb = probInRange(forward, atmStrike, Infinity, iv, tYears);

    return {
      ...base,
      atmStrike,
      aboveProb,
      atmIv: ivFromRawSvi(forward, forward, params, tYears),
    };
  } catch {
    return base; // young oracle with no surface yet — list it without a price
  }
}

export async function GET() {
  try {
    const rows = await indexer.oracles();

    const active = rows
      .filter(o => o.status === "active")
      .sort((a, b) => a.expiry - b.expiry);
    const settled = rows
      .filter(o => o.status === "settled")
      .sort((a, b) => (b.settled_at ?? 0) - (a.settled_at ?? 0))
      .slice(0, MAX_SETTLED);

    // Recent mint flow per oracle → a rough per-market volume (USD).
    const volByOracle = new Map<string, number>();
    try {
      const mints = await indexer.positionsMinted(500);
      for (const m of mints) {
        volByOracle.set(
          m.oracle_id,
          (volByOracle.get(m.oracle_id) ?? 0) + (m.cost ?? 0) / 1_000_000,
        );
      }
    } catch {}

    const activeDtos = await Promise.all(
      active.map(o => enrichActive(o, volByOracle.get(o.oracle_id) ?? 0)),
    );

    const settledDtos: PredictMarketDTO[] = settled.map(o => {
      const settlement =
        o.settlement_price != null ? fromPriceU64(o.settlement_price) : null;
      return {
        oracleId: o.oracle_id,
        asset: o.underlying_asset,
        expiry: o.expiry,
        status: o.status,
        minStrike: fromPriceU64(o.min_strike),
        tickSize: fromPriceU64(o.tick_size),
        settlementPrice: settlement,
        atmStrike: settlement,
        aboveProb: null,
        atmIv: null,
        volume: volByOracle.get(o.oracle_id) ?? 0,
      };
    });

    return NextResponse.json({ ok: true, markets: [...activeDtos, ...settledDtos] });
  } catch (e) {
    return NextResponse.json({ ok: false, markets: [], error: String(e) });
  }
}
