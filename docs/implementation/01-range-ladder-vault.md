# #1 — Range Ladder Vault

**Status:** ⬜ Not started · **Effort:** XL · **Needs:** 🦀 Move deploy + 🤖 keeper · **Updated:** 2026-06-18

> Auto-deposit user funds into a strip of Predict ranges around the ATM strike
> each new expiry, auto-roll on settlement, issue a tokenized share, expose a
> withdrawal queue. (Idea-bank #1.)

## Current state
- The ladder **trade** exists as a one-shot atomic mint: [usePredictLadderMint.ts](../../hooks/usePredictLadderMint.ts), [RangeLadderPanel.tsx](../../components/prediction/RangeLadderPanel.tsx), and the Ladder tab in [TradeTicket.tsx](../../components/prediction/terminal/TradeTicket.tsx).
- The strategy is **backtested**: "Range Ladder" in [lib/simulation/backtest.ts](../../lib/simulation/backtest.ts).
- **Missing:** the vault itself — pooling, tokenized shares, auto-roll, withdrawal queue, strike-width policy.

## Definition of done
- Users deposit dUSDC → receive a transferable **vault share Coin**; withdraw burns shares for dUSDC.
- Each expiry the vault **auto-rolls**: redeem settled ranges → mint the next strip around ATM.
- **Strike-width policy** selectable: fixed bps / 1σ-from-SVI / dynamic-on-realized-vol.
- **Withdrawal queue** for when capital is locked mid-cycle.
- Honest share-price/NAV history + the existing backtest shown as the strategy tab.

## Feasibility (verified)
- All needed Predict fns are **Public** (`mint_range`, `redeem_range`, `predict::create_manager`, `predict_manager::deposit/withdraw`). ✅
- ⚠️ `PredictManager` is **`key`-only** + `predict_manager::new` is **Friend** → vault can't wrap the manager in a struct. Pattern: `create_manager` then **own it via object-ownership + `transfer::Receiving`**. Share token = standard Sui `Coin` (OTW + `TreasuryCap`). See [README shared facts](README.md#shared-verified-facts-the-protocol-surface).

## Architecture
- **New Move package `ladder_vault`** (deployed to testnet; first Move code in this repo):
  - `VaultShare` coin (one-time witness) + `TreasuryCap` held by the vault.
  - Shared `LadderVault` object: config (oracle/asset, strike-width policy, fee bps), the owned `PredictManager` id, cash bookkeeping, last-NAV + share supply.
  - `deposit(vault, manager: Receiving<PredictManager>, coin: Coin<DUSDC>) → Coin<VaultShare>`: shares = coin × supply / NAV; `predict_manager::deposit` the cash.
  - `withdraw(vault, shares) → Coin<DUSDC>` if liquid, else **enqueue** (fulfilled at next `roll`).
  - `roll(vault, manager, oracle, clock)` — **keeper-callable**: `redeem_range` matured legs → compute next ATM strip (policy) → `mint_range` strip → recompute NAV → fulfill queued withdrawals.
- **NAV policy:** compute share price at **roll boundaries** (everything settled to cash) to avoid on-chain live MTM; intra-cycle deposits use last NAV, withdrawals queue to the next boundary. Document this assumption in the UI.
- **Keeper:** off-chain cron (Next API route or standalone script) calling `roll()` per expiry; reuse strip/ATM logic from `usePredictLadderMint` + SVI `atmIv`.
- **Frontend:** new `/prediction/vault` style page (clone [PredictVault.tsx](../../components/prediction/PredictVault.tsx) shape) — deposit/withdraw shares, NAV, net APY, holdings, queue status, strategy backtest tab.

## Task checklist
- [ ] Decide strike-width policy set + default; spec the roll algorithm (deep-ITM/OTM handling).
- [ ] Scaffold `ladder_vault` Move package (Move.toml, deps on predict + sui).
- [ ] `VaultShare` OTW + treasury; `LadderVault` shared object + config.
- [ ] `deposit` / `withdraw` (+ withdrawal queue) entry fns.
- [ ] `roll` keeper entry fn (redeem matured → mint next strip → NAV update).
- [ ] Move unit tests (deposit/withdraw share math, roll, queue).
- [ ] Publish to testnet; record package/object IDs in `lib/deepbook.ts`.
- [ ] `useLadderVault` hook (deposit/withdraw PTBs) + share balance reads.
- [ ] Keeper cron route/script for `roll()`.
- [ ] Vault page UI + NAV/APY/queue + backtest tab.
- [ ] End-to-end: deposit → roll across one expiry → withdraw with PnL.

## Risks / open questions
- On-chain NAV of open ranges is hard → the roll-boundary NAV simplification (above). Confirm acceptable.
- Keeper liveness/permissioning (anyone can roll? tip incentive? cf. #8 keeper).
- `Receiving` ergonomics for the owned manager in each entry fn.

## Acceptance criteria
- [ ] Deposit returns shares; withdraw returns dUSDC ± PnL; share price moves with vault performance.
- [ ] One full auto-roll executes on testnet (settled strip → new strip) without manual minting.
- [ ] Withdrawal queue fulfilled at the next roll when mid-cycle illiquid.

## Progress log
- _2026-06-18_ — doc created; not started.
