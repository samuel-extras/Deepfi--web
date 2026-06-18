import { NextRequest, NextResponse } from "next/server";
import { indexer } from "@/lib/indexer";
import { fromPriceU64 } from "@/lib/deepbook";

export const revalidate = 2;

const MAX_POINTS = 360; // plenty for a smooth line, cheap to ship

/**
 * GET /api/prices?oracleId=0x...&limit=900
 * Oracle price tape for the live chart — oldest-first, USD floats.
 */
export async function GET(req: NextRequest) {
  const oracleId = req.nextUrl.searchParams.get("oracleId");
  if (!oracleId) {
    return NextResponse.json({ ok: false, error: "oracleId required" });
  }
  const limit = Math.min(
    2000,
    Math.max(50, Number(req.nextUrl.searchParams.get("limit")) || 900),
  );

  try {
    const rows = await indexer.oraclePrices(oracleId, limit);
    // Newest-first from the indexer → oldest-first for charting
    const asc = [...rows].reverse();
    // Even-stride downsample, but always keep the latest tick
    const stride = Math.max(1, Math.ceil(asc.length / MAX_POINTS));
    const points = asc
      .filter((_, i) => i % stride === 0 || i === asc.length - 1)
      .map(r => ({
        t: r.checkpoint_timestamp_ms,
        spot: fromPriceU64(r.spot),
        forward: fromPriceU64(r.forward),
      }));

    const last = points.at(-1) ?? null;
    return NextResponse.json({
      ok: true,
      oracleId,
      points,
      spot: last?.spot ?? null,
      forward: last?.forward ?? null,
      asOf: last?.t ?? null,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e), points: [] });
  }
}
