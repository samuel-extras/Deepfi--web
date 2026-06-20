"use client";

/**
 * zkLogin session core — framework-agnostic (no React). Raw Sui zkLogin, no Enoki.
 *
 *   beginLogin   → ephemeral key + nonce(maxEpoch) → redirect to Google
 *   completeLogin→ (on callback) salt → address → ZK proof → persist session
 *   zkSign*      → ephemeral-sign bytes + assemble the zkLogin signature
 *
 * The proof is fetched CLIENT-SIDE straight from the Mysten prover (like the
 * polymedia demo); only the salt comes from our server route (no external calls).
 * Session (incl. the ephemeral secret) lives in sessionStorage — cleared on tab
 * close, valid only until `maxEpoch`. Acceptable for testnet.
 */
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import {
  decodeJwt,
  genAddressSeed,
  generateNonce,
  generateRandomness,
  getExtendedEphemeralPublicKey,
  getZkLoginSignature,
  jwtToAddress,
  type ZkLoginSignatureInputs,
} from "@mysten/sui/zklogin";
import { getSuiClient } from "@/lib/sui/client";
import {
  ZK_KEY_CLAIM,
  ZK_MAX_EPOCH_GAP,
  ZK_PENDING_KEY,
  ZK_PROVER_URL,
  ZK_PROVIDERS,
  ZK_SALT_ENDPOINT,
  ZK_SESSION_KEY,
  zkProviderEnabled,
  zkRedirectUrl,
  type ZkProvider,
} from "./config";

/** The prover's output — the zkLogin inputs minus the locally-computed seed. */
type ZkProof = Omit<ZkLoginSignatureInputs, "addressSeed">;

interface PendingState {
  provider: ZkProvider;
  maxEpoch: number;
  randomness: string;
  ephemeralSecretKey: string; // suiprivkey… (bech32)
}

export interface ZkSession {
  provider: ZkProvider;
  address: string;
  maxEpoch: number;
  ephemeralSecretKey: string;
  zkProof: ZkProof;
  addressSeed: string;
  sub: string;
  aud: string;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let json: { ok?: boolean; error?: string } & Record<string, unknown>;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      `${url} returned non-JSON (HTTP ${r.status}): ${text.slice(0, 120)}`,
    );
  }
  if (!r.ok || json?.ok === false) {
    throw new Error(json?.error ?? `${url} failed (HTTP ${r.status})`);
  }
  return json as T;
}

/** Step 1 — mint an ephemeral key, stash pre-redirect state, redirect to Google. */
export async function beginLogin(providerId: ZkProvider): Promise<void> {
  const provider = ZK_PROVIDERS[providerId];
  if (!zkProviderEnabled(providerId)) {
    throw new Error(`${provider.label} is not configured`);
  }
  let epoch: string;
  try {
    ({ epoch } = await getSuiClient().getLatestSuiSystemState());
  } catch (e) {
    throw new Error(
      `Couldn't reach the Sui RPC to start sign-in: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  }
  const maxEpoch = Number(epoch) + ZK_MAX_EPOCH_GAP;

  const ephemeral = new Ed25519Keypair();
  const randomness = generateRandomness();
  const nonce = generateNonce(ephemeral.getPublicKey(), maxEpoch, randomness);

  const pending: PendingState = {
    provider: providerId,
    maxEpoch,
    randomness,
    ephemeralSecretKey: ephemeral.getSecretKey(),
  };
  sessionStorage.setItem(ZK_PENDING_KEY, JSON.stringify(pending));

  const redirectUri = zkRedirectUrl();
  const params = new URLSearchParams({
    client_id: provider.clientId,
    redirect_uri: redirectUri,
    response_type: "id_token",
    scope: provider.scopes.join(" "),
    nonce,
  });
  // redirect_uri must be registered EXACTLY in the Google OAuth client.
  console.info(
    `[zkLogin] redirect_uri = "${redirectUri}"  ·  client_id = "${provider.clientId}"`,
  );
  window.location.href = `${provider.authUrl}?${params.toString()}`;
}

/** Step 2 — on the callback, turn the id_token into a usable zkLogin session. */
export async function completeLogin(idToken: string): Promise<ZkSession> {
  const raw = sessionStorage.getItem(ZK_PENDING_KEY);
  if (!raw) throw new Error("No pending zkLogin — start the sign-in again");
  const pending = JSON.parse(raw) as PendingState;

  const decoded = decodeJwt(idToken);
  if (!decoded.sub || !decoded.aud) throw new Error("Invalid id_token");
  const aud = Array.isArray(decoded.aud) ? decoded.aud[0] : decoded.aud;

  // salt (server, HMAC, no external calls) → address
  const { salt } = await postJson<{ salt: string }>(ZK_SALT_ENDPOINT, {
    jwt: idToken,
  });
  const address = jwtToAddress(idToken, salt, false);

  // ZK proof — straight from the Mysten prover, client-side (like the demo)
  const ephemeral = Ed25519Keypair.fromSecretKey(pending.ephemeralSecretKey);
  const extendedEphemeralPublicKey = getExtendedEphemeralPublicKey(
    ephemeral.getPublicKey(),
  );
  const zkProof = await postJson<ZkProof>(ZK_PROVER_URL, {
    jwt: idToken,
    extendedEphemeralPublicKey,
    maxEpoch: pending.maxEpoch,
    jwtRandomness: pending.randomness,
    salt,
    keyClaimName: ZK_KEY_CLAIM,
  });

  const addressSeed = genAddressSeed(
    BigInt(salt),
    ZK_KEY_CLAIM,
    decoded.sub,
    aud,
  ).toString();

  const session: ZkSession = {
    provider: pending.provider,
    address,
    maxEpoch: pending.maxEpoch,
    ephemeralSecretKey: pending.ephemeralSecretKey,
    zkProof,
    addressSeed,
    sub: decoded.sub,
    aud,
  };
  sessionStorage.setItem(ZK_SESSION_KEY, JSON.stringify(session));
  sessionStorage.removeItem(ZK_PENDING_KEY);
  return session;
}

/** Assemble a zkLogin signature over already-built transaction bytes. */
export async function zkSignTransaction(
  session: ZkSession,
  bytes: Uint8Array,
): Promise<string> {
  const ephemeral = Ed25519Keypair.fromSecretKey(session.ephemeralSecretKey);
  const { signature: userSignature } = await ephemeral.signTransaction(bytes);
  return getZkLoginSignature({
    inputs: { ...session.zkProof, addressSeed: session.addressSeed },
    maxEpoch: session.maxEpoch,
    userSignature,
  });
}

/** Assemble a zkLogin signature over a personal message. */
export async function zkSignPersonalMessage(
  session: ZkSession,
  message: Uint8Array,
): Promise<string> {
  const ephemeral = Ed25519Keypair.fromSecretKey(session.ephemeralSecretKey);
  const { signature: userSignature } =
    await ephemeral.signPersonalMessage(message);
  return getZkLoginSignature({
    inputs: { ...session.zkProof, addressSeed: session.addressSeed },
    maxEpoch: session.maxEpoch,
    userSignature,
  });
}

export function getSession(): ZkSession | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(ZK_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ZkSession;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(ZK_SESSION_KEY);
  sessionStorage.removeItem(ZK_PENDING_KEY);
}

/** True if the session's ephemeral key hasn't expired (epoch ≤ maxEpoch). */
export async function isSessionLive(session: ZkSession): Promise<boolean> {
  try {
    const { epoch } = await getSuiClient().getLatestSuiSystemState();
    return Number(epoch) <= session.maxEpoch;
  } catch {
    return true; // network hiccup — don't nuke the session
  }
}
