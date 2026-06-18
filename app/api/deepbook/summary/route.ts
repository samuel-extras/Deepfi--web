import { NextResponse } from "next/server";
import { getSummaryByPool } from "@/lib/sui/deepbookReads";

export const revalidate = 5;

/** GET /api/deepbook/summary — 24h stats for every pool, keyed by pool name. */
export async function GET() {
  try {
    const summary = await getSummaryByPool();
    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e), summary: {} });
  }
}
