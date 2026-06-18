# zkLogin setup (Google, email, Apple)

DeepFi uses **zkLogin** so users sign in with a social account and get a real Sui
address — no seed phrase. Three providers are targeted:

| Provider | Path | Status |
|----------|------|--------|
| **Google** | Mysten **Enoki** (one-click button in the navbar) | scaffolded — needs creds |
| **Email** | **Slush** wallet (email zkLogin), shown in the Connect modal | works today |
| **Apple** | **Raw zkLogin** (Enoki doesn't support Apple) | planned (see below) |

The app runs fine with no credentials — the Google button simply doesn't render
until the env vars are set. Slush (email) works regardless.

## 1. Google via Enoki (recommended)

1. Create an Enoki app: <https://portal.enoki.mystenlabs.com> → new app → **Testnet**.
2. Create a Google OAuth **Web** client: <https://console.cloud.google.com/apis/credentials>
   - Authorized redirect URI: `http://localhost:3000/auth/callback`
     (and your deployed origin + `/auth/callback`).
3. In the Enoki portal, enable the **Google** auth provider and paste the Google client id.
4. Copy the Enoki **public** API key.
5. Put them in `.env.local`:

   ```bash
   NEXT_PUBLIC_ENOKI_API_KEY=enoki_public_...
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
   ```

6. Restart `bun run dev`. A **Continue with Google** button appears in the navbar;
   clicking it runs the full zkLogin flow and returns a Sui address.

Wiring lives in: `lib/enoki.ts`, `components/wallet/register-enoki.tsx`,
`components/wallet/connect-wallet.tsx`, `app/auth/callback/page.tsx`.

## 2. Email (Slush) — already on

Slush supports email-based zkLogin. It shows up automatically in the **Connect**
modal (dapp-kit wallet standard). Nothing to configure.

## 3. Apple via raw zkLogin (planned)

Enoki's managed providers are `google | facebook | twitch` only. Apple requires
the raw zkLogin flow:

1. Apple **Sign in with Apple** service id + key.
2. A salt service (per-user salt) and the Mysten zkLogin **prover**
   (testnet prover endpoint).
3. Nonce → Apple authorize → `id_token` → prover `zkp` → assemble zkLogin signature.

Set `NEXT_PUBLIC_APPLE_CLIENT_ID` and implement the prover/salt calls. This is a
separate task from the Enoki path; ask to have it built out.
