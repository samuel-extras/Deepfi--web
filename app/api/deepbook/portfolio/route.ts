import { NextRequest, NextResponse } from "next/server";
import { getPortfolio } from "@/lib/sui/deepbookReads";
import { DEV_ADDRESS } from "@/lib/sui/network";

export const revalidate = 0;

/** GET /api/deepbook/portfolio?wallet=0x... (DeepBook margin + collateral + LP + equity) */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet") || DEV_ADDRESS;
  try {
    const portfolio = await getPortfolio(wallet);
    return NextResponse.json({ ok: true, wallet, ...portfolio });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      wallet,
      error: String(e),
      margin_positions: [],
      collateral_balances: [],
      lp_positions: [],
      summary: { total_equity_usd: 0, total_debt_usd: 0, net_value_usd: 0 },
    });
  }
}
