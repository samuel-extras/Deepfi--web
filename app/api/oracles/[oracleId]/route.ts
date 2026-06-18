import { NextResponse } from "next/server";
import { getOracleDetail } from "@/lib/predict";

export const revalidate = 5;

/** GET /api/oracles/:oracleId — full detail for one oracle (active or settled). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ oracleId: string }> },
) {
  const { oracleId } = await params;
  const oracle = await getOracleDetail(oracleId);
  if (!oracle) {
    return NextResponse.json({ ok: false, error: "oracle not found" });
  }
  return NextResponse.json({ ok: true, oracle });
}
