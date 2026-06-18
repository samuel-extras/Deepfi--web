# DeepBook Predict

URL: https://docs.sui.io/onchain-finance/deepbook-predict/

DeepBook **DeepBook** A decentralized central limit order book (CLOB) built on Sui. Predict is an expiry-based prediction market protocol on Sui. It lets applications build markets where users can mint and redeem binary positions or vertical ranges against oracle-driven prices, while liquidity providers supply quote assets to a shared vault and receive `PLP` LP shares.

The protocol is currently documented from the `predict-testnet-4-16` branch of the [DeepBookV3 repository](https://github.com/MystenLabs/deepbookv3/tree/predict-testnet-4-16/packages/predict) . The current public integration target is on SuiTestnet **Testnet** Staging network for testing changes before production deployment. .

caution
DeepBook Predict smart contracts might change beforeMainnet **Mainnet** Production network for live transactions and real-value assets. deployment. Treat the currentpackage **Package** Smart contracts on Sui. IDs,object **Object** The basic unit of storage on Sui. layouts, and entry points asTestnet integration targets. Allpackage IDs and source references on these pages are pinned to the `predict-testnet-4-16` branch and will change atMainnet launch.

## RequestTestnet tokens

Builders can requestTestnet tokens forDeepBook Predict integration and testing, including DUSDC and other assets, by submitting the [DeepBook Predict Testnet token request form](https://tally.so/r/Xx102L) .

## Key features

DeepBook Predict provides the following capabilities:

- **Binary positions:** Users can mint directional positions for an oracle, expiry, strike, and direction.
- **Vertical ranges:** Users can mint bounded range positions keyed by an oracle, expiry, lower strike, and higher strike.
- **Oracle-based pricing:**`OracleSVI` objects track spot, forward, SVI parameters, lifecycle status, and settlement prices.
- **Shared manager accounts:** Each user reuses a `PredictManager` to hold quote balances, positions, and range quantities.
- **Vault liquidity:** LPs supply accepted quote assets to the vault and receive `PLP` shares representing a proportional claim on vault value.
- **Indexed data path:** Applications can use the public Predict server for render-ready market, vault, portfolio, and history data.

## Integration model

Most applications should combine three data sources:

- Use the public Predict server for page rendering, lists, portfolio summaries, vault summaries, and historical data.
- Suicheckpoint **Checkpoint** Created after transaction execution to provide a certified record of chain history. or event streaming supports pages that need low-latency oracle updates.
- Use direct onchainobject reads immediately before or after wallet flows that need confirmation-critical state.
  Avoid building the primary UI around raw chain scans. The server already exposes indexed surfaces for market state, portfolio state, vault state, and history.

## User flow

A typical user flow starts with current market data from the public server. After selecting an active oracle and strike, the user creates or finds a `PredictManager` , deposits the enabled quote asset, previews mint and redeem amounts, then submits atransaction **Transaction** A number of commands that execute on inputs to define the result of the transaction. for a binary position or vertical range. After confirmation, refresh both the affected onchain objects and the indexed server endpoints backing the current page.

## Liquidity provider flow

Liquidity providers supply accepted quote assets into the shared vault using `predict::supply` . In return, the protocol mints `PLP` , which represents vault shares. LP withdrawals burn `PLP` and return a selected quote asset, subject to current vault value, max payout coverage, and the withdrawal limiter.

## Testnet status

DeepBook Predict is documented here as aTestnet integration surface. Do not reusepackage IDs from older Predict experiments. See [Contract Information](/onchain-finance/deepbook-predict/contract-information) for the currentpackage ,object ID, quote asset, server URL, and source branch. These identifiers are temporary and will be updated whenDeepBook Predict launches onMainnet .

[## Design

Learn about DeepBook Predict design, including Predict, PredictManager, OracleSVI, Vault, and PLP.

→](/onchain-finance/deepbook-predict/design)
[## Contract Information

In this section

- Predict
- Predict Manager
- Market Keys
- Oracle
- Vault
- Registry

→](/onchain-finance/deepbook-predict/contract-information)

# Design

URL: https://docs.sui.io/onchain-finance/deepbook-predict/design

At a high level,DeepBook **DeepBook** A decentralized central limit order book (CLOB) built on Sui. Predict revolves around four main onchain components:

- `Predict` : The top-level sharedobject **Object** The basic unit of storage on Sui. . It holds vault balances, pricing config, risk config, the quote-asset allowlist, oracle strike grids, withdrawal-limiter config, and the `PLP` treasury cap.
- `PredictManager` : A per-user shared accountobject . It wraps aDeepBook`BalanceManager` , stores deposited quote balances, and tracks a user's binary position and vertical range quantities.
- `OracleSVI` : The market state for one underlying asset and one expiry. It stores spot, forward, SVI parameters, activation status, timestamps, and settlement price.
- `Vault` : The shared liquidity and exposure state machine. It stores accepted quote assets, tracks mark-to-market liability, tracks maximum payout, and supports `PLP` supply and withdrawal flows.

## `Predict` sharedobject

`Predict` is the main protocolobject that applications pass to trading and liquidity functions. It validates quote assets, checks trading pause state, prices mints and redeems from oracle state, applies spread and utilization configuration, updates vault exposure, and emits protocol events.

For a mint, `Predict` first validates that the manager owner is the signer, the quote asset is accepted, the oracle is live, and the requested market key or range key matches the oracle. It then inserts the new liability into the vault before pricing the trade, so the trader pays for the post-trade state they create. After collecting payment from the `PredictManager` , it checks total exposure and increases the user's internal position quantity.

For a redeem, `Predict` decreases the user's internal position quantity, removes or compacts the vault exposure as needed, dispenses the payout from the vault, and deposits the payout back into the `PredictManager` .

## `PredictManager` sharedobject

Each user creates one `PredictManager` and reuses it across Predict flows. The manager owns an inner `BalanceManager` plus deposit and withdraw capabilities, which lets the protocolmove **Move** An open source programming language used for all activity on Sui. balances during mints, redeems, and payouts without exposing the internal capabilities directly.

Positions and ranges are not standalone objects. The manager stores binary position quantities in a table keyed by `MarketKey` , and vertical range quantities in a table keyed by `RangeKey` . Applications should read those quantities from the managerobject or from the indexed server API rather than looking for separate position objects.

## Positions and ranges

Binary positions are keyed by `(oracle_id, expiry, strike, is_up)` . The `is_up` direction represents whether the position pays when settlement is above the strike. A corresponding down position is created with the same oracle, expiry, and strike but the opposite direction.

Vertical ranges are keyed by `(oracle_id, expiry, lower_strike, higher_strike)` . A range is priced as a single bounded instrument. At settlement, it pays out when the settlement lands in the band `(lower, higher]` .

## Oracle lifecycle

`OracleSVI` moves through four lifecycle states:

- **Inactive:** The oracle exists but has not been activated.
- **Active:** The oracle accepts live spot, forward, and SVI updates before expiry.
- **Pending settlement:** The oracle has reached expiry but has not yet received the first post-expiry price push.
- **Settled:** The first post-expiry price update freezes the settlement price and prevents further live price or SVI updates.
  Tradeability depends on this lifecycle. Mints require a live oracle. Redeems can quote against live or settled oracle state. After settlement, the vault can compact dense strike matrix exposure into constant-size settled state.

## Vault and `PLP`

The vault takes the opposite side of every Predict trade. It stores concrete quote asset balances, a shared quote-denominated vault balance, per-oracle strike matrices, compact settled-oracle state, total mark-to-market liability, and total maximum payout.

Liquidity providers call `predict::supply` with an accepted quote asset and receive `PLP` shares. The first supplier receives shares one-to-one with the supplied amount. Later suppliers receive shares proportional to their deposit relative to current vault value. Withdrawals burn `PLP` and return quote assets only when the withdrawal amount is available after covering current max payout.

## Pricing and risk

Predict prices binary positions and ranges from oracle fair prices plus protocol spread and utilization adjustments. The protocol can set global ask bounds and tighter per-oracle ask bounds. These bounds prevent mints with post-spread ask prices outside configured limits.

Risk is enforced by the vault's total exposure check. After minting, the vault asserts that total mark-to-market liability remains within `max_total_exposure_pct` of the vault balance.

## Data flow

Applications should split reads by freshness and purpose:

1. Render markets, portfolios, vault summaries, and history from the public Predict server.
2. Subscribe to Suicheckpoints **Checkpoint** Created after transaction execution to provide a certified record of chain history. or events for second-level oracle updates when the UI needs a live tape.
3. Read onchain `Predict` , `PredictManager` , `OracleSVI` , and quote coin objects around wallet flows that require authoritative state.
   This keeps page rendering fast while still lettingtransaction **Transaction** A number of commands that execute on inputs to define the result of the transaction. flows confirm exact onchain state.

# Contract Information

URL: https://docs.sui.io/onchain-finance/deepbook-predict/contract-information

This page contains the current public integration targets forDeepBook **DeepBook** A decentralized central limit order book (CLOB) built on Sui. Predict on SuiTestnet **Testnet** Staging network for testing changes before production deployment. . These values come from the `predict-testnet-4-16` branch of the [DeepBookV3 Predict package](https://github.com/MystenLabs/deepbookv3/tree/predict-testnet-4-16/packages/predict) .

caution
DeepBook Predict is documented here as aTestnet integration surface. The smart contracts might change beforeMainnet **Mainnet** Production network for live transactions and real-value assets. deployment, so treat the currentpackage **Package** Smart contracts on Sui. IDs,object **Object** The basic unit of storage on Sui. layouts, and entry points as provisional. Ignore older Predictpackage IDs in local configs or scripts unless a newer deployment explicitly replaces the values below.

## Current deployment

| Parameter | Value
| Network | Testnet
| Public server | `https://predict-server.testnet.mystenlabs.com`
| Predictpackage | `0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138`
| Predict registry | `0x43af14fed5480c20ff77e2263d5f794c35b9fab7e2212903127062f4fe2a6e64`
| Predictobject | `0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a`
| Current quote asset | `0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC`
| PLP coin type | `0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138::plp::PLP`
| Source branch | [`predict-testnet-4-16`](https://github.com/MystenLabs/deepbookv3/tree/predict-testnet-4-16/packages/predict)

## Supported quote assets

Click to open DeepBook Test USDC (DUSDC)
| Parameter | Value
| Type | `0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC`
| Currency ID | `0xf3000dff421833d4bb8ed58fac146d691a3aaba2785aa1989af65a7089ca3e9c`
| Decimals | 6
| Network | Testnet

## Public server endpoints

The public server base URL is `https://predict-server.testnet.mystenlabs.com` . Use it to retrieve render-ready market, vault, portfolio, and history data.

The following example queries the market state for a Predictobject :

```bash
$ curl https://predict-server.testnet.mystenlabs.com/predicts/0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a/state
```

### Protocol and market state

| Endpoint | Use
| `GET /status` | Server health and status
| `GET /predicts/:predict_id/state` | Predictobject state and config
| `GET /predicts/:predict_id/oracles` | Oracle list for a Predictobject
| `GET /oracles/:oracle_id/state` | Current oracle state
| `GET /predicts/:predict_id/quote-assets` | Accepted quote assets
| `GET /oracles/:oracle_id/ask-bounds` | Resolved oracle ask bounds

### Vault and LP data

| Endpoint | Use
| `GET /predicts/:predict_id/vault/summary` | Current vault summary
| `GET /predicts/:predict_id/vault/performance?range=ALL` | Vault performance over a selected range
| `GET /lp/supplies` | LP supply history
| `GET /lp/withdrawals` | LP withdrawal history

### Manager and portfolio data

| Endpoint | Use
| `GET /managers` | Predict manager list
| `GET /managers/:manager_id/summary` | Manager summary
| `GET /managers/:manager_id/positions/summary` | Manager position summary
| `GET /managers/:manager_id/pnl?range=ALL` | Manager PnL over a selected range

### History data

| Endpoint | Use
| `GET /oracles/:oracle_id/prices` | Oracle price history
| `GET /oracles/:oracle_id/prices/latest` | Latest indexed price update
| `GET /oracles/:oracle_id/svi` | Oracle SVI history
| `GET /oracles/:oracle_id/svi/latest` | Latest indexed SVI update
| `GET /positions/minted` | Position mint history
| `GET /positions/redeemed` | Position redeem history
| `GET /ranges/minted` | Range mint history
| `GET /ranges/redeemed` | Range redeem history
| `GET /trades/:oracle_id` | Trade history for an oracle

## Live Sui events

When a UI needs lower-latency oracle state than the indexed server provides, use Suicheckpoint **Checkpoint** Created after transaction execution to provide a certified record of chain history. or event streaming. Filter by the current Predictpackage ID and watch these event types:

- `oracle::OraclePricesUpdated`
- `oracle::OracleSVIUpdated`
- `oracle::OracleSettled`
- `oracle::OracleActivated`
  Use the server for historical pagination. Use the live stream for freshness.

## Source pointers

| Area | Source
| Core sharedobject | [`packages/predict/sources/predict.move`](https://github.com/MystenLabs/deepbookv3/blob/predict-testnet-4-16/packages/predict/sources/predict.move)
| Manager account model | [`packages/predict/sources/predict_manager.move`](https://github.com/MystenLabs/deepbookv3/blob/predict-testnet-4-16/packages/predict/sources/predict_manager.move)
| Registry and admin entry points | [`packages/predict/sources/registry.move`](https://github.com/MystenLabs/deepbookv3/blob/predict-testnet-4-16/packages/predict/sources/registry.move)
| Oracle state machine | [`packages/predict/sources/oracle.move`](https://github.com/MystenLabs/deepbookv3/blob/predict-testnet-4-16/packages/predict/sources/oracle.move)
| Vault accounting | [`packages/predict/sources/vault/vault.move`](https://github.com/MystenLabs/deepbookv3/blob/predict-testnet-4-16/packages/predict/sources/vault/vault.move)

[## Predict

Learn about the Predict shared object, public trading functions, liquidity functions, configuration reads, and emitted events.

→](/onchain-finance/deepbook-predict/contract-information/predict)
[## Predict Manager

Learn about PredictManager accounts, deposited quote balances, binary position quantities, and range quantities.

→](/onchain-finance/deepbook-predict/contract-information/predict-manager)
[## Market Keys

Learn how DeepBook Predict identifies binary positions and vertical ranges with MarketKey and RangeKey.

→](/onchain-finance/deepbook-predict/contract-information/market-keys)
[## Oracle

Learn about OracleSVI lifecycle, price updates, SVI updates, settlement, and oracle read functions in DeepBook Predict.

→](/onchain-finance/deepbook-predict/contract-information/oracle)
[## Vault

Learn about the DeepBook Predict vault, PLP shares, vault value, exposure tracking, and liquidity reads.

→](/onchain-finance/deepbook-predict/contract-information/vault)
[## Registry

Learn about DeepBook Predict registry setup, oracle creation, quote asset management, and admin configuration entry points.

→](/onchain-finance/deepbook-predict/contract-information/registry)

# Predict

URL: https://docs.sui.io/onchain-finance/deepbook-predict/contract-information/predict

The `Predict` sharedobject **Object** The basic unit of storage on Sui. is the main protocol entry point. It coordinates user actions across manager balances, oracle state, pricing config, risk config, and vault accounting.

## API

Following are the public functions that applications use most often.

# Create a PredictManager

The create_manager() function creates a new shared PredictManager for the caller and returns its object ID.

github.com/MystenLabs/deepbookv3/packages/predict/sources/predict.move
public fun create_manager(ctx: &mut TxContext): ID {
let manager_id = predict_manager::new(ctx);
manager_id
}

# Preview binary position amounts

The get_trade_amounts() function returns the mint cost and redeem payout for a binary position at the requested quantity.

github.com/MystenLabs/deepbookv3/packages/predict/sources/predict.move
public fun get_trade_amounts(
predict: &Predict,
oracle: &OracleSVI,
key: MarketKey,
quantity: u64,
clock: &Clock,
): (u64, u64) {
let (ask, bid) = predict.trade_prices(oracle, key, clock);
(math::mul(ask, quantity), math::mul(bid, quantity))
}

# Mint a binary position

The mint() function buys a binary position using an enabled quote asset deposited in the caller's PredictManager.

github.com/MystenLabs/deepbookv3/packages/predict/sources/predict.move
public fun mint<Quote>(
predict: &mut Predict,
manager: &mut PredictManager,
oracle: &OracleSVI,
key: MarketKey,
quantity: u64,
clock: &Clock,
ctx: &mut TxContext,
) {
assert!(ctx.sender() == manager.owner(), ENotOwner);
assert!(!predict.trading_paused, ETradingPaused);
assert!(quantity > 0, EZeroQuantity);
predict.treasury_config.assert_quote_asset<Quote>();

    predict.oracle_config.assert_key_matches(oracle, &key);
    oracle_config::assert_live_oracle(oracle, clock);

    let strike = key.strike();
    let is_up = key.is_up();

    predict.vault.insert_position(oracle.id(), is_up, strike, quantity);
    predict.refresh_oracle_risk(oracle);

    let (ask, _) = predict.trade_prices(oracle, key, clock);
    predict.assert_mintable_ask(oracle.id(), ask);
    let cost = math::mul(ask, quantity);

    let payment = manager.withdraw<Quote>(cost, ctx).into_balance();
    predict.vault.accept_payment(payment);
    predict.vault.assert_total_exposure(predict.risk_config.max_total_exposure_pct());
    manager.increase_position(key, quantity);

    event::emit(PositionMinted {
        predict_id: object::id(predict),
        manager_id: object::id(manager),
        trader: manager.owner(),
        quote_asset: type_name::with_defining_ids<Quote>(),
        oracle_id: key.oracle_id(),
        expiry: key.expiry(),
        strike,
        is_up,
        quantity,
        cost,
        ask_price: ask,
    });

}

# Redeem a binary position

The redeem() function sells a binary position and deposits the payout back into the owner's PredictManager.

github.com/MystenLabs/deepbookv3/packages/predict/sources/predict.move
public fun redeem<Quote>(
predict: &mut Predict,
manager: &mut PredictManager,
oracle: &OracleSVI,
key: MarketKey,
quantity: u64,
clock: &Clock,
ctx: &mut TxContext,
) {
assert!(ctx.sender() == manager.owner(), ENotOwner);
let payout_coin = redeem_internal<Quote>(predict, manager, oracle, key, quantity, clock, ctx);
manager.deposit(payout_coin, ctx);
}

# Redeem a settled binary position permissionlessly

The redeem_permissionless() function lets anyone redeem a settled position into the owner's PredictManager.

github.com/MystenLabs/deepbookv3/packages/predict/sources/predict.move
public fun redeem_permissionless<Quote>(
predict: &mut Predict,
manager: &mut PredictManager,
oracle: &OracleSVI,
key: MarketKey,
quantity: u64,
clock: &Clock,
ctx: &mut TxContext,
) {
assert!(oracle.is_settled(), EOracleNotSettled);
let payout_coin = redeem_internal<Quote>(predict, manager, oracle, key, quantity, clock, ctx);
manager.deposit_permissionless(payout_coin, ctx);
}

# Preview range amounts

The get_range_trade_amounts() function returns the mint cost and redeem payout for a vertical range at the requested quantity.

github.com/MystenLabs/deepbookv3/packages/predict/sources/predict.move
public fun get_range_trade_amounts(
predict: &Predict,
oracle: &OracleSVI,
key: RangeKey,
quantity: u64,
clock: &Clock,
): (u64, u64) {
let (ask, bid) = predict.range_trade_prices(oracle, key, clock);
(math::mul(ask, quantity), math::mul(bid, quantity))
}

# Mint a vertical range

The mint_range() function buys a bounded range position. The range is keyed by oracle ID, expiry, lower strike, and higher strike.

github.com/MystenLabs/deepbookv3/packages/predict/sources/predict.move
public fun mint_range<Quote>(
predict: &mut Predict,
manager: &mut PredictManager,
oracle: &OracleSVI,
key: RangeKey,
quantity: u64,
clock: &Clock,
ctx: &mut TxContext,
) {
assert!(ctx.sender() == manager.owner(), ENotOwner);
assert!(!predict.trading_paused, ETradingPaused);
assert!(quantity > 0, EZeroQuantity);
predict.treasury_config.assert_quote_asset<Quote>();
predict.oracle_config.assert_range_key_matches(oracle, &key);
oracle_config::assert_live_oracle(oracle, clock);

    let lower = key.lower_strike();
    let higher = key.higher_strike();
    predict.vault.insert_range(oracle.id(), lower, higher, quantity);
    predict.refresh_oracle_risk(oracle);

    let (ask, _) = predict.range_trade_prices(oracle, key, clock);
    predict.assert_mintable_ask(oracle.id(), ask);
    let cost = math::mul(ask, quantity);

    let payment = manager.withdraw<Quote>(cost, ctx).into_balance();
    predict.vault.accept_payment(payment);
    predict.vault.assert_total_exposure(predict.risk_config.max_total_exposure_pct());
    manager.increase_range(key, quantity);

    event::emit(RangeMinted {
        predict_id: object::id(predict),
        manager_id: object::id(manager),
        trader: manager.owner(),
        quote_asset: type_name::with_defining_ids<Quote>(),
        oracle_id: key.oracle_id(),
        expiry: key.expiry(),
        lower_strike: lower,
        higher_strike: higher,
        quantity,
        cost,
        ask_price: ask,
    });

}

# Redeem a vertical range

The redeem_range() function sells a range position and deposits the payout into the owner's PredictManager.

github.com/MystenLabs/deepbookv3/packages/predict/sources/predict.move
public fun redeem_range<Quote>(
predict: &mut Predict,
manager: &mut PredictManager,
oracle: &OracleSVI,
key: RangeKey,
quantity: u64,
clock: &Clock,
ctx: &mut TxContext,
) {
assert!(ctx.sender() == manager.owner(), ENotOwner);
assert!(quantity > 0, EZeroQuantity);
predict.oracle_config.assert_range_key_matches(oracle, &key);
oracle_config::assert_quoteable_oracle(oracle, clock);

    manager.decrease_range(key, quantity);

    let lower = key.lower_strike();
    let higher = key.higher_strike();
    let payout;
    if (oracle.is_settled() && predict.vault.has_settled_oracle(oracle.id())) {
        let (_, settled_payout) = predict.get_range_trade_amounts(oracle, key, quantity, clock);
        predict.vault.redeem_settled_position(oracle.id(), quantity, settled_payout);
        payout = settled_payout;
    } else {
        predict.vault.remove_range(oracle.id(), lower, higher, quantity);
        predict.refresh_oracle_risk(oracle);

        let (_, live_payout) = predict.get_range_trade_amounts(oracle, key, quantity, clock);
        payout = live_payout;
    };

    let payout_balance = predict.vault.dispense_payout<Quote>(payout);
    let payout_coin = payout_balance.into_coin(ctx);
    manager.deposit(payout_coin, ctx);

    event::emit(RangeRedeemed {
        predict_id: object::id(predict),
        manager_id: object::id(manager),
        trader: manager.owner(),
        quote_asset: type_name::with_defining_ids<Quote>(),
        oracle_id: key.oracle_id(),
        expiry: key.expiry(),
        lower_strike: lower,
        higher_strike: higher,
        quantity,
        payout,
        bid_price: math::div(payout, quantity),
        is_settled: oracle.is_settled(),
    });

}

# Supply vault liquidity

The supply() function deposits an accepted quote asset into the vault and returns PLP shares.

github.com/MystenLabs/deepbookv3/packages/predict/sources/predict.move
public fun supply<Quote>(
predict: &mut Predict,
coin: Coin<Quote>,
clock: &Clock,
ctx: &mut TxContext,
): Coin<PLP> {
let amount = coin.value();
assert!(amount > 0, EZeroAmount);
predict.treasury_config.assert_quote_asset<Quote>();

    let vault_value = predict.vault.vault_value();
    predict.vault.accept_payment(coin.into_balance());
    predict.withdrawal_limiter.record_deposit(amount, clock);

    let total = predict.treasury_cap.total_supply();
    let shares = if (total == 0) {
        amount
    } else {
        assert!(vault_value > 0, EZeroVaultValue);
        mul_div_round_down(amount, total, vault_value)
    };
    assert!(shares > 0, EZeroSharesMinted);

    event::emit(Supplied {
        predict_id: object::id(predict),
        supplier: ctx.sender(),
        quote_asset: type_name::with_defining_ids<Quote>(),
        amount,
        shares_minted: shares,
    });
    coin::mint(&mut predict.treasury_cap, shares, ctx)

}

# Withdraw vault liquidity

The withdraw() function burns PLP shares and returns the selected quote asset when the requested amount is available after max payout coverage.

github.com/MystenLabs/deepbookv3/packages/predict/sources/predict.move
public fun withdraw<Quote>(
predict: &mut Predict,
lp_coin: Coin<PLP>,
clock: &Clock,
ctx: &mut TxContext,
): Coin<Quote> {
let vault_value = predict.vault.vault_value();
let shares_burned = lp_coin.value();
assert!(shares_burned > 0, EZeroAmount);
let amount = predict.shares_to_amount(shares_burned, vault_value);
let balance = predict.vault.balance();
let max_payout = predict.vault.total_max_payout();
let available = if (balance > max_payout) {
balance - max_payout
} else {
0
};
assert!(amount <= available, EWithdrawExceedsAvailable);
predict.withdrawal_limiter.consume(amount, clock);
predict.treasury_cap.burn(lp_coin);
event::emit(Withdrawn {
predict_id: object::id(predict),
withdrawer: ctx.sender(),
quote_asset: type_name::with_defining_ids<Quote>(),
amount,
shares_burned,
});
predict.vault.dispense_payout<Quote>(amount).into_coin(ctx)
}

# Compact settled oracle exposure

The compact_settled_oracle() function lets an authorized oracle operator compact settled strike-matrix exposure into constant-size settled state.

github.com/MystenLabs/deepbookv3/packages/predict/sources/predict.move
public fun compact_settled_oracle(
predict: &mut Predict,
oracle: &OracleSVI,
oracle_cap: &OracleSVICap,
) {
oracle::assert_authorized_cap(oracle, oracle_cap);
assert!(oracle.is_settled(), EOracleNotSettled);
let settlement = oracle.settlement_price().destroy_some();
predict.vault.compact_settled_oracle_if_needed(oracle.id(), settlement);
}

# Read protocol configuration

These read functions expose trading pause state, accepted quote assets, pricing parameters, risk limits, ask bounds, and currently available withdrawal amount.

github.com/MystenLabs/deepbookv3/packages/predict/sources/predict.move
public fun ask_bounds(predict: &Predict, oracle_id: ID): (u64, u64) {
predict.resolve_ask_bounds(oracle_id)
}

public fun trading_paused(predict: &Predict): bool {
predict.trading_paused
}

public fun accepted_quotes(predict: &Predict): &VecSet<TypeName> {
predict.treasury_config.accepted_quotes()
}

public fun base_spread(predict: &Predict): u64 {
predict.pricing_config.base_spread()
}

public fun min_spread(predict: &Predict): u64 {
predict.pricing_config.min_spread()
}

public fun utilization_multiplier(predict: &Predict): u64 {
predict.pricing_config.utilization_multiplier()
}

public fun max_total_exposure_pct(predict: &Predict): u64 {
predict.risk_config.max_total_exposure_pct()
}

public fun available_withdrawal(predict: &Predict, clock: &Clock): u64 {
predict.withdrawal_limiter.available_withdrawal(clock)
}

## Events

# Trading events

github.com/MystenLabs/deepbookv3/packages/predict/sources/predict.move
// === Events ===
public struct PositionMinted has copy, drop, store {
predict_id: ID,
manager_id: ID,
trader: address,
quote_asset: TypeName,
oracle_id: ID,
expiry: u64,
strike: u64,
is_up: bool,
quantity: u64,
cost: u64,
ask_price: u64,
}
public struct PositionRedeemed has copy, drop, store {
predict_id: ID,
manager_id: ID,
owner: address,
executor: address,
quote_asset: TypeName,
oracle_id: ID,
expiry: u64,
strike: u64,
is_up: bool,
quantity: u64,
payout: u64,
bid_price: u64,
is_settled: bool,
}
public struct RangeMinted has copy, drop, store {
predict_id: ID,
manager_id: ID,
trader: address,
quote_asset: TypeName,
oracle_id: ID,
expiry: u64,
lower_strike: u64,
higher_strike: u64,
quantity: u64,
cost: u64,
ask_price: u64,
}
public struct RangeRedeemed has copy, drop, store {
predict_id: ID,
manager_id: ID,
trader: address,
quote_asset: TypeName,
oracle_id: ID,
expiry: u64,
lower_strike: u64,
higher_strike: u64,
quantity: u64,
payout: u64,
bid_price: u64,
is_settled: bool,
}

# Liquidity events

github.com/MystenLabs/deepbookv3/packages/predict/sources/predict.move
public struct Supplied has copy, drop, store {
predict_id: ID,
supplier: address,
quote_asset: TypeName,
amount: u64,
shares_minted: u64,
}
public struct Withdrawn has copy, drop, store {
predict_id: ID,
withdrawer: address,
quote_asset: TypeName,
amount: u64,
shares_burned: u64,
}

# Configuration events

github.com/MystenLabs/deepbookv3/packages/predict/sources/predict.move
public struct TradingPauseUpdated has copy, drop, store {
predict_id: ID,
paused: bool,
}
public struct PricingConfigUpdated has copy, drop, store {
predict_id: ID,
base_spread: u64,
min_spread: u64,
utilization_multiplier: u64,
min_ask_price: u64,
max_ask_price: u64,
}
public struct OracleAskBoundsSet has copy, drop, store {
predict_id: ID,
oracle_id: ID,
min_ask_price: u64,
max_ask_price: u64,
}
public struct OracleAskBoundsCleared has copy, drop, store {
predict_id: ID,
oracle_id: ID,
}
public struct RiskConfigUpdated has copy, drop, store {
predict_id: ID,
max_total_exposure_pct: u64,
}
public struct QuoteAssetEnabled has copy, drop, store {
predict_id: ID,
quote_asset: TypeName,
}
public struct QuoteAssetDisabled has copy, drop, store {
predict_id: ID,
quote_asset: TypeName,
}

# Predict Manager

URL: https://docs.sui.io/onchain-finance/deepbook-predict/contract-information/predict-manager

The `PredictManager` is a per-user shared accountobject **Object** The basic unit of storage on Sui. . It wraps aDeepBook **DeepBook** A decentralized central limit order book (CLOB) built on Sui.`BalanceManager` , stores quote balances, and tracks Predict positions internally.

Each user should create one manager and reuse it. Binary positions and vertical ranges are not separate onchain objects; they are quantities stored inside the manager.

## API

# Read owner, balances, and position quantities

Use these functions to read the manager owner, deposited asset balances, binary position quantities, and range quantities.

github.com/MystenLabs/deepbookv3/packages/predict/sources/predict_manager.move
public fun owner(self: &PredictManager): address {
self.owner
}

public fun balance<T>(self: &PredictManager): u64 {
self.balance_manager.balance<T>()
}

public fun position(self: &PredictManager, key: MarketKey): u64 {
if (self.positions.contains(key)) {
self.positions[key]
} else {
0
}
}

public fun range_position(self: &PredictManager, key: RangeKey): u64 {
if (self.range_positions.contains(key)) {
self.range_positions[key]
} else {
0
}
}

# Deposit quote assets

The manager owner deposits quote assets before minting positions or ranges.

github.com/MystenLabs/deepbookv3/packages/predict/sources/predict_manager.move
public fun deposit<T>(self: &mut PredictManager, coin: Coin<T>, ctx: &TxContext) {
assert!(ctx.sender() == self.owner, EInvalidOwner);
self.balance_manager.deposit_with_cap(&self.deposit_cap, coin, ctx);
}

# Withdraw quote assets

The manager owner can withdraw quote assets from the manager.

github.com/MystenLabs/deepbookv3/packages/predict/sources/predict_manager.move
public fun withdraw<T>(self: &mut PredictManager, amount: u64, ctx: &mut TxContext): Coin<T> {
assert!(ctx.sender() == self.owner, EInvalidOwner);
self.balance_manager.withdraw_with_cap(&self.withdraw_cap, amount, ctx)
}

## Events

# PredictManagerCreated

Emitted when a new PredictManager is created.

github.com/MystenLabs/deepbookv3/packages/predict/sources/predict_manager.move
// === Events ===
public struct PredictManagerCreated has copy, drop, store {
manager_id: ID,
owner: address,
}

# Market Keys

URL: https://docs.sui.io/onchain-finance/deepbook-predict/contract-information/market-keys

`MarketKey` and `RangeKey` identify the internal position quantities stored in a `PredictManager` .

Use `MarketKey` for binary positions keyed by oracle ID, expiry, strike, and direction. Use `RangeKey` for vertical ranges keyed by oracle ID, expiry, lower strike, and higher strike.

## Binary position keys

# Create MarketKey values

Use up(), down(), or new() to create keys for binary positions.

github.com/MystenLabs/deepbookv3/packages/predict/sources/market_key/market_key.move
public fun up(oracle_id: ID, expiry: u64, strike: u64): MarketKey {
MarketKey { oracle_id, expiry, strike, direction: DIRECTION_UP }
}

public fun down(oracle_id: ID, expiry: u64, strike: u64): MarketKey {
MarketKey { oracle_id, expiry, strike, direction: DIRECTION_DOWN }
}

public fun new(oracle_id: ID, expiry: u64, strike: u64, is_up: bool): MarketKey {
let direction = if (is_up) { DIRECTION_UP } else { DIRECTION_DOWN };
MarketKey { oracle_id, expiry, strike, direction }
}

# Read MarketKey fields

github.com/MystenLabs/deepbookv3/packages/predict/sources/market_key/market_key.move
public fun oracle_id(key: &MarketKey): ID {
key.oracle_id
}

public fun expiry(key: &MarketKey): u64 {
key.expiry
}

public fun strike(key: &MarketKey): u64 {
key.strike
}

public fun is_up(key: &MarketKey): bool {
key.direction == DIRECTION_UP
}

public fun is_down(key: &MarketKey): bool {
key.direction == DIRECTION_DOWN
}

## Range keys

# Create RangeKey values

Use new() to create a vertical range key. It aborts if lower_strike is not less than higher_strike.

github.com/MystenLabs/deepbookv3/packages/predict/sources/market_key/range_key.move
public fun new(oracle_id: ID, expiry: u64, lower_strike: u64, higher_strike: u64): RangeKey {
assert!(lower_strike < higher_strike, EInvalidStrikes);
RangeKey { oracle_id, expiry, lower_strike, higher_strike }
}

# Read RangeKey fields

github.com/MystenLabs/deepbookv3/packages/predict/sources/market_key/range_key.move
public fun oracle_id(key: &RangeKey): ID {
key.oracle_id
}

public fun expiry(key: &RangeKey): u64 {
key.expiry
}

public fun lower_strike(key: &RangeKey): u64 {
key.lower_strike
}

public fun higher_strike(key: &RangeKey): u64 {
key.higher_strike
}

## Structs

# MarketKey

github.com/MystenLabs/deepbookv3/packages/predict/sources/market_key/market_key.move
// === Structs ===

/// Key for a market position used to identify positions in PredictManager and Vault.
public struct MarketKey has copy, drop, store {
oracle_id: ID,
expiry: u64,
strike: u64,
direction: u8,
}

# RangeKey

github.com/MystenLabs/deepbookv3/packages/predict/sources/market_key/range_key.move
// === Structs ===

/// Key for a vertical range position used in PredictManager and Vault.
public struct RangeKey has copy, drop, store {
oracle_id: ID,
expiry: u64,
lower_strike: u64,
higher_strike: u64,
}

# Oracle

URL: https://docs.sui.io/onchain-finance/deepbook-predict/contract-information/oracle

`OracleSVI` is the market state for one underlying asset and one expiry. It stores spot and forward prices, SVI volatility surface parameters, activation state, the last update timestamp, and the settlement price after expiry.

## Lifecycle

An oracle starts inactive, becomes active after `activate()` , accepts live price and SVI updates before expiry, enters pending settlement at expiry, and becomes settled when the first post-expiry price update freezes the settlement price.

Mints require a live oracle. Redeems can use quoteable live or settled oracle state. After settlement, price and SVI updates are rejected.

## API

# Activate an oracle

The activate() function moves an oracle into the active state before expiry.

github.com/MystenLabs/deepbookv3/packages/predict/sources/oracle.move
public fun activate(oracle: &mut OracleSVI, cap: &OracleSVICap, clock: &Clock) {
assert_authorized_cap(oracle, cap);
assert!(!oracle.active, EOracleAlreadyActive);

    let now = clock.timestamp_ms();
    assert!(now < oracle.expiry, EOracleExpired);

    oracle.active = true;

    event::emit(OracleActivated {
        oracle_id: oracle.id.to_inner(),
        expiry: oracle.expiry,
        timestamp: now,
    });

}

# Update prices

The update_prices() function pushes high-frequency spot and forward prices. If the oracle is past expiry and not yet settled, this call freezes the settlement price instead of recording another live update.

github.com/MystenLabs/deepbookv3/packages/predict/sources/oracle.move
public fun update_prices(
oracle: &mut OracleSVI,
cap: &OracleSVICap,
prices: PriceData,
clock: &Clock,
) {
assert_authorized_cap(oracle, cap);
let oracle_status = oracle.status(clock);
assert!(oracle_status != status_settled(), EOracleSettled);

    let now = clock.timestamp_ms();
    let oracle_id = oracle.id.to_inner();

    if (oracle_status == status_pending_settlement()) {
        oracle.settlement_price = option::some(prices.spot);
        oracle.active = false;

        event::emit(OracleSettled {
            oracle_id,
            expiry: oracle.expiry,
            settlement_price: prices.spot,
            timestamp: now,
        });
        return
    };

    oracle.prices = prices;
    oracle.timestamp = now;

    event::emit(OraclePricesUpdated {
        oracle_id,
        spot: prices.spot,
        forward: prices.forward,
        timestamp: now,
    });

}

# Update SVI parameters

The update_svi() function pushes lower-frequency SVI volatility surface parameters before expiry.

github.com/MystenLabs/deepbookv3/packages/predict/sources/oracle.move
public fun update_svi(oracle: &mut OracleSVI, cap: &OracleSVICap, svi: SVIParams, clock: &Clock) {
assert_authorized_cap(oracle, cap);
let oracle_status = oracle.status(clock);
assert!(oracle_status != status_settled(), EOracleSettled);
assert!(oracle_status != status_pending_settlement(), EOracleExpired);

    let now = clock.timestamp_ms();

    oracle.svi = svi;

    event::emit(OracleSVIUpdated {
        oracle_id: oracle.id.to_inner(),
        a: svi.a,
        b: svi.b,
        rho: svi.rho,
        m: svi.m,
        sigma: svi.sigma,
        timestamp: now,
    });

}

# Read oracle state

Use these functions to read oracle identifiers, underlying asset, prices, SVI parameters, expiry, timestamp, settlement, and lifecycle status.

github.com/MystenLabs/deepbookv3/packages/predict/sources/oracle.move
public fun id(oracle: &OracleSVI): ID {
oracle.id.to_inner()
}

public fun underlying_asset(oracle: &OracleSVI): String {
oracle.underlying_asset
}

public fun spot_price(oracle: &OracleSVI): u64 {
oracle.prices.spot
}

public fun forward_price(oracle: &OracleSVI): u64 {
oracle.prices.forward
}

public fun prices(oracle: &OracleSVI): PriceData {
oracle.prices
}

public fun svi(oracle: &OracleSVI): SVIParams {
oracle.svi
}

public fun expiry(oracle: &OracleSVI): u64 {
oracle.expiry
}

public fun timestamp(oracle: &OracleSVI): u64 {
oracle.timestamp
}

public fun settlement_price(oracle: &OracleSVI): Option<u64> {
oracle.settlement_price
}

public fun is_settled(oracle: &OracleSVI): bool {
oracle.settlement_price.is_some()
}

public fun is_active(oracle: &OracleSVI): bool {
oracle.active
}

public fun status(oracle: &OracleSVI, clock: &Clock): u8 {
if (oracle.is_settled()) {
STATUS_SETTLED
} else if (clock.timestamp_ms() >= oracle.expiry) {
STATUS_PENDING_SETTLEMENT
} else if (!oracle.active) {
STATUS_INACTIVE
} else {
STATUS_ACTIVE
}
}

# Create price and SVI data

These helper constructors build PriceData and SVIParams values for oracle updates.

github.com/MystenLabs/deepbookv3/packages/predict/sources/oracle.move
public fun new_price_data(spot: u64, forward: u64): PriceData {
PriceData { spot, forward }
}

public fun new_svi_params(a: u64, b: u64, rho: i64::I64, m: i64::I64, sigma: u64): SVIParams {
SVIParams { a, b, rho, m, sigma }
}

# Read status constant

These functions return the numeric status values used by status().

github.com/MystenLabs/deepbookv3/packages/predict/sources/oracle.move
public fun status_inactive(): u8 {
STATUS_INACTIVE
}
public fun status_active(): u8 {
STATUS_ACTIVE
}
public fun status_pending_settlement(): u8 {
STATUS_PENDING_SETTLEMENT
}
public fun status_settled(): u8 {
STATUS_SETTLED
}

## Structs

# OracleSVI

github.com/MystenLabs/deepbookv3/packages/predict/sources/oracle.move
/// Shared oracle object storing SVI volatility surface data.
/// One oracle per underlying + expiry combination.
public struct OracleSVI has key {
id: UID,
/// IDs of oracle caps authorized to update this oracle
authorized_caps: VecSet<ID>,
/// The underlying asset this oracle tracks (e.g., "BTC", "ETH")
underlying_asset: String,
/// Expiration timestamp in milliseconds
expiry: u64,
/// Whether the oracle is active
active: bool,
/// Spot and forward prices (high frequency updates)
prices: PriceData,
/// SVI volatility surface parameters (low frequency updates)
svi: SVIParams,
/// Timestamp of last update in milliseconds
timestamp: u64,
/// Settlement price, frozen on first update after expiry
settlement_price: Option<u64>,
}

# PriceData and SVIParams

github.com/MystenLabs/deepbookv3/packages/predict/sources/oracle.move
/// Price data updated at high frequency (~1s).
/// All values scaled by FLOAT_SCALING (1e9).
public struct PriceData has copy, drop, store {
/// Current spot price of the underlying
spot: u64,
/// Forward price for this expiry
forward: u64,
}

// === Structs ===

/// SVI volatility surface parameters.
/// All values scaled by FLOAT_SCALING (1e9).
public struct SVIParams has copy, drop, store {
/// Overall variance level (always >= 0)
a: u64,
/// Slope of the smile wings (always >= 0)
b: u64,
/// Signed skew parameter (typically negative - puts more expensive)
rho: i64::I64,
/// Signed horizontal shift parameter
m: i64::I64,
/// ATM curvature / smoothness (always >= 0)
sigma: u64,
}

## Events

# Oracle events

github.com/MystenLabs/deepbookv3/packages/predict/sources/oracle.move
// === Events ===
public struct OracleActivated has copy, drop, store {
oracle_id: ID,
expiry: u64,
timestamp: u64,
}
public struct OraclePricesUpdated has copy, drop, store {
oracle_id: ID,
spot: u64,
forward: u64,
timestamp: u64,
}
public struct OracleSVIUpdated has copy, drop, store {
oracle_id: ID,
a: u64,
b: u64,
rho: i64::I64,
m: i64::I64,
sigma: u64,
timestamp: u64,
}
public struct OracleSettled has copy, drop, store {
oracle_id: ID,
expiry: u64,
settlement_price: u64,
timestamp: u64,
}

# Vault

URL: https://docs.sui.io/onchain-finance/deepbook-predict/contract-information/vault

The Predict vault holds accepted quote assets and takes the opposite side of every trade. `predict.move` owns pricing and trading orchestration; `vault.move` is the state machine for balances, exposure, mark-to-market liability, max payout, and settled-oracle compaction.

LPs interact with the vault through `predict::supply` and `predict::withdraw` , which mint and burn `PLP` shares. See [Predict](/onchain-finance/deepbook-predict/contract-information/predict) for those public liquidity entry points.

## Read functions

Use these functions to read total vault balance, concrete asset balances, total mark-to-market liability, vault value, and total max payout.

github.com/MystenLabs/deepbookv3/packages/predict/sources/vault/vault.move
public fun balance(vault: &Vault): u64 {
vault.balance
}
public fun asset_balance<T>(vault: &Vault): u64 {
let key = BalanceKey<T> {};
if (vault.balances.contains(key)) {
let balance: &Balance<T> = &vault.balances[key];
balance.value()
} else {
0
}
}
public fun total_mtm(vault: &Vault): u64 {
vault.total_mtm
}
public fun vault_value(vault: &Vault): u64 {
assert!(vault.balance >= vault.total_mtm, EMtmExceedsBalance);
vault.balance - vault.total_mtm
}
public fun total_max_payout(vault: &Vault): u64 {
vault.total_max_payout
}

## Structs

# Vault

github.com/MystenLabs/deepbookv3/packages/predict/sources/vault/vault.move
public struct Vault has store {
/// Concrete balances stored per accepted quote asset type.
balances: Bag,
/// Shared treasury balance tracked in quote units.
balance: u64,
/// Per-oracle matrix for strike-level position tracking.
oracle_matrices: Table<ID, StrikeMatrix>,
/// Per-oracle compact state used after settlement compaction.
settled_oracles: Table<ID, SettledOracleState>,
/// Sum of all oracle matrix MTM values.
total_mtm: u64,
/// Sum of all oracle matrix max payout values.
total_max_payout: u64,
}

# SettledOracleState

After settlement compaction, the vault stores compact per-oracle remaining quantity and liability.

github.com/MystenLabs/deepbookv3/packages/predict/sources/vault/vault.move
public struct SettledOracleState has copy, drop, store {
remaining_quantity: u64,
remaining_liability: u64,
}

# PLP

PLP is the LP share coin minted when users supply vault liquidity.

github.com/MystenLabs/deepbookv3/packages/predict/sources/vault/plp.move
public struct PLP has drop {}

# Registry

URL: https://docs.sui.io/onchain-finance/deepbook-predict/contract-information/registry

The `Registry` sharedobject **Object** The basic unit of storage on Sui. tracks the Predictobject ID and the oracle IDs created by each `OracleSVICap` . The registrymodule **Module** A component of a Move package that defines interaction with on-chain objects. also exposes admin entry points for setup, quote asset management, oracle creation, pricing configuration, risk configuration, and the withdrawal limiter.

Most app integrations do not call these functions directly. They are operator and governance surfaces for deploying and maintaining the protocol.

## API

# registeredobject

Use these functions to read the active Predict object ID and the oracle IDs associated with an oracle cap.

github.com/MystenLabs/deepbookv3/packages/predict/sources/registry.move
public fun predict_id(registry: &Registry): Option<ID> {
registry.predict_id
}

public fun oracle_ids(registry: &Registry, cap_id: ID): vector<ID> {
if (registry.oracle_ids.contains(cap_id)) {
registry.oracle_ids[cap_id]
} else {
vector[]
}
}

# Create the Predictobject

The create_predict() function creates the shared Predict object once for a quote asset and records its ID in the registry.

github.com/MystenLabs/deepbookv3/packages/predict/sources/registry.move
public fun create_predict<Quote>(
registry: &mut Registry,
\_admin_cap: &AdminCap,
currency: &Currency<Quote>,
treasury_cap: TreasuryCap<PLP>,
clock: &Clock,
ctx: &mut TxContext,
): ID {
assert!(registry.predict_id.is_none(), EPredictAlreadyCreated);

    let predict_id = predict::create<Quote>(currency, treasury_cap, clock, ctx);
    registry.predict_id = option::some(predict_id);

    event::emit(PredictCreated { predict_id });

    predict_id

}

# Create and register oracle caps

Oracle caps authorize oracle operators to update oracles and tighten per-oracle ask bounds.

github.com/MystenLabs/deepbookv3/packages/predict/sources/registry.move
public fun create_oracle_cap(\_admin_cap: &AdminCap, ctx: &mut TxContext): OracleSVICap {
oracle::create_oracle_cap(ctx)
}

public fun register_oracle_cap(oracle: &mut OracleSVI, \_admin_cap: &AdminCap, cap: &OracleSVICap) {
oracle::register_cap(oracle, cap);
}

# Create an oracle

The create_oracle() function creates an OracleSVI, associates it with the calling cap, and initializes the Predict vault's strike grid for that oracle.

github.com/MystenLabs/deepbookv3/packages/predict/sources/registry.move
public fun create_oracle(
registry: &mut Registry,
predict: &mut Predict,
\_admin_cap: &AdminCap,
cap: &OracleSVICap,
underlying_asset: String,
expiry: u64,
min_strike: u64,
tick_size: u64,
ctx: &mut TxContext,
): ID {
assert_valid_strike_grid(min_strike, tick_size);
let oracle_id = oracle::create_oracle(underlying_asset, expiry, ctx);
let cap_id = object::id(cap);

    if (!registry.oracle_ids.contains(cap_id)) {
        registry.oracle_ids.add(cap_id, vector[]);
    };
    registry.oracle_ids[cap_id].push_back(oracle_id);
    predict.add_oracle_grid(oracle_id, min_strike, tick_size, ctx);
    event::emit(OracleCreated {
        oracle_id,
        oracle_cap_id: cap_id,
        underlying_asset,
        expiry,
        min_strike,
        tick_size,
    });

    oracle_id

}

# Manage quote assets

Admins can enable or disable quote assets for new supply and mint inflows.

github.com/MystenLabs/deepbookv3/packages/predict/sources/registry.move
public fun enable_quote_asset<Quote>(
predict: &mut Predict,
\_admin_cap: &AdminCap,
currency: &Currency<Quote>,
) {
predict.enable_quote_asset<Quote>(currency);
}

public fun disable_quote_asset<Quote>(predict: &mut Predict, \_admin_cap: &AdminCap) {
predict.disable_quote_asset<Quote>();
}

# Configure pricing

These functions control global spread, minimum spread, utilization multiplier, and global ask price bounds.

github.com/MystenLabs/deepbookv3/packages/predict/sources/registry.move
public fun set_base_spread(predict: &mut Predict, \_admin_cap: &AdminCap, spread: u64) {
predict.set_base_spread(spread);
}

public fun set_min_spread(predict: &mut Predict, \_admin_cap: &AdminCap, spread: u64) {
predict.set_min_spread(spread);
}

public fun set_utilization_multiplier(
predict: &mut Predict,
\_admin_cap: &AdminCap,
multiplier: u64,
) {
predict.set_utilization_multiplier(multiplier);
}

public fun set_min_ask_price(predict: &mut Predict, \_admin_cap: &AdminCap, value: u64) {
predict.set_min_ask_price(value);
}

public fun set_max_ask_price(predict: &mut Predict, \_admin_cap: &AdminCap, value: u64) {
predict.set_max_ask_price(value);
}

# Configure oracle ask bounds Oracle

Oracle ask-bound overrides are authorized by the oracle's cap and can only tighten the global bounds.

github.com/MystenLabs/deepbookv3/packages/predict/sources/registry.move
public fun set_oracle_ask_bounds(
predict: &mut Predict,
oracle: &OracleSVI,
cap: &OracleSVICap,
min: u64,
max: u64,
) {
predict.set_oracle_ask_bounds(oracle, cap, min, max);
}

public fun clear_oracle_ask_bounds(predict: &mut Predict, oracle: &OracleSVI, cap: &OracleSVICap) {
predict.clear_oracle_ask_bounds(oracle, cap);
}

# Configure trading and risk controls

These functions control the trading pause, max total exposure percentage, and LP withdrawal limiter.

github.com/MystenLabs/deepbookv3/packages/predict/sources/registry.move
public fun set_trading_paused(predict: &mut Predict, \_admin_cap: &AdminCap, paused: bool) {
predict.set_trading_paused(paused);
}

public fun set_max_total_exposure_pct(predict: &mut Predict, \_admin_cap: &AdminCap, pct: u64) {
predict.set_max_total_exposure_pct(pct);
}

public fun update_withdrawal_limiter(
predict: &mut Predict,
\_admin_cap: &AdminCap,
capacity: u64,
refill_rate_per_ms: u64,
clock: &Clock,
) {
predict.update_withdrawal_limiter(capacity, refill_rate_per_ms, clock);
}

public fun enable_withdrawal_limiter(predict: &mut Predict, \_admin_cap: &AdminCap, clock: &Clock) {
predict.enable_withdrawal_limiter(clock);
}

public fun disable_withdrawal_limiter(predict: &mut Predict, \_admin_cap: &AdminCap) {
predict.disable_withdrawal_limiter();
}

## Structs and events

# `Registry` and `AdminCap`

github.com/MystenLabs/deepbookv3/packages/predict/sources/registry.move
/// Shared object tracking global state.
public struct Registry has key {
id: UID,
/// ID of the Predict object (None if not yet created)
predict_id: Option<ID>,
/// OracleSVICap ID -> vector of oracle IDs created by that cap
oracle_ids: Table<ID, vector<ID>>,
}

// === Structs ===

/// Capability for admin operations.
/// Created during package init, transferred to deployer (multisig).
public struct AdminCap has key, store {
id: UID,
}

# Registry events

github.com/MystenLabs/deepbookv3/packages/predict/sources/registry.move
// === Events ===
public struct PredictCreated has copy, drop, store {
predict_id: ID,
}
public struct OracleCreated has copy, drop, store {
oracle_id: ID,
oracle_cap_id: ID,
underlying_asset: String,
expiry: u64,
min_strike: u64,
tick_size: u64,
}
