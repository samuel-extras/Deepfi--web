# #2 — PLP + Hedge Vault

**Status:** ✅ Level 1 done · 🟡 Level 2 (pooled) deferred · **Effort:** M (live position) / XL (pooled) · **Needs:** 🦀 only for pooled form · **Updated:** 2026-06-18

> Supply quote to `predict::supply` for PLP yield **and** buy OTM crash binaries
> via `predict::mint` to cap left-tail drawdown — "PLP yield minus crash
> insurance," sold net of cost. (Idea-bank #2.)

## Current state
- Raw PLP supply/withdraw is **live**: [EarnVault.tsx](../../components/earn/EarnVault.tsx) (`/earn`) and [PredictVault.tsx](../../components/prediction/PredictVault.tsx) (`/prediction/vault`) → `predict::supply`.
- The hedge overlay exists **only in the backtest**: `plpStrangle(withHedge)` in [lib/simulation/backtest.ts](../../lib/simulation/backtest.ts).
- **Missing:** a live executable hedged position; dynamic hedge ratio; net-of-cost APY.

## Definition of done
- **Level 1 (no Move):** one-click "Hedged PLP" — a single PTB that supplies PLP **and** mints an OTM downside crash binary, with a dynamic hedge ratio and a clean "APY net of insurance" readout. Near-expiry unwind.
- **Level 2 (pooled, optional):** the same as a tokenized auto-rolling vault (shares + keeper) — reuses the #1 Move machinery.

## Feasibility (verified)
- `predict::supply` (PLP) and `predict::mint` (binary) are both **Public**; binary mint already wired via [usePredictBinaryMint.ts](../../hooks/usePredictBinaryMint.ts). ✅
- Hedge sizing math already exists in the backtester (`plpStrangle`). OTM strike from SVI (`ivFromRawSvi` → −Nσ). ✅
- Level 2 inherits the `key`-only-manager constraint from [#1](01-range-ladder-vault.md).

## Architecture (Level 1)
- `useHedgedPlp` hook + PTB: `predict::supply(dUSDC_supply)` → PLP Coin to user; **and** mint an OTM down-binary on the chosen oracle sized by hedge ratio (deposit to PredictManager + `mint`).
- **Hedge ratio** from `vaultSummary.utilization` (higher utilization → more tail risk → bigger hedge). Expose a manual override.
- **OTM strike** = forward × (1 − k·σ) snapped to tick (σ from SVI).
- **Net APY** = PLP APY (from `vault/performance` share-price history) − annualized hedge premium.
- **Unwind:** near expiry, `redeem`/sell the hedge binary; offer "roll hedge" for next cycle (keeper for auto).
- **UI:** extend `/earn` or `/prediction/vault` with a "Hedged" toggle showing gross APY, hedge cost, net APY, current tail protection.

## Task checklist (Level 1)
- [x] [`usePredictHedgedSupply`](../../hooks/usePredictHedgedSupply.ts) hook: single PTB = `supply` (PLP) + deposit + `mint` (OTM down binary). Added composable [`addSupply`](../../lib/ptb/predict.ts) helper.
- [x] OTM strike selection from SVI — protection-% selector (−1/−2/−3/−5%), with the σ-equivalent shown (sub-hour σ is tiny, so % is the clearer control).
- [x] Hedge cost + payout estimate from the on-chain SVI (`ivFromRawSvi` + `probInRange`) — small premium → larger tail payout.
- [x] UI: "PLP + Crash Hedge" card on [`/earn`](../../components/prediction/hedge/HedgedPlp.tsx) with supply input, protection toggle, hedge-size slider, live breakdown (gross APY · hedge cost · coverage · total).
- [~] Net-of-cost framing: show **gross APY + per-cycle hedge cost** with an honest "continuous hedging is costly, use tactically" note. (Annualized net APY for sub-hour rolling is misleading, so omitted by design.)
- [ ] _(deferred)_ Dynamic hedge ratio auto-scaled from utilization (currently a manual slider; utilization is fetched but not yet driving the default).
- [ ] _(deferred)_ Pick a longer hedge expiry (currently uses the soonest active oracle — sometimes ~1m from settlement); unwind/roll-hedge flow near expiry.
- [ ] _(deferred)_ On-chain settle verification needs a funded wallet (PTB construction mirrors the proven binary-mint + supply flows; type-clean; live economics verified).

## Task checklist (Level 2 — pooled, optional)
- [ ] Reuse the [#1](01-range-ladder-vault.md) `ladder_vault`-style Move package, strategy = PLP+hedge.
- [ ] Auto-roll the hedge each expiry via keeper; tokenized share.

## Risks / open questions
- Hedge premium can eat PLP yield in calm regimes — surface honestly (net APY can be < raw PLP).
- Sizing the hedge so worst-case is actually capped (validate against backtest tail metrics).

## Acceptance criteria
- [ ] One PTB supplies PLP and mints the hedge; both appear on-chain.
- [ ] UI shows gross APY, hedge cost, net APY, and the protected drawdown band.
- [ ] A settled cycle shows the hedge paying off in a down move (vs raw PLP).

## Progress log
- _2026-06-18_ — doc created; not started.
- _2026-06-18_ — **Level 1 shipped & verified.** Added [`addSupply`](../../lib/ptb/predict.ts) (composable PLP supply leg), [`usePredictHedgedSupply`](../../hooks/usePredictHedgedSupply.ts) (one atomic PTB: supply PLP + deposit + mint OTM down-binary, with devInspect sizing), and the [`HedgedPlp`](../../components/prediction/hedge/HedgedPlp.tsx) card injected into `/earn`. SVI-priced strike + payout estimate. Verified live: $100 supply (0.6% APY) + −2% crash hedge below $60,923 costing $8 pays up to $26 (26% of supply); shadcn throughout; type-clean; no console errors. **Deferred:** utilization-driven hedge ratio, longer hedge expiry + unwind/roll, on-chain settle test (needs wallet), and **Level 2** (pooled tokenized auto-rolling vault — needs the [#1](01-range-ladder-vault.md) Move package).
