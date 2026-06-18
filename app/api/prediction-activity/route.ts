import { NextResponse } from "next/server";
import { indexer } from "@/lib/indexer";

export const revalidate = 2;

/**
 * Recent mints (buys) across the protocol, newest first — drives the live
 * "+$X floating up/down" buy feed on the rolling-series cards. Each row is one
 * PositionMinted: which oracle, Up (is_up) or Down, and the dUSDC cost.
 */
export async function GET() {
  try {
    const mints = await indexer.positionsMinted(80);
    const out = mints
      .map(m => ({
        key: m.event_digest || `${m.digest}:${m.oracle_id}:${m.is_up}`,
        oracleId: m.oracle_id,
        isUp: m.is_up,
        cost: (m.cost ?? 0) / 1_000_000, // dUSDC 1e6 → USD
        ts: m.checkpoint_timestamp_ms,
      }))
      .sort((a, b) => b.ts - a.ts);
    return NextResponse.json({ ok: true, mints: out });
  } catch (e) {
    return NextResponse.json({ ok: false, mints: [], error: String(e) });
  }
}
