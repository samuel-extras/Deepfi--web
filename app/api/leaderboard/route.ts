import { NextResponse } from "next/server";
import { computeTraderBoard } from "@/lib/leaderboard";

// Always server-rendered, but cache the heavy aggregation for a few seconds.
export const dynamic = "force-dynamic";
export const revalidate = 15;

/**
 * GET /api/leaderboard
 *
 * IV-Edge leaderboard. The headline metric only Predict can compute, because
 * every trade is priced against the on-chain SVI surface:
 *
 *   ROE     = total PnL ÷ total entry notional (premium paid across all mints)
 *   IV-Edge = ROE ÷ ATM implied vol
 *
 * Entry notional comes from mint history, not the manager's *current* open
 * exposure — open exposure collapses to 0 once positions settle, which would
 * zero out ROE for exactly the traders who have realized the most PnL.
 */
export async function GET() {
  try {
    const { rows, total } = await computeTraderBoard();
    const ranked = rows.slice(0, 20).map((r, i) => ({ rank: i + 1, ...r }));
    return NextResponse.json({ ok: true, rows: ranked, total });
  } catch (e) {
    return NextResponse.json({ ok: false, rows: [], error: String(e) });
  }
}
