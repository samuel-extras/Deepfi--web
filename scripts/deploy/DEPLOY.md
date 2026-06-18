# DeepFi full-stack testnet deploy (Spot + Margin + Predict)

Goal: make "Spot + Margin + Predictions in one composable PTB" literally true on
testnet. Predict is already deployed by Mysten; we deploy the missing legs
(a `SUI/dUSDC` DeepBook spot pool + `deepbook_margin` with a dUSDC pool) and wire
the 3-leg PTB.

> All function signatures below are verified from `predict-testnet-4-16`. The
> scripts are run live (and iterated) once the deployer is funded — much of the
> margin/Pyth wiring needs on-chain validation.

## 0. Prereqs — fund the deployer

Deployer (testnet, in local `~/.sui` keystore):

```
0xd3e835d573c126bb7f5266f3d5390cdf0eba7bf05984316cfb0675f4be362b91
```

Fund it with:
- **SUI** (gas): https://faucet.sui.io/?address=0xd3e835d573c126bb7f5266f3d5390cdf0eba7bf05984316cfb0675f4be362b91
- **DEEP** (pool-creation fee, `pool::create_permissionless_pool` asserts a fixed `creation_fee`): testnet DEEP faucet
- **dUSDC** (seed spot pool + margin pool + trade): the Tally form → send to the deployer

Verify: `sui client gas` and `sui client balance`.

## 1. Get DEEP (pool fee is **500 DEEP**)

`POOL_CREATION_FEE = 500 * 1e6` (DEEP has 6 dp). Acquire DEEP by swapping SUI on
the **whitelisted** DEEP/SUI testnet pool `0x48c95963e9eac37a316b7ae04a0deb761bcdcc2b67912374d6036e7f0e9bae9f`
(whitelisted ⇒ `deep_in` may be `coin::zero`):

`pool::swap_exact_quote_for_base<DEEP, SUI>(pool, quote_in: Coin<SUI>, deep_in: Coin<DEEP>, min_base_out, clock, ctx): (Coin<DEEP>, Coin<SUI>, Coin<DEEP>)`

> ⚠️ 500 DEEP may cost more SUI than the current 1.5 balance depending on pool
> price — top up SUI (Discord faucet) if the swap can't fill 500 DEEP.

CLI sketch:
```bash
sui client ptb \
  --split-coins gas '[<sui_mist>]' --assign sui_in \
  --move-call 0x2::coin::zero "<DEEP_TYPE>" --assign deep0 \
  --move-call <DEEPBOOK_PKG>::pool::swap_exact_quote_for_base "<DEEP_TYPE>" "0x2::sui::SUI" \
      @<DEEP_SUI_POOL> sui_in deep0 0 @0x6 --assign out \
  --transfer-objects '[out.0,out.1,out.2]' @<deployer> --gas-budget 100000000
```

## 2. Create the SUI/dUSDC spot pool + seed

`pool::create_permissionless_pool<SUI, DUSDC>(registry, tick_size, lot_size, min_size, creation_fee: Coin<DEEP>(500e6), ctx): ID`
- registry = `DEEPBOOK.registry`; params from `SPOT_POOL_PARAMS`.

Seed so swaps fill (`balance_manager.move`, `pool.move:179`):
1. `balance_manager::new(ctx)` → `transfer::public_share_object`
2. `balance_manager::deposit<SUI>` + `deposit<DUSDC>` (+ `deposit<DEEP>` for fees)
3. `balance_manager::generate_proof_as_owner(bm, ctx)` → TradeProof
4. `pool::place_limit_order<SUI,DUSDC>(pool, bm, proof, client_oid, order_type=0(NO_RESTRICTION), self_matching=0, price, quantity, is_bid, pay_with_deep=true, expire=MAX, clock, ctx)`
   — bids + asks around mid (e.g. $3.60/SUI).

Record pool id → `OUTPUT.spotPoolSuiDusdc` / `NEXT_PUBLIC_SPOT_POOL_SUI_DUSDC`.

Swap leg used by `lib/ptb/comboTrade.ts::buildSpotPredictTx` (verified, pool.move:248):
`pool::swap_exact_base_for_quote<SUI, DUSDC>(pool, base_in: Coin<SUI>, deep_in: Coin<DEEP>, min_quote_out, clock, ctx): (Coin<SUI>, Coin<DUSDC>, Coin<DEEP>)`

## 2. Publish deepbook_margin

`deepbook_margin` deps (Move.toml): `deepbook` (local), `token` (git), **Pyth**
(testnet rev). Build the workspace and publish:

```bash
cd /tmp/deepbookv3-predict
sui move build --path packages/deepbook_margin
sui client publish packages/deepbook_margin --gas-budget 500000000
```

Capture from effects: package id → `OUTPUT.marginPkg`, the shared `MarginRegistry`
→ `OUTPUT.marginRegistry`, and `MarginAdminCap` → `OUTPUT.marginAdminCap`.

## 3. Set up margin pools + Pyth + register the spot pool

1. **Pyth config** (registry): map asset → Pyth feed. dUSDC has no feed, so map
   `DUSDC -> Pyth USDC/USD` and `SUI -> Pyth SUI/USD`. Fill `PYTH.*` ids first
   (Pyth Sui testnet package/state + feed ids; a price update creates the
   `PriceInfoObject`s). Each borrow/risk call takes
   `base_price_info_object` + `quote_price_info_object`, so the PTB must include a
   Pyth update step (Hermes VAA → `pyth::update_single_price_feed`).
2. `margin_pool::create_margin_pool<SUI>(...)` and `create_margin_pool<DUSDC>(...)`
   (registry + admin/maintainer cap + interest/config params).
3. `margin_pool::supply<DUSDC>(pool, coin, clock, ctx)` — supply dUSDC so it's borrowable.
4. `margin_registry::register_deepbook_pool<SUI, DUSDC>(registry, pool_config, ...)`
   linking `OUTPUT.spotPoolSuiDusdc` + the two margin pools.
   `pool_config = new_pool_config_with_leverage<SUI, DUSDC>(registry, leverage)`
   (e.g. 3x). Then `enable_deepbook_pool<SUI, DUSDC>(...)`.

Record `OUTPUT.marginPool{Sui,Dusdc}`.

## 4. Full combo PTB (app)

`lib/ptb/comboTrade.ts` — one Transaction:
1. (Pyth) update SUI/USD + USDC/USD price feeds
2. `pool::swap_exact_base_for_quote<SUI,DUSDC>` — SUI → dUSDC
3. `margin_manager::new<SUI,DUSDC>` (or reuse) → `deposit` dUSDC collateral →
   `borrow_quote` extra dUSDC (with both PriceInfoObjects)
4. `predict_manager::deposit<DUSDC>` → `predict::mint_range<DUSDC>`

All atomic — any failure reverts. Fill `lib/deepbook.ts` + `.env` from `OUTPUT`.

## 5. Wire UI

Enable the SUI/BTC "Pay with" + leverage controls (currently preview-only); set
the `NEXT_PUBLIC_SPOT_POOL_SUI_DUSDC` / `NEXT_PUBLIC_MARGIN_*` env vars.
