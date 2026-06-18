import { NextResponse } from "next/server";
import { buildCompetitionList } from "@/lib/competition/season";

export const dynamic = "force-dynamic";
export const revalidate = 30;

/** GET /api/competition — the live Predict trading season(s). */
export async function GET() {
  try {
    return NextResponse.json(await buildCompetitionList());
  } catch (e) {
    return NextResponse.json([], { status: 200, headers: { "x-error": String(e).slice(0, 120) } });
  }
}
