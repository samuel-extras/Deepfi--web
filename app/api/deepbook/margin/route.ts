import { NextResponse } from "next/server";
import {
  getMarginSupply,
  getMarginManagersInfo,
  getMarginManagerStates,
} from "@/lib/sui/deepbookReads";

export const revalidate = 10;

/** GET /api/deepbook/margin — margin pools (supply) + managers + current states. */
export async function GET() {
  try {
    const [pools, managers, states] = await Promise.all([
      getMarginSupply(),
      getMarginManagersInfo().catch(() => []),
      getMarginManagerStates({ maxRiskRatio: 5 }).catch(() => []),
    ]);
    return NextResponse.json({ ok: true, pools, managers, states });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e), pools: [], managers: [], states: [] });
  }
}
