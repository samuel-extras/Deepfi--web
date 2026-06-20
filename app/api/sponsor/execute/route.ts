import { NextRequest, NextResponse } from "next/server";
import { executeSponsored } from "@/lib/sui/sponsor";

export const runtime = "nodejs";

/**
 * Optional server-side submit. The client normally executes the sponsored tx
 * itself (it already holds both signatures), so this is a fallback.
 * POST { bytes, signatures: string[] } -> { ok, digest }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body?.bytes || !Array.isArray(body?.signatures)) {
      return NextResponse.json(
        { ok: false, error: "bytes + signatures[] required" },
        { status: 400 },
      );
    }
    const res = await executeSponsored({
      bytes: body.bytes,
      signatures: body.signatures,
    });
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
