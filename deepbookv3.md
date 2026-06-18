# DeepBookV3

URL: https://docs.sui.io/onchain-finance/deepbookv3/deepbook

DeepBookV3 is a next-generation decentralized central limit order book (CLOB) built on Sui. DeepBookV3 leverages Sui's parallel execution and lowtransaction **Transaction** A number of commands that execute on inputs to define the result of the transaction. fees to bring a highly performant, low-latency exchange on chain.

The latest version delivers new features including flash loans, governance, improved account abstraction, and enhancements to the existing matching engine. This version also introduces its own tokenomics with the [DEEP token](https://suivision.xyz/coin/0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP) , which you can stake for additional benefits.

DeepBookV3 does not include an end-user interface for token trading. Rather, it offers built-in trading functionality that can support token trades from decentralized exchanges, wallets, or other apps. The available SDK abstracts away a lot of the complexities of interacting with the chain and buildingprogrammable transaction blocks **Programmable transaction blocks** Define all user transactions on Sui. , lowering the barrier of entry for active market making.

info
The documentation refers to theDeepBook **DeepBook** A decentralized central limit order book (CLOB) built on Sui. standard as "DeepBookV3" to avoid confusion with the recently deprecated version ofDeepBook (DeepBookV2).

## DeepBookV3 tokenomics

The DEEP token pays for trading fees on the exchange. Users can pay trading fees using DEEP tokens or input tokens, but owning, using, and staking DEEP continues to provide the most benefits to active DeepBookV3 traders on the Sui network.

As an example, governance determines the fee for paying in DEEP tokens, which is 20% lower than the fee for using input tokens.

Users that stake DEEP can enjoy taker and maker incentives. Taker incentives can reduce trading fees by half, dropping them to as low as 0.25 basis points (bps) on stable pairs and 2.5 bps on volatile pairs. Maker incentives are rebates earned based on maker volume generated.

## Liquidity support

Similar to order books for other market places, DeepBookV3's CLOB architecture enables you to enter market and limit orders. You can sell SUI tokens, referred to as an ask, can set your price, referred to as a limit order, or sell at the market's going rate. If you are seeking to buy SUI, referred to as a bid, you can pay the current market price or set a limit price. Limit orders only get fulfilled if the CLOB finds a match between a buyer and seller.

If you put in a limit order for 1,000 SUI, and no single seller is currently offering that quantity of tokens, DeepBookV3 automatically pools the current asks to meet the quantity of your bid.

## Transparency and privacy

As a CLOB, DeepBookV3 works like a digital ledger, logging bids and asks in chronological order and automatically finding matches between the two sides. It takes into account user parameters on trades such as prices.

The digital ledger is open so people can view the trades and prices, giving clear proof of fairness. You can use this transparency to create metrics and dashboards to monitor trading activity.

## Documentation

This documentation outlines the design of DeepBookV3, its public endpoints, and provides guidance for integrations. The SDK abstracts away a lot of the complexities of interacting with the chain and buildingprogrammable transaction blocks , lowering the barrier of entry for active market making.

## Open source

DeepBookV3 is open for community development. You can use the [Sui Improvement Proposals](https://github.com/sui-foundation/sips?ref=blog.sui.io) (SIPs) process to suggest changes to make DeepBookV3 better.

[## Design

Learn about DeepBookV3 design, including the Pool, PoolRegistry, and BalanceManager shared objects.

→](/onchain-finance/deepbookv3/design)
[## Contract Information

In this section

- BalanceManager
- Orders
- Flash Loans
- Swaps
- Staking and Governance
- Permissionless Pool Creation

* 3 more

→](/onchain-finance/deepbookv3/contract-information)
[## DeepBookV3 SDK

In this section

- BalanceManager
- Pools
- Orders
- Flash Loans
- Swaps
- Staking and Governance

→](/onchain-finance/deepbookv3-sdk/)
[## Indexer

DeepBookV3 Indexer provides streamlined, real-time access to order book and trading data from the DeepBookV3 protocol. It acts as a centralized service to aggregate and expose critical data points.

→](/onchain-finance/deepbookv3/deepbookv3-indexer)

# Design

URL: https://docs.sui.io/onchain-finance/deepbookv3/design

At a high level, the DeepBookV3 design follows the following flow, which revolves around three shared objects:

- `Pool` : A sharedobject **Object** The basic unit of storage on Sui. that represents one market and is responsible for managing its order book, users, stakes, and so on. See the Pool shared object section to learn more.
- `PoolRegistry` : Used only during pool creation, it makes sure that duplicate pools are not created and maintainspackage **Package** Smart contracts on Sui. versioning.
- `BalanceManager` : Used to source a user's funds when placing orders. A single `BalanceManager` can be used between all pools. See [BalanceManager](/onchain-finance/deepbookv3/contract-information/balance-manager) to learn more.
  ![1](/assets/images/DBv3Architecture-65523469d7d2de40637da8d3675bf996.png)

## Pool sharedobject

All public facing functions take in the `Pool` sharedobject as a mutable or immutable reference. `Pool` is made up of three distinct components:

- `Book`
- `State`
- `Vault`
  Logic is isolated between components and each component builds on top of the previous one. By maintaining a book, then state, then vault relationship, DeepBookV3 can provide data availability guarantees, improve code readability, and help make maintaining and upgrading the protocol easier.

![Pool Modules](/assets/images/pool-e04c69f5f1bb6fac875581fe0ea421de.png)

### Book

This component is made up of the main `Book`module **Module** A component of a Move package that defines interaction with on-chain objects. along with `Fill` , `OrderInfo` , and `Order`modules . The `Book` struct maintains two `BigVector<Order>` objects for bids and asks, as well as some metadata. It is responsible for storing, matching, modifying, and removing `Orders` .

When placing an order, an `OrderInfo` is first created. If applicable, it is first matched against existing maker orders, accumulating `Fill` s in the process. Any remaining quantity will be used to create an `Order`object and injected into the book. By the end of book processing, the `OrderInfo`object has enough information to update all relevant users and the overall state.

### State

`State` stores `Governance` , `History` , and `Account` . It processes all requests, updating at least one of these stored structs.

#### Governance

The `Governance`module stores data related to the pool's trading params. These parameters are the taker fee, maker fee, and the stake required. Stake required represents the amount of DEEP tokens that a user must have staked in this specific pool to be eligible for taker and maker incentives.

Everyepoch **Epoch** A period of time defined by the network. , users with nonzero stake can submit a proposal to change these parameters. The proposed fees are bounded.

table { width: 100%; display: inline-table; } th:nth-child(1), td:nth-child(1) { width: 15%; } th:nth-child(2), td:nth-child(2) { width: 15%; }
| min_value (bps) | max_value (bps) | Pool type | Taker or maker
| 1 | 10 | Volatile | Taker
| 0 | 5 | Volatile | Maker
| 0.1 | 1 | Stable | Taker
| 0 | 0.5 | Stable | Maker
| 0 | 0 | Whitelisted | Taker and maker

Users can also vote on live proposals. When a proposal exceeds thequorum **Quorum** A set of validators whose combined voting power is greater than 2/3 of the total. , the new trade parameters are queued to go live from the followingepoch and onwards. Proposals and votes are reset everyepoch . Users can start submitting and voting on proposals theepoch following their stake.Quorum is equivalent to half of the total voting power. A user's voting power is calculated with the following formula where V {V} V is the voting power, S {S} S is the amount staked, and V c {V_c} V c is the voting power cutoff. V c {V_c} V c is currently set to 100,000 DEEP.

V = min ⁡ ( S , V c ) + max ⁡ ( S − V c , 0 ) \LARGE V=\min\lparen S,V_c \rparen + \max\lparen \sqrt{S} - \sqrt{V_c} ,0 \rparen V= min ( S ,V c )+ max ( S− V c ,0 )

The following diagram helps visualize the governance lifecycle.

![DeepBookV3 Governance Timeline](/assets/images/governance-166bcc0f64efe0075432b3afc50f1f0a.png)

#### History

The `History`module stores aggregated volumes, trading params, fees collected and fees to burn for the currentepoch and previous epochs. During order processing, fills are used to calculate and update the total volume. Additionally, if the maker of the trade has enough stake, the total staked volume is also updated.

The first operation of everyepoch will trigger an update, moving the currentepoch data into historic data, and resetting the currentepoch data.

User rebate calculations are done in thismodule . During everyepoch , a maker is eligible for rebates as long as their DEEP staked is over the stake required and have contributed in maker volume. The following formula is used to calculate maker fees, quoted from the [Whitepaper:DeepBook **DeepBook** A decentralized central limit order book (CLOB) built on Sui. Token](/assets/files/deepbook-3e24e6e1deeb8cd860682c1fb473b597.pdf) document. Details on maker incentives can be found in section 2.2 of the whitepaper.

> The computation of incentives – which happens after anepoch ends and is only given to makers who have staked the required number of DEEP tokens in advance – is calculated in Equation (3) for a given maker i {i} i . Equation (3) introduces several new variables. First, M {M} M refers to the set of makers who stake a sufficient number of DEEP tokens, and M ˉ \bar{M} M ˉ refers to the set of makers who do not fulfill this condition. Second, F {F} F refers to total fees (collected both from takers and the maker) that a maker's volume has generated in a givenepoch . Third, L {L} L refers to the total liquidity provided by a maker – and specifically the liquidity traded, not just the liquidity quoted. Finally, the critical point p {p} p is the "phaseout" point, at which – if total liquidity provided by other makers' crosses this point – incentives are zero for the maker in thatepoch . This point p {p} p is constant for all makers in a pool andepoch .

Incentives for Maker i = max ⁡ [ F i ( 1 + ∑ j ∈ M ˉ F j ∑ j ∈ M F j ) ( 1 − ∑ j ∈ M ∪ M ˉ L j − L i p ) , 0 ] \LARGE \textsf {Incentives } \textsf {for } \textsf {Maker } i = \max\Bigg\lbrack F*i\Bigg\lparen 1 + \large\cfrac{\sum*{j \in \bar{M}} F*j} {\sum*{j \in M} F*j} \Bigg\rparen\Bigg\lparen \LARGE 1 - \large\cfrac{\sum*{j \in M \cup \bar{M}} L_j - L_i}{p}\Bigg\rparen \LARGE ,0 \Bigg\rbrack Incentives for Maker i= max[ F i ( 1+ ∑ j ∈ MF j∑ j ∈ M ˉF j ) ( 1− p∑ j ∈ M ∪ M ˉL j−L i ) ,0 ] (3)

In essence, if the total volume during anepoch is greater than the median volume from the last 28 days, then there are no rebates. The lower the volume compared to the median, the more rebates are available. The maximum amount of rebates for anepoch is equivalent to the total amount of DEEP collected during thatepoch . Remaining DEEP is burned.

#### Account

`Account` represents a single user and their relevant data. Everything related to volumes, stake, voted proposal, unclaimed rebates, and balances to be transferred. There is a one to one relationship between a `BalanceManager` and an `Account` .

Everyepoch , the first action that a user performs will update their account, triggering a calculation of any potential rebates from the previousepoch , as well as resetting their volumes for the currentepoch . Any new stakes from the previousepoch become active.

Each account has settled and owed balances. Settled balances are what the pool owes to the user, and owed balances are what the user owes to the pool. For example, when placing an order, the user's owed balances increase, representing the funds that the user has to pay to place that order. Then, if a maker order is taken by another user, the maker's settled balances increase, representing the funds that the maker is owed.

### Vault

Everytransaction **Transaction** A number of commands that execute on inputs to define the result of the transaction. that a user performs on DeepBookV3 resets their settled and owed balances. The vault then processes these balances for the user, deducting or adding to funds to their `BalanceManager` .

The vault also stores the `DeepPrice` struct. Thisobject holds up to 100 data points representing the conversion rate between the pool's base or quote asset and DEEP. These data points are sourced from a whitelisted pool, DEEP/USDC or DEEP/SUI. This conversion rate is used to determine the quantity of DEEP tokens required to pay for trading fees.

### BigVector

`BigVector` is an arbitrary sized vector-like data structure, implemented using an onchain B+ Tree to support almost constant time (log base max_fan_out) random access, insertion and removal.

Iteration is supported by exposing access to leaf nodes (slices). Finding the initial slice can be done in almost constant time, and subsequently finding the previous or next slice can also be done in constant time.

Nodes in the B+ Tree are stored as individual dynamic fields hanging off the `BigVector` .

## Place limit order flow

The following diagram of the lifecycle of an order placement action helps visualize the book, then state, then vault flow.

![Place limit order flow](/assets/images/placeorder-070837ca2be2d30e4a77afd64082957a.png)

### Pool

In the `Pool`module , `place_order_int` is called with the user's input parameters. In this function, four things happen in order:

1. An `OrderInfo` is created.
2. The `Book` function `create_order` is called.
3. The `State` function `process_create` is called.
4. The `Vault` function `settle_balance_manager` is called.

### Book

The order creation within the book involves three primary tasks:

- Validate inputs.
- Match against existing orders.
- Inject any remaining quantity into the order book as a limit order.
  Validation of inputs ensures that quantity, price, timestamp, and order type are within expected ranges.

To match an `OrderInfo` against the book, the list of `Order` s is iterated in the opposite side of the book. If there is an overlap in price and the existing maker order has not expired, then DeepBookV3 matches their quantities and generates a `Fill` . DeepBookV3 appends that fill to the `OrderInfo` fills, to use later in state. DeepBookV3 updates the existing maker order quantities and status during each match, and removes them from the book if they are completely filled or expired.

Finally, if the `OrderInfo`object has any remaining quantity, DeepBookV3 converts it into a compact `Order`object and injects it into the order book. `Order` has the minimum amount of data necessary for matching, while `OrderInfo` has the maximum amount of data for general processing.

Regardless of direction or order type, all DeepBookV3 matching is processed in a single function.

### State

The `process_create` function in `State` handles the processing of an order creation event within the pool's state: calculating thetransaction amounts and fees for the order, and updating the account volumes accordingly.

First, the function processes the list of fills from the `OrderInfo`object , updating volumes tracked and settling funds for the makers involved. Next, the function retrieves the account's total trading volume and active stake. It calculates the taker's fee based on the user's account stake and volume in DEEP tokens, while the maker fee is retrieved from the governance trade parameters. To receive discounted taker fees, the account must have more than the minimum stake for the pool, and the trading volume in DEEP tokens must exceed the same threshold. If any quantity remains in the `OrderInfo`object , it is added to the account's list of orders as an `Order` and is already created in `Book` .

Finally, the function calculates the partial taker fills and maker order quantities, if there are any, with consideration for the taker and maker fees. It adds these to the previously settled and owed balances from the account. Trade history is updated with the total fees collected from the order and two tuples are returned to `Pool` , settled and owed balances, in (base, quote, DEEP) format, ensuring the correct assets are transferred in `Vault` .

### Vault

The `settle_balance_manager` function in `Vault` is responsible for managing thetransfer **Transfer** Changing the owner of an asset. of any settled and owed amounts for the `BalanceManager` .

First, the function validates that a trader is authorized to use the `BalanceManager` .

Then, for each asset type the process compares `balances_out` against `balances_in` . If the `balances_out` total exceeds `balances_in` , the function splits the difference from the vault's balance and deposits it into the `BalanceManager` . Conversely, if the `balances_in` total exceeds `balances_out` , the function withdraws the difference from the `BalanceManager` and joins it to the vault's balance.

This process is repeated for base, quote, and DEEP asset balances, ensuring all asset balances are accurately reflected and settled between the vault and the `BalanceManager` .

# Contract Information

URL: https://docs.sui.io/onchain-finance/deepbookv3/contract-information

This page contains the contractaddresses **Address** A unique, anonymous identity on a blockchain network. , supported coins, and pool information for DeepBookV3 on SuiMainnet **Mainnet** Production network for live transactions and real-value assets. .

## Contract versions

DeepBookV3 uses upgradeable contracts. When a contract is upgraded, only `DEEPBOOK_PACKAGE_ID` needs to be updated - previous versions remain compatible unless noted. A redeployment would require updating `DEEPBOOK_PACKAGE_ID` , `REGISTRY_ID` , and all pool IDs.

### Current version

| Parameter | Value
| Version | 6
| Package **Package** Smart contracts on Sui. ID | `0x337f4f4f6567fcd778d5454f27c16c70e2f274cc6377ea6249ddf491482ef497`
| Registry ID | `0xaf16199a2dff736e9f07a845f23c5da6df6f756eddb631aed9d24a93efc4549d`

### Version history

| Version | Date | Package ID | Changes
| 6 | Jan 7, 2026 | `0x337f4f4f6567fcd778d5454f27c16c70e2f274cc6377ea6249ddf491482ef497` | Final preparation for margin launch
| 5 | Dec 18, 2025 | `0x2d93777cc8b67c064b495e8606f2f8f5fd578450347bbe7b36e0bc03963c1c40` | Improvements for referral system
| 4 | Dec 9, 2025 | `0x00c1a56ec8c4c623a848b2ed2f03d23a25d17570b670c22106f336eb933785cc` | Referral system, penalty taker fees
| 3 | Jun 11, 2025 | `0xb29d83c26cdd2a64959263abbcfc4a6937f0c9fccaf98580ca56faded65be244` | Small bug fix for creating balance manager
| 2 | Apr 16, 2025 | `0xcaf6ba059d539a97646d47f0b9ddf843e138d215e2a12ca1f4585d386f7aec3a` | Input token fees, permissionless pool creation,gas **Gas** The computational cost of execution and object storage for a transaction. improvements
| 1 | Oct 10, 2024 | `0x2c8d603bc51326b8c13cef9dd07031a408a48dddb541963357661df5d3204809` | Original deployment

## Supported coins

# DEEP Token

| Parameter | Value
| Type | `0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP`
| Decimals | 6

# SUI Token

| Parameter | Value
| Type | `0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI`
| Decimals | 9

# Native USDC

| Parameter | Value
| Type | `0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC`
| Decimals | 6

# Native Bridged ETH (BETH)

| Parameter | Value
| Type | `0xd0e89b2af5e4910726fbcd8b8dd37bb79b29e5f83f7491bca830e94f7f226d29::eth::ETH`
| Decimals | 8

# Wormhole USDT (WUSDT)

| Parameter | Value
| Type | `0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN`
| Decimals | 6

# Wormhole USDC (WUSDC)

| Parameter | Value
| Type | `0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN`
| Decimals | 6

# NS Token

| Parameter | Value
| Type | `0x5145494a5f5100e645e4b0aa950fa6b68f614e8c59e17bc5ded3495123a79178::ns::NS`
| Decimals | 6

# TYPUS Token

| Parameter | Value
| Type | `0xf82dc05634970553615eef6112a1ac4fb7bf10272bf6cbe0f80ef44a6c489385::typus::TYPUS`
| Decimals | 9

# AUSD Token

| Parameter | Value
| Type | `0x2053d08c1e2bd02791056171aab0fd12bd7cd7efad2ab8f6b9c8902f14df2ff2::ausd::AUSD`
| Decimals | 6

# DRF Token

| Parameter | Value
| Type | `0x294de7579d55c110a00a7c4946e09a1b5cbeca2592fbb83fd7bfacba3cfeaf0e::drf::DRF`
| Decimals | 6

# SEND Token

| Parameter | Value
| Type | `0xb45fcfcc2cc07ce0702cc2d229621e046c906ef14d9b25e8e4d25f6e8763fef7::send::SEND`
| Decimals | 6

# xBTC Token

| Parameter | Value
| Type | `0x876a4b7bce8aeaef60464c11f4026903e9afacab79b9b142686158aa86560b50::xbtc::XBTC`
| Decimals | 8

# WAL Token

| Parameter | Value
| Type | `0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL`
| Decimals | 9

# IKA Token

| Parameter | Value
| Type | `0x7262fb2f7a3a14c888c438a3cd9b912469a58cf60f367352c46584262e8299aa::ika::IKA`
| Decimals | 9

# ALKIMI Token

| Parameter | Value
| Type | `0x1a8f4bc33f8ef7fbc851f156857aa65d397a6a6fd27a7ac2ca717b51f2fd9489::alkimi::ALKIMI`
| Decimals | 9

# LayerZero WBTC (LZWBTC)

| Parameter | Value
| Type | `0x0041f9f9344cac094454cd574e333c4fdb132d7bcc9379bcd4aab485b2a63942::wbtc::WBTC`
| Decimals | 8

# SUIUSDE Token

| Parameter | Value
| Type | `0x41d587e5336f1c86cad50d38a7136db99333bb9bda91cea4ba69115defeb1402::sui_usde::SUI_USDE`
| Decimals | 6

# USDSUI Token

| Parameter | Value
| Type | `0x44f838219cf67b058f3b37907b655f226153c18e33dfcd0da559a844fea9b1c1::usdsui::USDSUI`
| Decimals | 6

## Pools

info
Taker and maker fees are subject to change based on governance proposals. See [Staking and Governance](/onchain-finance/deepbookv3/contract-information/staking-governance) for more information on how fees can be adjusted through the governance process.

# DEEP/SUI

| Parameter | Value
| Pool ID | `0xb663828d6217467c8a1838a03793da896cbe745b150ebd57d82f814ca579fc22`
| Tick Size | 0.00001
| Lot Size | 1 DEEP
| Min Size | 10 DEEP
| Taker Fee | 0 bps
| Maker Fee | 0 bps

# DEEP/USDC

| Parameter | Value
| Pool ID | `0xf948981b806057580f91622417534f491da5f61aeaf33d0ed8e69fd5691c95ce`
| Tick Size | 0.00001
| Lot Size | 1 DEEP
| Min Size | 10 DEEP
| Taker Fee | 0 bps
| Maker Fee | 0 bps

# SUI/USDC

| Parameter | Value
| Pool ID | `0xe05dafb5133bcffb8d59f4e12465dc0e9faeaa05e3e342a08fe135800e3e4407`
| Tick Size | 0.00001
| Lot Size | 0.1 SUI
| Min Size | 1 SUI
| Taker Fee | 1 bps
| Maker Fee | 0 bps

# BETH/USDC

| Parameter | Value
| Pool ID | `0x1109352b9112717bd2a7c3eb9a416fff1ba6951760f5bdd5424cf5e4e5b3e65c`
| Tick Size | 0.001
| Lot Size | 0.0001 BETH
| Min Size | 0.001 BETH
| Taker Fee | 10 bps
| Maker Fee | 5 bps

# WUSDC/USDC

| Parameter | Value
| Pool ID | `0xa0b9ebefb38c963fd115f52d71fa64501b79d1adcb5270563f92ce0442376545`
| Tick Size | 0.00001
| Lot Size | 0.1 WUSDC
| Min Size | 1 WUSDC
| Taker Fee | 0 bps
| Maker Fee | 0 bps

# WUSDT/USDC

| Parameter | Value
| Pool ID | `0x4e2ca3988246e1d50b9bf209abb9c1cbfec65bd95afdacc620a36c67bdb8452f`
| Tick Size | 0.00001
| Lot Size | 0.1 WUSDT
| Min Size | 1 WUSDT
| Taker Fee | 1 bps
| Maker Fee | 0.5 bps

# NS/SUI

| Parameter | Value
| Pool ID | `0x27c4fdb3b846aa3ae4a65ef5127a309aa3c1f466671471a806d8912a18b253e8`
| Tick Size | 0.00001
| Lot Size | 0.1 NS
| Min Size | 1 NS
| Taker Fee | 10 bps
| Maker Fee | 5 bps

# NS/USDC

| Parameter | Value
| Pool ID | `0x0c0fdd4008740d81a8a7d4281322aee71a1b62c449eb5b142656753d89ebc060`
| Tick Size | 0.00001
| Lot Size | 0.1 NS
| Min Size | 1 NS
| Taker Fee | 10 bps
| Maker Fee | 5 bps

# TYPUS/SUI

| Parameter | Value
| Pool ID | `0xe8e56f377ab5a261449b92ac42c8ddaacd5671e9fec2179d7933dd1a91200eec`
| Tick Size | 0.00001
| Lot Size | 0.1 TYPUS
| Min Size | 1 TYPUS
| Taker Fee | 10 bps
| Maker Fee | 5 bps

# SUI/AUSD

| Parameter | Value
| Pool ID | `0x183df694ebc852a5f90a959f0f563b82ac9691e42357e9a9fe961d71a1b809c8`
| Tick Size | 0.0001
| Lot Size | 0.1 SUI
| Min Size | 1 SUI
| Taker Fee | 10 bps
| Maker Fee | 5 bps

# AUSD/USDC

| Parameter | Value
| Pool ID | `0x5661fc7f88fbeb8cb881150a810758cf13700bb4e1f31274a244581b37c303c3`
| Tick Size | 0.00001
| Lot Size | 0.1 AUSD
| Min Size | 1 AUSD
| Taker Fee | 1 bps
| Maker Fee | 0.5 bps

# DRF/SUI

| Parameter | Value
| Pool ID | `0x126865a0197d6ab44bfd15fd052da6db92fd2eb831ff9663451bbfa1219e2af2`
| Tick Size | 0.000001
| Lot Size | 1 DRF
| Min Size | 10 DRF
| Taker Fee | 10 bps
| Maker Fee | 5 bps

# SEND/USDC

| Parameter | Value
| Pool ID | `0x1fe7b99c28ded39774f37327b509d58e2be7fff94899c06d22b407496a6fa990`
| Tick Size | 0.000001
| Lot Size | 0.1 SEND
| Min Size | 1 SEND
| Taker Fee | 10 bps
| Maker Fee | 5 bps

# WAL/USDC

| Parameter | Value
| Pool ID | `0x56a1c985c1f1123181d6b881714793689321ba24301b3585eec427436eb1c76d`
| Tick Size | 0.000001
| Lot Size | 0.1 WAL
| Min Size | 1 WAL
| Taker Fee | 10 bps
| Maker Fee | 5 bps

# WAL/SUI

| Parameter | Value
| Pool ID | `0x81f5339934c83ea19dd6bcc75c52e83509629a5f71d3257428c2ce47cc94d08b`
| Tick Size | 0.000001
| Lot Size | 0.1 WAL
| Min Size | 1 WAL
| Taker Fee | 10 bps
| Maker Fee | 5 bps

# xBTC/USDC

| Parameter | Value
| Pool ID | `0x20b9a3ec7a02d4f344aa1ebc5774b7b0ccafa9a5d76230662fdc0300bb215307`
| Tick Size | 1
| Lot Size | 0.00001 xBTC
| Min Size | 0.00001 xBTC
| Taker Fee | 10 bps
| Maker Fee | 5 bps

# IKA/USDC

| Parameter | Value
| Pool ID | `0xfa732993af2b60d04d7049511f801e79426b2b6a5103e22769c0cead982b0f47`
| Tick Size | 0.000001
| Lot Size | 10 IKA
| Min Size | 10 IKA
| Taker Fee | 10 bps
| Maker Fee | 5 bps

# ALKIMI/SUI

| Parameter | Value
| Pool ID | `0x84752993c6dc6fce70e25ddeb4daddb6592d6b9b0912a0a91c07cfff5a721d89`
| Tick Size | 0.00001
| Lot Size | 0.1 ALKIMI
| Min Size | 1 ALKIMI
| Taker Fee | 10 bps
| Maker Fee | 5 bps

# LZWBTC/USDC

| Parameter | Value
| Pool ID | `0xf5142aafa24866107df628bf92d0358c7da6acc46c2f10951690fd2b8570f117`
| Tick Size | 1
| Lot Size | 0.00001 LZWBTC
| Min Size | 0.00001 LZWBTC
| Taker Fee | 10 bps
| Maker Fee | 5 bps

# SUIUSDE/USDC

| Parameter | Value
| Pool ID | `0x0fac1cebf35bde899cd9ecdd4371e0e33f44ba83b8a2902d69186646afa3a94b`
| Tick Size | 0.000001
| Lot Size | 0.1 SUIUSDE
| Min Size | 0.1 SUIUSDE
| Taker Fee | 1 bps
| Maker Fee | 0.5 bps

# SUI/SUIUSDE

| Parameter | Value
| Pool ID | `0x034f3a42e7348de2084406db7a725f9d9d132a56c68324713e6e623601fb4fd7`
| Tick Size | 0.0001
| Lot Size | 0.1 SUI
| Min Size | 0.1 SUI
| Taker Fee | 10 bps
| Maker Fee | 5 bps

# USDSUI/USDC

| Parameter | Value
| Pool ID | `0xa374264d43e6baa5aa8b35ff18ff24fdba7443b4bcb884cb4c2f568d32cdac36`
| Tick Size | 0.000001
| Lot Size | 0.1 USDSUI
| Min Size | 0.1 USDSUI
| Taker Fee | 1 bps
| Maker Fee | 0.5 bps

# SUI/USDSUI

| Parameter | Value
| Pool ID | `0x826eeacb2799726334aa580396338891205a41cf9344655e526aae6ddd5dc03f`
| Tick Size | 0.0001
| Lot Size | 0.1 SUI
| Min Size | 0.1 SUI
| Taker Fee | 10 bps
| Maker Fee | 5 bps

# BalanceManager

URL: https://docs.sui.io/onchain-finance/deepbookv3/contract-information/balance-manager

The `BalanceManager` sharedobject **Object** The basic unit of storage on Sui. holds all balances for different assets. To perform trades, pass a combination of `BalanceManager` and `TradeProof` into a [pool](/onchain-finance/deepbookv3/design#pool) . `TradeProof` s are generated in one of two ways, either by the `BalanceManager` owner directly, or by any `TradeCap` owner. The owner can generate a `TradeProof` without the risk ofequivocation **Equivocation** When an owned object pair is used concurrently in multiple non-finalized transactions. . The `TradeCap` owner, because it's an ownedobject , risksequivocation when generating a `TradeProof` . Generally, a high frequency trading engine trades as the default owner.

With exception to swaps, all interactions with DeepBookV3 require a `BalanceManager` as one of its inputs. When orders are matched, funds are transferred to or from the `BalanceManager` . You can use a single `BalanceManager` between all pools.

## API

Following are the different public functions that the `BalanceManager` exposes.

# Create a `BalanceManager`

The `new()` function creates a `BalanceManager` . Combine it with `share` , or else thetransaction **Transaction** A number of commands that execute on inputs to define the result of the transaction. fails. You can combine thetransaction with deposit calls, allowing you to create, deposit, then share the balance manager in onetransaction .

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/balance_manager.move
public fun new(ctx: &mut TxContext): BalanceManager {
let id = object::new(ctx);
event::emit(BalanceManagerEvent {
balance_manager_id: id.to_inner(),
owner: ctx.sender(),
});

    BalanceManager {
        id,
        owner: ctx.sender(),
        balances: bag::new(ctx),
        allow_listed: vec_set::empty(),
    }

}

# Create a `BalanceManager` with custom owner

The `new_with_custom_owner()` function creates a `BalanceManager` with a custom owner. Combine it with `share` , or else thetransaction fails. You can combine thetransaction with deposit calls, allowing you to create, deposit, then share the balance manager in onetransaction .

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/balance_manager.move
public fun new_with_custom_owner(owner: address, ctx: &mut TxContext): BalanceManager {
let id = object::new(ctx);
event::emit(BalanceManagerEvent {
balance_manager_id: id.to_inner(),
owner,
});

    BalanceManager {
        id,
        owner,
        balances: bag::new(ctx),
        allow_listed: vec_set::empty(),
    }

}

# Create a `BalanceManager` with custom owner and capabilities

The `new_with_custom_owner_caps<App>()` function creates a `BalanceManager` with a custom owner and returns all three capabilities ( `DepositCap` , `WithdrawCap` , and `TradeCap` ) in a single call. This function requires authorization through theDeepBook **DeepBook** A decentralized central limit order book (CLOB) built on Sui. Registry with a specific `App` type. Combine the balance manager with `share` , or else thetransaction fails. This is a convenient way to set up a complete balance manager with all necessary capabilities in onetransaction .

caution
Move **Move** An open source programming language used for all activity on Sui. code using DeepBookV3 uses `DepositCap` , `WithdrawCap` , and `TradeCap` , while the DeepBookV3 SDK uses `depositCap` , `withdrawCap` , and `tradeCap` .

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/balance_manager.move #[deprecated(note = b"This function is deprecated, use `new_with_custom_owner_caps_v2` instead.")] #[allow(unused_type_parameter)]
public fun new_with_custom_owner_caps<App: drop>(
\_deepbook_registry: &Registry,
\_owner: address,
\_ctx: &mut TxContext,
): (BalanceManager, DepositCap, WithdrawCap, TradeCap) { abort 1337 }

# Mint a `TradeCap`

The owner of a `BalanceManager` can mint a `TradeCap` and send it to anotheraddress **Address** A unique, anonymous identity on a blockchain network. . Upon receipt, thataddress will have the capability to place orders with this `BalanceManager` . Theaddress owner cannot deposit or withdraw funds, however. The maximum total number of `TradeCap` , `WithdrawCap` , and `DepositCap` that can be assigned for a `BalanceManager` is `1000` . If this limit is reached, one or more existing caps must be revoked before minting new ones. You can also use `revoke_trade_cap` to revoke `DepositCap` and `WithdrawCap` .

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/balance_manager.move
/// Mint a `TradeCap`, only owner can mint a `TradeCap`.
public fun mint_trade_cap(balance_manager: &mut BalanceManager, ctx: &mut TxContext): TradeCap {
balance_manager.validate_owner(ctx);
balance_manager.mint_trade_cap_internal(ctx)
}

/// Revoke a `TradeCap`. Only the owner can revoke a `TradeCap`.
/// Can also be used to revoke `DepositCap` and `WithdrawCap`.
public fun revoke_trade_cap(
balance_manager: &mut BalanceManager,
trade_cap_id: &ID,
ctx: &TxContext,
) {
balance_manager.validate_owner(ctx);

    assert!(balance_manager.allow_listed.contains(trade_cap_id), ECapNotInList);
    balance_manager.allow_listed.remove(trade_cap_id);

}

# Mint a `DepositCap` or `WithdrawCap`

The owner of a `BalanceManager` can mint a `DepositCap` or `WithdrawCap` and send it to anotheraddress . Upon receipt, thataddress will have the capability to deposit in or withdraw from `BalanceManager` . Theaddress owner cannot execute trades, however. The maximum total number of `TradeCap` , `WithdrawCap` , and `DepositCap` that can be assigned for a `BalanceManager` is `1000` . If this limit is reached, one or more existing caps must be revoked before minting new ones.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/balance_manager.move
/// Mint a `DepositCap`, only owner can mint.
public fun mint_deposit_cap(balance_manager: &mut BalanceManager, ctx: &mut TxContext): DepositCap {
balance_manager.validate_owner(ctx);
balance_manager.mint_deposit_cap_internal(ctx)
}

/// Mint a `WithdrawCap`, only owner can mint.
public fun mint_withdraw_cap(
balance_manager: &mut BalanceManager,
ctx: &mut TxContext,
): WithdrawCap {
balance_manager.validate_owner(ctx);
balance_manager.mint_withdraw_cap_internal(ctx)
}

# Generate a `TradeProof`

To call any function that requires a balance check ortransfer **Transfer** Changing the owner of an asset. , the user must provide their `BalanceManager` as well as a `TradeProof` . There are two ways to generate a trade proof, one used by the owner and another used by a `TradeCap` owner.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/balance_manager.move
/// Generate a `TradeProof` by the owner. The owner does not require a capability
/// and can generate TradeProofs without the risk of equivocation.
public fun generate_proof_as_owner(
balance_manager: &mut BalanceManager,
ctx: &TxContext,
): TradeProof {
balance_manager.validate_owner(ctx);

    TradeProof {
        balance_manager_id: object::id(balance_manager),
        trader: ctx.sender(),
    }

}

/// Generate a `TradeProof` with a `TradeCap`.
/// Risk of equivocation since `TradeCap` is an owned object.
public fun generate_proof_as_trader(
balance_manager: &mut BalanceManager,
trade_cap: &TradeCap,
ctx: &TxContext,
): TradeProof {
balance_manager.validate_trader(trade_cap);

    TradeProof {
        balance_manager_id: object::id(balance_manager),
        trader: ctx.sender(),
    }

}

# Deposit funds

Only the owner can call this function to deposit funds into the `BalanceManager` .

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/balance_manager.move
/// Deposit funds to a balance manager. Only owner can call this directly.
public fun deposit<T>(balance_manager: &mut BalanceManager, coin: Coin<T>, ctx: &mut TxContext) {
balance_manager.emit_balance_event(
type_name::with_defining_ids<T>(),
coin.value(),
true,
);

    let proof = balance_manager.generate_proof_as_owner(ctx);
    balance_manager.deposit_with_proof(&proof, coin.into_balance());

}

# Withdraw funds

Only the owner can call this function to withdraw funds from the `BalanceManager` .

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/balance_manager.move
/// Withdraw funds from a balance_manager. Only owner can call this directly.
/// If withdraw_all is true, amount is ignored and full balance withdrawn.
/// If withdraw_all is false, withdraw_amount will be withdrawn.
public fun withdraw<T>(
balance_manager: &mut BalanceManager,
withdraw_amount: u64,
ctx: &mut TxContext,
): Coin<T> {
let proof = generate_proof_as_owner(balance_manager, ctx);
let coin = balance_manager.withdraw_with_proof(&proof, withdraw_amount, false).into_coin(ctx);
balance_manager.emit_balance_event(
type_name::with_defining_ids<T>(),
coin.value(),
false,
);

    coin

}
public fun withdraw_all<T>(balance_manager: &mut BalanceManager, ctx: &mut TxContext): Coin<T> {
let proof = generate_proof_as_owner(balance_manager, ctx);
let coin = balance_manager.withdraw_with_proof(&proof, 0, true).into_coin(ctx);
balance_manager.emit_balance_event(
type_name::with_defining_ids<T>(),
coin.value(),
false,
);

    coin

}

# Deposit funds using `DepositCap`

Only holders of a `DepositCap` for the `BalanceManager` can call this function to deposit funds into the `BalanceManager` .
github.com/MystenLabs/deepbookv3/packages/deepbook/sources/balance_manager.move
/// Deposit funds into a balance manager by a `DepositCap` owner.
public fun deposit_with_cap<T>(
balance_manager: &mut BalanceManager,
deposit_cap: &DepositCap,
coin: Coin<T>,
ctx: &TxContext,
) {
balance_manager.emit_balance_event(
type_name::with_defining_ids<T>(),
coin.value(),
true,
);

    let proof = balance_manager.generate_proof_as_depositor(deposit_cap, ctx);
    balance_manager.deposit_with_proof(&proof, coin.into_balance());

}

# Withdraw funds using WithdrawCap

Only holders of a `WithdrawCap` for the `BalanceManager` can call this function to withdraw funds from the `BalanceManager` .

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/balance_manager.move
/// Withdraw funds from a balance manager by a `WithdrawCap` owner.
public fun withdraw_with_cap<T>(
balance_manager: &mut BalanceManager,
withdraw_cap: &WithdrawCap,
withdraw_amount: u64,
ctx: &mut TxContext,
): Coin<T> {
let proof = balance_manager.generate_proof_as_withdrawer(
withdraw_cap,
ctx,
);
let coin = balance_manager.withdraw_with_proof(&proof, withdraw_amount, false).into_coin(ctx);
balance_manager.emit_balance_event(
type_name::with_defining_ids<T>(),
coin.value(),
false,
);

    coin

}

# Set and unset referral

The owner of a `TradeCap` can set or unset a pool-specific referral for the balance manager. Setting a referral allows the balance manager to be associated with a `DeepBookPoolReferral` for that pool, which can track and earn referral fees. Each balance manager can have different referrals for different pools.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/balance*manager.move
/// Set the referral for the balance manager.
public fun set_balance_manager_referral(
balance_manager: &mut BalanceManager,
referral: &DeepBookPoolReferral,
trade_cap: &TradeCap,
) {
balance_manager.validate_trader(trade_cap);
let *: Option<ID> = balance_manager.id.remove_if_exists(ReferralKey(referral.pool_id));
balance_manager.id.add(ReferralKey(referral.pool_id), referral.id.to_inner());

    event::emit(DeepBookReferralSetEvent {
        referral_id: referral.id.to_inner(),
        balance_manager_id: balance_manager.id.to_inner(),
    });

}

/// Unset the referral for the balance manager.
public fun unset*balance_manager_referral(
balance_manager: &mut BalanceManager,
pool_id: ID,
trade_cap: &TradeCap,
) {
balance_manager.validate_trader(trade_cap);
let *: Option<ID> = balance_manager.id.remove_if_exists(ReferralKey(pool_id));

    event::emit(DeepBookReferralSetEvent {
        referral_id: id_from_address(@0x0),
        balance_manager_id: balance_manager.id.to_inner(),
    });

}

# Register balance manager

Register a balance manager with the registry. This adds the balance manager to the owner's list of managers in the registry.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/balance_manager.move
public fun register_balance_manager(
balance_manager: &BalanceManager,
registry: &mut Registry,
ctx: &mut TxContext,
) {
balance_manager.validate_owner(ctx);
let owner = balance_manager.owner();
let manager_id = balance_manager.id();
registry.add_balance_manager(owner, manager_id);
}

# Read endpoints

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/balance_manager.move
public fun validate_proof(balance_manager: &BalanceManager, proof: &TradeProof) {
assert!(object::id(balance_manager) == proof.balance_manager_id, EInvalidProof);
}

/// Returns the balance of a Coin in a balance manager.
public fun balance<T>(balance_manager: &BalanceManager): u64 {
let key = BalanceKey<T> {};
if (!balance_manager.balances.contains(key)) {
0
} else {
let acc_balance: &Balance<T> = &balance_manager.balances[key];
acc_balance.value()
}
}

/// Returns the owner of the balance_manager.
public fun owner(balance_manager: &BalanceManager): address {
balance_manager.owner
}

/// Returns the owner of the balance_manager.
public fun id(balance_manager: &BalanceManager): ID {
balance_manager.id.to_inner()
}

/// Get the referral id from the balance manager.
public fun get*balance_manager_referral_id(
balance_manager: &BalanceManager,
pool_id: ID,
): Option<ID> {
let ref_key = ReferralKey(pool_id);
if (!balance_manager.id.exists*(ref_key)) {
return option::none()
};
let referral_id: &ID = balance_manager.id.borrow(ref_key);

    option::some(*referral_id)

}
public fun balance_manager_referral_owner(referral: &DeepBookPoolReferral): address {
referral.owner
}
public fun balance_manager_referral_pool_id(referral: &DeepBookPoolReferral): ID {
referral.pool_id
}

## Events

# `BalanceManagerEvent`

Emitted when a new balance manager is created.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/balance_manager.move
/// Event emitted when a new balance_manager is created.
public struct BalanceManagerEvent has copy, drop {
balance_manager_id: ID,
owner: address,
}

# BalanceEvent

Emitted when a deposit or withdrawal occurs.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/balance_manager.move
/// Event emitted when a deposit or withdrawal occurs.
public struct BalanceEvent has copy, drop {
balance_manager_id: ID,
asset: TypeName,
amount: u64,
deposit: bool,
}

# Orders

URL: https://docs.sui.io/onchain-finance/deepbookv3/contract-information/orders

Users can create limit or market orders, modify orders, and cancel orders. The `BalanceManager` must have the necessary funds to process orders. DeepBookV3 has four order options and three self matching options. If you set the `pay_with_deep` flag to `true` , trading fees are paid with the DEEP token. If you set the `pay_with_deep` flag to `false` , trading fees are paid with the input token.

Users can modify their existing order, reducing the size, lowering the expiration time, or both. Users cannot modify their order to increase their size or increase their expiration time. To do that, they must cancel the original order and place a new order.

Users can cancel a single order or cancel all of their orders.

## API

Following are the order related endpoints that `Pool` exposes.

# Order options

The following constants define the options available for orders.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/helper/constants.move
// Restrictions on limit orders.
// No restriction on the order.
const NO_RESTRICTION: u8 = 0;
// Mandates that whatever amount of an order that can be executed in the current
// transaction, be filled and then the rest of the order canceled.
const IMMEDIATE_OR_CANCEL: u8 = 1;
// Mandates that the entire order size be filled in the current transaction.
// Otherwise, the order is canceled.
const FILL_OR_KILL: u8 = 2;
// Mandates that the entire order be passive. Otherwise, cancel the order.
const POST_ONLY: u8 = 3;

# Self-matching options

The following constants define the options available for self-matching orders.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/helper/constants.move
// Self matching types.
// Self matching is allowed.
const SELF_MATCHING_ALLOWED: u8 = 0;
// Cancel the taker order.
const CANCEL_TAKER: u8 = 1;
// Cancel the maker order.
const CANCEL_MAKER: u8 = 2;

# OrderInfo struct

Placing a limit order or a market order creates and returns an `OrderInfo`object **Object** The basic unit of storage on Sui. . DeepBookV3 automatically drops thisobject after the order completes or is placed in the book. Use `OrderInfo` to inspect the execution details of the request as it represents all order information. DeepBookV3 does not catch any errors, so if there's a failure of any kind, then the entiretransaction **Transaction** A number of commands that execute on inputs to define the result of the transaction. fails.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/book/order_info.move
// === Structs ===
/// OrderInfo struct represents all order information.
/// This objects gets created at the beginning of the order lifecycle and
/// gets updated until it is completed or placed in the book.
/// It is returned at the end of the order lifecycle.
public struct OrderInfo has copy, drop, store {
// ID of the pool
pool_id: ID,
// ID of the order within the pool
order_id: u128,
// ID of the account the order uses
balance_manager_id: ID,
// ID of the order defined by client
client_order_id: u64,
// Trader of the order
trader: address,
// Order type, NO_RESTRICTION, IMMEDIATE_OR_CANCEL, FILL_OR_KILL, POST_ONLY
order_type: u8,
// Self matching option,
self_matching_option: u8,
// Price, only used for limit orders
price: u64,
// Whether the order is a buy or a sell
is_bid: bool,
// Quantity (in base asset terms) when the order is placed
original_quantity: u64,
// Deep conversion used by the order
order_deep_price: OrderDeepPrice,
// Expiration timestamp in ms
expire_timestamp: u64,
// Quantity executed so far
executed_quantity: u64,
// Cumulative quote quantity executed so far
cumulative_quote_quantity: u64,
// Any partial fills
fills: vector<Fill>,
// Whether the fee is in DEEP terms
fee_is_deep: bool,
// Fees paid so far in base/quote/DEEP terms for taker orders
paid_fees: u64,
// Fees transferred to pool vault but not yet paid for maker order
maker_fees: u64,
// Epoch this order was placed
epoch: u64,
// Status of the order
status: u8,
// Is a market_order
market_order: bool,
// Executed in one transaction
fill_limit_reached: bool,
// Whether order is inserted
order_inserted: bool,
// Order Timestamp
timestamp: u64,
}

# `OrderDeepPrice` struct

The `OrderDeepPrice` struct represents the conversion rate of DEEP at the time the order was placed.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/vault/deep_price.move
public struct OrderDeepPrice has copy, drop, store {
asset_is_base: bool,
deep_per_asset: u64,
}

# `Fill` struct

The `Fill` struct represents the results of a match between two orders. Use this struct to update the state.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/book/fill.move
// === Structs ===
/// Fill struct represents the results of a match between two orders.
/// It is used to update the state.
public struct Fill has copy, drop, store {
// ID of the maker order
maker_order_id: u128,
// Client Order ID of the maker order
maker_client_order_id: u64,
// Execution price
execution_price: u64,
// account_id of the maker order
balance_manager_id: ID,
// Whether the maker order is expired
expired: bool,
// Whether the maker order is fully filled
completed: bool,
// Original maker quantity
original_maker_quantity: u64,
// Quantity filled
base_quantity: u64,
// Quantity of quote currency filled
quote_quantity: u64,
// Whether the taker is bid
taker_is_bid: bool,
// Maker epoch
maker_epoch: u64,
// Maker deep price
maker_deep_price: OrderDeepPrice,
// Taker fee paid for fill
taker_fee: u64,
// Whether taker_fee is DEEP
taker_fee_is_deep: bool,
// Maker fee paid for fill
maker_fee: u64,
// Whether maker_fee is DEEP
maker_fee_is_deep: bool,
}

# Place limit order

Place a limit order. Quantity is in base asset terms. For current version `pay_with_deep` must be true, so the fee is paid with DEEP tokens.

You must combine a `BalanceManager` call of generating a `TradeProof` before placing orders.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun place_limit_order<BaseAsset, QuoteAsset>(
self: &mut Pool<BaseAsset, QuoteAsset>,
balance_manager: &mut BalanceManager,
trade_proof: &TradeProof,
client_order_id: u64,
order_type: u8,
self_matching_option: u8,
price: u64,
quantity: u64,
is_bid: bool,
pay_with_deep: bool,
expire_timestamp: u64,
clock: &Clock,
ctx: &TxContext,
): OrderInfo {
self.place_order_int(
balance_manager,
trade_proof,
client_order_id,
order_type,
self_matching_option,
price,
quantity,
is_bid,
pay_with_deep,
expire_timestamp,
clock,
false,
ctx,
)
}

# Place market order

Place a market order. Quantity is in base asset terms. Calls `place_limit_order` with a price of `MAX_PRICE` for bids and `MIN_PRICE` for asks. DeepBookV3 cancels the order for any quantity not filled.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun place_market_order<BaseAsset, QuoteAsset>(
self: &mut Pool<BaseAsset, QuoteAsset>,
balance_manager: &mut BalanceManager,
trade_proof: &TradeProof,
client_order_id: u64,
self_matching_option: u8,
quantity: u64,
is_bid: bool,
pay_with_deep: bool,
clock: &Clock,
ctx: &TxContext,
): OrderInfo {
self.place_order_int(
balance_manager,
trade_proof,
client_order_id,
constants::immediate_or_cancel(),
self_matching_option,
if (is_bid) constants::max_price() else constants::min_price(),
quantity,
is_bid,
pay_with_deep,
clock.timestamp_ms(),
clock,
true,
ctx,
)
}

# Modify order

Modifies an order given `order_id` and `new_quantity` . New quantity must be less than the original quantity and more than the filled quantity. Order must not have already expired.

The `modify_order` function does not return anything. If thetransaction is successful, then assume the modification was successful.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun modify_order<BaseAsset, QuoteAsset>(
self: &mut Pool<BaseAsset, QuoteAsset>,
balance_manager: &mut BalanceManager,
trade_proof: &TradeProof,
order_id: u128,
new_quantity: u64,
clock: &Clock,
ctx: &TxContext,
) {
let previous_quantity = self.get_order(order_id).quantity();

    let self = self.load_inner_mut();
    let (cancel_quantity, order) = self
        .book
        .modify_order(order_id, new_quantity, clock.timestamp_ms());
    assert!(order.balance_manager_id() == balance_manager.id(), EInvalidOrderBalanceManager);
    let (settled, owed) = self
        .state
        .process_modify(
            balance_manager.id(),
            cancel_quantity,
            order,
            self.pool_id,
            ctx,
        );
    self.vault.settle_balance_manager(settled, owed, balance_manager, trade_proof);

    order.emit_order_modified(
        self.pool_id,
        previous_quantity,
        ctx.sender(),
        clock.timestamp_ms(),
    );

}

# Cancel order

Cancel an order. The order must be owned by the `balance_manager` . The order is removed from the book and the `balance_manager` open orders. The `balance_manager` balance is updated with the order's remaining quantity.

Similar to modify, `cancel_order` does not return anything. DeepBookV3 emits `OrderCanceled` event.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun cancel_order<BaseAsset, QuoteAsset>(
self: &mut Pool<BaseAsset, QuoteAsset>,
balance_manager: &mut BalanceManager,
trade_proof: &TradeProof,
order_id: u128,
clock: &Clock,
ctx: &TxContext,
) {
let self = self.load_inner_mut();
let mut order = self.book.cancel_order(order_id);
assert!(order.balance_manager_id() == balance_manager.id(), EInvalidOrderBalanceManager);
let (settled, owed) = self
.state
.process_cancel(&mut order, balance_manager.id(), self.pool_id, ctx);
self.vault.settle_balance_manager(settled, owed, balance_manager, trade_proof);

    order.emit_order_canceled(
        self.pool_id,
        ctx.sender(),
        clock.timestamp_ms(),
    );

}

# Cancel multiple orders

Cancel multiple orders within a vector. The orders must be owned by the `balance_manager` . The orders are removed from the book and the `balance_manager` open orders. If any order fails to cancel, no orders will be cancelled (atomic operation).

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun cancel_orders<BaseAsset, QuoteAsset>(
self: &mut Pool<BaseAsset, QuoteAsset>,
balance_manager: &mut BalanceManager,
trade_proof: &TradeProof,
order_ids: vector<u128>,
clock: &Clock,
ctx: &TxContext,
) {
let mut i = 0;
let num_orders = order_ids.length();
while (i < num_orders) {
let order_id = order_ids[i];
self.cancel_order(balance_manager, trade_proof, order_id, clock, ctx);
i = i + 1;
}
}

# Cancel all orders

Cancel all open orders placed by the balance manager in the pool. This is a convenience function that cancels every order associated with the balance manager.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun cancel_all_orders<BaseAsset, QuoteAsset>(
self: &mut Pool<BaseAsset, QuoteAsset>,
balance_manager: &mut BalanceManager,
trade_proof: &TradeProof,
clock: &Clock,
ctx: &TxContext,
) {
let inner = self.load_inner_mut();
let mut open_orders = vector[];
if (inner.state.account_exists(balance_manager.id())) {
open_orders = inner.state.account(balance_manager.id()).open_orders().into_keys();
};

    let mut i = 0;
    let num_orders = open_orders.length();
    while (i < num_orders) {
        let order_id = open_orders[i];
        self.cancel_order(balance_manager, trade_proof, order_id, clock, ctx);
        i = i + 1;
    }

}

# Withdraw settled amounts

Withdraw settled amounts to the `balance_manager` . All orders automatically withdraw settled amounts. This can be called explicitly to withdraw all settled funds from the pool.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun withdraw_settled_amounts<BaseAsset, QuoteAsset>(
self: &mut Pool<BaseAsset, QuoteAsset>,
balance_manager: &mut BalanceManager,
trade_proof: &TradeProof,
) {
let self = self.load_inner_mut();
let (settled, owed) = self.state.withdraw_settled_amounts(balance_manager.id());
self.vault.settle_balance_manager(settled, owed, balance_manager, trade_proof);
}

# Withdraw settled amounts permissionless

Withdraw settled amounts to the `balance_manager` without requiring a `TradeProof` . This is a permissionless version that anyone can call to settle a balance manager's funds.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun withdraw_settled_amounts_permissionless<BaseAsset, QuoteAsset>(
self: &mut Pool<BaseAsset, QuoteAsset>,
balance_manager: &mut BalanceManager,
) {
let self = self.load_inner_mut();
let (settled, owed) = self.state.withdraw_settled_amounts(balance_manager.id());
self.vault.settle_balance_manager_permissionless(settled, owed, balance_manager);
}

## Events

# `OrderFilled`

Emitted when a maker order is filled.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/book/order_info.move
/// Emitted when a maker order is filled.
public struct OrderFilled has copy, drop, store {
pool_id: ID,
maker_order_id: u128,
taker_order_id: u128,
maker_client_order_id: u64,
taker_client_order_id: u64,
price: u64,
taker_is_bid: bool,
taker_fee: u64,
taker_fee_is_deep: bool,
maker_fee: u64,
maker_fee_is_deep: bool,
base_quantity: u64,
quote_quantity: u64,
maker_balance_manager_id: ID,
taker_balance_manager_id: ID,
timestamp: u64,
}

# `OrderCanceled`

Emitted when a maker order is canceled.
github.com/MystenLabs/deepbookv3/packages/deepbook/sources/book/order.move
/// Emitted when a maker order is canceled.
public struct OrderCanceled has copy, drop, store {
balance_manager_id: ID,
pool_id: ID,
order_id: u128,
client_order_id: u64,
trader: address,
price: u64,
is_bid: bool,
original_quantity: u64,
base_asset_quantity_canceled: u64,
timestamp: u64,
}

# `OrderModified`

Emitted when a maker order is modified.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/book/order.move
/// Emitted when a maker order is modified.
public struct OrderModified has copy, drop, store {
balance_manager_id: ID,
pool_id: ID,
order_id: u128,
client_order_id: u64,
trader: address,
price: u64,
is_bid: bool,
previous_quantity: u64,
filled_quantity: u64,
new_quantity: u64,
timestamp: u64,
}

# `OrderPlaced`

Emitted when a maker order is placed into the order book.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/book/order_info.move
/// Emitted when a maker order is injected into the order book.
public struct OrderPlaced has copy, drop, store {
balance_manager_id: ID,
pool_id: ID,
order_id: u128,
client_order_id: u64,
trader: address,
price: u64,
is_bid: bool,
placed_quantity: u64,
expire_timestamp: u64,
timestamp: u64,
}

# Flash Loans

URL: https://docs.sui.io/onchain-finance/deepbookv3/contract-information/flash-loans

Flash loans by definition are uncollateralized loans that are borrowed and repaid within the same programmabletransaction **Transaction** A number of commands that execute on inputs to define the result of the transaction. block. Users can borrow flash loans in the base or quote asset from any DeepBookV3 pool. Flash loans return a `FlashLoan` hot potato (struct with no abilities), which must be returned back to the pool by the end of the call. Thetransaction is atomic, so the entiretransaction fails if the loan is not returned.

The quantity borrowed can be the maximum amount that the pool owns. Borrowing from a pool and trading in the same pool can result in failures because trading requires the movement of funds. If the funds are borrowed, then there are no funds tomove **Move** An open source programming language used for all activity on Sui. .

## API

Following are the endpoints that the `Pool` exposes for flash loans.

# Borrow flash loan base

Borrow base assets from the `Pool` . The function returns a hot potato, forcing the borrower to return the assets within the sametransaction .

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun borrow_flashloan_base<BaseAsset, QuoteAsset>(
self: &mut Pool<BaseAsset, QuoteAsset>,
base_amount: u64,
ctx: &mut TxContext,
): (Coin<BaseAsset>, FlashLoan) {
let self = self.load_inner_mut();
self.vault.borrow_flashloan_base(self.pool_id, base_amount, ctx)
}

# Borrow flash loan quote

Borrow quote assets from the `Pool` . The function returns a hot potato, forcing the borrower to return the assets within the sametransaction .

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun borrow_flashloan_quote<BaseAsset, QuoteAsset>(
self: &mut Pool<BaseAsset, QuoteAsset>,
quote_amount: u64,
ctx: &mut TxContext,
): (Coin<QuoteAsset>, FlashLoan) {
let self = self.load_inner_mut();
self.vault.borrow_flashloan_quote(self.pool_id, quote_amount, ctx)
}

# Retrieve flash loan base

Return the flash loaned base assets to the `Pool` . `FlashLoan`object **Object** The basic unit of storage on Sui. is unwrapped only if the assets are returned, otherwise thetransaction fails.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun return_flashloan_base<BaseAsset, QuoteAsset>(
self: &mut Pool<BaseAsset, QuoteAsset>,
coin: Coin<BaseAsset>,
flash_loan: FlashLoan,
) {
let self = self.load_inner_mut();
self.vault.return_flashloan_base(self.pool_id, coin, flash_loan);
}

# Retrieve flash loan quote

Return the flash loaned quote assets to the `Pool` . `FlashLoan`object is unwrapped only if the assets are returned, otherwise thetransaction fails.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun return_flashloan_quote<BaseAsset, QuoteAsset>(
self: &mut Pool<BaseAsset, QuoteAsset>,
coin: Coin<QuoteAsset>,
flash_loan: FlashLoan,
) {
let self = self.load_inner_mut();
self.vault.return_flashloan_quote(self.pool_id, coin, flash_loan);
}

# Swaps

URL: https://docs.sui.io/onchain-finance/deepbookv3/contract-information/swaps

DeepBook **DeepBook** A decentralized central limit order book (CLOB) built on Sui. provides a swap-like interface commonly seen in automatic market makers (AMMs). Unlike the order functions, you can call `swap_exact_amount` without a `BalanceManager` . You call it directly with `Coin` objects instead. When swapping from base to quote, `base_in` must have a positive value while `quote_in` must be zero. When swapping from quote to base, `quote_in` must be positive and `base_in` zero. Some `deep_in` amount is required to pay for trading fees. You can overestimate this amount, as the unused DEEP tokens are returned at the end of the call.

You can use the `get_amount_out` endpoint to simulate a swap. The function returns the exact amount of DEEP tokens that the swap requires.

## API

Following are the endpoints that the `Pool` exposes for swaps.

# Swap exact base for quote

Swap exact base quantity without needing a `balance_manager` . DEEP quantity can be overestimated. Returns three `Coin` objects:

- `BaseAsset`
- `QuoteAsset`
- `DEEP`
  Some base quantity might be left over if the input quantity is not divisible by lot size.

You can overestimate the amount of DEEP required. The remaining balance is returned.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun swap_exact_base_for_quote<BaseAsset, QuoteAsset>(
self: &mut Pool<BaseAsset, QuoteAsset>,
base_in: Coin<BaseAsset>,
deep_in: Coin<DEEP>,
min_quote_out: u64,
clock: &Clock,
ctx: &mut TxContext,
): (Coin<BaseAsset>, Coin<QuoteAsset>, Coin<DEEP>) {
let quote_in = coin::zero(ctx);

    self.swap_exact_quantity(
        base_in,
        quote_in,
        deep_in,
        min_quote_out,
        clock,
        ctx,
    )

}

# Swap exact quote for base

Swap exact quote quantity without needing a `balance_manager` . You can overestimate DEEP quantity. Returns three `Coin` objects:

- `BaseAsset`
- `QuoteAsset`
- `DEEP`
  Some quote quantity could be left over if the input quantity is not divisible by lot size.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun swap_exact_quote_for_base<BaseAsset, QuoteAsset>(
self: &mut Pool<BaseAsset, QuoteAsset>,
quote_in: Coin<QuoteAsset>,
deep_in: Coin<DEEP>,
min_base_out: u64,
clock: &Clock,
ctx: &mut TxContext,
): (Coin<BaseAsset>, Coin<QuoteAsset>, Coin<DEEP>) {
let base_in = coin::zero(ctx);

    self.swap_exact_quantity(
        base_in,
        quote_in,
        deep_in,
        min_base_out,
        clock,
        ctx,
    )

}

# open Swap exact quantity

This function is what the previous two functions call with `coin::zero()` set for the third coin. Users can call this directly for base → quote or quote → base as long as base or quote have a zero value.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun swap_exact_quantity<BaseAsset, QuoteAsset>(
self: &mut Pool<BaseAsset, QuoteAsset>,
base_in: Coin<BaseAsset>,
quote_in: Coin<QuoteAsset>,
deep_in: Coin<DEEP>,
min_out: u64,
clock: &Clock,
ctx: &mut TxContext,
): (Coin<BaseAsset>, Coin<QuoteAsset>, Coin<DEEP>) {
let mut base_quantity = base_in.value();
let quote_quantity = quote_in.value();
let taker_fee = self.load_inner().state.governance().trade_params().taker_fee();
let input_fee_rate = math::mul(
taker_fee,
constants::fee_penalty_multiplier(),
);
assert!((base_quantity > 0) != (quote_quantity > 0), EInvalidQuantityIn);

    let pay_with_deep = deep_in.value() > 0;
    let is_bid = quote_quantity > 0;
    if (is_bid) {
        (base_quantity, _, _) = if (pay_with_deep) {
            self.get_quantity_out(0, quote_quantity, clock)
        } else {
            self.get_quantity_out_input_fee(0, quote_quantity, clock)
        }
    } else {
        if (!pay_with_deep) {
            base_quantity =
                math::div(
                    base_quantity,
                    constants::float_scaling() + input_fee_rate,
                );
        }
    };
    base_quantity = base_quantity - base_quantity % self.load_inner().book.lot_size();
    if (base_quantity < self.load_inner().book.min_size()) {
        return (base_in, quote_in, deep_in)
    };

    let mut temp_balance_manager = balance_manager::new(ctx);
    let trade_proof = temp_balance_manager.generate_proof_as_owner(ctx);
    temp_balance_manager.deposit(base_in, ctx);
    temp_balance_manager.deposit(quote_in, ctx);
    temp_balance_manager.deposit(deep_in, ctx);

    self.place_market_order(
        &mut temp_balance_manager,
        &trade_proof,
        0,
        constants::self_matching_allowed(),
        base_quantity,
        is_bid,
        pay_with_deep,
        clock,
        ctx,
    );

    let base_out = temp_balance_manager.withdraw_all<BaseAsset>(ctx);
    let quote_out = temp_balance_manager.withdraw_all<QuoteAsset>(ctx);
    let deep_out = temp_balance_manager.withdraw_all<DEEP>(ctx);

    if (is_bid) {
        assert!(base_out.value() >= min_out, EMinimumQuantityOutNotMet);
    } else {
        assert!(quote_out.value() >= min_out, EMinimumQuantityOutNotMet);
    };

    temp_balance_manager.delete();

    (base_out, quote_out, deep_out)

}

# Swap exact base for quote with manager

Swap exact base for quote using a `BalanceManager` . Assumes fees are paid in DEEP. Assumes balance manager has enough DEEP for fees. Returns two `Coin` objects: base and quote.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun swap_exact_base_for_quote_with_manager<BaseAsset, QuoteAsset>(
self: &mut Pool<BaseAsset, QuoteAsset>,
balance_manager: &mut BalanceManager,
trade_cap: &TradeCap,
deposit_cap: &DepositCap,
withdraw_cap: &WithdrawCap,
base_in: Coin<BaseAsset>,
min_quote_out: u64,
clock: &Clock,
ctx: &mut TxContext,
): (Coin<BaseAsset>, Coin<QuoteAsset>) {
let quote_in = coin::zero(ctx);

    self.swap_exact_quantity_with_manager(
        balance_manager,
        trade_cap,
        deposit_cap,
        withdraw_cap,
        base_in,
        quote_in,
        min_quote_out,
        clock,
        ctx,
    )

}

# Swap exact quote for base with manager

Swap exact quote for base using a `BalanceManager` . Assumes fees are paid in DEEP. Assumes balance manager has enough DEEP for fees. Returns two `Coin` objects: base and quote.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun swap_exact_quote_for_base_with_manager<BaseAsset, QuoteAsset>(
self: &mut Pool<BaseAsset, QuoteAsset>,
balance_manager: &mut BalanceManager,
trade_cap: &TradeCap,
deposit_cap: &DepositCap,
withdraw_cap: &WithdrawCap,
quote_in: Coin<QuoteAsset>,
min_base_out: u64,
clock: &Clock,
ctx: &mut TxContext,
): (Coin<BaseAsset>, Coin<QuoteAsset>) {
let base_in = coin::zero(ctx);

    self.swap_exact_quantity_with_manager(
        balance_manager,
        trade_cap,
        deposit_cap,
        withdraw_cap,
        base_in,
        quote_in,
        min_base_out,
        clock,
        ctx,
    )

}

# Swap exact quantity with manager

Swap exact quantity using a `BalanceManager` . This is the underlying function that the two manager-based swap functions call. Assumes fees are paid in DEEP and that the balance manager has sufficient DEEP for fees. Returns two `Coin` objects: base and quote.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun swap_exact_quantity_with_manager<BaseAsset, QuoteAsset>(
self: &mut Pool<BaseAsset, QuoteAsset>,
balance_manager: &mut BalanceManager,
trade_cap: &TradeCap,
deposit_cap: &DepositCap,
withdraw_cap: &WithdrawCap,
base_in: Coin<BaseAsset>,
quote_in: Coin<QuoteAsset>,
min_out: u64,
clock: &Clock,
ctx: &mut TxContext,
): (Coin<BaseAsset>, Coin<QuoteAsset>) {
let mut adjusted_base_quantity = base_in.value();
let base_quantity = base_in.value();
let quote_quantity = quote_in.value();
assert!((adjusted_base_quantity > 0) != (quote_quantity > 0), EInvalidQuantityIn);

    let is_bid = quote_quantity > 0;
    if (is_bid) {
        (adjusted_base_quantity, _, _) = self.get_quantity_out(0, quote_quantity, clock)
    } else {
        adjusted_base_quantity =
            adjusted_base_quantity - adjusted_base_quantity % self.load_inner().book.lot_size();
    };
    if (adjusted_base_quantity < self.load_inner().book.min_size()) {
        return (base_in, quote_in)
    };

    balance_manager.deposit_with_cap(deposit_cap, base_in, ctx);
    balance_manager.deposit_with_cap(deposit_cap, quote_in, ctx);
    let trade_proof = balance_manager.generate_proof_as_trader(trade_cap, ctx);
    let order_info = self.place_market_order(
        balance_manager,
        &trade_proof,
        0,
        constants::self_matching_allowed(),
        adjusted_base_quantity,
        is_bid,
        true,
        clock,
        ctx,
    );

    let (base_out_quantity, quote_out_quantity) = if (is_bid) {
        let quote_left = quote_quantity - order_info.cumulative_quote_quantity();
        (order_info.executed_quantity(), quote_left)
    } else {
        let base_left = base_quantity - order_info.executed_quantity();
        (base_left, order_info.cumulative_quote_quantity())
    };

    let base_out = if (base_out_quantity > 0) {
        balance_manager.withdraw_with_cap(withdraw_cap, base_out_quantity, ctx)
    } else {
        coin::zero(ctx)
    };
    let quote_out = if (quote_out_quantity > 0) {
        balance_manager.withdraw_with_cap(withdraw_cap, quote_out_quantity, ctx)
    } else {
        coin::zero(ctx)
    };

    if (is_bid) {
        assert!(base_out.value() >= min_out, EMinimumQuantityOutNotMet);
    } else {
        assert!(quote_out.value() >= min_out, EMinimumQuantityOutNotMet);
    };

    (base_out, quote_out)

}

# Staking and Governance

URL: https://docs.sui.io/onchain-finance/deepbookv3/contract-information/staking-governance

DeepBook **DeepBook** A decentralized central limit order book (CLOB) built on Sui. 's novel approach to governance allows users to update a single pool's three parameters:

- Taker fee rate
- Maker fee rate
- Stake required
  Stake required is the amount of DEEP tokens a user must have staked in the pool to take advantage of taker and maker incentives. Each individualDeepBook pool has independent governance, and governance can be conducted everyepoch **Epoch** A period of time defined by the network. . See [Design](/onchain-finance/deepbookv3/design#governance) to learn more about governance.

![DeepBook Governance Timeline.png](/assets/images/governance-166bcc0f64efe0075432b3afc50f1f0a.png)

## API

`Pool` exposes the following endpoints for staking and governance.

# Stake

DEEP tokens must be available in the `balance_manager` for staking. A user's stake becomes active in the followingepoch . If the user's active stake is greater than the stake required, the user can get reduced taker fees and can accumulate trading fee rebates during thatepoch .

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun stake<BaseAsset, QuoteAsset>(
self: &mut Pool<BaseAsset, QuoteAsset>,
balance_manager: &mut BalanceManager,
trade_proof: &TradeProof,
amount: u64,
ctx: &TxContext,
) {
assert!(amount > 0, EInvalidStake);
let self = self.load_inner_mut();
let (settled, owed) = self.state.process_stake(self.pool_id, balance_manager.id(), amount, ctx);
self.vault.settle_balance_manager(settled, owed, balance_manager, trade_proof);
}

# Unstake

All of the user's active and inactive stake are removed and added back into the `BalanceManager` . Any casted votes are removed. Maker rebates for theepoch are forfeited, and any reduced taker fees for the remainingepoch are disabled.

The `balance_manager` must have enough staked DEEP tokens. The `balance_manager` data is updated with the unstaked amount. Balance is transferred to the `balance_manager` immediately.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun unstake<BaseAsset, QuoteAsset>(
self: &mut Pool<BaseAsset, QuoteAsset>,
balance_manager: &mut BalanceManager,
trade_proof: &TradeProof,
ctx: &TxContext,
) {
let self = self.load_inner_mut();
let (settled, owed) = self.state.process_unstake(self.pool_id, balance_manager.id(), ctx);
self.vault.settle_balance_manager(settled, owed, balance_manager, trade_proof);
}

# Submit proposal

Users with a nonzero active stake can submit proposals. One proposal per user. The user automatically votes for the proposal they submit.

Submit a proposal to change the taker fee, maker fee, and stake required. The `balance_manager` must have enough staked DEEP tokens to participate. Each `balance_manager` can only submit one proposal perepoch . If the maximum proposal is reached, the proposal with the lowest vote is removed. If the `balance_manager` has less voting power than the lowest voted proposal, the proposal is not added.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun submit_proposal<BaseAsset, QuoteAsset>(
self: &mut Pool<BaseAsset, QuoteAsset>,
balance_manager: &mut BalanceManager,
trade_proof: &TradeProof,
taker_fee: u64,
maker_fee: u64,
stake_required: u64,
ctx: &TxContext,
) {
let self = self.load_inner_mut();
balance_manager.validate_proof(trade_proof);
self
.state
.process_proposal(
self.pool_id,
balance_manager.id(),
taker_fee,
maker_fee,
stake_required,
ctx,
);
}

# Vote

Users with nonzero voting power can vote on a proposal. All voting power is used on a single proposal. If the user has voted on a different proposal during thisepoch , then that vote is removed and recasted into the new proposal. The `balance_manager` must have enough staked DEEP tokens to participate.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun vote<BaseAsset, QuoteAsset>(
self: &mut Pool<BaseAsset, QuoteAsset>,
balance_manager: &mut BalanceManager,
trade_proof: &TradeProof,
proposal_id: ID,
ctx: &TxContext,
) {
let self = self.load_inner_mut();
balance_manager.validate_proof(trade_proof);
self.state.process_vote(self.pool_id, balance_manager.id(), proposal_id, ctx);
}

# Claim rebates

Use `claim_rebates` to claim the rewards for the `balance_manager` . The `balance_manager` must have rewards to claim. The `balance_manager` data is updated with the claimed rewards.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun claim_rebates<BaseAsset, QuoteAsset>(
self: &mut Pool<BaseAsset, QuoteAsset>,
balance_manager: &mut BalanceManager,
trade_proof: &TradeProof,
ctx: &TxContext,
) {
let self = self.load_inner_mut();
let (settled, owed) = self
.state
.process_claim_rebates<BaseAsset, QuoteAsset>(
self.pool_id,
balance_manager,
ctx,
);
self.vault.settle_balance_manager(settled, owed, balance_manager, trade_proof);
}

# Permissionless Pool Creation

URL: https://docs.sui.io/onchain-finance/deepbookv3/contract-information/permissionless-pool

The `Pool` sharedobject **Object** The basic unit of storage on Sui. represents a market, such as a SUI/USDC market. That `Pool` is the only one representing that unique pairing (SUI/USDC) and the pairing is the only member of that particular `Pool` . See [DeepBookV3 Design](/onchain-finance/deepbookv3/design#pool) to learn more about the structure of pools.

## API

# Create a `Pool`

The `create_permissionless_pool()` function creates a `Pool`

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun create_permissionless_pool<BaseAsset, QuoteAsset>(
registry: &mut Registry,
tick_size: u64,
lot_size: u64,
min_size: u64,
creation_fee: Coin<DEEP>,
ctx: &mut TxContext,
): ID {
assert!(creation_fee.value() == constants::pool_creation_fee(), EInvalidFee);
let base_type = type_name::with_defining_ids<BaseAsset>();
let quote_type = type_name::with_defining_ids<QuoteAsset>();
let whitelisted_pool = false;
let stable_pool = registry.is_stablecoin(base_type) && registry.is_stablecoin(quote_type);

    create_pool<BaseAsset, QuoteAsset>(
        registry,
        tick_size,
        lot_size,
        min_size,
        creation_fee,
        whitelisted_pool,
        stable_pool,
        ctx,
    )

}

Tick size should be 10^(9 - base_decimals + quote_decimals - decimal_desired). For example, if creating a SUI(9 decimals)/USDC(6 decimals) pool, with a desired decimal of 3 for tick size (0.001), tick size should be 10^(9 - 9 + 6 - 3) = 10^(3) = 1000.

Decimal desired should be at most 1bps, or 0.01%, of the price between base and quote asset. For example, if 3 decimals is the target, 0.001 (three decimals) / price should be less than or equal to 0.0001. Consider a lower tick size for pools where both base and quote assets are stablecoins.

Lot size is inMIST **MIST** The smallest unit of SUI. of the base asset, and should be approximately $0.01 to $0.10 nominal of the base asset. Lot size must be a power of 10, and less than or equal to min size. Lot size should also be greater than or equal to 1,000.

Min size is inMIST of the base asset, and should be approximately $0.10 to $1.00 nominal of the base asset. Min size must be a power of 10, and larger than or equal to lot size.

Creation fee is 500 DEEP tokens.

info
Pools can only be created if the asset pair has not already been created before.

# Add DEEP price point

The `add_deep_price_point()` function allows for the calculation of DEEP price and correct collection of fees in DEEP.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun add_deep_price_point<BaseAsset, QuoteAsset, ReferenceBaseAsset, ReferenceQuoteAsset>(
target_pool: &mut Pool<BaseAsset, QuoteAsset>,
reference_pool: &Pool<ReferenceBaseAsset, ReferenceQuoteAsset>,
clock: &Clock,
) {
assert!(
reference_pool.whitelisted() && reference_pool.registered_pool(),
EIneligibleReferencePool,
);
let reference_pool_price = reference_pool.mid_price(clock);

    let target_pool = target_pool.load_inner_mut();
    let reference_base_type = type_name::with_defining_ids<ReferenceBaseAsset>();
    let reference_quote_type = type_name::with_defining_ids<ReferenceQuoteAsset>();
    let target_base_type = type_name::with_defining_ids<BaseAsset>();
    let target_quote_type = type_name::with_defining_ids<QuoteAsset>();
    let deep_type = type_name::with_defining_ids<DEEP>();
    let timestamp = clock.timestamp_ms();

    assert!(
        reference_base_type == deep_type || reference_quote_type == deep_type,
        EIneligibleTargetPool,
    );

    let reference_deep_is_base = reference_base_type == deep_type;
    let reference_other_type = if (reference_deep_is_base) {
        reference_quote_type
    } else {
        reference_base_type
    };
    let reference_other_is_target_base = reference_other_type == target_base_type;
    let reference_other_is_target_quote = reference_other_type == target_quote_type;
    assert!(
        reference_other_is_target_base || reference_other_is_target_quote,
        EIneligibleTargetPool,
    );

    let deep_per_reference_other_price = if (reference_deep_is_base) {
        math::div(1_000_000_000, reference_pool_price)
    } else {
        reference_pool_price
    };
    assert!(deep_per_reference_other_price > 0, EInvalidDeepPrice);

    target_pool
        .deep_price
        .add_price_point(
            deep_per_reference_other_price,
            timestamp,
            reference_other_is_target_base,
        );
    emit_deep_price_added(
        deep_per_reference_other_price,
        timestamp,
        reference_other_is_target_base,
        reference_pool.load_inner().pool_id,
        target_pool.pool_id,
    );

}

All pools support input token fees. To allow a permissionless pool to pay fees in DEEP, which has a 20% discount compared to input token fees, two conditions must be met:

1. Either the base or quote asset must be `USDC` or `SUI` .
2. To calculate DEEP fees accurately, you must set up a cron job to call the `add_deep_price_point()` function on the pool every 1-10 minutes.
   For a pool with `USDC` as an asset, use the `DEEP/USDC` pool at `0xf948981b806057580f91622417534f491da5f61aeaf33d0ed8e69fd5691c95ce` as the reference pool.

For a pool with `SUI` as an asset, use the `DEEP/SUI` pool at `0xb663828d6217467c8a1838a03793da896cbe745b150ebd57d82f814ca579fc22` as the reference pool.

# Update allowed versions

The `update_pool_allowed_versions()` function takes a pool and the registry, and updates the allowed contract versions within the pool. This is very important after contract upgrades to ensure the newest contract can be used on the pool. This is the permissionless equivalent of `update_allowed_versions()` .

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun update_pool_allowed_versions<BaseAsset, QuoteAsset>(
self: &mut Pool<BaseAsset, QuoteAsset>,
registry: &Registry,
) {
let allowed_versions = registry.allowed_versions();
let inner: &mut PoolInner<BaseAsset, QuoteAsset> = self.inner.load_value_mut();
inner.allowed_versions = allowed_versions;
}

# Query the Pool

URL: https://docs.sui.io/onchain-finance/deepbookv3/contract-information/query-the-pool

The `Pool` sharedobject **Object** The basic unit of storage on Sui. represents a market, such as a SUI/USDC market. That `Pool` is the only one representing that unique pairing (SUI/USDC) and the pairing is the only member of that particular `Pool` . See [DeepBookV3 Design](/onchain-finance/deepbookv3/design#pool) to learn more about the structure of pools.

To perform trades, you pass a `BalanceManager` and `TradeProof` into the relevant `Pool` . Unlike `Pool` s, `BalanceManager` shared objects can contain any type of token, such that the same `BalanceManager` can access multiple `Pool` s to interact with many different trade pairings. See [BalanceManager](/onchain-finance/deepbookv3/contract-information/balance-manager) to learn more.

## API

DeepBookV3 exposes a set of endpoints that can be used to query any pool.

# Check whitelist status

Accessor to check whether the pool is whitelisted.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun whitelisted<BaseAsset, QuoteAsset>(self: &Pool<BaseAsset, QuoteAsset>): bool {
self.load_inner().state.governance().whitelisted()
}

# Check quote quantity against base (DEEP fees)

Dry run to determine the quote quantity out for a given base quantity. Uses DEEP as fee.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun get_quote_quantity_out<BaseAsset, QuoteAsset>(
self: &Pool<BaseAsset, QuoteAsset>,
base_quantity: u64,
clock: &Clock,
): (u64, u64, u64) {
self.get_quantity_out(base_quantity, 0, clock)
}

# Check base quantity against quote (DEEP fees)

Dry run to determine the base quantity out for a given quote quantity. Uses DEEP as fee.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun get_base_quantity_out<BaseAsset, QuoteAsset>(
self: &Pool<BaseAsset, QuoteAsset>,
quote_quantity: u64,
clock: &Clock,
): (u64, u64, u64) {
self.get_quantity_out(0, quote_quantity, clock)
}

# Check quote quantity against base (input token fees)

Dry run to determine the quote quantity out for a given base quantity. Uses input token as fee.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun get_quote_quantity_out_input_fee<BaseAsset, QuoteAsset>(
self: &Pool<BaseAsset, QuoteAsset>,
base_quantity: u64,
clock: &Clock,
): (u64, u64, u64) {
self.get_quantity_out_input_fee(base_quantity, 0, clock)
}

# Check base quantity against quote (input token fees)

Dry run to determine the base quantity out for a given quote quantity. Uses input token as fee.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun get_base_quantity_out_input_fee<BaseAsset, QuoteAsset>(
self: &Pool<BaseAsset, QuoteAsset>,
quote_quantity: u64,
clock: &Clock,
): (u64, u64, u64) {
self.get_quantity_out_input_fee(0, quote_quantity, clock)
}

# Check quote quantity against quote or base

Dry run to determine the quantity out for a given base or quote quantity. Only one out of base or quote quantity should be nonzero. Returns the ( `base_quantity_out` , `quote_quantity_out` , `deep_quantity_required` ).

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun get_quantity_out<BaseAsset, QuoteAsset>(
self: &Pool<BaseAsset, QuoteAsset>,
base_quantity: u64,
quote_quantity: u64,
clock: &Clock,
): (u64, u64, u64) {
let whitelist = self.whitelisted();
let self = self.load_inner();
let params = self.state.governance().trade_params();
let taker_fee = params.taker_fee();
let deep_price = self.deep_price.get_order_deep_price(whitelist);
self
.book
.get_quantity_out(
base_quantity,
quote_quantity,
taker_fee,
deep_price,
self.book.lot_size(),
true,
clock.timestamp_ms(),
)
}

# Check fee required

Returns the DEEP required for an order if it's a taker or maker given quantity and price ( `deep_required_taker` , `deep_required_maker` ).

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun get_order_deep_required<BaseAsset, QuoteAsset>(
self: &Pool<BaseAsset, QuoteAsset>,
base_quantity: u64,
price: u64,
): (u64, u64) {
let order_deep_price = self.get_order_deep_price();
let self = self.load_inner();
let maker_fee = self.state.governance().trade_params().maker_fee();
let taker_fee = self.state.governance().trade_params().taker_fee();
let deep_quantity = order_deep_price
.fee_quantity(
base_quantity,
math::mul(base_quantity, price),
true,
)
.deep();

    (math::mul(taker_fee, deep_quantity), math::mul(maker_fee, deep_quantity))

}

# Retrieve mid price for a pool

Returns the mid price of the pool.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun mid_price<BaseAsset, QuoteAsset>(
self: &Pool<BaseAsset, QuoteAsset>,
clock: &Clock,
): u64 {
self.load_inner().book.mid_price(clock.timestamp_ms())
}

# Retrieve order IDs

Returns the `order_id` for all open orders for the `balance_manager` in the pool.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun account_open_orders<BaseAsset, QuoteAsset>(
self: &Pool<BaseAsset, QuoteAsset>,
balance_manager: &BalanceManager,
): VecSet<u128> {
let self = self.load_inner();

    if (!self.state.account_exists(balance_manager.id())) {
        return vec_set::empty()
    };

    self.state.account(balance_manager.id()).open_orders()

}

# Retrieve prices and quantities for an order book

Returns vectors holding the prices ( `price_vec` ) and quantities ( `quantity_vec` ) for the level2 order book. The `price_low` and `price_high` are inclusive, all orders within the range are returned. `is_bid` is `true` for bids and `false` for asks.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun get_level2_range<BaseAsset, QuoteAsset>(
self: &Pool<BaseAsset, QuoteAsset>,
price_low: u64,
price_high: u64,
is_bid: bool,
clock: &Clock,
): (vector<u64>, vector<u64>) {
self
.load_inner()
.book
.get_level2_range_and_ticks(
price_low,
price_high,
constants::max_u64(),
is_bid,
clock.timestamp_ms(),
)
}

Returns vectors holding the prices ( `price_vec` ) and quantities ( `quantity_vec` ) for the level2 order book. `ticks` are the maximum number of ticks to return starting from best bid and best ask. ( `bid_price` , `bid_quantity` , `ask_price` , `ask_quantity` ) are returned as four vectors. The price vectors are sorted in descending order for bids and ascending order for asks.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun get_level2_ticks_from_mid<BaseAsset, QuoteAsset>(
self: &Pool<BaseAsset, QuoteAsset>,
ticks: u64,
clock: &Clock,
): (vector<u64>, vector<u64>, vector<u64>, vector<u64>) {
let self = self.load_inner();
let (bid_price, bid_quantity) = self
.book
.get_level2_range_and_ticks(
constants::min_price(),
constants::max_price(),
ticks,
true,
clock.timestamp_ms(),
);
let (ask_price, ask_quantity) = self
.book
.get_level2_range_and_ticks(
constants::min_price(),
constants::max_price(),
ticks,
false,
clock.timestamp_ms(),
);

    (bid_price, bid_quantity, ask_price, ask_quantity)

}

# Retrieve balances

Get all balances held in this pool.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun vault_balances<BaseAsset, QuoteAsset>(
self: &Pool<BaseAsset, QuoteAsset>,
): (u64, u64, u64) {
self.load_inner().vault.balances()
}

# Retrieve pool ID

Get the ID of the pool given the asset types.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun get_pool_id_by_asset<BaseAsset, QuoteAsset>(registry: &Registry): ID {
registry.get_pool_id<BaseAsset, QuoteAsset>()
}

# Retrieve order information

Returns the `Order` struct using the order ID.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun get_order<BaseAsset, QuoteAsset>(
self: &Pool<BaseAsset, QuoteAsset>,
order_id: u128,
): Order {
self.load_inner().book.get_order(order_id)
}
Returns a vector of `Order` structs using a vector of order IDs.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun get_orders<BaseAsset, QuoteAsset>(
self: &Pool<BaseAsset, QuoteAsset>,
order_ids: vector<u128>,
): vector<Order> {
let mut orders = vector[];
let mut i = 0;
let num_orders = order_ids.length();
while (i < num_orders) {
let order_id = order_ids[i];
orders.push_back(self.get_order(order_id));
i = i + 1;
};

    orders

}
Returns a vector of `Order` structs for all orders that belong to a `BalanceManager` in the pool.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun get_account_order_details<BaseAsset, QuoteAsset>(
self: &Pool<BaseAsset, QuoteAsset>,
balance_manager: &BalanceManager,
): vector<Order> {
let acct_open_orders = self.account_open_orders(balance_manager).into_keys();

    self.get_orders(acct_open_orders)

}

# Retrieve locked balance

Returns the locked balance for a `BalanceManager` in the pool ( `base_quantity` , `quote_quantity` , `deep_quantity` ).

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun locked_balance<BaseAsset, QuoteAsset>(
self: &Pool<BaseAsset, QuoteAsset>,
balance_manager: &BalanceManager,
): (u64, u64, u64) {
let account_orders = self.get_account_order_details(balance_manager);
let self = self.load_inner();
if (!self.state.account_exists(balance_manager.id())) {
return (0, 0, 0)
};

    let mut base_quantity = 0;
    let mut quote_quantity = 0;
    let mut deep_quantity = 0;

    account_orders.do_ref!(|order| {
        let maker_fee = self.state.history().historic_maker_fee(order.epoch());
        let locked_balance = order.locked_balance(maker_fee);
        base_quantity = base_quantity + locked_balance.base();
        quote_quantity = quote_quantity + locked_balance.quote();
        deep_quantity = deep_quantity + locked_balance.deep();
    });

    let settled_balances = self.state.account(balance_manager.id()).settled_balances();
    base_quantity = base_quantity + settled_balances.base();
    quote_quantity = quote_quantity + settled_balances.quote();
    deep_quantity = deep_quantity + settled_balances.deep();

    (base_quantity, quote_quantity, deep_quantity)

}

# Retrieve pool parameters

Returns the trade parameters for the pool ( `taker_fee` , `maker_fee` , `stake_required` ).

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun pool_trade_params<BaseAsset, QuoteAsset>(
self: &Pool<BaseAsset, QuoteAsset>,
): (u64, u64, u64) {
let self = self.load_inner();
let trade_params = self.state.governance().trade_params();
let taker_fee = trade_params.taker_fee();
let maker_fee = trade_params.maker_fee();
let stake_required = trade_params.stake_required();

    (taker_fee, maker_fee, stake_required)

}

Returns the trade parameters for the nextepoch **Epoch** A period of time defined by the network. for the currently leading proposal of the pool ( `taker_fee` , `maker_fee` , `stake_required` ).

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun pool_trade_params_next<BaseAsset, QuoteAsset>(
self: &Pool<BaseAsset, QuoteAsset>,
): (u64, u64, u64) {
let self = self.load_inner();
let trade_params = self.state.governance().next_trade_params();
let taker_fee = trade_params.taker_fee();
let maker_fee = trade_params.maker_fee();
let stake_required = trade_params.stake_required();

    (taker_fee, maker_fee, stake_required)

}

Returns thequorum **Quorum** A set of validators whose combined voting power is greater than 2/3 of the total. needed to pass proposal in the currentepoch .

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun quorum<BaseAsset, QuoteAsset>(self: &Pool<BaseAsset, QuoteAsset>): u64 {
self.load_inner().state.governance().quorum()
}
Returns the book parameters for the pool ( `tick_size` , `lot_size` , `min_size` ).

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun pool_book_params<BaseAsset, QuoteAsset>(
self: &Pool<BaseAsset, QuoteAsset>,
): (u64, u64, u64) {
let self = self.load_inner();
let tick_size = self.book.tick_size();
let lot_size = self.book.lot_size();
let min_size = self.book.min_size();

    (tick_size, lot_size, min_size)

}

Returns the `OrderDeepPrice` struct for the pool, which determines the conversion for DEEP fees.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun get_order_deep_price<BaseAsset, QuoteAsset>(
self: &Pool<BaseAsset, QuoteAsset>,
): OrderDeepPrice {
let whitelist = self.whitelisted();
let self = self.load_inner();

    self.deep_price.get_order_deep_price(whitelist)

}

# Retrieve reverse quantity calculations

Dry run to determine the base quantity needed to receive a given quote quantity out.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun get_base_quantity_in<BaseAsset, QuoteAsset>(
self: &Pool<BaseAsset, QuoteAsset>,
target_quote_quantity: u64,
pay_with_deep: bool,
clock: &Clock,
): (u64, u64, u64) {
let whitelist = self.whitelisted();
let self = self.load_inner();
let params = self.state.governance().trade_params();
let taker_fee = params.taker_fee();
let deep_price = if (pay_with_deep) {
self.deep_price.get_order_deep_price(whitelist)
} else {
self.deep_price.empty_deep_price()
};
self
.book
.get_base_quantity_in(
target_quote_quantity,
taker_fee,
deep_price,
pay_with_deep,
clock.timestamp_ms(),
)
}

Dry run to determine the quote quantity needed to receive a given base quantity out.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun get_quote_quantity_in<BaseAsset, QuoteAsset>(
self: &Pool<BaseAsset, QuoteAsset>,
target_base_quantity: u64,
pay_with_deep: bool,
clock: &Clock,
): (u64, u64, u64) {
let whitelist = self.whitelisted();
let self = self.load_inner();
let params = self.state.governance().trade_params();
let taker_fee = params.taker_fee();
let deep_price = if (pay_with_deep) {
self.deep_price.get_order_deep_price(whitelist)
} else {
self.deep_price.empty_deep_price()
};
self
.book
.get_quote_quantity_in(
target_base_quantity,
taker_fee,
deep_price,
pay_with_deep,
clock.timestamp_ms(),
)
}

# Pre-trade validation

Check if a limit order can be placed with the given parameters. Returns `true` if the order can be placed, `false` otherwise.
github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun can_place_limit_order<BaseAsset, QuoteAsset>(
self: &Pool<BaseAsset, QuoteAsset>,
balance_manager: &BalanceManager,
price: u64,
quantity: u64,
is_bid: bool,
pay_with_deep: bool,
expire_timestamp: u64,
clock: &Clock,
): bool {
let whitelist = self.whitelisted();
let pool_inner = self.load_inner();

    if (
        !self.check_limit_order_params(
            price,
            quantity,
            expire_timestamp,
            clock,
        )
    ) {
        return false
    };

    let order_deep_price = if (pay_with_deep) {
        pool_inner.deep_price.get_order_deep_price(whitelist)
    } else {
        pool_inner.deep_price.empty_deep_price()
    };

    let quote_quantity = math::mul(quantity, price);

    let taker_fee = pool_inner.state.governance().trade_params().taker_fee();
    let fee_balances = order_deep_price.fee_quantity(quantity, quote_quantity, is_bid);

    let mut required_base = 0;
    let mut required_quote = 0;
    let mut required_deep = 0;

    if (is_bid) {
        required_quote = quote_quantity;
        if (pay_with_deep) {
            required_deep = math::mul(fee_balances.deep(), taker_fee);
        } else {
            let fee_quote = math::mul(fee_balances.quote(), taker_fee);
            required_quote = required_quote + fee_quote;
        };
    } else {
        required_base = quantity;
        if (pay_with_deep) {
            required_deep = math::mul(fee_balances.deep(), taker_fee);
        } else {
            let fee_base = math::mul(fee_balances.base(), taker_fee);
            required_base = required_base + fee_base;
        };
    };

    let settled_balances = if (!self.account_exists(balance_manager)) {
        balances::empty()
    } else {
        self.account(balance_manager).settled_balances()
    };
    let available_base = balance_manager.balance<BaseAsset>() + settled_balances.base();
    let available_quote = balance_manager.balance<QuoteAsset>() + settled_balances.quote();
    let available_deep = balance_manager.balance<DEEP>() + settled_balances.deep();

    (available_base >= required_base) && (available_quote >= required_quote) && (available_deep >= required_deep)

}

Check if a market order can be placed with the given parameters. Returns `true` if the order can be placed, `false` otherwise.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun can_place_market_order<BaseAsset, QuoteAsset>(
self: &Pool<BaseAsset, QuoteAsset>,
balance_manager: &BalanceManager,
quantity: u64,
is_bid: bool,
pay_with_deep: bool,
clock: &Clock,
): bool {
if (!self.check_market_order_params(quantity)) {
return false
};

    let mut required_base = 0;
    let mut required_deep = 0;

    let settled_balances = if (!self.account_exists(balance_manager)) {
        balances::empty()
    } else {
        self.account(balance_manager).settled_balances()
    };
    let available_base = balance_manager.balance<BaseAsset>() + settled_balances.base();
    let available_quote = balance_manager.balance<QuoteAsset>() + settled_balances.quote();
    let available_deep = balance_manager.balance<DEEP>() + settled_balances.deep();

    if (is_bid) {
        let (base_out, quote_needed, deep_required) = self.get_quote_quantity_in(
            quantity,
            pay_with_deep,
            clock,
        );

        if (base_out < quantity || available_quote < quote_needed) {
            return false
        };

        if (pay_with_deep) {
            required_deep = deep_required;
        };
    } else {
        let (_, _, deep_required) = if (pay_with_deep) {
            self.get_quantity_out(quantity, 0, clock)
        } else {
            self.get_quantity_out_input_fee(quantity, 0, clock)
        };

        required_base = if (pay_with_deep) {
            quantity
        } else {
            let (taker_fee, _, _) = self.pool_trade_params();
            let input_fee_rate = math::mul(taker_fee, constants::fee_penalty_multiplier());
            math::mul(quantity, constants::float_scaling() + input_fee_rate)
        };

        if (pay_with_deep) {
            required_deep = deep_required;
        };
    };

    (available_base >= required_base) && (available_deep >= required_deep)

}

Validate limit order parameters and return detailed error information if invalid.
github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun check_limit_order_params<BaseAsset, QuoteAsset>(
self: &Pool<BaseAsset, QuoteAsset>,
price: u64,
quantity: u64,
expire_timestamp: u64,
clock: &Clock,
): bool {
let pool_inner = self.load_inner();
pool_inner
.book
.check_limit_order_params(price, quantity, expire_timestamp, clock.timestamp_ms())
}
Validate market order parameters and return detailed error information if invalid.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun check_market_order_params<BaseAsset, QuoteAsset>(
self: &Pool<BaseAsset, QuoteAsset>,
quantity: u64,
): bool {
let pool_inner = self.load_inner();
pool_inner.book.check_market_order_params(quantity)
}

# Pool status

Check if the pool is a stable pool (uses stable curve pricing).

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun stable_pool<BaseAsset, QuoteAsset>(self: &Pool<BaseAsset, QuoteAsset>): bool {
self.load_inner().state.governance().stable()
}
Check if the pool is registered in the registry.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun registered_pool<BaseAsset, QuoteAsset>(self: &Pool<BaseAsset, QuoteAsset>): bool {
self.load_inner().registered_pool
}

# Account queries

Check if an account exists for a `BalanceManager` in the pool.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun account_exists<BaseAsset, QuoteAsset>(
self: &Pool<BaseAsset, QuoteAsset>,
balance_manager: &BalanceManager,
): bool {
let self = self.load_inner();
self.state.account_exists(balance_manager.id())
}
Get the `Account` struct for a `BalanceManager` in the pool.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun account<BaseAsset, QuoteAsset>(
self: &Pool<BaseAsset, QuoteAsset>,
balance_manager: &BalanceManager,
): Account {
let self = self.load_inner();

    *self.state.account(balance_manager.id())

}

# Referrals

URL: https://docs.sui.io/onchain-finance/deepbookv3/contract-information/referral

TheDeepBook **DeepBook** A decentralized central limit order book (CLOB) built on Sui. referral system allows users to earn fees by referring traders to the platform. Referrers can mint a `DeepBookPoolReferral`object **Object** The basic unit of storage on Sui. for a specific pool, and traders can associate their `BalanceManager` with a referral. When traders with an associated referral execute trades, a portion of their trading fees is allocated to the referrer based on the referral multiplier.

## How referrals work

1. **Mint a referral:** Anyone can mint a `DeepBookPoolReferral` for a specific pool with a specified multiplier. The referral is permanently tied to the pool it was minted from and can only earn fees from trades in that pool.
2. **Set referral:** Traders associate their `BalanceManager` with a pool-specific referral using a `TradeCap` . Each `BalanceManager` can be associated with different referrals from different pools simultaneously.
3. **Earn fees:** When taker orders are executed by the balance manager in that pool, referral fees are automatically allocated based on the multiplier. Maker orders do not generate referral fees.
4. **Claim rewards:** Referrers can claim their accumulated fees in base, quote, and DEEP tokens.

## API

The following are the referral-related functions thatDeepBook exposes.

# Mint a referral

Mint a new `DeepBookPoolReferral`object for a specific pool with a specified multiplier. The multiplier determines the portion of trading fees allocated to the referrer. The multiplier must be a multiple of 0.1 (such as 0.1, 0.2, or 0.3) and cannot exceed 2.0. Returns the ID of the created referral.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun mint*referral<BaseAsset, QuoteAsset>(
self: &mut Pool<BaseAsset, QuoteAsset>,
multiplier: u64,
ctx: &mut TxContext,
): ID {
assert!(multiplier <= constants::referral_max_multiplier(), EInvalidReferralMultiplier);
assert!(multiplier % constants::referral_multiplier() == 0, EInvalidReferralMultiplier);
let * = self.load_inner();
let referral_id = balance_manager::mint_referral(self.id(), ctx);
self
.id
.add(
referral_id,
ReferralRewards<BaseAsset, QuoteAsset> {
multiplier,
base: balance::zero(),
quote: balance::zero(),
deep: balance::zero(),
},
);

    referral_id

}

# Update referral multiplier

Update the multiplier for an existing pool referral. Only the referral owner can update the multiplier. The new multiplier must be a multiple of 0.1 and cannot exceed 2.0.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun update*pool_referral_multiplier<BaseAsset, QuoteAsset>(
self: &mut Pool<BaseAsset, QuoteAsset>,
referral: &DeepBookPoolReferral,
multiplier: u64,
ctx: &TxContext,
) {
let * = self.load_inner();
referral.assert_referral_owner(ctx);
assert!(multiplier <= constants::referral_max_multiplier(), EInvalidReferralMultiplier);
assert!(multiplier % constants::referral_multiplier() == 0, EInvalidReferralMultiplier);
let referral_id = object::id(referral);
let referral_rewards: &mut ReferralRewards<BaseAsset, QuoteAsset> = self
.id
.borrow_mut(referral_id);
referral_rewards.multiplier = multiplier;
}

# Claim referral rewards

Claim accumulated referral fees for a pool referral. Only the referral owner can claim rewards. Returns three `Coin` objects representing the accumulated fees in base asset, quote asset, and DEEP tokens.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun claim*pool_referral_rewards<BaseAsset, QuoteAsset>(
self: &mut Pool<BaseAsset, QuoteAsset>,
referral: &DeepBookPoolReferral,
ctx: &mut TxContext,
): (Coin<BaseAsset>, Coin<QuoteAsset>, Coin<DEEP>) {
let * = self.load_inner();
referral.assert_referral_owner(ctx);
let referral_id = object::id(referral);
let referral_rewards: &mut ReferralRewards<BaseAsset, QuoteAsset> = self
.id
.borrow_mut(referral_id);
let base = referral_rewards.base.withdraw_all().into_coin(ctx);
let quote = referral_rewards.quote.withdraw_all().into_coin(ctx);
let deep = referral_rewards.deep.withdraw_all().into_coin(ctx);

    event::emit(ReferralClaimed {
        pool_id: self.id(),
        referral_id,
        owner: ctx.sender(),
        base_amount: base.value(),
        quote_amount: quote.value(),
        deep_amount: deep.value(),
    });

    (base, quote, deep)

}

# Get referral balances

View the current accumulated balances for a pool referral without claiming them. Returns the amounts in base, quote, and DEEP tokens.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun get*pool_referral_balances<BaseAsset, QuoteAsset>(
self: &Pool<BaseAsset, QuoteAsset>,
referral: &DeepBookPoolReferral,
): (u64, u64, u64) {
let * = self.load_inner();
assert!(referral.balance_manager_referral_pool_id() == self.id(), EWrongPoolReferral);
let referral_rewards: &ReferralRewards<BaseAsset, QuoteAsset> = self
.id
.borrow(object::id(referral));
let base = referral_rewards.base.value();
let quote = referral_rewards.quote.value();
let deep = referral_rewards.deep.value();

    (base, quote, deep)

}

# Get referral multiplier

Get the current multiplier for a pool referral.
github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public fun pool*referral_multiplier<BaseAsset, QuoteAsset>(
self: &Pool<BaseAsset, QuoteAsset>,
referral: &DeepBookPoolReferral,
): u64 {
let * = self.load_inner();
assert!(referral.balance_manager_referral_pool_id() == self.id(), EWrongPoolReferral);
let referral_rewards: &ReferralRewards<BaseAsset, QuoteAsset> = self
.id
.borrow(object::id(referral));

    referral_rewards.multiplier

}

## `BalanceManager` referral functions

These functions are available on the `BalanceManager` to associate or disassociate a referral.

# Set referral

Associate a `BalanceManager` with a pool-specific referral. Requires a `TradeCap` to authorize the operation. Once set, all trades executed by this balance manager in the referral's pool will generate referral fees according to the referral's multiplier. Any previously set referral for the same pool is replaced.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/balance*manager.move
public fun set_balance_manager_referral(
balance_manager: &mut BalanceManager,
referral: &DeepBookPoolReferral,
trade_cap: &TradeCap,
) {
balance_manager.validate_trader(trade_cap);
let *: Option<ID> = balance_manager.id.remove_if_exists(ReferralKey(referral.pool_id));
balance_manager.id.add(ReferralKey(referral.pool_id), referral.id.to_inner());

    event::emit(DeepBookReferralSetEvent {
        referral_id: referral.id.to_inner(),
        balance_manager_id: balance_manager.id.to_inner(),
    });

}

# Unset referral

Remove the referral association from a `BalanceManager` for a specific pool. Requires a `TradeCap` to authorize the operation. After unsetting, trades in that pool will no longer generate referral fees.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/balance*manager.move
public fun unset_balance_manager_referral(
balance_manager: &mut BalanceManager,
pool_id: ID,
trade_cap: &TradeCap,
) {
balance_manager.validate_trader(trade_cap);
let *: Option<ID> = balance_manager.id.remove_if_exists(ReferralKey(pool_id));

    event::emit(DeepBookReferralSetEvent {
        referral_id: id_from_address(@0x0),
        balance_manager_id: balance_manager.id.to_inner(),
    });

}

# Get referral ID

Retrieve the referral ID currently associated with a `BalanceManager` for a specific pool, if any. Returns `Option<ID>` which is `none` if no referral is set for that pool.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/balance*manager.move
public fun get_balance_manager_referral_id(
balance_manager: &BalanceManager,
pool_id: ID,
): Option<ID> {
let ref_key = ReferralKey(pool_id);
if (!balance_manager.id.exists*(ref_key)) {
return option::none()
};
let referral_id: &ID = balance_manager.id.borrow(ref_key);

    option::some(*referral_id)

}

# Get referral owner

Get the owneraddress **Address** A unique, anonymous identity on a blockchain network. of a pool referralobject .

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/balance_manager.move
public fun balance_manager_referral_owner(referral: &DeepBookPoolReferral): address {
referral.owner
}

# Get referral pool ID

Get the pool ID associated with a pool referral object .

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/balance_manager.move
public fun balance_manager_referral_pool_id(referral: &DeepBookPoolReferral): ID {
referral.pool_id
}

## Events

# `DeepBookReferralCreatedEvent`

Emitted when a new referral is minted.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/balance_manager.move
public struct DeepBookReferralCreatedEvent has copy, drop {
referral_id: ID,
owner: address,
}

# `DeepBookReferralSetEvent`

Emitted when a referral is set or unset on a balance manager.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/balance_manager.move
public struct DeepBookReferralSetEvent has copy, drop {
referral_id: ID,
balance_manager_id: ID,
}

# `ReferralClaimed`

Emitted when a referral owner claims their accumulated fees.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public struct ReferralClaimed has copy, drop, store {
pool_id: ID,
referral_id: ID,
owner: address,
base_amount: u64,
quote_amount: u64,
deep_amount: u64,
}

# `ReferralFeeEvent`

Emitted when referral fees are allocated during trade execution.

github.com/MystenLabs/deepbookv3/packages/deepbook/sources/pool.move
public struct ReferralFeeEvent has copy, drop, store {
pool_id: ID,
referral_id: ID,
base_fee: u64,
quote_fee: u64,
deep_fee: u64,
}

# EWMA Gas Price Penalty

URL: https://docs.sui.io/onchain-finance/deepbookv3/contract-information/ewma

DeepBook **DeepBook** A decentralized central limit order book (CLOB) built on Sui. implements an exponentially weighted moving average (EWMA) system to dynamically adjust taker fees based on networkgas **Gas** The computational cost of execution and object storage for a transaction. prices. This feature helps prevent toxic takers from using highgas prices to prioritize their transactions and pick off stale maker orders.

## Overview

The system tracksgas prices over time and applies a penalty fee to takers when the currentgas price is unusually high compared to recent history. This protects makers from having their orders filled during periods of abnormal network activity where toxic takers might try to front-run or take advantage of stale orders.

## How it works

The EWMA system calculates a smoothed average and variance of recentgas prices, then compares the currentgas price against this historical baseline. When the currentgas price is significantly elevated (beyond a threshold measured in standard deviations), an additional taker fee penalty is applied.

Key components include:

- Mean: Smoothed average of recentgas prices.
- Variance: Measure ofgas price volatility.
- Standard deviation: Square root of variance, used for z-score calculation.
- Z-score: How many standard deviations the currentgas price is from the mean.
- Z-score threshold: Trigger point for applying the penalty.

### The formula

```sh
z_score = (current_gas_price - mean) / standard_deviation

if z_score > z_score_threshold:
    apply additional_taker_fee
```

## Configuration parameters

The following table shows sample configuration parameters for the EWMA system:

| Parameter | Value | Meaning
| Alpha | 0.1 (100000000) | 10% weight on new data, 90% on history
| Mean | 1,478 | Averagegas price (smoothed)
| Variance | 43,270,831 | Volatility measure
| Std deviation | 6,578 | Calculated: √variance
| Z-score threshold | 3.0 | Trigger: 3 standard deviations
| Additional taker fee | 0.1% (1000000) | Penalty fee added

## When does the penalty apply?

The penalty is applied only when all of the following conditions are met:

1. EWMA is enabled for the pool.
2. Currentgas price ≥ mean (must be above average).
3. Z-Score > threshold (must exceed 3.0 standard deviations).

### Penalty threshold calculation

```sh
Penalty Threshold = Mean + (Z-Score Threshold × Std Dev)
Penalty Threshold = 1,478 + (3.0 × 6,578)
Penalty Threshold = 1,478 + 19,734
Penalty Threshold ≈ 21,212
```

## Practical examples

The following examples illustrate how the EWMA penalty system works under differentgas price conditions.

### Example 1: Normal conditions (current)

- **Gas price:** 1,000
- **Calculation:** (1,000 - 1,478) / 6,578 = -0.073
- **Z-score:** Negative, below mean
- **Result:** No penalty - Base taker fee only

### Example 2: Slightly elevated

- **Gas price:** 5,000
- **Calculation:** (5,000 - 1,478) / 6,578 = 0.54
- **Z-score:** 0.54
- **Result:** No penalty - Below 3.0 threshold

### Example 3: High spike

- **Gas price:** 15,000
- **Calculation:** (15,000 - 1,478) / 6,578 = 2.06
- **Z-score:** 2.06
- **Result:** No penalty - Still below 3.0 threshold

### Example 4: Extreme spike (penalty triggered)

- **Gas price:** 25,000
- **Calculation:** (25,000 - 1,478) / 6,578 = 3.58
- **Z-score:** 3.58
- **Result:** Penalty applied - Additional 0.1% fee added

## Benefits

- Maker protection: Discourages takers from picking off stale maker orders during network congestion.
- Dynamic adjustment: Automatically adapts to changinggas price patterns over time.
- Fair pricing: Only penalizes during extreme conditions (3 standard deviations).
- Statistical rigor: Uses well-established statistical methods to identify outliers.

## Technical notes

- Update frequency: EWMA updates when an order is submitted. Only counts if the timestamp is different (multiple orders within the sametransaction **Transaction** A number of commands that execute on inputs to define the result of the transaction. are only counted once).
- Alpha value: 0.1 means the system adapts relatively quickly to new price levels while maintaining historical context.
- 3-sigma threshold: Statistically, only approximately 0.3% of observations exceed 3 standard deviations in a normal distribution (approximately 0.15% above 3 standard deviations).
- Pool-specific: Each pool has its own EWMA state tracked independently.

# DeepBookV3 SDK

URL: https://docs.sui.io/onchain-finance/deepbookv3-sdk/

The DeepBookV3 TypeScript SDK abstracts away thetransaction **Transaction** A number of commands that execute on inputs to define the result of the transaction. calls, allowing for direct interactions with the `DeepBook`package **Package** Smart contracts on Sui. .

- [SDK repository](https://github.com/MystenLabs/ts-sdks/tree/main/packages/deepbook-v3)
- [NPM version](https://www.npmjs.com/package/@mysten/deepbook-v3)

## Install

To use the SDK in your projects, install the `@mysten/deepbook`package .

- npm
- Yarn
- pnpm

```sh
npm install @mysten/deepbook-v3
```

```sh
yarn add @mysten/deepbook-v3
```

```sh
pnpm add @mysten/deepbook-v3
```

## Constants

The DeepBookV3 SDK includes a constants file ( `/utils/constants.ts` ) that maintains the latest deployedaddresses **Address** A unique, anonymous identity on a blockchain network. for DeepBookV3, as well as a few staple coins and pools.

Click to open `constants.ts`

[packages/deepbook-v3/src/utils/constants.ts](https://github.com/MystenLabs/sui/blob/main/packages/deepbook-v3/src/utils/constants.ts)

```ts
loading...
```

[View on GitHub](https://github.com/MystenLabs/ts-sdks/blob/main/packages/deepbook-v3/src/utils/constants.ts)

## DeepBookClient

To work with DeepBookV3, use the client extension to addDeepBook **DeepBook** A decentralized central limit order book (CLOB) built on Sui. functionality to a Sui client. The [Sui TypeScript SDK](https://sdk.mystenlabs.com/typescript) provides the `SuiGrpcClient` and key functionality necessary to process transactions. The following example imports those libraries, as well.

```tsx
import { deepbook, type DeepBookClient } from "@mysten/deepbook-v3";
import type { ClientWithExtensions } from "@mysten/sui/client";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

class DeepBookMarketMaker {
  client: ClientWithExtensions<{ deepbook: DeepBookClient }>;
  keypair: Ed25519Keypair;

  constructor(privateKey: string, env: "testnet" | "mainnet") {
    this.keypair = this.getSignerFromPK(privateKey);
    this.client = new SuiGrpcClient({
      network: env,
      baseUrl:
        env === "mainnet"
          ? "https://fullnode.mainnet.sui.io:443"
          : "https://fullnode.testnet.sui.io:443",
    }).$extend(
      deepbook({
        address: this.getActiveAddress(),
      }),
    );
  }

  getSignerFromPK = (privateKey: string): Ed25519Keypair => {
    const { scheme, secretKey } = decodeSuiPrivateKey(privateKey);
    if (scheme === "ED25519") return Ed25519Keypair.fromSecretKey(secretKey);

    throw new Error(`Unsupported scheme: ${scheme}`);
  };

  getActiveAddress() {
    return this.keypair.toSuiAddress();
  }
}
```

## Keys: Coin, Pool, and Manager

Functions that require the input of a coin, pool, or a manager require the key of any suchobject **Object** The basic unit of storage on Sui. as the parameter. The SDK manages a `key:value` relationship of this data in memory. Some default data comes with the SDK (as seen in `utils/constants.ts` ). Coins are stored in a `CoinMap` and pools in a `PoolMap` in the config.

### Balance manager

Before placing any trade, you must supply a balance manageraddress to the client. The manager key points to anobject defined by the `BalanceManager` interface in the client. [BalanceManager docs](/onchain-finance/deepbookv3/contract-information/balance-manager) . Initialize the balance manager with the client. If you don't create a balance manager, you can rely on the client to create one, but then the user must reinitialize the client.

Example using an existing balance manager:

```tsx
import { deepbook, type DeepBookClient } from "@mysten/deepbook-v3";
import type { ClientWithExtensions } from "@mysten/sui/client";
import type { BalanceManager } from "@mysten/deepbook-v3";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { config } from "dotenv";

config();

const BALANCE_MANAGER_KEY = "MANAGER_1";

class DeepBookMarketMaker {
  client: ClientWithExtensions<{ deepbook: DeepBookClient }>;
  keypair: Ed25519Keypair;

  constructor(privateKey: string, env: "testnet" | "mainnet") {
    this.keypair = this.getSignerFromPK(privateKey);
    this.client = new SuiGrpcClient({
      network: env,
      baseUrl:
        env === "mainnet"
          ? "https://fullnode.mainnet.sui.io:443"
          : "https://fullnode.testnet.sui.io:443",
    }).$extend(
      deepbook({
        address: this.getActiveAddress(),
        balanceManagers: this.getBalanceManagers(),
      }),
    );
  }

  getSignerFromPK = (privateKey: string): Ed25519Keypair => {
    const { scheme, secretKey } = decodeSuiPrivateKey(privateKey);
    if (scheme === "ED25519") return Ed25519Keypair.fromSecretKey(secretKey);

    throw new Error(`Unsupported scheme: ${scheme}`);
  };

  getActiveAddress() {
    return this.keypair.toSuiAddress();
  }

  getBalanceManagers(): { [key: string]: BalanceManager } {
    const balanceManagerAddress = process.env.BALANCE_MANAGER_ADDRESS;
    const balanceManagerTradeCap = process.env.BALANCE_MANAGER_TRADE_CAP;
    if (!balanceManagerAddress) {
      throw new Error("No balance manager address found");
    }
    return {
      [BALANCE_MANAGER_KEY]: {
        address: balanceManagerAddress,
        tradeCap: balanceManagerTradeCap,
      },
    };
  }
}
```

Example creating a balance manager:

```tsx
import { deepbook, type DeepBookClient } from "@mysten/deepbook-v3";
import type { ClientWithExtensions } from "@mysten/sui/client";
import type { BalanceManager } from "@mysten/deepbook-v3";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

const BALANCE_MANAGER_KEY = "MANAGER_1";

class DeepBookMarketMaker {
  client: ClientWithExtensions<{ deepbook: DeepBookClient }>;
  keypair: Ed25519Keypair;
  env: "testnet" | "mainnet";

  constructor(privateKey: string, env: "testnet" | "mainnet") {
    this.env = env;
    this.keypair = this.getSignerFromPK(privateKey);
    this.client = this.#createClient(env);
  }

  #createClient(
    env: "testnet" | "mainnet",
    balanceManagers?: { [key: string]: BalanceManager },
  ) {
    return new SuiGrpcClient({
      network: env,
      baseUrl:
        env === "mainnet"
          ? "https://fullnode.mainnet.sui.io:443"
          : "https://fullnode.testnet.sui.io:443",
    }).$extend(
      deepbook({
        address: this.getActiveAddress(),
        balanceManagers,
      }),
    );
  }

  getSignerFromPK = (privateKey: string): Ed25519Keypair => {
    const { scheme, secretKey } = decodeSuiPrivateKey(privateKey);
    if (scheme === "ED25519") return Ed25519Keypair.fromSecretKey(secretKey);

    throw new Error(`Unsupported scheme: ${scheme}`);
  };

  getActiveAddress() {
    return this.keypair.toSuiAddress();
  }

  async createBalanceManagerAndReinitialize() {
    let tx = new Transaction();
    tx.add(this.client.deepbook.balanceManager.createAndShareBalanceManager());

    const result = await this.client.core.signAndExecuteTransaction({
      transaction: tx,
      signer: this.keypair,
      include: { effects: true, objectTypes: true },
    });

    if (result.$kind === "FailedTransaction") {
      throw new Error("Transaction failed");
    }

    const objectTypes = result.Transaction?.objectTypes ?? {};
    const balanceManagerAddress =
      result.Transaction?.effects?.changedObjects?.find(
        (obj) =>
          obj.idOperation === "Created" &&
          objectTypes[obj.objectId]?.includes("BalanceManager"),
      )?.objectId;

    if (!balanceManagerAddress) {
      throw new Error("Failed to create balance manager");
    }

    const balanceManagers: { [key: string]: BalanceManager } = {
      [BALANCE_MANAGER_KEY]: {
        address: balanceManagerAddress,
        tradeCap: undefined,
      },
    };

    this.client = this.#createClient(this.env, balanceManagers);
  }
}
```

### Coin

The SDK comes with four default coins onTestnet **Testnet** Staging network for testing changes before production deployment. and five default coins onMainnet **Mainnet** Production network for live transactions and real-value assets. .

**DefaultTestnet coins**

- DEEP
- SUI
- DBUSDC
- DBUSDT
  **DefaultMainnet coins**

- DEEP
- SUI
- USDC
- USDT
- WETH
  You can also initialize the SDK with custom coins to interact with pools that are not supported by default. To do this, create a `CoinMap`object and pass it to the constructor of the client.

### Pool

Similar to coins, the SDK comes with default pools. You can provide a `PoolMap` during construction to override this behavior.

```tsx
import { deepbook, type DeepBookClient } from "@mysten/deepbook-v3";
import type { ClientWithExtensions } from "@mysten/sui/client";
import type { BalanceManager } from "@mysten/deepbook-v3";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import type { Keypair } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import type { Transaction } from "@mysten/sui/transactions";

export class DeepBookMarketMaker {
  keypair: Keypair;
  client: ClientWithExtensions<{ deepbook: DeepBookClient }>;

  constructor(
    keypair: string | Keypair,
    env: "testnet" | "mainnet",
    balanceManagers?: { [key: string]: BalanceManager },
    adminCap?: string,
  ) {
    if (typeof keypair === "string") {
      this.keypair = DeepBookMarketMaker.#getSignerFromPK(keypair);
    } else {
      this.keypair = keypair;
    }

    this.client = new SuiGrpcClient({
      network: env,
      baseUrl:
        env === "mainnet"
          ? "https://fullnode.mainnet.sui.io:443"
          : "https://fullnode.testnet.sui.io:443",
    }).$extend(
      deepbook({
        address: this.getActiveAddress(),
        balanceManagers,
        adminCap,
      }),
    );
  }

  static #getSignerFromPK = (privateKey: string) => {
    const { schema, secretKey } = decodeSuiPrivateKey(privateKey);
    if (schema === "ED25519") return Ed25519Keypair.fromSecretKey(secretKey);

    throw new Error(`Unsupported schema: ${schema}`);
  };

  signAndExecute = async (tx: Transaction) => {
    const result = await this.client.core.signAndExecuteTransaction({
      transaction: tx,
      signer: this.keypair,
      include: { effects: true },
    });
    if (result.$kind === "FailedTransaction") {
      throw new Error("Transaction failed");
    }
    return result.Transaction;
  };

  getActiveAddress() {
    return this.keypair.getPublicKey().toSuiAddress();
  }
}
```

### Example setup

The following example uses the default pools and coins provided.

```tsx
import { Transaction } from "@mysten/sui/transactions";

import { DeepBookMarketMaker } from "./deepbookMarketMaker.js";

(async () => {
  const privateKey = ""; // Can encapsulate this in a .env file

  // Initialize with balance managers if created
  const balanceManagers = {
    MANAGER_1: {
      address: "",
      tradeCap: "",
    },
  };
  const mmClient = new DeepBookMarketMaker(
    privateKey,
    "testnet",
    balanceManagers,
  );

  const tx = new Transaction();

  // Read only call
  console.log(
    await mmClient.client.deepbook.checkManagerBalance("MANAGER_1", "SUI"),
  );
  console.log(
    await mmClient.client.deepbook.getLevel2Range("SUI_DBUSDC", 0.1, 100, true),
  );

  // Balance manager contract call
  mmClient.client.deepbook.balanceManager.depositIntoManager(
    "MANAGER_1",
    "DBUSDT",
    10000,
  )(tx);
  mmClient.client.deepbook.balanceManager.withdrawAllFromManager(
    "MANAGER_1",
    "DBUSDT",
    mmClient.getActiveAddress(),
  )(tx);

  let res = await mmClient.signAndExecute(tx);

  console.dir(res, { depth: null });
})();
```

## Referral functions

The SDK provides functions for managing pool-specific referrals. Referrals allow users to earn a portion of trading fees from traders they refer.

### Pool referral functions

These functions are available on the `deepbook` contract for managing referrals at the pool level.

Multiplier constraints
The referral multiplier must be a multiple of 0.1 (such as 0.1, 0.2, or 0.3) and cannot exceed 2.0.

```tsx
// Mint a new referral for a specific pool
// multiplier determines the portion of fees allocated to the referrer
// Valid values: 0.1, 0.2, 0.3, ... up to 2.0
client.deepbook.mintReferral("SUI_DBUSDC", 0.1)(tx);

// Update the multiplier for an existing referral
client.deepbook.updatePoolReferralMultiplier("SUI_DBUSDC", referralId, 0.2)(tx);

// Claim accumulated referral rewards (returns base, quote, and DEEP coins)
const { baseRewards, quoteRewards, deepRewards } = tx.add(
  client.deepbook.claimPoolReferralRewards("SUI_DBUSDC", referralId),
);

// Get the current balances for a referral
client.deepbook.getPoolReferralBalances("SUI_DBUSDC", referralId)(tx);

// Get the multiplier for a referral
client.deepbook.poolReferralMultiplier("SUI_DBUSDC", referralId)(tx);
```

### Balance manager referral functions

These functions are available on the `balanceManager` contract for associating referrals with balance managers.

```tsx
// Generate a trade cap first (needed for setting referrals)
const tradeCap = tx.add(
  client.deepbook.balanceManager.mintTradeCap("MANAGER_1"),
);

// Set a referral for a balance manager (pool-specific)
// Each balance manager can have different referrals for different pools
client.deepbook.balanceManager.setBalanceManagerReferral(
  "MANAGER_1",
  referralId,
  tradeCap,
)(tx);

// Unset the referral for a specific pool
client.deepbook.balanceManager.unsetBalanceManagerReferral(
  "MANAGER_1",
  "SUI_DBUSDC",
  tradeCap,
)(tx);

// Get the referral ID associated with a balance manager for a specific pool
client.deepbook.balanceManager.getBalanceManagerReferralId(
  "MANAGER_1",
  "SUI_DBUSDC",
)(tx);

// Get the owner of a referral
client.deepbook.balanceManager.balanceManagerReferralOwner(referralId)(tx);

// Get the pool ID associated with a referral
client.deepbook.balanceManager.balanceManagerReferralPoolId(referralId)(tx);
```

# BalanceManager SDK

URL: https://docs.sui.io/onchain-finance/deepbookv3-sdk/balance-manager

The `BalanceManager` is a core component of DeepBookV3 that holds all asset balances. The SDK provides comprehensive functions to create, manage, and interact with balance managers.

## Balance manager functions

The DeepBookV3 SDK provides the following functions for managing balance managers.

# createAndShareBalanceManager

Use `createAndShareBalanceManager` to create a new balance manager and automatically share it. The call returns a function that takes a `Transaction`object **Object** The basic unit of storage on Sui. .

github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/balanceManager.ts
createAndShareBalanceManager = () => (tx: Transaction)

# createBalanceManagerWithOwner

Use `createBalanceManagerWithOwner` to create a new balance manager with a custom owner. Returns the managerobject . The call returns a function that takes a `Transaction`object .

**Parameters**

- `ownerAddress` : String representing theaddress **Address** A unique, anonymous identity on a blockchain network. of the owner.

  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/balanceManager.ts
  createBalanceManagerWithOwner = (ownerAddress: string) => (tx: Transaction)

# shareBalanceManager

Use `shareBalanceManager` to share a balance manager that was created but not yet shared. The call returns a function that takes a `Transaction`object .

**Parameters**

- `manager` : `TransactionArgument` representing the balance manager to share.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/balanceManager.ts
  shareBalanceManager = (manager: TransactionArgument) => (tx: Transaction)

## Deposit and withdraw functions

# depositIntoManager

Use `depositIntoManager` to deposit funds into a balance manager. The call returns a function that takes a `Transaction`object .

**Parameters**

- `managerKey` : String that identifies the balance manager.
- `coinKey` : String that identifies the coin to deposit.
- `amountToDeposit` : Number representing the amount to deposit.

github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/balanceManager.ts
depositIntoManager =
(managerKey: string, coinKey: string, amountToDeposit: number) => (tx: Transaction)

# withdrawFromManager

Use `withdrawFromManager` to withdraw funds from a balance manager. The call returns a function that takes a `Transaction`object .

**Parameters**

- `managerKey` : String that identifies the balance manager.
- `coinKey` : String that identifies the coin to withdraw.
- `amountToWithdraw` : Number representing the amount to withdraw.
- `recipient` : String representing the recipientaddress .
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/balanceManager.ts
  withdrawFromManager =
  (managerKey: string, coinKey: string, amountToWithdraw: number, recipient: string) =>
  (tx: Transaction)

# withdrawAllFromManager

Use `withdrawAllFromManager` to withdraw all funds of a specific coin type from a balance manager. The call returns a function that takes a `Transaction`object .

**Parameters**

- `managerKey` : String that identifies the balance manager.
- `coinKey` : String that identifies the coin to withdraw.
- `recipient` : String representing the recipientaddress .

github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/balanceManager.ts
withdrawAllFromManager =
(managerKey: string, coinKey: string, recipient: string) => (tx: Transaction)

# checkManagerBalance

Use `checkManagerBalance` to check the balance of a specific coin in a balance manager. The call returns a function that takes a `Transaction`object .

**Parameters**

- `managerKey` : String that identifies the balance manager.
- `coinKey` : String that identifies the coin to check.

github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/balanceManager.ts
checkManagerBalance = (managerKey: string, coinKey: string) => (tx: Transaction)

## Trade proof functions

# generateProof

Use `generateProof` to generate a trade proof for the balance manager. Automatically calls the appropriate function based on whether a `tradeCap` is set. The call returns a function that takes a `Transaction`object .

**Parameters**

- `managerKey` : String that identifies the balance manager.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/balanceManager.ts
  generateProof = (managerKey: string) => (tx: Transaction)

# generateProofAsOwner

Use `generateProofAsOwner` to generate a trade proof as the owner of the balance manager. The call returns a function that takes a `Transaction`object .

**Parameters**

- `managerId` : String representing the ID of the balance manager.

github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/balanceManager.ts
generateProofAsOwner = (managerId: string) => (tx: Transaction)

# generateProofAsTrader

Use `generateProofAsTrader` to generate a trade proof using a `tradeCap` . The call returns a function that takes a `Transaction`object .

**Parameters**

- `managerId` : String representing the ID of the balance manager.
- `tradeCapId` : String representing the ID of the trade cap.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/balanceManager.ts
  generateProofAsTrader = (managerId: string, tradeCapId: string) => (tx: Transaction)

## Capability functions

# mintTradeCap

Use `mintTradeCap` to mint a `tradeCap` for the balance manager. The call returns a function that takes a `Transaction`object .

**Parameters**

- `managerKey` : String that identifies the balance manager.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/balanceManager.ts
  mintTradeCap = (managerKey: string) => (tx: Transaction)

# mintDepositCap

Use `mintDepositCap` to mint a `depositCap` for the balance manager. The call returns a function that takes a `Transaction`object .

**Parameters**

- `managerKey` : String that identifies the balance manager.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/balanceManager.ts
  mintDepositCap = (managerKey: string) => (tx: Transaction)

# mintWithdrawalCap

Use `mintWithdrawalCap` to mint a `withdrawCap` for the balance manager. The call returns a function that takes a `Transaction`object .

**Parameters**

- `managerKey` : String that identifies the balance manager.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/balanceManager.ts
  mintWithdrawalCap = (managerKey: string) => (tx: Transaction)

# depositWithCap

Use `depositWithCap` to deposit funds into a balance manager using a `depositCap` . The call returns a function that takes a `Transaction`object .

**Parameters**

- `managerKey` : String that identifies the balance manager.
- `coinKey` : String that identifies the coin to deposit.
- `amountToDeposit` : Number representing the amount to deposit.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/balanceManager.ts
  depositWithCap =
  (managerKey: string, coinKey: string, amountToDeposit: number) => (tx: Transaction)

# withdrawWithCap

Use `withdrawWithCap` to withdraw funds from a balance manager using a `withdrawCap` . The call returns a function that takes a `Transaction`object .

**Parameters**

- `managerKey` : String that identifies the balance manager.
- `coinKey` : String that identifies the coin to withdraw.
- `amountToWithdraw` : Number representing the amount to withdraw.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/balanceManager.ts
  withdrawWithCap =
  (managerKey: string, coinKey: string, amountToWithdraw: number) => (tx: Transaction)

# revokeTradeCap

Use `revokeTradeCap` to revoke a `TradeCap` . This also revokes the associated `DepositCap` and `WithdrawCap` . The call returns a function that takes a `Transaction`object .

**Parameters**

- `managerKey` : String that identifies the balance manager.
- `tradeCapId` : String representing the ID of the TradeCap to revoke.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/balanceManager.ts
  revokeTradeCap = (managerKey: string, tradeCapId: string) => (tx: Transaction)

## Referral functions

# setBalanceManagerReferral

Use `setBalanceManagerReferral` to set a pool-specific referral for the balance manager. Requires a `tradeCap` for permission checking. The call returns a function that takes a `Transaction`object .

**Parameters**

- `managerKey` : String that identifies the balance manager.
- `referral` : String representing the referral ID (DeepBookPoolReferral).
- `tradeCap` : `TransactionArgument` representing the trade cap for permission.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/balanceManager.ts
  setBalanceManagerReferral =
  (managerKey: string, referral: string, tradeCap: TransactionArgument) => (tx: Transaction)

# unsetBalanceManagerReferral

Use `unsetBalanceManagerReferral` to remove a referral from the balance manager for a specific pool. Requires a `tradeCap` for permission checking. The call returns a function that takes a `Transaction`object .

**Parameters**

- `managerKey` : String that identifies the balance manager.
- `poolKey` : String that identifies the pool to unset the referral for.
- `tradeCap` : `TransactionArgument` representing the trade cap for permission.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/balanceManager.ts
  unsetBalanceManagerReferral =
  (managerKey: string, poolKey: string, tradeCap: TransactionArgument) => (tx: Transaction)

# getBalanceManagerReferralId

Use `getBalanceManagerReferralId` to get the referral ID associated with a balance manager for a specific pool. The call returns a function that takes a `Transaction`object .

**Parameters**

- `managerKey` : String that identifies the balance manager.
- `poolKey` : String that identifies the pool.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/balanceManager.ts
  getBalanceManagerReferralId = (managerKey: string, poolKey: string) => (tx: Transaction)

## Registry functions

# registerBalanceManager

Use `registerBalanceManager` to register a balance manager with the registry. The call returns a function that takes a `Transaction`object .

**Parameters**

- `managerKey` : String that identifies the balance manager.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/balanceManager.ts
  registerBalanceManager = (managerKey: string) => (tx: Transaction)

## Read-only functions

# owner

Use `owner` to get the owneraddress of a balance manager. The call returns a function that takes a `Transaction`object .

**Parameters**

- `managerKey` : String that identifies the balance manager.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/balanceManager.ts
  owner = (managerKey: string) => (tx: Transaction)

# id

Use `id` to get the ID of a balance manager. The call returns a function that takes a `Transaction`object .

**Parameters**

- `managerKey` : String that identifies the balance manager.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/balanceManager.ts
  id = (managerKey: string) => (tx: Transaction)

# balanceManagerReferralOwner

Use `balanceManagerReferralOwner` to get the owneraddress of a pool referral (DeepBookPoolReferral). The call returns a function that takes a `Transaction`object .

**Parameters**

- `referralId` : String representing the ID of the referral.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/balanceManager.ts
  balanceManagerReferralOwner = (referralId: string) => (tx: Transaction)

# balanceManagerReferralPoolId

Use `balanceManagerReferralPoolId` to get the pool ID associated with a pool referral (DeepBookPoolReferral). The call returns a function that takes a `Transaction`object .

**Parameters**

- `referralId` : String representing the ID of the referral.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/balanceManager.ts
  balanceManagerReferralPoolId = (referralId: string) => (tx: Transaction)

## Examples

The following examples demonstrate common balance manager operations.

### Create and share a balance manager

```tsx
// Example: Create and share a new balance manager
createBalanceManager = (tx: Transaction) => {
  tx.add(this.balanceManager.createAndShareBalanceManager());
};
```

### Create a balance manager with custom owner

```tsx
// Example: Create a balance manager with custom owner and share it
createManagerWithOwner = (tx: Transaction) => {
  const ownerAddress = "0x123...";

  // Create the manager with custom owner
  const manager = tx.add(
    this.balanceManager.createBalanceManagerWithOwner(ownerAddress),
  );

  // Share the manager
  tx.add(this.balanceManager.shareBalanceManager(manager));
};
```

### Deposit and withdraw funds

```tsx
// Example: Deposit USDC into a balance manager
depositFunds = (tx: Transaction) => {
  const managerKey = "MANAGER_1";
  const coinKey = "DBUSDC";
  const amount = 1000; // 1000 USDC

  tx.add(this.balanceManager.depositIntoManager(managerKey, coinKey, amount));
};

// Example: Withdraw SUI from a balance manager
withdrawFunds = (tx: Transaction) => {
  const managerKey = "MANAGER_1";
  const coinKey = "SUI";
  const amount = 100; // 100 SUI
  const recipient = "0x456...";

  tx.add(
    this.balanceManager.withdrawFromManager(
      managerKey,
      coinKey,
      amount,
      recipient,
    ),
  );
};

// Example: Withdraw all DEEP from a balance manager
withdrawAllDeep = (tx: Transaction) => {
  const managerKey = "MANAGER_1";
  const coinKey = "DEEP";
  const recipient = "0x456...";

  tx.add(
    this.balanceManager.withdrawAllFromManager(managerKey, coinKey, recipient),
  );
};
```

### Mint and use capabilities

```tsx
// Example: Mint a TradeCap and use it
mintAndUseTradeCap = async (tx: Transaction) => {
  const managerKey = "MANAGER_1";

  // Mint the TradeCap
  const tradeCap = tx.add(this.balanceManager.mintTradeCap(managerKey));

  // Transfer to a trader
  const traderAddress = "0x789...";
  tx.transferObjects([tradeCap], traderAddress);
};

// Example: Use DepositCap to deposit funds
depositWithCapability = (tx: Transaction) => {
  const managerKey = "MANAGER_1";
  const coinKey = "DBUSDC";
  const amount = 5000; // 5000 USDC

  tx.add(this.balanceManager.depositWithCap(managerKey, coinKey, amount));
};

// Example: Use WithdrawCap to withdraw funds
withdrawWithCapability = (tx: Transaction) => {
  const managerKey = "MANAGER_1";
  const coinKey = "SUI";
  const amount = 50; // 50 SUI

  const withdrawnCoin = tx.add(
    this.balanceManager.withdrawWithCap(managerKey, coinKey, amount),
  );

  // Transfer the withdrawn coin
  tx.transferObjects([withdrawnCoin], "0xabc...");
};
```

### Generate trade proofs

```tsx
// Example: Generate a trade proof and use it to place an order
placeOrderWithProof = (tx: Transaction) => {
  const managerKey = "MANAGER_1";
  const poolKey = "SUI_DBUSDC";

  // Generate proof automatically (uses owner or tradeCap method)
  const proof = tx.add(this.balanceManager.generateProof(managerKey));

  // Use the proof to place an order
  tx.add(
    this.deepBook.placeLimitOrder({
      poolKey: poolKey,
      balanceManagerKey: managerKey,
      clientOrderId: "12345",
      price: 2.5,
      quantity: 100,
      isBid: true,
      payWithDeep: true,
    }),
  );
};
```

### Set and manage referrals

```tsx
// Example: Set a pool-specific referral for a balance manager
setManagerReferral = (tx: Transaction) => {
  const managerKey = "MANAGER_1";
  const referralId = "0xdef..."; // DeepBookPoolReferral ID

  // Get or create the TradeCap
  const tradeCap = tx.object("0x..."); // Assuming tradeCap is already minted

  tx.add(
    this.balanceManager.setBalanceManagerReferral(
      managerKey,
      referralId,
      tradeCap,
    ),
  );
};

// Example: Unset a referral for a specific pool
unsetManagerReferral = (tx: Transaction) => {
  const managerKey = "MANAGER_1";
  const poolKey = "SUI_DBUSDC";
  const tradeCap = tx.object("0x...");

  tx.add(
    this.balanceManager.unsetBalanceManagerReferral(
      managerKey,
      poolKey,
      tradeCap,
    ),
  );
};
```

### Complete workflow

```tsx
// Example: Complete balance manager setup workflow
completeSetup = async (tx: Transaction) => {
  const ownerAddress = "0x123...";

  // Step 1: Create manager with custom owner
  const manager = tx.add(
    this.balanceManager.createBalanceManagerWithOwner(ownerAddress),
  );

  // Step 2: Share the manager
  tx.add(this.balanceManager.shareBalanceManager(manager));

  // Step 3: Mint capabilities
  const tradeCap = tx.add(this.balanceManager.mintTradeCap("MANAGER_1"));
  const depositCap = tx.add(this.balanceManager.mintDepositCap("MANAGER_1"));
  const withdrawCap = tx.add(
    this.balanceManager.mintWithdrawalCap("MANAGER_1"),
  );

  // Step 4: Transfer capabilities to owner
  tx.transferObjects([depositCap, withdrawCap, tradeCap], ownerAddress);
};
```

# Pools SDK

URL: https://docs.sui.io/onchain-finance/deepbookv3-sdk/pools

Pools are shared objects that represent a market. See [Query the Pool](/onchain-finance/deepbookv3/contract-information/query-the-pool) for more information on pools.

## Pool functions

The DeepBookV3 SDK exposes functions that you can call to read the state of a pool. These functions typically require a `managerKey` , `coinKey` , `poolKey` , or a combination of these. For details on these keys, see [DeepBookV3 SDK](/onchain-finance/deepbookv3-sdk#keys) . The SDK includes some default keys that you can view in the `constants.ts` file.

SDK unit handling
Input amounts, quantities, and prices should be provided in standard decimal format (such as `10.5` SUI or `0.00001` nBTC). The SDK handles conversion to base units internally. Returned amounts are also in standard decimal format.

### account

Use `account` to retrieve the account information for a `BalanceManager` in a pool, which has the following form:

```ts
{
  epoch: '511',
  open_orders: {
    constants: [
      '170141211130585342296014727715884105730',
      '18446744092156295689709543266',
      '18446744092156295689709543265'
    ]
  },
  taker_volume: 0,
  maker_volume: 0,
  active_stake: 0,
  inactive_stake: 0,
  created_proposal: false,
  voted_proposal: null,
  unclaimed_rebates: { base: 0, quote: 0, deep: 0 },
  settled_balances: { base: 0, quote: 0, deep: 0 },
  owed_balances: { base: 0, quote: 0, deep: 0 }
}
```

**Parameters**

- `poolKey` : String that identifies the pool to query.
- `balanceManagerKey` : key of the balance manager defined in the SDK.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/client.ts

### accountOpenOrders

Use `accountOpenOrders` to retrieve open orders for the balance manager and pool with the IDs you provide. The call returns a `Promise` that contains an array of open order IDs.

**Parameters**

- `poolKey` : String that identifies the pool to query.
- `managerKey` : String that identifies the balance manager to query.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/client.ts
  accountOpenOrders(poolKey: string, managerKey: string): Promise<string[]>

### checkManagerBalance

Use `checkManagerBalance` to check the balance manager for a specific coin. The call returns a `Promise` in the form:

```text
{
  coinType: string,
  balance: number
}
```

**Parameters**

- `managerKey` : String that identifies the balance manager to query.
- `coinKey` : String that identifies the coin to query the balance of.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/client.ts
  checkManagerBalance(managerKey: string, coinKey: string): Promise<ManagerBalance>

### getOrder

Use `getOrder` to retrieve an order's information. The call returns a `Promise` in the `Order` struct, which has the following form:

```ts
{
  balance_manager_id: {
    bytes: '0x6149bfe6808f0d6a9db1c766552b7ae1df477f5885493436214ed4228e842393'
  },
  order_id: '9223372036873222552073709551614',
  client_order_id: '888',
  quantity: '50000000',
  filled_quantity: '0',
  fee_is_deep: true,
  order_deep_price: { asset_is_base: false, deep_per_asset: '0' },
  epoch: '440',
  status: 0,
  expire_timestamp: '1844674407370955161'
}
```

**Parameters**

`poolKey` : String that identifies the pool to query. `orderId` : ID of the order to query.

github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/client.ts
getOrder(poolKey: string, orderId: string)

### getQuoteQuantityOut

Use `getQuoteQuantityOut` to retrieve the quote quantity out for the base quantity you provide. The call returns a `Promise` in the form:

```text
{
  baseQuantity: number,
  baseOut: number,
  quoteOut: number,
  deepRequired: number
}
```

where `deepRequired` is the amount of DEEP required for the dry run.

**Parameters**

- `poolKey` : String that identifies the pool to query.
- `baseQuantity` : Number that defines the base quantity you want to convert.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/client.ts
  getQuoteQuantityOut(poolKey: string, baseQuantity: number | bigint): Promise<QuoteQuantityOut>

### getBaseQuantityOut

Use `getBaseQuantityOut` to retrieve the base quantity out for the quote quantity that you provide. The call returns a `Promise` in the form:

```text
{
  quoteQuantity: number,
  baseOut: number,
  quoteOut: number,
  deepRequired: number
}
```

where `deepRequired` is the amount of DEEP required for the dry run.

**Parameters**

- `poolKey` : String that identifies the pool to query.
- `quoteQuantity` : Number that defines the quote quantity you want to convert.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/client.ts
  getBaseQuantityOut(poolKey: string, quoteQuantity: number | bigint): Promise<BaseQuantityOut>

### getQuantityOut

Use `getQuantityOut` to retrieve the output quantities for the base or quote quantity you provide. You provide values for both quantities, but only one of them can be nonzero. The call returns a `Promise` with the form:

```text
{
  baseQuantity: number,
  quoteQuantity: number,
  baseOut: number,
  quoteOut: number,
  deepRequired: number
}
```

where `deepRequired` is the amount of DEEP required for the dry run.

**Parameters**

- `poolKey` : String that identifies the pool to query.
- `baseQuantity` : Number that defines the base quantity you want to convert. Set to `0` if using quote quantity.
- `quoteQuantity` : Number that defines the quote quantity you want to convert. Set to `0` if using base quantity.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/client.ts
  getQuantityOut(
  poolKey: string,
  baseQuantity: number | bigint,
  quoteQuantity: number | bigint,
  ): Promise<QuantityOut>

### getLevel2Range

Use `getLevel2Range` to retrieve level 2 order book within the boundary price range you provide. The call returns a `Promise` in the form:

```text
{
  prices: Array<number>,
  quantities: Array<number>
}
```

**Parameters**

- `poolKey` : String that identifies the pool to query.
- `priceLow` : Number for lower bound of price range.
- `priceHigh` : Number for upper bound of price range.
- `isBid` : Boolean when set to `true` gets bid orders, else retrieve ask orders.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/client.ts
  getLevel2Range(
  poolKey: string,
  priceLow: number | bigint,
  priceHigh: number | bigint,
  isBid: boolean,
  ): Promise<Level2Range>

### getLevel2TicksFromMid

Use `getLevel2TicksFromMid` to retrieve level 2 order book ticks from mid-price for a pool with the ID you provide. The call returns a `Promise` in the form:

```ts
{
  bid_prices: Array<number>,
  bid_quantities: Array<number>,
  ask_prices: Array<number>,
  ask_quantities: Array<number>
}
```

**Parameters**

- `poolKey` : String that identifies the pool to query.
- `ticks` : Number of ticks from mid-price.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/client.ts
  getLevel2TicksFromMid(poolKey: string, ticks: number): Promise<Level2TicksFromMid>

### lockedBalance

Use `lockedBalance` to retrieve a `BalanceManager` locked balance in the pool. The call returns a `Promise` in the `Order` struct, which has the following form:

```ts
{
  base: 5.5,
	quote: 2,
	deep: 0.15,
}
```

**Parameters**

`poolKey` : String that identifies the pool to query. `balanceManagerKey` : key of the balance manager defined in the SDK.

github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/client.ts

### poolTradeParams

Use `poolTradeParams` to retrieve the trade params for the pool, which has the following form:

```ts
{
  takerFee: 0.001,
	makerFee: 0.0005,
	stakeRequired: 100,
}
```

**Parameters**

- `poolKey` : String that identifies the pool to query.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/client.ts
  poolTradeParams(poolKey: string): Promise<PoolTradeParams>

### vaultBalances

Use `vaultBalances` to get the vault balances for a pool with the ID you provide. The call returns a `Promise` in the form:

```ts
{
  base: number,
  quote: number,
  deep: number
}
```

**Parameters**

- `poolKey` : String that identifies the pool to query.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/client.ts
  vaultBalances(poolKey: string): Promise<VaultBalances>

### getPoolIdByAssets

Use `getPoolIdByAssets` to retrieve the pool ID for the asset types you provide. The call returns a `Promise` with theaddress **Address** A unique, anonymous identity on a blockchain network. of the pool if it's found.

**Parameters**

- `baseType` : String of the type of base asset.
- `quoteType` : String of the type of quote asset.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/client.ts
  getPoolIdByAssets(baseType: string, quoteType: string): Promise<string>

### midPrice

Use `midPrice` to retrieve the mid price for a pool with the ID that you provide. The call returns a `Promise` with the mid price.

**Parameters**

- `poolKey` : String that identifies the pool to query.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/client.ts
  midPrice(poolKey: string): Promise<number>

### `whitelisted`

Use `whitelisted` to check if the pool with the ID you provide is whitelisted. The call returns a `Promise` as a boolean indicating whether the pool is whitelisted.

**Parameters**

- `poolKey` : String that identifies the pool to query.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/client.ts
  whitelisted(poolKey: string): Promise<boolean>

### `poolBookParams`

Use `poolBookParams` to retrieve the book parameters for a pool, including tick size, lot size, and min size. The call returns a `Promise` with the book parameters.

**Parameters**

- `poolKey` : String that identifies the pool to query.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/client.ts
  poolBookParams(poolKey: string): Promise<PoolBookParams>

### `getOrders`

Use `getOrders` to retrieve multiple orders from a pool. The call returns a `Promise` with an array of order information.

**Parameters**

- `poolKey` : String that identifies the pool to query.
- `orderIds` : Array of strings representing the order IDs to retrieve.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/client.ts
  getOrders(poolKey: string, orderIds: string[])

### `getPoolDeepPrice`

Use `getPoolDeepPrice` to get the DEEP price conversion for a pool. The call returns a `Promise` with the DEEP price information.

**Parameters**

- `poolKey` : String that identifies the pool to query.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/client.ts

## Administrative functions

The SDK provides administrative functions for pool management.

### `addDeepPricePoint`

Use `addDeepPricePoint` to add a DEEP price point for a target pool using a reference pool. The call returns a function that takes a `Transaction`object **Object** The basic unit of storage on Sui. .

**Parameters**

- `targetPoolKey` : String that identifies the target pool.
- `referencePoolKey` : String that identifies the reference pool.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/deepbook.ts
  addDeepPricePoint = (targetPoolKey: string, referencePoolKey: string) => (tx: Transaction)

### `updatePoolAllowedVersions`

Use `updatePoolAllowedVersions` to update the allowedpackage **Package** Smart contracts on Sui. versions for a pool. The call returns a function that takes a `Transaction`object .

**Parameters**

- `poolKey` : String that identifies the pool.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/deepbook.ts
  updatePoolAllowedVersions = (poolKey: string) => (tx: Transaction)

### `createPermissionlessPool`

Use `createPermissionlessPool` to create a new permissionless pool. The call returns a function that takes a `Transaction`object .

**Parameters**

- `params` : `CreatePermissionlessPoolParams`object containing:
- `baseCoinKey` : String that identifies the base coin.
- `quoteCoinKey` : String that identifies the quote coin.
- `tickSize` : Number representing the tick size.
- `lotSize` : Number representing the lot size.
- `minSize` : Number representing the minimum order size.
- `deepCoin` : Optional `TransactionArgument` for DEEP token payment.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/deepbook.ts
  createPermissionlessPool = (params: CreatePermissionlessPoolParams) => (tx: Transaction)

### `getBalanceManagerIds`

Use `getBalanceManagerIds` to get all balance manager IDs for a specific owner. The call returns a `Promise` with an array of balance manager IDs.

**Parameters**

- `owner` : String representing the owneraddress .
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/client.ts
  getBalanceManagerIds(owner: string): Promise<string[]>

## Referral functions

The SDK provides functions to manage referrals and earn referral fees from trading activity.

### `mintReferral`

Use `mintReferral` to create a new referral for a pool with a specified multiplier. The multiplier determines what percentage of trading fees are allocated to the referrer. The call returns a function that takes a `Transaction`object .

**Parameters**

- `poolKey` : String that identifies the pool.
- `multiplier` : Number representing the referral multiplier (such as 0.1 for 10%).
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/deepbook.ts
  mintReferral = (poolKey: string, multiplier: number) => (tx: Transaction)

### `updateReferralMultiplier`

Use `updateReferralMultiplier` to update the multiplier for an existing referral. Only the referral owner can update the multiplier. The call returns a function that takes a `Transaction`object .

**Parameters**

- `poolKey` : String that identifies the pool.
- `referral` : String representing the referral ID.
- `multiplier` : Number representing the new referral multiplier.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/deepbook.ts

### `claimReferralRewards`

Use `claimReferralRewards` to claim accumulated referral fees. Returns anobject with `baseRewards` , `quoteRewards` , and `deepRewards` . The call returns a function that takes a `Transaction`object .

**Parameters**

- `poolKey` : String that identifies the pool.
- `referral` : String representing the referral ID.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/deepbook.ts

### `getReferralBalances`

Use `getReferralBalances` to view the current accumulated balances for a referral without claiming them. The call returns a `Promise` with the balances in base, quote, and DEEP tokens.

**Parameters**

- `poolKey` : String that identifies the pool.
- `referral` : String representing the referral ID.

# Pools SDK

URL: https://docs.sui.io/onchain-finance/deepbookv3-sdk/pools

Pools are shared objects that represent a market. See [Query the Pool](/onchain-finance/deepbookv3/contract-information/query-the-pool) for more information on pools.

## Pool functions

The DeepBookV3 SDK exposes functions that you can call to read the state of a pool. These functions typically require a `managerKey` , `coinKey` , `poolKey` , or a combination of these. For details on these keys, see [DeepBookV3 SDK](/onchain-finance/deepbookv3-sdk#keys) . The SDK includes some default keys that you can view in the `constants.ts` file.

SDK unit handling
Input amounts, quantities, and prices should be provided in standard decimal format (such as `10.5` SUI or `0.00001` nBTC). The SDK handles conversion to base units internally. Returned amounts are also in standard decimal format.

### account

Use `account` to retrieve the account information for a `BalanceManager` in a pool, which has the following form:

```ts
{
  epoch: '511',
  open_orders: {
    constants: [
      '170141211130585342296014727715884105730',
      '18446744092156295689709543266',
      '18446744092156295689709543265'
    ]
  },
  taker_volume: 0,
  maker_volume: 0,
  active_stake: 0,
  inactive_stake: 0,
  created_proposal: false,
  voted_proposal: null,
  unclaimed_rebates: { base: 0, quote: 0, deep: 0 },
  settled_balances: { base: 0, quote: 0, deep: 0 },
  owed_balances: { base: 0, quote: 0, deep: 0 }
}
```

**Parameters**

- `poolKey` : String that identifies the pool to query.
- `balanceManagerKey` : key of the balance manager defined in the SDK.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/client.ts

### accountOpenOrders

Use `accountOpenOrders` to retrieve open orders for the balance manager and pool with the IDs you provide. The call returns a `Promise` that contains an array of open order IDs.

**Parameters**

- `poolKey` : String that identifies the pool to query.
- `managerKey` : String that identifies the balance manager to query.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/client.ts
  accountOpenOrders(poolKey: string, managerKey: string): Promise<string[]>

### checkManagerBalance

Use `checkManagerBalance` to check the balance manager for a specific coin. The call returns a `Promise` in the form:

```text
{
  coinType: string,
  balance: number
}
```

**Parameters**

- `managerKey` : String that identifies the balance manager to query.
- `coinKey` : String that identifies the coin to query the balance of.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/client.ts
  checkManagerBalance(managerKey: string, coinKey: string): Promise<ManagerBalance>

### getOrder

Use `getOrder` to retrieve an order's information. The call returns a `Promise` in the `Order` struct, which has the following form:

```ts
{
  balance_manager_id: {
    bytes: '0x6149bfe6808f0d6a9db1c766552b7ae1df477f5885493436214ed4228e842393'
  },
  order_id: '9223372036873222552073709551614',
  client_order_id: '888',
  quantity: '50000000',
  filled_quantity: '0',
  fee_is_deep: true,
  order_deep_price: { asset_is_base: false, deep_per_asset: '0' },
  epoch: '440',
  status: 0,
  expire_timestamp: '1844674407370955161'
}
```

**Parameters**

`poolKey` : String that identifies the pool to query. `orderId` : ID of the order to query.

github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/client.ts
getOrder(poolKey: string, orderId: string)

### getQuoteQuantityOut

Use `getQuoteQuantityOut` to retrieve the quote quantity out for the base quantity you provide. The call returns a `Promise` in the form:

```text
{
  baseQuantity: number,
  baseOut: number,
  quoteOut: number,
  deepRequired: number
}
```

where `deepRequired` is the amount of DEEP required for the dry run.

**Parameters**

- `poolKey` : String that identifies the pool to query.
- `baseQuantity` : Number that defines the base quantity you want to convert.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/client.ts
  getQuoteQuantityOut(poolKey: string, baseQuantity: number | bigint): Promise<QuoteQuantityOut>

### getBaseQuantityOut

Use `getBaseQuantityOut` to retrieve the base quantity out for the quote quantity that you provide. The call returns a `Promise` in the form:

```text
{
  quoteQuantity: number,
  baseOut: number,
  quoteOut: number,
  deepRequired: number
}
```

where `deepRequired` is the amount of DEEP required for the dry run.

**Parameters**

- `poolKey` : String that identifies the pool to query.
- `quoteQuantity` : Number that defines the quote quantity you want to convert.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/client.ts
  getBaseQuantityOut(poolKey: string, quoteQuantity: number | bigint): Promise<BaseQuantityOut>

### getQuantityOut

Use `getQuantityOut` to retrieve the output quantities for the base or quote quantity you provide. You provide values for both quantities, but only one of them can be nonzero. The call returns a `Promise` with the form:

```text
{
  baseQuantity: number,
  quoteQuantity: number,
  baseOut: number,
  quoteOut: number,
  deepRequired: number
}
```

where `deepRequired` is the amount of DEEP required for the dry run.

**Parameters**

- `poolKey` : String that identifies the pool to query.
- `baseQuantity` : Number that defines the base quantity you want to convert. Set to `0` if using quote quantity.
- `quoteQuantity` : Number that defines the quote quantity you want to convert. Set to `0` if using base quantity.

github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/client.ts
getQuantityOut(
poolKey: string,
baseQuantity: number | bigint,
quoteQuantity: number | bigint,
): Promise<QuantityOut>

### getLevel2Range

Use `getLevel2Range` to retrieve level 2 order book within the boundary price range you provide. The call returns a `Promise` in the form:

```text
{
  prices: Array<number>,
  quantities: Array<number>
}
```

**Parameters**

- `poolKey` : String that identifies the pool to query.
- `priceLow` : Number for lower bound of price range.
- `priceHigh` : Number for upper bound of price range.
- `isBid` : Boolean when set to `true` gets bid orders, else retrieve ask orders.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/client.ts
  getLevel2Range(
  poolKey: string,
  priceLow: number | bigint,
  priceHigh: number | bigint,
  isBid: boolean,
  ): Promise<Level2Range>

### getLevel2TicksFromMid

Use `getLevel2TicksFromMid` to retrieve level 2 order book ticks from mid-price for a pool with the ID you provide. The call returns a `Promise` in the form:

```ts
{
  bid_prices: Array<number>,
  bid_quantities: Array<number>,
  ask_prices: Array<number>,
  ask_quantities: Array<number>
}
```

**Parameters**

- `poolKey` : String that identifies the pool to query.
- `ticks` : Number of ticks from mid-price.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/client.ts
  getLevel2TicksFromMid(poolKey: string, ticks: number): Promise<Level2TicksFromMid>

### lockedBalance

Use `lockedBalance` to retrieve a `BalanceManager` locked balance in the pool. The call returns a `Promise` in the `Order` struct, which has the following form:

```ts
{
  base: 5.5,
	quote: 2,
	deep: 0.15,
}
```

**Parameters**

`poolKey` : String that identifies the pool to query. `balanceManagerKey` : key of the balance manager defined in the SDK.

github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/client.ts

### poolTradeParams

Use `poolTradeParams` to retrieve the trade params for the pool, which has the following form:

```ts
{
  takerFee: 0.001,
	makerFee: 0.0005,
	stakeRequired: 100,
}
```

**Parameters**

- `poolKey` : String that identifies the pool to query.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/client.ts
  poolTradeParams(poolKey: string): Promise<PoolTradeParams>

### vaultBalances

Use `vaultBalances` to get the vault balances for a pool with the ID you provide. The call returns a `Promise` in the form:

```ts
{
  base: number,
  quote: number,
  deep: number
}
```

**Parameters**

- `poolKey` : String that identifies the pool to query.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/client.ts
  vaultBalances(poolKey: string): Promise<VaultBalances>

### getPoolIdByAssets

Use `getPoolIdByAssets` to retrieve the pool ID for the asset types you provide. The call returns a `Promise` with theaddress **Address** A unique, anonymous identity on a blockchain network. of the pool if it's found.

**Parameters**

- `baseType` : String of the type of base asset.
- `quoteType` : String of the type of quote asset.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/client.ts
  getPoolIdByAssets(baseType: string, quoteType: string): Promise<string>

### midPrice

Use `midPrice` to retrieve the mid price for a pool with the ID that you provide. The call returns a `Promise` with the mid price.

**Parameters**

- `poolKey` : String that identifies the pool to query.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/client.ts
  midPrice(poolKey: string): Promise<number>

### `whitelisted`

Use `whitelisted` to check if the pool with the ID you provide is whitelisted. The call returns a `Promise` as a boolean indicating whether the pool is whitelisted.

**Parameters**

- `poolKey` : String that identifies the pool to query.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/client.ts
  whitelisted(poolKey: string): Promise<boolean>

### `poolBookParams`

Use `poolBookParams` to retrieve the book parameters for a pool, including tick size, lot size, and min size. The call returns a `Promise` with the book parameters.

**Parameters**

- `poolKey` : String that identifies the pool to query.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/client.ts
  poolBookParams(poolKey: string): Promise<PoolBookParams>

### `getOrders`

Use `getOrders` to retrieve multiple orders from a pool. The call returns a `Promise` with an array of order information.

**Parameters**

- `poolKey` : String that identifies the pool to query.
- `orderIds` : Array of strings representing the order IDs to retrieve.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/client.ts
  getOrders(poolKey: string, orderIds: string[])

### `getPoolDeepPrice`

Use `getPoolDeepPrice` to get the DEEP price conversion for a pool. The call returns a `Promise` with the DEEP price information.

**Parameters**

- `poolKey` : String that identifies the pool to query.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/client.ts

## Administrative functions

The SDK provides administrative functions for pool management.

### `addDeepPricePoint`

Use `addDeepPricePoint` to add a DEEP price point for a target pool using a reference pool. The call returns a function that takes a `Transaction`object **Object** The basic unit of storage on Sui. .

**Parameters**

- `targetPoolKey` : String that identifies the target pool.
- `referencePoolKey` : String that identifies the reference pool.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/deepbook.ts
  addDeepPricePoint = (targetPoolKey: string, referencePoolKey: string) => (tx: Transaction)

### `updatePoolAllowedVersions`

Use `updatePoolAllowedVersions` to update the allowedpackage **Package** Smart contracts on Sui. versions for a pool. The call returns a function that takes a `Transaction`object .

**Parameters**

- `poolKey` : String that identifies the pool.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/deepbook.ts
  updatePoolAllowedVersions = (poolKey: string) => (tx: Transaction)

### `createPermissionlessPool`

Use `createPermissionlessPool` to create a new permissionless pool. The call returns a function that takes a `Transaction`object .

**Parameters**

- `params` : `CreatePermissionlessPoolParams`object containing:
- `baseCoinKey` : String that identifies the base coin.
- `quoteCoinKey` : String that identifies the quote coin.
- `tickSize` : Number representing the tick size.
- `lotSize` : Number representing the lot size.
- `minSize` : Number representing the minimum order size.
- `deepCoin` : Optional `TransactionArgument` for DEEP token payment.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/deepbook.ts
  createPermissionlessPool = (params: CreatePermissionlessPoolParams) => (tx: Transaction)

### `getBalanceManagerIds`

Use `getBalanceManagerIds` to get all balance manager IDs for a specific owner. The call returns a `Promise` with an array of balance manager IDs.

**Parameters**

- `owner` : String representing the owneraddress .
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/client.ts
  getBalanceManagerIds(owner: string): Promise<string[]>

## Referral functions

The SDK provides functions to manage referrals and earn referral fees from trading activity.

### `mintReferral`

Use `mintReferral` to create a new referral for a pool with a specified multiplier. The multiplier determines what percentage of trading fees are allocated to the referrer. The call returns a function that takes a `Transaction`object .

**Parameters**

- `poolKey` : String that identifies the pool.
- `multiplier` : Number representing the referral multiplier (such as 0.1 for 10%).
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/deepbook.ts
  mintReferral = (poolKey: string, multiplier: number) => (tx: Transaction)

### `updateReferralMultiplier`

Use `updateReferralMultiplier` to update the multiplier for an existing referral. Only the referral owner can update the multiplier. The call returns a function that takes a `Transaction`object .

**Parameters**

- `poolKey` : String that identifies the pool.
- `referral` : String representing the referral ID.
- `multiplier` : Number representing the new referral multiplier.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/deepbook.ts

### `claimReferralRewards`

Use `claimReferralRewards` to claim accumulated referral fees. Returns anobject with `baseRewards` , `quoteRewards` , and `deepRewards` . The call returns a function that takes a `Transaction`object .

**Parameters**

- `poolKey` : String that identifies the pool.
- `referral` : String representing the referral ID.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/deepbook.ts

### `getReferralBalances`

Use `getReferralBalances` to view the current accumulated balances for a referral without claiming them. The call returns a `Promise` with the balances in base, quote, and DEEP tokens.

**Parameters**

- `poolKey` : String that identifies the pool.
- `referral` : String representing the referral ID.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/client.ts

# Orders SDK

URL: https://docs.sui.io/onchain-finance/deepbookv3-sdk/orders

Placing orders is a main function of anyDeepBook **DeepBook** A decentralized central limit order book (CLOB) built on Sui. integration. Before you can place orders, though, you must first set up a balance manager. See [DeepBookV3 SDK](/onchain-finance/deepbookv3-sdk) for information on setting up a balance manager.

## Order functions

The DeepBookV3 SDK provides the following functions for leveraging orders against pools.

### placeLimitOrder

Use `placeLimitOrder` to place limit orders. The call returns a function that takes a `Transaction`object **Object** The basic unit of storage on Sui. .

**Parameters**

- `params` : `SwapParams`object that represents the parameters for the swap.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/deepbook.ts
  placeLimitOrder = (params: PlaceLimitOrderParams) => (tx: Transaction)

### placeMarketOrder

Use `placeMarketOrder` to place market orders. The call returns a function that takes a `Transaction`object .

**Parameters**

- `params` : `SwapParams`object that represents the parameters for the swap.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/deepbook.ts
  placeMarketOrder = (params: PlaceMarketOrderParams) => (tx: Transaction)

### cancelOrder

Use `cancelOrder` to cancel an existing order that is identified by the `orderId` that you provide. The call returns a function that takes a `Transaction`object .

warning
The `orderId` is the protocol `orderId` generated during order placement, which is different from the client `orderId` .

**Parameters**

- `poolKey` : String that identifies the pool from which to borrow.
- `balanceManagerKey` : String that identifies the `BalanceManager` .
- `orderId` : String of the protocol order ID that identifies the order to cancel.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/deepbook.ts
  cancelOrder =
  (poolKey: string, balanceManagerKey: string, orderId: string) => (tx: Transaction)

### cancelOrders

Use `cancelOrders` to cancel multiple orders atomically by providing an array of order IDs. The call returns a function that takes a `Transaction`object .

**Parameters**

- `poolKey` : String that identifies the pool.
- `balanceManagerKey` : String that identifies the `BalanceManager` .
- `orderIds` : Array of strings representing the protocol order IDs to cancel.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/deepbook.ts
  cancelOrders =
  (poolKey: string, balanceManagerKey: string, orderIds: string[]) => (tx: Transaction)

### cancelAllOrders

Use `cancelAllOrders` to cancel every order for the balance manager whose key you provide. The call returns a function that takes a `Transaction`object .

**Parameters**

- `poolKey` : String that identifies the pool from which to borrow.
- `balanceManagerKey` : String that identifies the `BalanceManager` .
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/deepbook.ts
  cancelAllOrders = (poolKey: string, balanceManagerKey: string) => (tx: Transaction)

### `modifyOrder`

Use `modifyOrder` to modify an existing order by changing its quantity. The new quantity must be less than the original quantity and more than the filled quantity. The call returns a function that takes a `Transaction`object .

**Parameters**

- `poolKey` : String that identifies the pool.
- `balanceManagerKey` : String that identifies the `BalanceManager` .
- `orderId` : String of the protocol order ID to modify.
- `newQuantity` : Number representing the new quantity for the order.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/deepbook.ts
  modifyOrder =
  (poolKey: string, balanceManagerKey: string, orderId: string, newQuantity: number) =>
  (tx: Transaction)

### `withdrawSettledAmounts`

Use `withdrawSettledAmounts` to withdraw all settled amounts for a balance manager in a specific pool. The call returns a function that takes a `Transaction`object .

**Parameters**

- `poolKey` : String that identifies the pool.
- `balanceManagerKey` : String that identifies the `BalanceManager` .
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/deepbook.ts
  withdrawSettledAmounts = (poolKey: string, balanceManagerKey: string) => (tx: Transaction)

### `withdrawSettledAmountsPermissionless`

Use `withdrawSettledAmountsPermissionless` to withdraw settled amounts permissionlessly for any balance manager. This can be called by anyone and does not require a trade proof. The call returns a function that takes a `Transaction`object .

**Parameters**

- `poolKey` : String that identifies the pool.
- `balanceManagerKey` : String that identifies the `BalanceManager` .
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/deepbook.ts
  withdrawSettledAmountsPermissionless =
  (poolKey: string, balanceManagerKey: string) => (tx: Transaction)

## Examples

The following examples demonstrate some custom functions for DeepBookV3 orders.

### Limit orders

See the [Order API](/onchain-finance/deepbookv3/contract-information/orders) for the different order types and self matching options.

```tsx
// Params for limit order
interface PlaceLimitOrderParams {
  poolKey: string;
  balanceManagerKey: string;
  clientOrderId: string;
  price: number;
  quantity: number;
  isBid: boolean;
  expiration?: number | bigint; // Default no expiration
  orderType?: OrderType; // Default no restrictions
  selfMatchingOption?: SelfMatchingOptions; // Default self matching allowed
  payWithDeep?: boolean; // Default true
}

/**
 * @description Place a limit order
 * @param {PlaceLimitOrderParams} params Parameters for placing a limit order
 * @returns A function that takes a Transaction object
 */
placeLimitOrder = (params: PlaceLimitOrderParams) => (tx: Transaction) => {};

// Example usage in DeepBookMarketMaker class
// Place a bid of 10 DEEP at $0.1
customPlaceLimitOrder = (tx: Transaction) => {
  const poolKey = "DEEP_DBUSDC"; // Pool key, check constants.ts for more
  const managerKey = "MANAGER_1"; // Balance manager key, initialized during client creation by user
  tx.add(
    this.deepBook.placeLimitOrder({
      poolKey: poolKey,
      balanceManagerKey: managerKey,
      clientOrderId: "1",
      price: 0.1,
      quantity: 10,
      isBid: true,
      payWithDeep: true,
    }),
  );
};
```

### Place market order

Example of placing a market order.

```tsx
// Params for market order
interface PlaceMarketOrderParams {
  poolKey: string;
  balanceManagerKey: string;
  clientOrderId: string;
  quantity: number;
  isBid: boolean;
  selfMatchingOption?: SelfMatchingOptions;
  payWithDeep?: boolean;
}

// Example usage in DeepBookMarketMaker class
// Place a market sell of 10 SUI in the SUI_DBUSDC pool
customPlaceMarketOrder = (tx: Transaction) => {
  const poolKey = "SUI_DBUSDC"; // Pool key, check constants.ts for more
  const managerKey = "MANAGER_1"; // Balance manager key, initialized during client creation by user
  tx.add(
    this.deepBook.placeMarketOrder({
      poolKey: poolKey,
      balanceManagerKey: managerKey,
      clientOrderId: "2",
      quantity: 10,
      isBid: true,
      payWithDeep: true,
    }),
  );
};
```

### Cancel an order

Example of canceling a single order in a pool for a balance manager.

```tsx
/**
 * @description Cancel an existing order
 * @param {string} poolKey The key to identify the pool
 * @param {string} balanceManagerKey The key to identify the BalanceManager
 * @param {number} orderId Order ID to cancel
 * @returns A function that takes a Transaction object
 */
cancelOrder =
  (poolKey: string, balanceManagerKey: string, orderId: number) =>
  (tx: Transaction) => {};

// Example usage in DeepBookMarketMaker class
// Cancel order 12345678 in SUI_DBUSDC pool
cancelOrder = (tx: Transaction) => {
  const poolKey = "SUI_DBUSDC"; // Pool key, check constants.ts for more
  const managerKey = "MANAGER_1"; // Balance manager key, initialized during client creation by user
  tx.add(this.deepBook.cancelOrder(poolKey, managerKey, 12345678));
};
```

### Cancel all orders

Example of canceling all orders in a pool for a balance manager.

```tsx
/**
 * @description Cancel all open orders for a balance manager
 * @param {string} poolKey The key to identify the pool
 * @param {string} balanceManagerKey The key to identify the BalanceManager
 * @returns A function that takes a Transaction object
 */
cancelAllOrders =
  (poolKey: string, balanceManagerKey: string) => (tx: Transaction) => {};

// Example usage in DeepBookMarketMaker class
// Cancel order 12345678 in SUI_DBUSDC pool
cancelOrder = (tx: Transaction) => {
  const poolKey = "SUI_DBUSDC"; // Pool key, check constants.ts for more
  const managerKey = "MANAGER_1"; // Balance manager key, initialized during client creation by user
  tx.add(this.deepBook.cancelAllOrders(poolKey, managerKey));
};
```

# Flash Loans SDK

URL: https://docs.sui.io/onchain-finance/deepbookv3-sdk/flash-loans

A flash loan is one where the borrowing and returning of loans from pools is performed within a single programmabletransaction **Transaction** A number of commands that execute on inputs to define the result of the transaction. block. The SDK exposes functions that allow you to implement this functionality. See [Flash Loans](/onchain-finance/deepbookv3/contract-information/flash-loans) for more details on the API.

## Flash loan functions

The DeepBookV3 SDK provides the following flash loan related functions.

### borrowBaseAsset

Use `borrowBaseAsset` to borrow a base asset from the pool identified by the `poolKey` value you provide. The call returns a function that takes a `Transaction`object **Object** The basic unit of storage on Sui.

**Parameters**

- `poolKey` : String that identifies the pool from which to borrow.
- `borrowAmount` : Number that represents the amount to borrow from the pool.

```tsx
borrowBaseAsset(poolKey: string, borrowAmount: number);
```

### returnBaseAsset

Use `returnBaseAsset` to return the base asset to the pool identified by the `poolKey` value you provide. The call returns a function that takes a `Transaction`object .

**Parameters**

- `poolKey` : String that identifies the pool from which to borrow.
- `borrowAmount` : Number that represents the amount to borrow from the pool.
- `baseCoinInput` : Coinobject representing the base asset to be returned.
- `flashLoan` : Flash loanobject representing the loan to be settled.

```tsx
returnBaseAsset({
  poolKey: string,
  borrowAmount: number,
  baseCoinInput: TransactionObjectArgument,
  flashLoan: TransactionObjectArgument,
});
```

### borrowQuoteAsset

Use `borrowQuoteAsset` to borrow a quote asset from the pool identified by the `poolKey` value you provide. The call returns a function that takes a `Transaction`object .

**Parameters**

- `poolKey` : String that identifies the pool from which to borrow.
- `borrowAmount` : Number that represents the amount to borrow from the pool.

```tsx
borrowQuoteAsset(poolKey: string, borrowAmount: number);
```

### returnQuoteAsset

Use `returnQuoteAsset` to return a quote asset to the pool identified by the `poolKey` you provide. The call returns a function that takes a `Transaction`object .

**Parameters**

- `poolKey` : String that identifies the pool from which to borrow.
- `borrowAmount` : Number that represents the amount to borrow from the pool.
- `baseCoinInput` : Coinobject representing the quote asset to be returned.
- `flashLoan` : Flash loanobject representing the loan to be settled.

```tsx
returnQuoteAsset(
  poolKey: string,
  borrowAmount: number,
  quoteCoinInput: TransactionObjectArgument,
  flashLoan: TransactionObjectArgument,
);
```

## Flash loan example

The following example demonstrates flash loan usage in `DeepBookMarketMaker` class.

```tsx
// Example of a flash loan transaction
// Borrow 1 DEEP from DEEP_SUI pool
// Swap 0.5 DBUSDC for SUI in SUI_DBUSDC pool, pay with deep borrowed
// Swap SUI back to DEEP
// Return 1 DEEP to DEEP_SUI pool
flashLoanExample = async (tx: Transaction) => {
  const borrowAmount = 1;
  const [deepCoin, flashLoan] = tx.add(
    this.flashLoans.borrowBaseAsset("DEEP_SUI", borrowAmount),
  );

  // Execute trade using borrowed DEEP
  const [baseOut, quoteOut, deepOut] = tx.add(
    this.deepBook.swapExactQuoteForBase({
      poolKey: "SUI_DBUSDC",
      amount: 0.5,
      deepAmount: 1,
      minOut: 0,
      deepCoin: deepCoin,
    }),
  );

  tx.transferObjects([baseOut, quoteOut, deepOut], this.getActiveAddress());

  // Execute second trade to get back DEEP for repayment
  const [baseOut2, quoteOut2, deepOut2] = tx.add(
    this.deepBook.swapExactQuoteForBase({
      poolKey: "DEEP_SUI",
      amount: 10,
      deepAmount: 0,
      minOut: 0,
    }),
  );

  tx.transferObjects([quoteOut2, deepOut2], this.getActiveAddress());

  // Return borrowed DEEP
  const loanRemain = tx.add(
    this.flashLoans.returnBaseAsset(
      "DEEP_SUI",
      borrowAmount,
      baseOut2,
      flashLoan,
    ),
  );

  // Send the remaining coin to user's address
  tx.transferObjects([loanRemain], this.getActiveAddress());
};
```

# Swaps

URL: https://docs.sui.io/onchain-finance/deepbookv3-sdk/swaps

DeepBookV3 provides a swap-like interface commonly seen in automatic market makers (AMMs). The DeepBookV3 SDK provides functions to leverage the features of this interface. See [Swaps](/onchain-finance/deepbookv3/contract-information/swaps) in the API section for more details.

## Swap functions

The SDK provides the following functions to perform swaps between the base and quote asset.

### swapExactBaseForQuote

Use `swapExactBaseForQuote` to swap exact base amount for quote amount. The call returns a function that takes a `Transaction`object **Object** The basic unit of storage on Sui. .

**Parameters**

- `params` : `SwapParams`object that represents the parameters for the swap.

```tsx
swapExactBaseForQuote({ params: SwapParams });
```

### swapExactQuoteForBase

Use `swapExactQuoteForBase` to swap exact quote amount for base amount. The call returns a function that takes a `Transaction`object .

**Parameters**

- `params` : `SwapParams`object that represents the parameters for the swap.

```tsx
swapExactQuoteForBase({ params: SwapParams });
```

### `swapExactQuantity`

Use `swapExactQuantity` to swap an exact quantity in either direction (base to quote or quote to base) without using a balance manager. The call returns a function that takes a `Transaction`object .

**Parameters**

- `params` : `SwapParams & { isBaseToCoin: boolean }`object containing:
- `poolKey` : String that identifies the pool.
- `amount` : Number representing the amount to swap.
- `deepAmount` : Number representing the DEEP amount for fees.
- `minOut` : Number representing minimum output amount.
- `isBaseToCoin` : Boolean indicating swap direction (true = base to quote).
- `baseCoin` : Optional `TransactionArgument` for base coin input.
- `quoteCoin` : Optional `TransactionArgument` for quote coin input.
- `deepCoin` : Optional `TransactionArgument` for DEEP coin input.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/deepbook.ts
  swapExactQuantity = (params: SwapParams & { isBaseToCoin: boolean }

### swapExactQuantityWithManager

Use `swapExactQuantityWithManager` to swap an exact quantity using a balance manager. The call returns a function that takes a `Transaction`object .

**Parameters**

- `params` : `SwapWithManagerParams & { isBaseToCoin: boolean }`object containing:
- `poolKey` : String that identifies the pool.
- `balanceManagerKey` : String that identifies the balance manager.
- `amount` : Number representing the amount to swap.
- `minOut` : Number representing minimum output amount.
- `isBaseToCoin` : Boolean indicating swap direction (true = base to quote).
- `tradeCap` : Optional `TransactionArgument` for trade capability.
- `depositCap` : Optional `TransactionArgument` for deposit capability.
- `withdrawCap` : Optional `TransactionArgument` for withdraw capability.
- `baseCoin` : Optional `TransactionArgument` for base coin input.
- `quoteCoin` : Optional `TransactionArgument` for quote coin input.
github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/deepbook.ts
swapExactQuantityWithManager =
	(params: SwapWithManagerParams & { isBaseToCoin: boolean }
### Examples

The following examples demonstrate custom swap functions that you can place into the `DeepBookMarketMaker` class. Base coin, quote coin, and deep coin are automatically determined by the coin available in the useraddress **Address** A unique, anonymous identity on a blockchain network. unless you explicitly pass one in as an argument. You cantransfer **Transfer** Changing the owner of an asset. the coin outputs to theiraddress or execute other operations using the outputs.

```tsx
swapExactBaseForQuote = (tx: Transaction) => {
  const [baseOut, quoteOut, deepOut] = this.deepBook.swapExactBaseForQuote({
    poolKey: "SUI_DBUSDC",
    amount: 1, // amount of SUI to swap
    deepAmount: 1, // amount of DEEP to pay as fees, excess is returned
    minOut: 0.1, // minimum amount of DBUSDC to receive or transaction fails
  })(tx);

  // Transfer received coins to own address
  tx.transferObjects([baseOut, quoteOut, deepOut], this.getActiveAddress());
};

swapExactQuoteForBase = (tx: Transaction) => {
  const [baseOut, quoteOut, deepOut] = this.deepBook.swapExactQuoteForBase({
    poolKey: "SUI_DBUSDC",
    amount: 1, // amount of DBUSDC to swap
    deepAmount: 1, // amount of DEEP to pay as fees, excess is returned
    minOut: 0.1, // minimum amount of SUI to receive or transaction fails
  })(tx);

  // Transfer received coins to own address
  tx.transferObjects([baseOut, quoteOut, deepOut], this.getActiveAddress());
};
```

# Staking and Governance SDK

URL: https://docs.sui.io/onchain-finance/deepbookv3-sdk/staking-governance

Examples of interacting with staking and governance. These functions typically require a `balanceManagerKey` , `poolKey` , or both. For details on these keys, see [DeepBookV3 SDK](/onchain-finance/deepbookv3-sdk#keys) . The SDK includes some default keys that you can view in the `constants.ts` file.

See [Staking and Governance](/onchain-finance/deepbookv3/contract-information/staking-governance) for more information on the staking and governance API.

## Staking and governance functions

### stake

Use `stake` to stake an amount you specify into a specific pool. The call returns a `Transaction`object **Object** The basic unit of storage on Sui. .

**Parameters**

- `poolKey` : String that identifies the pool.
- `balanceManagerKey` : String that identifies the balance manager.
- `stakeAmount` : Number representing the amount to stake.

```tsx
stake(poolKey: string, balanceManagerKey: string, stakeAmount: number);
```

### unstake

Use `unstake` to unstake from a particular pool. The call returns a `Transaction`object .

**Parameters**

- `poolKey` : String that identifies the pool.
- `balanceManagerKey` : String that identifies the balance manager.

```tsx
unstake(poolKey: string, balanceManagerKey: string);
```

### submitProposal

Use `submitProposal` to submit a governance proposal. The call returns a `Transaction`object .

**Parameters**

- `params` : A `ProposalParams`object that defines the proposal.

```tsx
submitProposal({ params: ProposalParams });
```

### vote

Use `vote` to vote on a proposal. The call returns a `Transaction`object .

**Parameters**

- `poolKey` : String that identifies the pool.
- `balanceManagerKey` : String that identifies the balance manager.
- `proposal_id` : String that identifies the proposal to vote on.

```tsx
vote(poolKey: string, balanceManagerKey: string, proposal_id: string)
```

### `claimRebates`

Use `claimRebates` to claim maker/taker rebates for a balance manager in a specific pool. The call returns a function that takes a `Transaction`object .

**Parameters**

- `poolKey` : String that identifies the pool.
- `balanceManagerKey` : String that identifies the balance manager.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/deepbook.ts
  claimRebates = (poolKey: string, balanceManagerKey: string) => (tx: Transaction)

## Examples

The following examples demonstrate custom staking and governance functions that you can place into the `DeepBookMarketMaker` class.

### stake custom function

```tsx
stake =
  (poolKey: string, balanceManagerKey: string, stakeAmount: number) =>
  (tx: Transaction) => {};

// Custom function to stake 100 DEEP in DeepBookMarketMaker class
stake = (tx: Transaction) => {
  const poolKey = "DBUSDT_DBUSDC";
  const balanceManagerKey = "MANAGER_1";
  tx.add(this.governance.stake(poolKey, balanceManagerKey, 100));
};
```

### unstake custom function

```tsx
unstake =
  (poolKey: string, balanceManagerKey: string) => (tx: Transaction) => {};

// Custom function to unstake in DeepBookMarketMaker class
unstake = (tx: Transaction) => {
  const poolKey = "DBUSDT_DBUSDC";
  const balanceManagerKey = "MANAGER_1";
  tx.add(this.governance.unstake(poolKey, balanceManagerKey));
};
```

### submitProposal custom function

```tsx
// Proposal params
export interface ProposalParams {
  poolKey: string;
  balanceManagerKey: string;
  takerFee: number;
  makerFee: number;
  stakeRequired: number;
}

submitProposal = (params: ProposalParams) => (tx: Transaction) => {};

// Custom function to submit proposal in DeepBookMarketMaker class
submitProposal = (tx: Transaction) => {
  const poolKey = "DBUSDT_DBUSDC";
  const balanceManagerKey = "MANAGER_1";
  tx.add(
    this.governance.submitProposal({
      poolKey,
      balanceManagerKey,
      takerFee: 0.002,
      makerFee: 0.001,
      stakeRequired: 100,
    }),
  );
};
```

### vote custom function

```tsx
vote =
  (poolKey: string, balanceManagerKey: string, proposal_id: string) =>
  (tx: Transaction) => {};

// Custom function to vote in DeepBookMarketMaker class
vote = (tx: Transaction) => {
  const poolKey = "DBUSDT_DBUSDC";
  const balanceManagerKey = "MANAGER_1";
  const proposalID = "0x123456789";
  tx.add(this.governance.vote(poolKey, balanceManagerKey, proposalID));
};
```

# DeepBookV3 Indexer

URL: https://docs.sui.io/onchain-finance/deepbookv3/deepbookv3-indexer

DeepBookV3 Indexer provides streamlined, real-time access to order book and trading data from the DeepBookV3 protocol. It acts as a centralized service to aggregate and expose critical data points for developers, traders, and analysts who interact with DeepBookV3.

DeepBookV3 Indexer simplifies data retrieval by offering endpoints that enable:

- **Viewing pool information:** Retrieve detailed metadata about all available trading pools, including base and quote assets, tick sizes, and lot sizes.
- **Historical volume analysis:** Fetch volume metrics for specific pools or balance managers over custom time ranges, with support for interval-based breakdowns.
- **User-specific volume tracking:** Provide insights into individual trader activities by querying their balance manager-specific volumes.
- **OHLCV candlestick data:** Access candlestick chart data for technical analysis with configurable intervals.
- **DeepBook **DeepBook** A decentralized central limit order book (CLOB) built on Sui. Margin data:** Query margin trading events including loans, liquidations, and margin pool operations.
  You can either use a publicly available indexer or spin up your own service. The choice you make depends on a few factors.

Use the public service if:

- You have standard data needs.
- Latency and availability provided by the public endpoint meet your requirements.
- You want to avoid the operational overhead of running your own service.
  Run your own indexer if:

- You require guaranteed uptime and low latency.
- You have specific customization needs.
- Your application depends on proprietary features or extended data sets.

## Public DeepBookV3 indexer

[Mysten Labs](https://www.mystenlabs.com/) provides public indexers for DeepBookV3.

### Mainnet **Mainnet** Production network for live transactions and real-value assets.

```http
https://deepbook-indexer.mainnet.mystenlabs.com/
```

### Testnet **Testnet** Staging network for testing changes before production deployment.

```http
https://deepbook-indexer.testnet.mystenlabs.com/
```

## Asset conversions

Volumes returned by the following endpoints are expressed in the smallest unit of the corresponding asset.

- `/all_historical_volume`
- `/historical_volume`
- `/historical_volume_by_balance_manager_id`
- `/historical_volume_by_balance_manager_id_with_interval`
  Following are the decimal places (scalars) used to determine the base unit for each asset.

| Asset | Scalar
| ALKIMI | 9
| AUSD | 6
| Bridged Eth (BETH) | 8
| DEEP | 6
| DRF | 6
| IKA | 9
| LayerZero WBTC (LZWBTC) | 8
| Native USDC | 6
| NS | 6
| SEND | 6
| SUI | 9
| TYPUS | 9
| SUIUSDE | 6
| USDSUI | 6
| WAL | 9
| Wormhole USDC (WUSDC) | 6
| Wormhole USDT (WUSDT) | 6
| xBTC | 8

To convert the returned volume to the standard asset unit, divide the value by 10^SCALAR. For example:

If the volume returned in the base asset for the SUI/USDC pool is 1,000,000,000 SUI UNIT, the correct volume in SUI is 1,000,000,000 / 10^(SUI_SCALAR) = 1 SUI. Similarly, if the volume returned in the quote asset for the SUI/USDC pool is 1,000,000,000 USDC UNIT, the correct volume is 1,000,000,000 / 10^(USDC_SCALAR) = 1,000 USDC.

Use these conversions to interpret the volumes correctly across all pools and assets.

## API endpoints

You can perform the following tasks using the endpoints that the indexer API for DeepBookV3 provides.

Click to open Get all pool information

```text
/get_pools
```

Returns a list of all available pools, each containing detailed information about the base and quote assets, as well as pool parameters like minimum size, lot size, and tick size.

#### Response

```json
[
	{
	  "pool_id": "string",
	  "pool_name": "string",
	  "base_asset_id": "string",
	  "base_asset_decimals": integer,
	  "base_asset_symbol": "string",
	  "base_asset_name": "string",
	  "quote_asset_id": "string",
	  "quote_asset_decimals": integer,
	  "quote_asset_symbol": "string",
	  "quote_asset_name": "string",
	  "min_size": integer,
	  "lot_size": integer,
	  "tick_size": integer
	},
	...
]
```

Each poolobject **Object** The basic unit of storage on Sui. in the response includes the following fields:

- **pool_id:** ID for the pool.
- **pool_name:** Name of the pool.
- **base_asset_id:** ID for the base asset.
- **base_asset_decimals:** Number of decimals for the base asset.
- **base_asset_symbol:** Symbol for the base asset.
- **base_asset_name:** Name of the base asset.
- **quote_asset_id:** ID for the quote asset.
- **quote_asset_decimals:** Number of decimals for the quote asset.
- **quote_asset_symbol:** Symbol for the quote asset.
- **quote_asset_name:** Name of the quote asset.
- **min_size:** Minimum trade size for the pool, in smallest units of the base asset.
- **lot_size:** Minimum increment for trades in this pool, in smallest units of the base asset.
- **tick_size:** Minimum price increment for trades in this pool.

#### Example

A successful request to the following endpoint

```http
/get_pools
```

produces a response similar to

```json
[
  {
    "pool_id": "0xb663828d6217467c8a1838a03793da896cbe745b150ebd57d82f814ca579fc22",
    "pool_name": "DEEP_SUI",
    "base_asset_id": "0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP",
    "base_asset_decimals": 6,
    "base_asset_symbol": "DEEP",
    "base_asset_name": "DeepBook Token",
    "quote_asset_id": "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
    "quote_asset_decimals": 9,
    "quote_asset_symbol": "SUI",
    "quote_asset_name": "Sui",
    "min_size": 100000000,
    "lot_size": 10000000,
    "tick_size": 10000000
  },
  {
    "pool_id": "0xf948981b806057580f91622417534f491da5f61aeaf33d0ed8e69fd5691c95ce",
    "pool_name": "DEEP_USDC",
    "base_asset_id": "0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP",
    "base_asset_decimals": 6,
    "base_asset_symbol": "DEEP",
    "base_asset_name": "DeepBook Token",
    "quote_asset_id": "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
    "quote_asset_decimals": 6,
    "quote_asset_symbol": "USDC",
    "quote_asset_name": "USDC",
    "min_size": 100000000,
    "lot_size": 10000000,
    "tick_size": 10000
  }
]
```

Click to open Get historical volume for pool in a specific time range

```http
/historical_volume/:pool_names?start_time=<UNIX_TIMESTAMP_SECONDS>&end_time=<UNIX_TIMESTAMP_SECONDS>&volume_in_base=<BOOLEAN>
```

Use this endpoint to get historical volume for pools for a specific time range. Delimit the `pool_names` with commas, and use Unix timestamp seconds for `start_time` and `end_time` values.

By default, this endpoint retrieves the last 24-hour trading volume in the quote asset for specified pools. If you want to query the base asset instead, set `volume_in_base` to `true` .

#### Response

Returns the historical volume for each specified pool within the given time range.

```json
{
	"pool_name_1": total_pool1_volume,
	"pool_name_2": total_pool2_volume,
	...
}
```

#### Example

A successful request to the following endpoint

```http
/historical_volume/DEEP_SUI,SUI_USDC?start_time=1731260703&end_time=1731692703&volume_in_base=true
```

produces a response similar to

```json
{
  "DEEP_SUI": 22557460000000,
  "SUI_USDC": 19430171000000000
}
```

Click to open Get historical volume for all pools

```http
/all_historical_volume?start_time=<UNIX_TIMESTAMP_SECONDS>&end_time=<UNIX_TIMESTAMP_SECONDS>&volume_in_base=<BOOLEAN>
```

Use this endpoint to get historical volume for all pools. Include the optional `start_time` and `end_time` values as Unix timestamp seconds to retrieve the volume within that time range.

By default, this endpoint retrieves the last 24-hour trading volume in the quote asset. If you want to query the base asset instead, set `volume_in_base` to `true` .

#### Response

Returns the historical volume for all available pools within the time range (if provided).

```json
{
	"pool_name_1": total_pool1_volume,
	"pool_name_2": total_pool2_volume
}
```

#### Example

A successful request to the following endpoint

```http
/all_historical_volume?start_time=<UNIX_TIMESTAMP_SECONDS>&end_time=<UNIX_TIMESTAMP_SECONDS>&volume_in_base=<BOOLEAN>
```

produces a response similar to

```json
{
  "DEEP_SUI": 22557460000000,
  "WUSDT_USDC": 10265000000,
  "NS_USDC": 4399650900000,
  "NS_SUI": 6975475200000,
  "SUI_USDC": 19430171000000000,
  "WUSDC_USDC": 23349574900000,
  "DEEP_USDC": 130000590000000
}
```

Click to open Get historical volume by balance manager

```http
/historical_volume_by_balance_manager_id/:pool_names/:balance_manager_id?start_time=<UNIX_TIMESTAMP_SECONDS>&end_time=<UNIX_TIMESTAMP_SECONDS>&volume_in_base=<BOOLEAN>
```

Get historical volume by balance manager for a specific time range. Delimit the `pool_names` with commas, and use Unix timestamp seconds for the optional `start_time` and `end_time` values.

By default, this endpoint retrieves the last 24-hour trading volume for the balance manager in the quote asset for specified pools. If you want to query the base asset instead, set `volume_in_base` to `true` .

#### Response

```json
{
	"pool_name_1": [maker_volume, taker_volume],
	"pool_name_2": …
}
```

#### Example

A successful request to the following endpoint

```http
/historical_volume_by_balance_manager_id/SUI_USDC,DEEP_SUI/0x344c2734b1d211bd15212bfb7847c66a3b18803f3f5ab00f5ff6f87b6fe6d27d?start_time=1731260703&end_time=1731692703&volume_in_base=true
```

produces a response similar to

```json
{
  "DEEP_SUI": [14207960000000, 3690000000],
  "SUI_USDC": [2089300100000000, 17349400000000]
}
```

Click to open Get historical volume by balance manager within a specific time range and intervals

```http
/historical_volume_by_balance_manager_id_with_interval/:pool_names/:balance_manager_id?start_time=<UNIX_TIMESTAMP_SECONDS>&end_time=<UNIX_TIMESTAMP_SECONDS>&interval=<UNIX_TIMESTAMP_SECONDS>&volume_in_base=<BOOLEAN>
```

Get historical volume by `BalanceManager` for a specific time range with intervals. Delimit `pool_names` with commas and use Unix timestamp seconds for the optional `start_time` and `end_time` values. Use number of seconds for the `interval` value. As a simplified interval example, if `start_time` is 5, `end_time` is 10, and `interval` is 2, then the response includes volume from 5 to 7 and 7 to 9, with start time of the periods as keys.

By default, this endpoint retrieves the last 24-hour trading volume for the balance manager in the quote asset for specified pools. If you want to query the base asset instead, set `volume_in_base` to `true` .

#### Response

```json
{
	"[time_1_start, time_1_end]": {
		"pool_name_1": [maker_volume, taker_volume],
		"pool_name_2": …
	},
	"[time_2_start, time_2_end]": {
		"pool_name_1": [maker_volume, taker_volume],
		"pool_name_2": …
	}
}
```

#### Example

A successful request to the following endpoint with an interval of 24 hours

```http
/historical_volume_by_balance_manager_id_with_interval/USDC_DEEP,SUI_USDC/0x344c2734b1d211bd15212bfb7847c66a3b18803f3f5ab00f5ff6f87b6fe6d27d?start_time=1731460703&end_time=1731692703&interval=86400&volume_in_base=true
```

produces a response similar to

```json
{
  "[1731460703, 1731547103]": {
    "SUI_USDC": [505887400000000, 2051300000000]
  },
  "[1731547103, 1731633503]": {
    "SUI_USDC": [336777500000000, 470600000000]
  }
}
```

Click to open Get summary

```http
/summary
```

Returns a summary in JSON for all trading pairs in DeepBookV3.

#### Response

Each summaryobject has the following form. The order of fields in the JSONobject is not guaranteed.

```json
{
	"trading_pairs": "string",
	"quote_currency": "string",
	"last_price": float,
	"lowest_price_24h": float,
	"highest_bid": float,
	"base_volume": float,
	"price_change_percent_24h": float,
	"quote_volume": float,
	"lowest_ask": float,
	"highest_price_24h": float,
	"base_currency": "string"
}
```

#### Example

A successful request to

```text
/summary
```

produces a response similar to

```json
[
	{
    "trading_pairs": "AUSD_USDC",
    "quote_currency": "USDC",
    "last_price": 1.0006,
    "lowest_price_24h": 0.99905,
    "highest_bid": 1.0006,
    "base_volume": 1169.2,
    "price_change_percent_24h": 0.07501125168773992,
    "quote_volume": 1168.961637,
    "lowest_ask": 1.0007,
    "highest_price_24h": 1.00145,
    "base_currency": "AUSD"
  },
  {
    "quote_volume": 4063809.55231,
    "lowest_price_24h": 0.9999,
    "highest_price_24h": 1.009,
    "base_volume": 4063883.6,
    "quote_currency": "USDC",
    "price_change_percent_24h": 0.0,
    "base_currency": "WUSDC",
    "trading_pairs": "WUSDC_USDC",
    "last_price": 1.0,
    "highest_bid": 1.0,
    "lowest_ask": 1.0001
  },
  {
		"price_change_percent_24h": 0.0,
		"quote_currency": "USDC",
		"lowest_price_24h": 0.0,
		"quote_volume": 0.0,
		"base_volume": 0.0,
		"highest_price_24h": 0.0,
		"lowest_ask": 1.04,
		"last_price": 1.04,
		"base_currency": "WUSDT",
		"highest_bid": 0.90002,
		"trading_pairs": "WUSDT_USDC"
	},
	...
]
```

Click to open Get ticker information

```http
/ticker
```

Returns all trading pairs volume (already scaled), last price, and `isFrozen` value. Possible values for `isFrozen` is either:

- `0` : Pool is active
- `1` : Pool is inactive

#### Response

```json
{
  "TRADING_PAIR": {
    "base_volume": float,
    "quote_volume": float,
    "last_price": float,
    "isFrozen": integer (0 | 1)
  }
}
```

#### Example

A successful request to

```text
/ticker
```

produces a response similar to

```json
{
	"DEEP_USDC": {
		"last_price": 0.07055,
		"base_volume": 43760440.0,
		"quote_volume": 3096546.9161,
		"isFrozen": 0
	},
	"NS_SUI": {
		"last_price": 0.08323,
		"base_volume": 280820.8,
		"quote_volume": 23636.83837,
		"isFrozen": 0
	},
	...
}
```

Click to open Get trades

```http
/trades/:pool_name?limit=<INTEGER>&start_time=<UNIX_TIMESTAMP_SECONDS>&end_time=<UNIX_TIMESTAMP_SECONDS>&maker_balance_manager_id=<ID>&taker_balance_manager_id=<ID>
```

Returns the most recent trades in the pool.

#### Response

```json
[
    {
        "event_digest": "string",
        "digest": "string",
        "trade_id": "string",
        "maker_order_id": "string",
        "taker_order_id": "string",
        "maker_balance_manager_id": "string",
        "taker_balance_manager_id": "string",
        "price": float,
        "base_volume": float,
        "quote_volume": float,
        "timestamp": integer,
        "type": "string",
        "taker_is_bid": boolean,
        "taker_fee": float,
        "maker_fee": float,
        "taker_fee_is_deep": boolean,
        "maker_fee_is_deep": boolean
    }
]
```

The `timestamp` value is in Unix milliseconds. The `type` value is either `"buy"` or `"sell"` based on the taker's direction.

#### Example

A successful request to

```http
trades/SUI_USDC?limit=2&start_time=1738093405&end_time=1738096485&maker_balance_manager_id=0x344c2734b1d211bd15212bfb7847c66a3b18803f3f5ab00f5ff6f87b6fe6d27d&taker_balance_manager_id=0x47dcbbc8561fe3d52198336855f0983878152a12524749e054357ac2e3573d58
```

produces a response similar to

```json
[
    {
        "event_digest": "abc123...",
        "digest": "def456...",
        "trade_id": "136321457151457660152049680",
        "maker_order_id": "68160737799100866923792791",
        "taker_order_id": "170141183460537392451039660509112362617",
        "maker_balance_manager_id": "0x344c2734b1d211bd15212bfb7847c66a3b18803f3f5ab00f5ff6f87b6fe6d27d",
        "taker_balance_manager_id": "0x47dcbbc8561fe3d52198336855f0983878152a12524749e054357ac2e3573d58",
        "price": 3.695,
        "base_volume": 405.0,
        "quote_volume": 1499.0,
        "timestamp": 1738096392913,
        "type": "sell",
        "taker_is_bid": false,
        "taker_fee": 0.001,
        "maker_fee": 0.0005,
        "taker_fee_is_deep": true,
        "maker_fee_is_deep": true
    },
	...
]
```

Click to open Get order updates

```http
/order_updates/:pool_name?limit=<INTEGER>&start_time=<UNIX_TIMESTAMP_SECONDS>&end_time=<UNIX_TIMESTAMP_SECONDS>&status=<"Placed" or "Canceled">&balance_manager_id=<ID>
```

Returns the orders that were recently placed or canceled in the pool

#### Response

```json
[
    {
        "order_id": "string",
        "balance_manager_id": "string",
        "timestamp": integer,
        "original_quantity": integer,
        "remaining_quantity": integer,
        "filled_quantity": integer,
        "price": integer,
        "status": "string",
        "type": "string"
    }
]
```

The `timestamp` value is in Unix milliseconds.

#### Example

A successful request to

```http
/order_updates/DEEP_USDC?start_time=1738703053&end_time=1738704080&limit=2&status=Placed&balance_manager_id=0xd335e8aa19d6dc04273d77e364c936bad69db4905a4ab3b2733d644dd2b31e0a
```

produces a response similar to

```json
[
    {
        "order_id": "170141183464610341308794360958165054983",
        "balance_manager_id": "0xd335e8aa19d6dc04273d77e364c936bad69db4905a4ab3b2733d644dd2b31e0a",
        "timestamp": 1738704071994,
        "original_quantity": 8910,
        "remaining_quantity": 8910,
        "filled_quantity": 0,
        "price": 22449,
        "status": "Placed",
        "type": "sell"
    },
	...
]
```

Click to open Get order book information

```http
/orderbook/:pool_name?level={1|2}&depth={integer}
```

Returns the bids and asks for the relevant pool. The bids and asks returned are each sorted from best to worst. There are two optional query parameters in the endpoint:

- **level** : The `level` value can be either 1 or 2.
- `1` : Only the best bid and ask.
- `2` : Arranged by best bids and asks. This is the default value.
- **depth** : The `depth` value can be `0` or greater than `1` . A value of `0` returns the entire order book, and a value greater than `1` returns the specified number of both bids and asks. In other words, if you provide `depth=100` , then your response includes 50 bids and 50 asks. If the `depth` value is odd, it's treated as the next lowest even value. Consequently, `depth=101` also returns 50 bids and 50 asks. If you do not provide a `depth` parameter, the response defaults to all orders in the order book.

#### Response

```json
{
  "timestamp": "string",
  "bids": [
    ["string", "string"],
    ["string", "string"]
  ],
  "asks": [
    ["string", "string"],
    ["string", "string"]
  ]
}
```

The timestamp returned is a string that represents a Unix timestamp in milliseconds.

#### Example

A successful request to

```json
/orderbook/SUI_USDC?level=2&depth=4
```

produces a response similar to

```json
{
  "timestamp": "1733874965431",
  "bids": [
    ["3.715", "2.7"],
    ["3.713", "2294.8"]
  ],
  "asks": [
    ["3.717", "0.9"],
    ["3.718", "1000"]
  ]
}
```

Click to open Get asset information

```http
/assets
```

Returns asset information for all coins being traded on DeepBookV3.

#### Response

Each assetobject has the following form:

```json
"ASSET_NAME": {
	"unified_cryptoasset_id": "string",
	"name": "string",
	"contractAddress": "string",
	"contractAddressUrl": "string",
	"can_deposit": "string (true | false)",
	"can_withdraw": "string (true | false)"
}
```

#### Example

A successful request to

```json
/assets
```

produces a response similar to

```json
{
  "NS": {
    "unified_cryptoasset_id": "32942",
    "name": "Sui Name Service",
    "contractAddress": "0x5145494a5f5100e645e4b0aa950fa6b68f614e8c59e17bc5ded3495123a79178",
    "contractAddressUrl": "https://suiscan.xyz/mainnet/object/0x5145494a5f5100e645e4b0aa950fa6b68f614e8c59e17bc5ded3495123a79178",
    "can_deposit": "true",
    "can_withdraw": "true"
  },
  "AUSD": {
    "unified_cryptoasset_id": "32864",
    "name": "AUSD",
    "contractAddress": "0x2053d08c1e2bd02791056171aab0fd12bd7cd7efad2ab8f6b9c8902f14df2ff2",
    "contractAddressUrl": "https://suiscan.xyz/mainnet/object/0x2053d08c1e2bd02791056171aab0fd12bd7cd7efad2ab8f6b9c8902f14df2ff2",
    "can_deposit": "true",
    "can_withdraw": "true"
  },
	...
}
```

Click to open Get orders by balance manager

```http
/orders/:pool_name/:balance_manager_id?limit=<INTEGER>&status=<STATUS>
```

Returns orders for a specific balance manager in a pool. The `status` parameter can filter by order status (such as `Placed` , `Canceled` , or `Filled` ). Multiple statuses can be provided as comma-separated values.

#### Response

```json
[
    {
        "order_id": "string",
        "balance_manager_id": "string",
        "type": "string",
        "current_status": "string",
        "price": float,
        "placed_at": integer,
        "last_updated_at": integer,
        "original_quantity": float,
        "filled_quantity": float,
        "remaining_quantity": float
    }
]
```

Click to open Get trade count

```http
/trade_count?start_time=<UNIX_TIMESTAMP_SECONDS>&end_time=<UNIX_TIMESTAMP_SECONDS>
```

Returns the total number of trades across all pools within the specified time range.

#### Response

```json
integer
```

Click to open Get OHLCV candlestick data

```http
/ohclv/:pool_name?interval=<INTERVAL>&start_time=<UNIX_TIMESTAMP_SECONDS>&end_time=<UNIX_TIMESTAMP_SECONDS>&limit=<INTEGER>
```

Returns OHLCV (Open, High, Low, Close, Volume) candlestick data for a pool. Valid intervals are: `1m` , `5m` , `15m` , `30m` , `1h` , `4h` , `1d` , `1w` .

#### Response

```json
{
    "candles": [
        [timestamp, open, high, low, close, volume],
        ...
    ]
}
```

#### Example

A successful request to

```http
/ohclv/SUI_USDC?interval=1h&limit=10
```

produces a response similar to

```json
{
    "candles": [
        [1738000000, 3.5, 3.6, 3.4, 3.55, 1000000],
        [1738003600, 3.55, 3.7, 3.5, 3.65, 1500000],
        ...
    ]
}
```

Click to open Get net deposits

```http
/get_net_deposits/:asset_ids/:timestamp
```

Returns the net deposits (deposits minus withdrawals) for specified assets up to a given timestamp. Asset IDs should be comma-separated.

#### Response

```json
{
    "asset_id_1": integer,
    "asset_id_2": integer,
    ...
}
```

Click to open Get DEEP supply

```http
/deep_supply
```

Returns the total supply of DEEP tokens.

#### Response

```json
{
  "total_supply": "string"
}
```

Click to open Get deposited assets

```http
/deposited_assets/:balance_manager_ids
```

Returns the list of assets that have been deposited into the specified balance managers. Balance manager IDs should be comma-separated.

#### Response

```json
[
    {
        "balance_manager_id": "string",
        "assets": ["string", ...]
    }
]
```

Click to open Get indexer status

```http
/status?max_checkpoint_lag=<INTEGER>&max_time_lag_seconds=<INTEGER>
```

Returns the health status of the indexer, includingcheckpoint **Checkpoint** Created after transaction execution to provide a certified record of chain history. lag information for each pipeline. The optional parameters set thresholds for determining healthy status (defaults: `max_checkpoint_lag=100` , `max_time_lag_seconds=60` ).

#### Response

```json
{
    "status": "OK" | "UNHEALTHY",
    "latest_onchain_checkpoint": integer,
    "current_time_ms": integer,
    "earliest_checkpoint": integer,
    "max_lag_pipeline": "string",
    "max_checkpoint_lag": integer,
    "max_time_lag_seconds": integer,
    "pipelines": [
        {
            "pipeline": "string",
            "indexed_checkpoint": integer,
            "indexed_epoch": integer,
            "indexed_timestamp_ms": integer,
            "checkpoint_lag": integer,
            "time_lag_seconds": integer,
            "latest_onchain_checkpoint": integer
        }
    ]
}
```

Click to open Get points

```http
/get_points?addresses=<ADDRESS1>,<ADDRESS2>,...
```

Returns the total points accumulated for the specifiedaddresses **Address** A unique, anonymous identity on a blockchain network. . Points are earned through trading activity on DeepBookV3. Provideaddresses as comma-separated values.

#### Response

```json
[
  {
    "address": "0x1234...",
    "total_points": 1000000
  },
  {
    "address": "0x5678...",
    "total_points": 500000
  }
]
```

#### Example

A successful request to

```http
/get_points?addresses=0x344c2734b1d211bd15212bfb7847c66a3b18803f3f5ab00f5ff6f87b6fe6d27d,0x47dcbbc8561fe3d52198336855f0983878152a12524749e054357ac2e3573d58
```

produces a response similar to

```json
[
  {
    "address": "0x344c2734b1d211bd15212bfb7847c66a3b18803f3f5ab00f5ff6f87b6fe6d27d",
    "total_points": 1250000
  },
  {
    "address": "0x47dcbbc8561fe3d52198336855f0983878152a12524749e054357ac2e3573d58",
    "total_points": 750000
  }
]
```

Click to open Get margin supply

```http
/margin_supply
```

Returns the total supply balance for each margin pool, queried onchain through the margin pool contract.

#### Response

```json
{
  "0x2::sui::SUI": 1000000000000,
  "0xdba3...::usdc::USDC": 5000000000000
}
```

A map of asset type to total supply amount (in smallest units).

Click to open Get pool creation events

```http
/pool_created
```

Returns events for whenDeepBook pools are created.

#### Response

```json
[
  {
    "event_digest": "0xabc123...",
    "digest": "0xdef456...",
    "sender": "0x1111...",
    "checkpoint": 12345678,
    "checkpoint_timestamp_ms": 1738000000000,
    "package": "0x2222...",
    "pool_id": "0x1234...",
    "taker_fee": 1000000,
    "maker_fee": 500000,
    "tick_size": 10000,
    "lot_size": 10000000,
    "min_size": 100000000,
    "whitelisted_pool": false,
    "treasury_address": "0x5678..."
  }
]
```

Click to open Get book parameters updated events

```http
/book_params_updated?pool_id=<ID>
```

Returns the most recent book parameter update event for a pool. The `pool_id` parameter is required.

#### Response

```json
{
  "event_digest": "0xabc123...",
  "digest": "0xdef456...",
  "sender": "0x1111...",
  "checkpoint": 12345678,
  "checkpoint_timestamp_ms": 1738000000000,
  "package": "0x2222...",
  "pool_id": "0x1234...",
  "tick_size": 10000,
  "lot_size": 10000000,
  "min_size": 100000000,
  "onchain_timestamp": 1738000000000
}
```

Click to open Get user portfolio

```http
/portfolio/:wallet_address
```

Returns a comprehensive portfolio view for a walletaddress , including margin positions, collateral balances, LP positions, and a summary of total equity.

#### Response

```json
{
  "margin_positions": [
    {
      "margin_manager_id": "0x1234...",
      "pool": "SUI_USDC",
      "base_asset_symbol": "SUI",
      "quote_asset_symbol": "USDC",
      "base_asset": 100.0,
      "quote_asset": 500.0,
      "base_debt": 50.0,
      "quote_debt": 200.0,
      "base_asset_usd": 350.0,
      "quote_asset_usd": 500.0,
      "base_debt_usd": 175.0,
      "quote_debt_usd": 200.0,
      "total_debt_usd": 375.0,
      "net_value_usd": 475.0,
      "risk_ratio": 2.27
    }
  ],
  "collateral_balances": [
    {
      "asset": "SUI",
      "balance": 100.0,
      "balance_usd": 350.0
    }
  ],
  "lp_positions": [
    {
      "margin_pool_id": "0x5678...",
      "asset": "USDC",
      "supplied": 1000.0,
      "shares": 1000000000,
      "supplied_usd": 1000.0
    }
  ],
  "summary": {
    "total_equity_usd": 1850.0,
    "total_debt_usd": 375.0,
    "net_value_usd": 1475.0
  }
}
```

Click to open Get referral fee events

```http
/referral_fee_events?pool_id=<ID>&referral_id=<ID>
```

Returns events for referral fees earned during trading. These events track fees earned by referrals across different pools.

#### Response

```json
[
  {
    "event_digest": "0xabc123...",
    "digest": "0xdef456...",
    "sender": "0x1111...",
    "checkpoint": 12345678,
    "checkpoint_timestamp_ms": 1738000000000,
    "package": "0x2222...",
    "pool_id": "0x1234...",
    "referral_id": "0x5678...",
    "base_fee": 1000000,
    "quote_fee": 500000,
    "deep_fee": 250000
  }
]
```
