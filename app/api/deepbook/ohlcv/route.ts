import { NextRequest, NextResponse } from "next/server";
import { getOhlcv } from "@/lib/sui/deepbookReads";

export const revalidate = 0;

/** GET /api/deepbook/ohlcv?pool=SUI_DBUSDC&interval=1h&start=<sec>&end=<sec> */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const pool = sp.get("pool") || "SUI_DBUSDC";
  const interval = sp.get("interval") || "1h";
  const start = sp.get("start") ? Number(sp.get("start")) : undefined;
  const end = sp.get("end") ? Number(sp.get("end")) : undefined;
  try {
    const candles = await getOhlcv(pool, interval, start, end);
    return NextResponse.json({ ok: true, pool, interval, candles });
  } catch (e) {
    return NextResponse.json({ ok: false, pool, error: String(e), candles: [] });
  }
}
