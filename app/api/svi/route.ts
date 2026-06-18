import { NextRequest, NextResponse } from "next/server";
import { indexer, type SviLatestRow, type PriceLatestRow } from "@/lib/indexer";
import { fromPriceU64 } from "@/lib/deepbook";
import {
  buildSmileFromRaw,
  ivFromRawSvi,
  normalizeRawSvi,
} from "@/lib/svi";

export const revalidate = 5;

const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;

function first<T>(v: T | T[]): T {
  return Array.isArray(v) ? v[0] : v;
}

/** GET /api/svi?oracleId=0x...  (defaults to soonest active BTC oracle). */
export async function GET(req: NextRequest) {
  try {
    const rows = await indexer.oracles();
    const active = rows
      .filter((o) => o.status === "active")
      .sort((a, b) => a.expiry - b.expiry);
    const wanted = req.nextUrl.searchParams.get("oracleId");
    const oracle = wanted
      ? rows.find((o) => o.oracle_id === wanted)
      : active[0];
    if (!oracle) return NextResponse.json({ ok: false, error: "no oracle" });

    const [sviRaw, priceRaw] = await Promise.all([
      indexer.oracleSviLatest(oracle.oracle_id).then(first<SviLatestRow>),
      indexer
        .oraclePriceLatest(oracle.oracle_id)
        .then(first<PriceLatestRow>)
        .catch(() => null),
    ]);

    const params = normalizeRawSvi(sviRaw as Required<SviLatestRow>);
    const fwdRaw = priceRaw?.forward ?? priceRaw?.spot ?? priceRaw?.price;
    const forward = fwdRaw
      ? fromPriceU64(fwdRaw)
      : fromPriceU64(oracle.min_strike) * 1.4; // fallback if price feed missing
    const now = Date.now();
    const tYears = Math.max(1e-6, (oracle.expiry - now) / MS_PER_YEAR);

    const points = buildSmileFromRaw(forward, params, tYears);
    const atmIv = ivFromRawSvi(forward, forward, params, tYears);

    return NextResponse.json({
      ok: true,
      oracleId: oracle.oracle_id,
      asset: oracle.underlying_asset,
      expiry: oracle.expiry,
      forward,
      atmIv,
      params,
      points,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) });
  }
}
