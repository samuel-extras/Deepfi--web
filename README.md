# DeepFi — Full-Stack Finance on DeepBook Predict

A trading terminal for **DeepBook Predict** on Sui testnet: vol-surface-priced
range & binary prediction markets, a three-protocol atomic PTB, a PLP vault with
a real backtest, social copy-trading, and a leaderboard — in one app.

Built for the DeepBook Predict track (`predict-testnet-4-16`).

---

## Qualification checklist

| Requirement | Where |
|---|---|
| **Integrate DeepBook Predict on testnet** | Real `create_manager` / `deposit` / `mint` / `mint_range` / `redeem*` / `supply` / `withdraw` PTBs against the live testnet deployment (`lib/ptb/predict.ts`, `lib/deepbook.ts`), data from `predict-server.testnet.mystenlabs.com` |
| **Work end to end** | Connect Slush wallet → mint a range or binary on a live BTC oracle → see it in Portfolio → redeem → withdraw to wallet. Every screen listed below is live |
| **Composability: one PTB across protocols** | `/prediction/combo` executes **DeepBook Margin + DeepBook Predict + PLP vault in a single atomic transaction**, with a Pyth price refresh prepended (details below) |
| **Simulation result for vault strategies** | `/prediction/vault` → "Strategy Backtest": 5,000 real BTC 15m candles through three strategies with Sharpe / max-drawdown / win-rate and a methodology disclosure |

## The flagship: a three-protocol atomic PTB

One signature executes, atomically (any leg fails → everything reverts):

```
┌─ Leg 0  Pyth oracle      refresh SUI + DBUSDC price feeds (Hermes VAA → Wormhole verify → update)
├─ Leg 1  DeepBook Margin  new_with_initializer → deposit SUI collateral → share MarginManager
├─ Leg 2  PLP vault (opt)  supply dUSDC → PLP tokens to sender
└─ Leg 3  DeepBook Predict deposit dUSDC → mint_range on a live BTC oracle
```

**Why Leg 0 exists (and why it was hard):** `margin_manager::deposit` aborts on
`pyth::check_price_is_fresh` (~60s staleness window), and nobody keeps Sui
testnet's Pyth feeds fresh — they were ~67 minutes stale when we measured. The
official `@pythnetwork/pyth-sui-js` SDK targets `@mysten/sui` v1 and is
incompatible with this app's v2, so we **hand-rolled the full update flow**
(fetch the accumulator message from `hermes-beta`, extract the VAA,
`wormhole::vaa::parse_and_verify`, `pyth::create_authenticated_price_infos_using_accumulator`,
`update_single_price_feed` per feed, destroy the hot potato) on v2, verifying
every function signature against the deployed on-chain ABI
(`sui_getNormalizedMoveModule`). See `lib/ptb/pyth.ts`.

The combo hook **simulates the whole PTB via `devInspect` before requesting a
signature**, so a would-be revert surfaces as a readable error (stale feed, low
collateral, insufficient dUSDC) instead of a failed transaction.

## Vault backtest (real data, honest methodology)

5,000 real BTC 15m candles (~52 days, bundled for reproducibility) replayed
through three strategies. Ranges/binaries are priced **empirically off the
trailing return distribution** (captures BTC's fat tails — no Black-Scholes
mispricing artifact), fixed-notional sizing (no compounding distortion), Sharpe
annualized from daily returns.

| Strategy | Return (52d) | Sharpe | Max DD | Win |
|---|---|---|---|---|
| Range Ladder (buyer) | −100% | −2.2 | 100% | 50% |
| PLP Supply (short strangle) | +11.4% | 0.40 | 43% | 53% |
| **PLP + Hedge** (PLP + OTM crash binary) | **+24.2%** | **1.06** | **33%** | 53% |

The takeaway judges can verify on `/prediction/vault`: buying ranges bleeds the
vault spread; supplying liquidity earns it; and the crash hedge roughly doubles
return while cutting max drawdown — "PLP yield minus crash insurance."
Full assumptions are disclosed in the Methodology box (idealized fills, no
adverse selection; the sample window was a BTC downtrend).

## Screens

| Route | What |
|---|---|
| `/prediction` | Live BTC oracles, SVI smile chart, range + binary mint, range-ladder panel, live trade feed with **Mirror** (pre-fills your trade from someone else's via URL params) |
| `/prediction/combo` | The three-protocol Combo PTB screen |
| `/prediction/portfolio` | Unified positions (binary + range), redeem settled, withdraw manager balance to wallet |
| `/prediction/vault` | PLP supply/withdraw + the strategy backtest |
| `/prediction/top-traders` | Leaderboard from indexer events |
| `/social` | Copy-trading feed |

Plus a "Demo Mode" button (when bot wallets are configured) that makes funded
bot wallets place small **real** trades so the feed is never empty — see
`scripts/demo-bots.md`.

## Running it

```bash
bun install        # or npm install
bun run dev        # next dev --turbopack, http://localhost:3000
```

You'll need testnet funds to trade:
- **SUI** — gas + margin collateral: `sui client faucet`
- **dUSDC** — Predict's quote asset (NOT official testnet USDC): request via
  https://tally.so/r/Xx102L

Optional env (`.env.local`):

```bash
DEMO_BOT_KEYS=suiprivkey1...,suiprivkey1...   # enables /api/demo + the Demo Mode button
DEMO_BOT_TRADE_DUSDC=1
DEMO_TICK_SECRET=...                          # protects POST /api/demo
```

### Scripts

| Script | What |
|---|---|
| `node scripts/combo-execute.mjs` | Executes one real three-protocol Combo PTB from the CLI (key via `COMBO_KEY` env, never leaves your machine). Dry-runs first, prints digest + explorer links |
| `node scripts/margin_dryrun.mjs` | devInspect proof that the Pyth-refresh + margin deposit sequence passes on testnet |
| `node scripts/demo-bots.mjs` | Scheduler that ticks `/api/demo` so bots trade on an interval |

## Architecture

```
lib/deepbook.ts        every package/object ID + Move target (predict, margin, Pyth/Wormhole)
                       — all verified against the deployed on-chain ABI, not docs
lib/ptb/predict.ts     Predict PTB builders (manager, mint, mint_range, redeem, supply, withdraw)
lib/ptb/comboTrade.ts  buildMarginPredictTx — the three-protocol atomic PTB
lib/ptb/pyth.ts        hand-rolled Pyth price refresh on @mysten/sui v2
lib/indexer.ts         predict-server REST wrapper (oracles, SVI, positions, ranges, managers)
lib/simulation/        backtest engine + bundled real BTC candles
lib/demoBots.ts        server-side bot wallets (same PTB builders as the user flow)
hooks/useComboPTB.ts   combo execution: ensure manager → price via devInspect → simulate → sign
app/api/*              oracles, svi, portfolio, feed, leaderboard, simulation, demo
```

Key on-chain IDs (Sui **testnet**):

| | |
|---|---|
| Predict package | `0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138` |
| Predict (shared) | `0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a` |
| deepbook_margin package | `0xd6a42f4df4db73d68cbeb52be66698d2fe6a9464f45ad113ca52b0c6ebd918b6` |
| MarginRegistry | `0x48d7640dfae2c6e9ceeada197a7a1643984b5a24c55a0c6c023dac77e0339f75` |
| Pyth state | `0x243759059f4c3111179da5878c12f68d612c21a8d54d85edc86164bb18be1c7c` |
| Indexer | `https://predict-server.testnet.mystenlabs.com` |

## Honest limitations

- The combo PTB is **proven via full testnet simulation** (`devInspect` executes
  the identical Move logic, including Wormhole VAA verification and the margin
  deposit); landing it live just needs a funded wallet + one signature
  (`scripts/combo-execute.mjs` or the UI).
- Backtest figures are indicative (idealized fills, no adverse selection), with
  all assumptions disclosed in-app.
- Testnet only. Not financial advice.
