import { NextRequest, NextResponse } from "next/server";
import { createSponsored } from "@/lib/sui/sponsor";

export const runtime = "nodejs";

/** POST { transactionKindBytes, sender } -> { ok, bytes, sponsorSignature, sponsor } */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body?.transactionKindBytes || !body?.sender) {
      return NextResponse.json(
        { ok: false, error: "transactionKindBytes + sender required" },
        { status: 400 },
      );
    }
    const res = await createSponsored({
      transactionKindBytes: body.transactionKindBytes,
      sender: body.sender,
    });
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
