import { NextRequest, NextResponse } from "next/server";
import { getTrades } from "@/lib/sui/deepbookReads";

export const revalidate = 0;

/** GET /api/deepbook/trades?pool=SUI_DBUSDC&limit=40 */
export async function GET(req: NextRequest) {
  const pool = req.nextUrl.searchParams.get("pool") || "SUI_DBUSDC";
  const limit = Number(req.nextUrl.searchParams.get("limit") || "40");
  try {
    const trades = await getTrades(pool, limit);
    return NextResponse.json({ ok: true, pool, trades });
  } catch (e) {
    return NextResponse.json({ ok: false, pool, error: String(e), trades: [] });
  }
}
