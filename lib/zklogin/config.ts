/**
 * zkLogin (Google) — client-safe config. Raw Sui zkLogin, no Enoki.
 *
 * The flow runs CLIENT-SIDE (browser ↔ Google ↔ Mysten prover), like the
 * polymedia demo, so the Next server never reaches googleapis — which is what
 * broke the earlier server-side salt route behind a proxy. The only server
 * piece is the salt route, and it makes no external calls (see its source).
 */
export type ZkProvider = "google";

export interface OidcProvider {
  id: ZkProvider;
  label: string;
  clientId: string;
  authUrl: string;
  issuer: string;
  scopes: string[];
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export const ZK_PROVIDERS: Record<ZkProvider, OidcProvider> = {
  google: {
    id: "google",
    label: "Sign in with Google",
    clientId: GOOGLE_CLIENT_ID,
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    issuer: "https://accounts.google.com",
    scopes: ["openid", "email"],
  },
};

/** A provider is usable only once its client id is configured. */
export function zkProviderEnabled(id: ZkProvider): boolean {
  return Boolean(ZK_PROVIDERS[id]?.clientId);
}

export function anyZkProviderEnabled(): boolean {
  return (Object.keys(ZK_PROVIDERS) as ZkProvider[]).some(zkProviderEnabled);
}

/**
 * Redirect URL Google sends the id_token back to. Must be registered in the
 * OAuth client. Pin via env (stable across environments); else derive from origin.
 */
export function zkRedirectUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_ZKLOGIN_REDIRECT_URL;
  if (explicit) return explicit;
  if (typeof window !== "undefined")
    return `${window.location.origin}/auth/callback`;
  return "/auth/callback";
}

/** Ephemeral key validity window, in epochs, from the current epoch. */
export const ZK_MAX_EPOCH_GAP = 2;

/** Which JWT claim names the zkLogin address (sub is stable per user/app). */
export const ZK_KEY_CLAIM = "sub" as const;

/**
 * Mysten Labs' public ZK proving service — called CLIENT-SIDE (the browser
 * reaches it fine; this avoids any server-side / proxy networking). Override
 * with NEXT_PUBLIC_ZKLOGIN_PROVER_URL to self-host.
 */
export const ZK_PROVER_URL =
  process.env.NEXT_PUBLIC_ZKLOGIN_PROVER_URL ??
  "https://prover-dev.mystenlabs.com/v1";

/** Salt endpoint (server-side HMAC; makes no external calls). */
export const ZK_SALT_ENDPOINT = "/api/zklogin/salt";

/** sessionStorage keys for the pre-redirect state and the established session. */
export const ZK_PENDING_KEY = "deepfi:zk:pending";
export const ZK_SESSION_KEY = "deepfi:zk:session";
