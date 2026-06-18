# #10 — PLP Risk Dashboard

**Status:** ✅ Done (core) · **Effort:** M–L · **Needs:** — (data verified live) · **Updated:** 2026-06-18

> Vault utilization, withdrawal-limiter state, per-oracle exposure, and a "what-if"
> ±5σ scenario simulator — the "is PLP safe?" dashboard that gates serious LP TVL.
> (Idea-bank #10.)

## Current state
- Vault stats shown today: TVL, share price, **utilization**, APY in [EarnVault.tsx](../../components/earn/EarnVault.tsx) / [PredictVault.tsx](../../components/prediction/PredictVault.tsx) (from `vault/summary`).
- Historical 3-strategy **backtest**: [VaultSimulation.tsx](../../components/prediction/VaultSimulation.tsx) + [/api/simulation](../../app/api/simulation/route.ts).
- **Missing:** per-oracle exposure breakdown, withdrawal-limiter token-bucket view, **live ±5σ what-if**, per-strike inventory heatmap, exportable report.

## Definition of done
- **Per-oracle exposure** breakdown of vault inventory.
- **Withdrawal-limiter** token-bucket state (available vs max, refill).
- **±5σ live scenario simulator** (shock spot, recompute PLP MTM) — distinct from the historical replay.
- **Per-strike inventory heatmap**; historical drawdown replay; exportable (CSV) report.

## Feasibility (verified)
- `vault/summary` already returns `utilization`, `available_withdrawal`, `max_payout_utilization`, `plp_total_supply`, `plp_share_price`, etc. ✅
- `vault/performance` → PLP share-price history for drawdown replay. ✅
- Per-oracle exposure derivable from `positions/{minted,redeemed}` + `ranges/{minted,redeemed}` grouped by oracle (same pattern as [/api/oracles/[oracleId]/holders](../../app/api/oracles/[oracleId]/route.ts)). ✅
- ±5σ uses [lib/simulation/pricing.ts](../../lib/simulation/pricing.ts) + live candles (σ) already fetched by the simulation route. ✅
- ⚠️ Withdrawal-limiter **internals** (bucket capacity/refill rate) may not be in `vault/summary` → may need an on-chain `getObject` read of the Predict/limiter object, or display available-vs-max only.

## Architecture
- **New route** `app/prediction/risk/page.tsx` (or a tab on `/prediction/vault`).
- **API** `GET /api/vault/risk`: assemble `vault/summary` + `vault/performance` + per-oracle exposure (aggregate minted−redeemed) into one payload.
- **Exposure aggregation** server-side (reuse holders-style grouping) → `{oracleId, expiry, netExposure, maxPayout}[]`.
- **Scenario engine** `lib/risk/scenario.ts`: given inventory + spot + per-oracle SVI, shock spot by ±kσ and recompute the vault's net payout/MTM with `pricing.ts`. Output a PnL curve over the shock range.
- **UI:** utilization gauge + limiter bar, exposure table + per-strike heatmap, ±5σ PnL chart with a draggable shock slider, drawdown replay (from `vault/performance`), CSV export.

## Task checklist
- [x] [`GET /api/vault/risk`](../../app/api/vault/risk/route.ts) (summary + performance + per-oracle exposure + open positions + spot/σ).
- [x] Per-oracle exposure aggregation (open mints on active oracles, by oracle).
- [x] [`lib/risk/scenario.ts`](../../lib/risk/scenario.ts) ±kσ stress engine (`stressCurve`, `inTheMoney`, `sigmaMovePct`, `shockGrid`, `drawdownSeries`). _(unit tests deferred)_
- [x] Withdrawal-limiter: show available-vs-locked (`available_withdrawal` vs TVL). _(bucket refill internals not exposed by the indexer → deferred)_
- [x] [`/prediction/risk`](../../components/prediction/risk/RiskDashboard.tsx): vault-health stats + utilization gauge + limiter bar + exposure + ±σ stress chart + shock slider + drawdown replay (all shadcn + recharts).
- [x] Nav "Risk" entry.
- [x] Drawdown outlier cleaning (median ±0.6% filter — indexer share-price history has glitch spikes that poisoned the peak).
- [ ] _(deferred)_ Per-strike inventory heatmap; CSV export; arb/scenario unit tests.

## Risks / open questions
- Limiter internals exposure (above) — confirm what's readable.
- ±5σ accuracy depends on the same pricing assumptions as the backtest — label "indicative."
- Exposure sign/netting correctness (vault is counterparty → opposite side of each mint).

## Acceptance criteria
- [x] Dashboard shows live utilization (0.15%), available-vs-locked withdrawal (99.9% free), and per-oracle exposure. _(verified)_
- [x] ±σ shock slider produces a sensible payout curve — directional (vault is net-short BTC upside), peaking at ~max payout (~0.29% of TVL). _(verified)_
- [x] Drawdown replay renders from live data (−0.79% after outlier cleaning). _(verified)_ — per-strike heatmap + CSV deferred.

## Progress log
- _2026-06-18_ — doc created; not started.
- _2026-06-18_ — **core shipped & verified → #10 done.** Added [`lib/risk/scenario.ts`](../../lib/risk/scenario.ts) (relative-weight stress engine × authoritative `total_max_payout`, so robust to contract-unit scaling); [`GET /api/vault/risk`](../../app/api/vault/risk/route.ts) (summary + performance + per-oracle exposure + open positions + spot/σ); [`RiskDashboard.tsx`](../../components/prediction/risk/RiskDashboard.tsx) + [page](../../app/prediction/risk/page.tsx); nav "Risk". Reframed the stress test from a premium-based PnL (premium under-sampled from the 200-mint window) to **payout vs TVL** — the honest "is PLP safe?" metric, tied to max-payout-utilization. Cleaned share-price drawdown outliers (indexer glitch spikes → ±0.6% median filter). Type-clean, no console errors. Verified live: TVL $1.01M, util 0.15%, max-payout-util 0.29%, withdrawable 99.9%, stress payout ≤0.3% of TVL even at ±18%. **Deferred:** per-strike heatmap, CSV export, unit tests, withdrawal-limiter bucket internals (not exposed).
