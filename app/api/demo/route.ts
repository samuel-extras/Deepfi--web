import { NextRequest, NextResponse } from "next/server";
import {
  demoBotsEnabled,
  getBotStatuses,
  runDemoBotTick,
} from "@/lib/demoBots";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // bots trade sequentially; allow headroom

/**
 * GET  /api/demo            → { enabled, bots: [{ address, suiBalance, dusdcBalance, hasManager }] }
 * POST /api/demo            → run one trade tick; returns per-bot results
 *
 * POST is gated by DEMO_TICK_SECRET when set: pass ?secret=… or
 * `x-demo-secret` header. Bots are configured via DEMO_BOT_KEYS (comma-separated
 * suiprivkey… secret keys) — see scripts/demo-bots.md.
 */
export async function GET() {
  if (!demoBotsEnabled()) {
    return NextResponse.json({ enabled: false, bots: [] });
  }
  try {
    const bots = await getBotStatuses();
    return NextResponse.json({ enabled: true, bots });
  } catch (e) {
    return NextResponse.json(
      { enabled: true, bots: [], error: String(e) },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  if (!demoBotsEnabled()) {
    return NextResponse.json(
      { ok: false, error: "Demo bots not configured (set DEMO_BOT_KEYS)" },
      { status: 400 },
    );
  }

  const secret = process.env.DEMO_TICK_SECRET;
  if (secret) {
    const provided =
      req.nextUrl.searchParams.get("secret") ?? req.headers.get("x-demo-secret");
    if (provided !== secret) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const results = await runDemoBotTick();
    const traded = results.filter(r => r.ok).length;
    return NextResponse.json({ ok: true, traded, total: results.length, results });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
