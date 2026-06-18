import { NextRequest, NextResponse } from "next/server";
import { sponsorTransaction } from "@/lib/sui/enokiSponsor";

/** POST { transactionKindBytes, sender, allowedMoveCallTargets? } -> { bytes, digest } */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body?.transactionKindBytes || !body?.sender) {
      return NextResponse.json({ ok: false, error: "transactionKindBytes + sender required" }, { status: 400 });
    }
    const res = await sponsorTransaction({
      transactionKindBytes: body.transactionKindBytes,
      sender: body.sender,
      allowedMoveCallTargets: body.allowedMoveCallTargets,
      allowedAddresses: body.allowedAddresses,
    });
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
