import { NextRequest, NextResponse } from "next/server";
import { getSummaryByPool } from "@/lib/sui/deepbookReads";

export const revalidate = 5;

/** GET /api/deepbook/ticker?pool=SUI_DBUSDC -> normalized 24h stats for the pair. */
export async function GET(req: NextRequest) {
  const pool = req.nextUrl.searchParams.get("pool") || "SUI_DBUSDC";
  try {
    const summary = await getSummaryByPool();
    const row = summary[pool];
    if (!row) return NextResponse.json({ ok: false, pool, error: "no summary" });
    const last = row.last_price;
    const pct = row.price_change_percent_24h ?? 0;
    const prevDay = pct !== 0 ? last / (1 + pct / 100) : last;
    return NextResponse.json({
      ok: true,
      pool,
      lastPrice: last,
      change24h: last - prevDay,
      change24hPercent: pct,
      baseVolume: row.base_volume,
      quoteVolume: row.quote_volume,
      high24h: row.highest_price_24h,
      low24h: row.lowest_price_24h,
      bestBid: row.highest_bid,
      bestAsk: row.lowest_ask,
      baseCurrency: row.base_currency,
      quoteCurrency: row.quote_currency,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, pool, error: String(e) });
  }
}
