# #4 — Three-Protocol Margin Loop

**Status:** ⬜ Not started · **Effort:** XL · **Needs:** mainnet (iron_bank + real stable routing) · **Updated:** 2026-06-18

> Borrow dUSDC on `deepbook_margin` against an `iron_bank` USDsui share, deploy
> the borrow into Predict ranges, repay from settlement — one atomic PTB across
> three protocol logos. (Idea-bank #4.)

## Current state
- [/prediction/combo](../../components/prediction/ComboTrade.tsx) ([useComboPTB.ts](../../hooks/useComboPTB.ts), [lib/ptb/comboTrade.ts](../../lib/ptb/comboTrade.ts)) ships an **atomic PTB** = margin (create manager + deposit **SUI collateral**) + predict (`mint_range`) + optional PLP supply, with a Pyth refresh.
- **Missing:** the actual loop — **no borrow**, no `iron_bank`, no repay-from-settlement, no leverage/health-factor.

## Definition of done
- Atomic PTB: iron_bank USDsui collateral → `margin::borrow` dUSDC → `predict::mint_range` → (later) redeem → `margin::repay` → withdraw collateral.
- Health-factor / liquidation-price gauge; LTV bounded against worst-case Predict outcome.

## Feasibility (verified) — and the real blocker
- Borrow/repay/liquidate **are callable**: `margin_manager::{borrow_base, borrow_quote, repay_base, repay_quote, liquidate}` all **Public**. ✅
- ⛔ **Asset routing:** margin/spot quote is **DBUSDC**, Predict needs **dUSDC**, and there is **no DBUSDC↔dUSDC pool** on testnet → a borrowed stable can't be routed into the predict leg.
- ⛔ **iron_bank is mainnet-only** (per [problem statement](../../DeepBookPredictProblemStatement.md)) — it cannot execute in a testnet PTB at all.
- ⇒ The faithful loop is effectively a **mainnet** deliverable. On testnet you can at most add a borrow leg that doesn't feed Predict (theatre).

## Architecture (mainnet target)
- Single PTB on **mainnet**: iron_bank supply USDsui → receive share → use as margin collateral → `borrow_quote` USDC → (route to the Predict quote) → `predict::mint_range`.
- Settlement/unwind PTB (or keeper): `redeem_range` → `repay_quote` → `withdraw` collateral.
- Risk: bound borrow so worst-case Predict loss can't push the margin account under maintenance; compute + display health factor and liquidation price from the margin account.
- Reuse the existing combo UI/pipeline-rail; add a **Borrow / Leverage** leg and a **Health Factor** gauge (the CLAUDE.md spec'd both).

## Decision needed first
Pick the path before building:
- **(A) Mainnet loop** — full fidelity (iron_bank + real USDC route). Requires mainnet Predict (planned, not yet) ⇒ may be **gated on Predict mainnet launch**.
- **(B) Testnet "composability proof"** — keep margin+predict+PLP atomic, **add a real `borrow_quote`** that returns DBUSDC to the user (honest: "borrow demonstrated; routing to Predict needs mainnet"). Relabel from "3-protocol loop" to "atomic multi-protocol."
- **(C) Deploy a testnet DBUSDC↔dUSDC pool** + seed liquidity, then route borrow → swap → predict on testnet. Real but heavy and synthetic.

## Task checklist
- [ ] **Decide A/B/C** (blocks everything below).
- [ ] (B) Add `borrow_quote` leg to the combo PTB + health-factor/liq-price gauge.
- [ ] (A) iron_bank supply leg + USDC routing + repay-from-settlement PTB/keeper, on mainnet config.
- [ ] (C) Deploy + seed DBUSDC/dUSDC pool; add swap leg.
- [ ] LTV bound vs worst-case Predict payout; liquidation-path doc.
- [ ] Update [combo doc/answer] + UI copy to match what actually executes.

## Risks / open questions
- Predict mainnet not live yet → (A) timing.
- Honest framing: today's combo is "3 protocols touched," not "looped" — fix the copy regardless of path.

## Acceptance criteria
- [ ] (chosen path) A real `borrow` (and, for A, iron_bank) executes; funds visibly flow into the Predict leg (A/C) or are honestly labelled (B).
- [ ] Health factor + liquidation price shown and correct.
- [ ] Repay-from-settlement returns collateral.

## Progress log
- _2026-06-18_ — doc created; not started. **Blocked on path decision (A/B/C).**
