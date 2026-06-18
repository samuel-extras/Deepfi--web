import { NextResponse } from "next/server";
import { buildCompetitionDetail, SEASON_ID } from "@/lib/competition/season";

export const dynamic = "force-dynamic";
export const revalidate = 15;

/** GET /api/competition/:id?owner=0x… — season detail + live leaderboard. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (id !== SEASON_ID) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const owner = new URL(req.url).searchParams.get("owner") ?? undefined;
  try {
    return NextResponse.json(await buildCompetitionDetail(owner));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
