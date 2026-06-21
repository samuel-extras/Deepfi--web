import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { decodeJwt } from "@mysten/sui/zklogin";

export const runtime = "nodejs";

/**
 * Derive a user's zkLogin salt — deterministically, no DB, no network.
 *
 *   salt = HMAC_SHA256(ZKLOGIN_SALT_SECRET, "iss|aud|sub")  (first 16 bytes, < 2^128)
 *
 * NOTE: web auth now uses Enoki (Enoki manages the salt) and no longer calls
 * this. It's kept for the **deepfi-mobile relay**: mobile signs in through this
 * web OAuth client (see app/auth/callback) and derives its salt here. Decodes
 * the JWT rather than verifying it (no googleapis fetch); fine for testnet.
 */
export async function POST(req: NextRequest) {
  try {
    const secret = process.env.ZKLOGIN_SALT_SECRET;
    if (!secret) {
      return NextResponse.json(
        { ok: false, error: "ZKLOGIN_SALT_SECRET is not set" },
        { status: 500 },
      );
    }
    const { jwt } = await req.json();
    if (!jwt || typeof jwt !== "string") {
      return NextResponse.json(
        { ok: false, error: "jwt required" },
        { status: 400 },
      );
    }

    const payload = decodeJwt(jwt);
    if (!payload.sub || !payload.aud) {
      return NextResponse.json(
        { ok: false, error: "jwt missing sub/aud" },
        { status: 400 },
      );
    }
    const aud = Array.isArray(payload.aud) ? payload.aud[0] : payload.aud;

    const mac = createHmac("sha256", secret)
      .update(`${payload.iss}|${aud}|${payload.sub}`)
      .digest();
    const salt = BigInt("0x" + mac.subarray(0, 16).toString("hex")).toString();

    return NextResponse.json({ ok: true, salt });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: `salt: ${String(e)}` },
      { status: 400 },
    );
  }
}
