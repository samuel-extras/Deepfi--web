/**
 * zkLogin (Google) config — client-safe (NEXT_PUBLIC only).
 *
 * Auth runs client-side via **Enoki's managed nonce + salt + prover**
 * (api.enoki.mystenlabs.com). Enoki uses testnet/mainnet proving params and
 * proves for OUR registered audience — which Mysten's public provers can't do
 * for a custom Google client (dev prover = devnet params → Groth16 fail; prod
 * prover = audience allowlist). Gas is still paid by our self-hosted sponsor.
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

/**
 * Public Enoki API key (`enoki_public_…`). In the Enoki portal, the app behind
 * this key MUST register the Google client id as an auth provider AND the app
 * origin (http://localhost:3140) as an allowed origin — else the proof step 400s
 * with "audience … not supported".
 */
export const ENOKI_API_KEY = process.env.NEXT_PUBLIC_ENOKI_API_KEY ?? "";

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

/** Usable only once BOTH the OAuth client id and the Enoki key are configured. */
export function zkProviderEnabled(id: ZkProvider): boolean {
  return Boolean(ZK_PROVIDERS[id]?.clientId && ENOKI_API_KEY);
}

export function anyZkProviderEnabled(): boolean {
  return (Object.keys(ZK_PROVIDERS) as ZkProvider[]).some(zkProviderEnabled);
}

/**
 * Redirect URL Google sends the id_token back to. Must be registered in the
 * OAuth client. Pin via env; else derive from the current origin in the browser.
 */
export function zkRedirectUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_ZKLOGIN_REDIRECT_URL;
  if (explicit) return explicit;
  if (typeof window !== "undefined")
    return `${window.location.origin}/auth/callback`;
  return "/auth/callback";
}

/** sessionStorage keys for the pre-redirect state and the established session. */
export const ZK_PENDING_KEY = "deepfi:zk:pending";
export const ZK_SESSION_KEY = "deepfi:zk:session";
