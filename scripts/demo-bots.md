# Demo-mode bot wallets

Keeps the live Predict feed populated by having a few pre-funded testnet wallets
place small, **real** binary trades on a schedule. The trades use the same PTB
builders as the user flow, so they appear in the real indexer feed like any
organic trade.

## 1. Create + fund bot wallets

Generate a few keypairs (e.g. with the Sui CLI: `sui client new-address ed25519`),
then fund **each** address with:

- **SUI** — for gas (testnet faucet: `sui client faucet` or the web faucet)
- **dUSDC** — for trading, via the form: https://tally.so/r/Xx102L
  (dUSDC is **not** the official testnet USDC and can't be auto-faucted)

Export each wallet's secret key (`suiprivkey1…` bech32 form):
`sui keytool export --key-identity <address>`.

## 2. Configure the app

Set env vars for the Next app (e.g. in `.env.local`):

```bash
# comma-separated suiprivkey… secret keys
DEMO_BOT_KEYS=suiprivkey1aaaa...,suiprivkey1bbbb...,suiprivkey1cccc...

# optional: dUSDC per trade (default 1)
DEMO_BOT_TRADE_DUSDC=1

# optional: shared secret to protect POST /api/demo
DEMO_TICK_SECRET=some-long-random-string
```

Restart the app so it picks up the env. Verify:

```bash
curl http://localhost:3000/api/demo   # { enabled: true, bots: [{ address, suiBalance, dusdcBalance, hasManager }] }
```

## 3. Run the scheduler

```bash
DEMO_TICK_URL=http://localhost:3000/api/demo \
DEMO_TICK_SECRET=some-long-random-string \
DEMO_TICK_INTERVAL_MIN=5 \
node scripts/demo-bots.mjs
```

Each tick, every funded bot places one small binary trade on the soonest live
BTC oracle. Bots with no dUSDC are skipped with a clear message. You can also
trigger a single tick from the UI ("Demo Mode" button on the Prediction page) or
with a one-off `curl -X POST`.

## Notes

- Trades are real and on-chain — keep `DEMO_BOT_TRADE_DUSDC` small.
- The endpoint is testnet-only and safe to leave gated behind `DEMO_TICK_SECRET`.
- To stop, kill the scheduler process; the bots hold no open automation otherwise.
