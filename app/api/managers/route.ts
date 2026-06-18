import { NextRequest, NextResponse } from "next/server";
import { indexer } from "@/lib/indexer";

export const dynamic = "force-dynamic";

/** GET /api/managers?owner=0x... -> the caller's PredictManager id (most recent). */
export async function GET(req: NextRequest) {
  const owner = req.nextUrl.searchParams.get("owner");
  try {
    const all = await indexer.managers();
    if (!owner) return NextResponse.json({ managers: all, ok: true });
    const mine = all
      .filter((m) => m.owner === owner)
      .sort((a, b) => b.checkpoint_timestamp_ms - a.checkpoint_timestamp_ms);
    return NextResponse.json({
      managerId: mine[0]?.manager_id ?? null,
      count: mine.length,
      ok: true,
    });
  } catch (e) {
    return NextResponse.json({ managerId: null, ok: false, error: String(e) });
  }
}
