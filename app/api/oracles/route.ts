import { NextResponse } from "next/server";
import { indexer, type OracleRow } from "@/lib/indexer";
import { fromPriceU64 } from "@/lib/deepbook";

export const revalidate = 5;

const RECENT_SETTLED = 8; // recently-settled markets shipped for the "Past" rail

/**
 * Normalized oracle list for the UI (USD strikes/prices, ms expiries).
 *
 * The indexer returns the protocol's *entire* oracle history (thousands of rows,
 * almost all settled/expired). The UI only reads the active set plus a handful
 * of the most-recently-settled markets, so we filter server-side and ship just
 * those — a few dozen rows instead of thousands.
 */
const toDTO = (o: OracleRow) => ({
  oracleId: o.oracle_id,
  asset: o.underlying_asset,
  expiry: o.expiry,
  status: o.status,
  minStrike: fromPriceU64(o.min_strike),
  tickSize: fromPriceU64(o.tick_size),
  settlementPrice:
    o.settlement_price != null ? fromPriceU64(o.settlement_price) : null,
});

export async function GET() {
  try {
    const rows = await indexer.oracles();
    const active = rows
      .filter((o) => o.status === "active")
      .sort((a, b) => a.expiry - b.expiry)
      .map(toDTO);
    const settled = rows
      .filter((o) => o.status === "settled")
      .sort((a, b) => (b.settled_at ?? b.expiry) - (a.settled_at ?? a.expiry))
      .slice(0, RECENT_SETTLED)
      .map(toDTO);
    return NextResponse.json({ active, settled, ok: true });
  } catch (e) {
    return NextResponse.json({
      active: [],
      settled: [],
      ok: false,
      error: String(e),
    });
  }
}
