import { NextRequest, NextResponse } from "next/server";
import { getOrderHistory } from "@/lib/sui/deepbookReads";

export const revalidate = 0;

/** GET /api/deepbook/orders?pool=SUI_DBUSDC&bm=0x...&limit=50 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const pool = sp.get("pool") || "SUI_DBUSDC";
  const bm = sp.get("bm");
  if (!bm) {
    return NextResponse.json({ ok: false, error: "bm required", orders: [] });
  }
  try {
    const orders = await getOrderHistory(pool, bm, Number(sp.get("limit") || "50"));
    return NextResponse.json({ ok: true, pool, orders });
  } catch (e) {
    return NextResponse.json({ ok: false, pool, error: String(e), orders: [] });
  }
}
