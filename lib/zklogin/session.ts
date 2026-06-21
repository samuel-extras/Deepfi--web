"use client";

/**
 * zkLogin session core — framework-agnostic (no React). Auth via **Enoki's**
 * managed nonce + salt + prover (production params, our registered audience),
 * which is what makes raw client-side zkLogin work for a custom Google client on
 * testnet. Gas is still our self-hosted sponsor; the ephemeral key + signing are
 * still ours.
 *
 *   beginLogin   → ephemeral key + Enoki nonce(maxEpoch) → redirect to Google
 *   completeLogin→ (on callback) Enoki address + ZK proof → persist session
 *   zkSign*      → ephemeral-sign bytes + assemble the zkLogin signature
 *
 * Session (incl. the ephemeral secret) lives in sessionStorage — cleared on tab
 * close, valid only until `maxEpoch`. Acceptable for testnet.
 */
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import {
  getZkLoginSignature,
  type ZkLoginSignatureInputs,
} from "@mysten/sui/zklogin";
import { EnokiClient, type EnokiNetwork } from "@mysten/enoki";
import { getSuiClient } from "@/lib/sui/client";
import { SUI_NETWORK } from "@/lib/sui/network";
import {
  ENOKI_API_KEY,
  ZK_PENDING_KEY,
  ZK_PROVIDERS,
  ZK_SESSION_KEY,
  zkProviderEnabled,
  zkRedirectUrl,
  type ZkProvider,
} from "./config";

const NETWORK = SUI_NETWORK as EnokiNetwork;

let _enoki: EnokiClient | null = null;
function enoki(): EnokiClient {
  if (!ENOKI_API_KEY)
    throw new Error("Enoki is not configured (NEXT_PUBLIC_ENOKI_API_KEY)");
  if (!_enoki) _enoki = new EnokiClient({ apiKey: ENOKI_API_KEY });
  return _enoki;
}

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
  /** Full zkLogin inputs from Enoki (proofPoints + issBase64Details + headerBase64 + addressSeed). */
  zkProof: ZkLoginSignatureInputs;
}

/** Step 1 — mint an ephemeral key, get an Enoki nonce, redirect to Google. */
export async function beginLogin(providerId: ZkProvider): Promise<void> {
  const provider = ZK_PROVIDERS[providerId];
  if (!zkProviderEnabled(providerId)) {
    throw new Error(`${provider.label} is not configured`);
  }

  const ephemeral = new Ed25519Keypair();
  // Enoki generates the nonce + randomness + maxEpoch (and tracks the window).
  const { nonce, randomness, maxEpoch } = await enoki().createZkLoginNonce({
    network: NETWORK,
    ephemeralPublicKey: ephemeral.getPublicKey(),
  });

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
  // This redirect_uri must be registered EXACTLY in the Google OAuth client.
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

  const ephemeral = Ed25519Keypair.fromSecretKey(pending.ephemeralSecretKey);

  // Enoki: the user's address (its salt) + the ZK proof (full signature inputs).
  const { address } = await enoki().getZkLogin({ jwt: idToken });
  const zkProof = await enoki().createZkLoginZkp({
    network: NETWORK,
    jwt: idToken,
    ephemeralPublicKey: ephemeral.getPublicKey(),
    randomness: pending.randomness,
    maxEpoch: pending.maxEpoch,
  });

  const session: ZkSession = {
    provider: pending.provider,
    address,
    maxEpoch: pending.maxEpoch,
    ephemeralSecretKey: pending.ephemeralSecretKey,
    zkProof,
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
    inputs: session.zkProof,
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
    inputs: session.zkProof,
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
