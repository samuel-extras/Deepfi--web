# zkLogin (Google) + Gas Sponsorship — raw Sui zkLogin, no Enoki

Sign in with Google → a real Sui **zkLogin** address. The flow runs **client-side**
(browser ↔ Google ↔ Mysten prover), like the polymedia zklogin demo, so the Next
server never makes outbound auth calls — which is what broke the earlier
server-side approach behind a proxy ([[deepfi-web-proxy-fetch]]). Every on-chain
action is **sponsored** (our funded keypair pays gas) and zkLogin-signed by an
in-app ephemeral key, so there's no wallet popup and users never need SUI.

## Setup

1. Copy `.env.example` → `.env.local` and fill:
   - `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — Google OAuth **Web** client. Register redirect URIs
     `http://localhost:3140/auth/callback` (+ `<prod>/auth/callback`) and matching JS origins.
   - `ZKLOGIN_SALT_SECRET` — random 32+ bytes (`openssl rand -hex 32`). SERVER ONLY.
   - `NEXT_PUBLIC_ZKLOGIN_PROVER_URL` — network-matched Mysten prover (testnet/mainnet
     `prover.mystenlabs.com`, devnet `prover-dev`). Mismatch → on-chain "Groth16 proof verify failed".
   - `SPONSOR_PRIVATE_KEY` — a **funded testnet** keypair (`suiprivkey…`).
2. Until `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set, the Google button shows a hint;
   a normal wallet (Slush) keeps working.

## How it works

| File | Role |
|------|------|
| `config.ts` | Client-safe config: Google client id, redirect URL, client-side prover URL. |
| `session.ts` | The flow: `beginLogin` (ephemeral key + nonce → OAuth redirect), `completeLogin` (salt → address → **client-side** proof), `zkSign*`. Session in `sessionStorage`. |
| `sponsoredTx.ts` | The single sponsored-write: build `onlyTransactionKind` → `/api/sponsor/create` → zkLogin-sign → execute. |
| `useSponsoredExecute.ts` | Drop-in `useSignAndExecuteTransaction`: sponsors when the zkLogin session is active, else delegates to dapp-kit. Write hooks import this. |
| `../../stores/useZkLoginStore.ts` | Reactive mirror of the session (source of truth for the zkLogin identity). |
| `../../providers/ZkLoginRegistrar.tsx` | Re-hydrates the session on load (mounted in `SuiProvider`). |
| `../../providers/SuiAuthBridge.tsx` | Feeds the zkLogin address into the app auth store (prefers it over a dapp-kit wallet). |
| `../../app/auth/callback/page.tsx` | Reads `#id_token`, completes login, returns to the app. |

Servers: `app/api/zklogin/salt` (HMAC-derives the salt from the JWT's claims —
**no external calls**, decodes rather than verifies; the prover is the real JWT
gatekeeper) and `app/api/sponsor/create` (`lib/sui/sponsor.ts`, signs gas with
`SPONSOR_PRIVATE_KEY`, allowlists the app's Move packages, caps the budget).

## Notes
- **Why client-side prover + decode-only salt:** both avoid any server→external
  fetch, so it works behind a proxy. For production (no proxy) you can re-add
  `jose` JWT signature verification in the salt route.
- **More providers** — `config.ts` is provider-shaped; add Twitch/Facebook + their
  redirect URIs to enable.
