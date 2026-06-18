import { NextRequest, NextResponse } from "next/server";
import { executeSponsoredTransaction } from "@/lib/sui/enokiSponsor";

/** POST { digest, signature } -> { digest } */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body?.digest || !body?.signature) {
      return NextResponse.json({ ok: false, error: "digest + signature required" }, { status: 400 });
    }
    const res = await executeSponsoredTransaction({ digest: body.digest, signature: body.signature });
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
