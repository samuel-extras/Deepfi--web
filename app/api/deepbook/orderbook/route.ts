import { NextRequest, NextResponse } from "next/server";
import { getSpotBook } from "@/lib/sui/deepbookReads";

export const revalidate = 0; // always fresh (live book)

/** GET /api/deepbook/orderbook?pool=SUI_DBUSDC&ticks=12 */
export async function GET(req: NextRequest) {
  const pool = req.nextUrl.searchParams.get("pool") || "SUI_DBUSDC";
  const ticks = Number(req.nextUrl.searchParams.get("ticks") || "12");
  try {
    const book = await getSpotBook(pool, ticks);
    const bestBid = book.bids[0]?.px ?? null;
    const bestAsk = book.asks[0]?.px ?? null;
    const spread =
      bestBid != null && bestAsk != null ? bestAsk - bestBid : null;
    return NextResponse.json({ ok: true, ...book, bestBid, bestAsk, spread });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      pool,
      error: String(e),
      mid: null,
      bids: [],
      asks: [],
    });
  }
}
