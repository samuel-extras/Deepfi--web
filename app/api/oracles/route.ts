import { NextResponse } from "next/server";
import { indexer } from "@/lib/indexer";
import { fromPriceU64 } from "@/lib/deepbook";

export const revalidate = 5;

/**
 * Normalized oracle list for the UI (USD strikes/prices, ms expiries).
 *
 * The indexer returns the protocol's *entire* oracle history (thousands of rows,
 * almost all settled/expired). The UI only ever reads the active set, so we
 * filter server-side and ship just that — a few dozen rows instead of thousands.
 */
export async function GET() {
  try {
    const rows = await indexer.oracles();
    const active = rows
      .filter((o) => o.status === "active")
      .sort((a, b) => a.expiry - b.expiry)
      .map((o) => ({
        oracleId: o.oracle_id,
        asset: o.underlying_asset,
        expiry: o.expiry,
        status: o.status,
        minStrike: fromPriceU64(o.min_strike),
        tickSize: fromPriceU64(o.tick_size),
        settlementPrice:
          o.settlement_price != null ? fromPriceU64(o.settlement_price) : null,
      }));
    return NextResponse.json({ active, ok: true });
  } catch (e) {
    return NextResponse.json({ active: [], ok: false, error: String(e) });
  }
}
