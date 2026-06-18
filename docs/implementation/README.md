# DeepFi — Implementation Docs

Living specs for finishing the six **partially-implemented** idea-bank items. We
pick one at a time, implement it, and update its doc (check boxes + Progress log
+ Status) as we go.

> Created 2026-06-18. These docs are the source of truth for scope/status — keep
> them current as code lands.

## How to use
1. Pick the next item (see **Build order**).
2. Flip its **Status** to `🟡 In progress` and work the **Task checklist**.
3. Tick boxes as they land; append to the **Progress log** with what changed + file refs.
4. When all acceptance criteria pass, set **Status** to `✅ Done`.

## Status legend
`⬜ Not started` · `🟡 In progress` · `✅ Done` · `⛔ Blocked`

## The six (status)
| # | Idea | Doc | Status | Effort | Needs |
|---|------|-----|--------|--------|-------|
| 1 | Range Ladder Vault | [01](01-range-ladder-vault.md) | ⬜ | XL | 🦀 Move deploy · 🤖 keeper |
| 2 | PLP + Hedge Vault | [02](02-plp-hedge-vault.md) | ✅ L1 · 🟡 L2 | M / XL | 🦀 (pooled only) |
| 4 | Three-Protocol Margin Loop | [04](04-three-protocol-margin-loop.md) | ⬜ | XL | mainnet (iron_bank) |
| 6 | Streaks & Leaderboard PWA | [06](06-streaks-leaderboard-pwa.md) | ⬜ | M–L | 🗄️ off-chain backend |
| 9 | Predict Surface Studio | [09](09-predict-surface-studio.md) | ✅ | L | — (data exists) |
| 10 | PLP Risk Dashboard | [10](10-plp-risk-dashboard.md) | ✅ | M–L | — (data exists) |

Effort: **S** <½d · **M** 1–2d · **L** 3–5d · **XL** >1w.

## Build order (most value per effort first)
1. **#9 Surface Studio** + **#10 Risk Dashboard** — fully unblocked, no Move, data verified live.
2. **#2 Level-1 hedged-PLP** — turns the backtested hedge into a live one-click product (no Move).
3. **#6 Streaks + PWA** — once the off-chain backend is enabled.
4. **#1 Ladder Vault** (Move) and **#4 Margin Loop** (mainnet) — the heavy, high-reward finale.

---

## Shared verified facts (the protocol surface)
Confirmed this session against the **live on-chain ABI** (`sui_getNormalizedMoveModule`)
and the **predict-server indexer** — cite these instead of re-discovering.

### On-chain (testnet, `SUI_NETWORK = "testnet"`) — see [lib/deepbook.ts](../../lib/deepbook.ts)
- **Predict package** `0xf5ea2b37…785138` — these are all **Public** (composable from a custom Move pkg):
  `predict::{mint, mint_range, supply, withdraw, redeem, redeem_range, redeem_permissionless, get_trade_amounts, get_range_trade_amounts, create_manager}`, `predict_manager::{deposit, withdraw}`.
- ⚠️ `predict_manager::new` is **Friend** and **`PredictManager` has only the `key` ability** (no `store`). A custom vault therefore **cannot wrap a manager inside its own struct** — it must `predict::create_manager` then **own it via object-ownership + `transfer::Receiving`**. Vault shares = a normal Sui `Coin`.
- **Margin package** `0xd6a42f4d…918b6` — all **Public**: `margin_manager::{new_with_initializer, deposit, withdraw, borrow_base, borrow_quote, repay_base, repay_quote, liquidate, share}`.
- **Asset split:** Predict quote = **dUSDC** (`…ba73e1a::dusdc::DUSDC`). DeepBook spot/margin quote = **DBUSDC** (different coin). There is **no DBUSDC↔dUSDC pool** on testnet.
- **iron_bank** (USDsui supply) is **mainnet-only** (per [DeepBookPredictProblemStatement.md](../../DeepBookPredictProblemStatement.md)).
- Pyth margin deposits need a fresh price push (testnet feeds aren't keeper-kept) — see [lib/ptb/pyth.ts](../../lib/ptb/pyth.ts), already handled in [useComboPTB.ts](../../hooks/useComboPTB.ts).

### Indexer — `https://predict-server.testnet.mystenlabs.com`, see [lib/indexer.ts](../../lib/indexer.ts)
- `GET /oracles/:id/svi` → **full SVI history list** (`?limit=` supported). `…/svi/latest` → latest only.
- `GET /oracles/:id/prices?limit=` → spot tape history. `…/prices/latest` → latest.
- `GET /predicts/:id/vault/summary` → TVL, share price, **utilization**, `available_withdrawal`, `max_payout_utilization`, `plp_total_supply`, etc. `…/vault/performance` → PLP share-price history.
- `GET /positions/{minted,redeemed}`, `/ranges/{minted,redeemed}`, `/managers`, `/managers/:id/{summary,positions/summary,ranges,pnl}`.

### Off-chain DEX backend (for social/gamification) — env-gated
- Privy auth (`usePrivy`) + `dexBackendApi` + `EventType`; `useDailyActiveTracking` already logs daily-active events. Gated by `NEXT_PUBLIC_DEX_API_BASE_URL` (unset in dev → social features no-op). Powers competitions/leaderboard/streaks/payouts/referrals.

### Math / data we already have
- SVI: [lib/svi.ts](../../lib/svi.ts) (`normalizeRawSvi`, `ivFromRawSvi`, `probInRange`, `buildSmileFromRaw`).
- Backtester: [lib/simulation/backtest.ts](../../lib/simulation/backtest.ts) (Range Ladder, PLP, PLP+Hedge) + [pricing.ts](../../lib/simulation/pricing.ts); candle source = Binance/Coinbase 15m klines in [app/api/simulation/route.ts](../../app/api/simulation/route.ts).

### Reference docs (in repo root)
[deepBook-predict.md](../../deepBook-predict.md) · [deepbook-margin.md](../../deepbook-margin.md) · [deepbookv3.md](../../deepbookv3.md) · [DeepBookPredictProblemStatement.md](../../DeepBookPredictProblemStatement.md)
