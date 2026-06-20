import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { decodeJwt } from "@mysten/sui/zklogin";

export const runtime = "nodejs";

/**
 * Derive a user's zkLogin salt — deterministically, no DB, no network.
 *
 *   salt = HMAC_SHA256(ZKLOGIN_SALT_SECRET, "iss|aud|sub")  (first 16 bytes, < 2^128)
 *
 * NOTE: we DECODE the JWT (claims only) rather than verifying its signature.
 * Verifying would need Google's JWKS from googleapis.com, which isn't reachable
 * from the server behind some proxies — and it isn't required here: the Mysten
 * prover (called client-side) cryptographically verifies the JWT, and leaking a
 * salt only lets someone compute a *public* address, never move funds. Good for
 * testnet. For production (no proxy), re-add `jose` signature verification.
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
