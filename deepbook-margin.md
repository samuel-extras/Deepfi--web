# DeepBook Margin

URL: https://docs.sui.io/onchain-finance/deepbook-margin/

DeepBook **DeepBook** A decentralized central limit order book (CLOB) built on Sui. Margin extends the trading capabilities of DeepBookV3 by enabling leveraged trading positions. With margin trading, users can borrow funds to increase their buying power.

## Key features

DeepBook Margin provides the following capabilities:

- **Leveraged positions** : Trade with borrowed funds to increase position sizes beyond available capital
- **Risk management** : Built-in liquidation mechanisms to protect lenders and maintain system solvency
- **Collateral flexibility** : Support for multiple assets as collateral for isolated margin positions
- **Interest accrual** : Transparent interest rate calculations for borrowed funds

## Risk considerations

Margin trading carries additional risks, including the potential for liquidation if positionsmove **Move** An open source programming language used for all activity on Sui. against the trader. Users should understand these risks before engaging in margin trading on DeepBookV3.

### Liquidation mechanisms

When a margin position falls below the maintenance margin requirement, the position is liquidated to protect lenders and maintain system solvency. The liquidation engine operates onchain through smart contracts, ensuring transparent and fair execution.

### Interest rates

Interest rates for borrowed funds are calculated transparently based on utilization rates and market conditions.

[## Design

Learn about DeepBook Margin design, including MarginPool, MarginManager, and MarginRegistry shared objects.

→](/onchain-finance/deepbook-margin/design)
[## Margin Risks

Understand the risks of margin trading on DeepBook, including liquidation, interest rate fluctuations, and how to protect your positions.

→](/onchain-finance/deepbook-margin/margin-risks)
[## Contract Information

In this section

- Margin Manager
- Margin Pool
- Orders
- Maintainer
- Take Profit Stop Loss
- Interest Rates

* 2 more

→](/onchain-finance/deepbook-margin/contract-information)
[## DeepBook Margin SDK

In this section

- Margin Manager
- Margin Pool
- Orders
- Maintainer
- Take Profit Stop Loss

→](/onchain-finance/deepbook-margin-sdk/)
[## Indexer

DeepBook Margin Indexer provides access to margin trading events including loans, liquidations, and margin pool operations.

→](/onchain-finance/deepbook-margin/deepbook-margin-indexer)

# Design

URL: https://docs.sui.io/onchain-finance/deepbook-margin/design

At a high level, theDeepBook **DeepBook** A decentralized central limit order book (CLOB) built on Sui. Margin design revolves around four main shared objects that work together to enable leveraged trading:

- `MarginPool` : A sharedobject **Object** The basic unit of storage on Sui. that manages liquidity for a specific asset, handling supply and borrow operations with interest accrual. See the MarginPool shared object section to learn more.
- `MarginManager` : A sharedobject that wraps a `BalanceManager` and provides capabilities for leveraged trading, including borrowing, repaying, and risk management. See the MarginManager shared object section to learn more.
- `MarginRegistry` : A central registry that manages all margin pools and margin managers, enforces system-wide configurations, and tracks enabled pools. See the MarginRegistry section to learn more.
- `BalanceManager` : Inherited from DeepBookV3, used to source funds for trading. See [BalanceManager](/onchain-finance/deepbookv3/contract-information/balance-manager) to learn more.

## `MarginPool` sharedobject

The `MarginPool` is responsible for managing liquidity for a single asset type. It consists of several key components:

- `State`
- `ProtocolConfig`
- `ProtocolFees`
- `PositionManager`

### State

The `State` component tracks the total supply and borrow amounts, along with their corresponding shares. It uses a shares-based accounting system where:

- **Supply shares:** Represent a lender's proportional ownership of the total supplied assets.
- **Borrow shares:** Represent a borrower's proportional debt obligation.
  Interest accrues continuously based on the utilization rate (ratio of borrowed to supplied assets). The state updates on every supply, borrow, repay, and withdraw operation, ensuring interest is always current.

The interest rate is calculated dynamically based on the pool's utilization rate, following a piecewise linear model defined in the `InterestConfig` . Higher utilization leads to higher interest rates, incentivizing more supply and less borrowing.

### Protocol config

The `ProtocolConfig` stores critical parameters that govern the margin pool's behavior:

- **Interest rate parameters:** Base rate, multipliers, and kink points that define the interest rate curve.
- **Supply cap:** Maximum amount that can be supplied to the pool.
- **Max utilization rate:** Upper bound on how much of the pool can be borrowed (for example, 80%).
- **Min borrow amount:** Minimum loan size to prevent spam.
- **Protocol spread:** Percentage of interest that goes to protocol fees.
  These parameters can be updated by the pool operator using the `MarginPoolCap` .

### Protocol fees

The `ProtocolFees` component manages the distribution of interest earned. When borrowers pay interest, the protocol spread (for example, 10%) is taken as fees, with the remaining portion (for example, 90%) distributed to suppliers based on their shares.

The protocol spread is then distributed as follows:

- **Referral fees:** 50% of the protocol spread goes to supply referrals who bring in liquidity.
- **Protocol fees:** 25% of the protocol spread goes to the protocol treasury.
- **Maintainer fees:** 25% of the protocol spread goes to the pool maintainer.
  For example, if 100 USDC in interest is paid, 10 USDC goes to protocol fees (at 10% spread) and 90 USDC goes to suppliers. The 10 USDC is then split: 5 USDC to referrals, 2.5 USDC to protocol, and 2.5 USDC to the maintainer.

The protocol tracks shares owned by each referral and calculates their proportional fees based on the liquidity they've referred.

### Position manager

The `PositionManager` tracks individual supplier positions, including:

- Supply shares owned by each `SupplierCap` .
- Referral associations for fee distribution.
- Historical position data.

## `MarginManager` sharedobject

The `MarginManager` wraps a `BalanceManager` and adds margin trading capabilities. Each `MarginManager` is associated with a specificDeepBook pool and tracks:

- **Borrowed shares:** Amount borrowed from base and quote asset margin pools.
- **Margin pool ID:** Which margin pool the current loan is from (if any).
- **DeepBook pool:** Which trading pool this manager is authorized to trade on.

### Borrowing and risk management

A `MarginManager` can only borrow from one margin pool at a time (either base or quote asset). This simplifies risk calculations and prevents complex cross-collateral scenarios.

Risk is measured using a **risk ratio** calculated as:

Risk Ratio = Total Assets Total Debt \text{Risk Ratio} = \frac{\text{Total Assets}}{\text{Total Debt}} Risk Ratio= Total DebtTotal Assets

Different risk ratio thresholds determine allowable actions:

- **Withdraw threshold** (for example, 2.0): Minimum ratio to withdraw collateral.
- **Borrow threshold** (for example, 1.25): Minimum ratio to take out new loans.
- **Target liquidation ratio** (for example, 1.25): Target ratio after partial liquidation.
- **Liquidation threshold** (for example, 1.15): Below this, the position can be liquidated.

### Liquidation process

When a `MarginManager` risk ratio falls below the liquidation threshold, anyone can liquidate the position:

1. The liquidator provides repayment for the debt.
2. The liquidator receives collateral plus a liquidation reward (for example, 5%).
3. The margin pool might also receive a reward (for example, 3%).
4. If assets are insufficient, the pool records bad debt.
   Liquidations can be partial or full, depending on the position's health and the liquidator's input.

## `MarginRegistry`

The `MarginRegistry` serves as the central coordination point for the margin system:

- **Pool registration:** Tracks all margin pools by asset type.
- **Pool enablement:** Determines whichDeepBook pools are enabled for margin trading.
- **Risk parameters:** Stores risk ratios and liquidation parameters per pool.
- **Manager tracking:** Maintains a list of all margin managers.
  The registry enforces that only one margin pool can exist per asset type and ensures margin managers can only trade on enabledDeepBook pools.

## Liquidation flow

The following describes a typical liquidation scenario:

1. **Risk calculation:** A `MarginManager` falls below the liquidation threshold due to price movements or interest accrual.
2. **Liquidator action:** A liquidator calls `liquidate()` providing repayment coins.
3. **Order cancellation:** All open orders for the manager are cancelled.
4. **Debt calculation:** The system calculates the maximum debt that can be repaid.
5. **Assettransfer **Transfer** Changing the owner of an asset. :** Collateral assets are transferred to the liquidator with the reward.
6. **Pool update:** The margin pool processes the repayment and any potential bad debt.
7. **Position update:** The manager's borrowed shares are reduced or cleared.

## Interest accrual

Interest accrues continuously inDeepBook Margin based on the utilization rate:

Utilization Rate = Total Borrowed Total Supplied \text{Utilization Rate} = \frac{\text{Total Borrowed}}{\text{Total Supplied}} Utilization Rate= Total SuppliedTotal Borrowed

The interest rate follows a kinked model:

- Below the kink (for example, 80% utilization): Linear growth at a moderate rate.
- Above the kink: Steep linear growth to discourage over-borrowing.
  Interest compounds every time the state is updated (on any supply, borrow, repay, or withdraw operation). The protocol spread determines what portion of the interest goes to fees versus suppliers.

# Margin Risks

URL: https://docs.sui.io/onchain-finance/deepbook-margin/margin-risks

Margin trading amplifies both gains and losses. Before usingDeepBook **DeepBook** A decentralized central limit order book (CLOB) built on Sui. Margin, you should understand the risks involved. This guide explains the key risks and provides concrete examples to help you make informed decisions.

## Liquidation risk

The most significant risk in margin trading is **liquidation** - the forced closure of your position when it becomes too risky for the protocol to maintain.

### How liquidation works

When you borrow funds to trade, you must maintain a minimum [risk ratio](/onchain-finance/deepbook-margin/contract-information/risk-ratio) (the ratio of your total assets to total debts). If your position's risk ratio falls to or below the **Liquidation Risk Ratio** , anyone can liquidate your position.

Warning zone
For SUI/USDC (5x leverage), when your risk ratio falls between 1.1 and 1.2, you are in the **warning zone** . For WAL/USDC and DEEP/USDC (3x leverage), the warning zone is between 1.2 and 1.3. At these levels, even minor price movements can push you into liquidation. Monitor your position carefully and consider adding collateral or reducing your position size.

### Partial liquidation

Liquidation inDeepBook Margin is **partial** , not total. The protocol only liquidates enough of your position to restore your risk ratio to the **Target Liquidation Risk Ratio** (1.25 for SUI/USDC, 1.5 for WAL/USDC and DEEP/USDC).

During liquidation:

1. A liquidator repays a portion of your debt (not all of it)
2. They receive collateral plus a liquidation reward (typically 2%)
3. The margin pool also takes a fee (typically 3%)
4. Your position is restored to the target risk ratio
5. You keep the remaining position, but with less equity
   This means if you're liquidated, you won't lose your entire position. The liquidator repays just enough debt to bring your ratio back to the target, leaving you with a smaller but healthier position.

However, if your position is severely underwater (assets barely cover debt plus rewards), a full liquidation might occur where all debt is repaid and the lending pool might incur bad debt.

### Example: Getting liquidated on SUI/USDC

Let's walk through a concrete example using the SUI/USDC trading pair, which has a **Liquidation Risk Ratio of 1.1** .

**Opening position:**

- You deposit 100 USDC as collateral
- You borrow 400 USDC and open a 5x long position on SUI at 1.50 USDC per SUI
- Total assets: 500 USDC
- Total debt: 400 USDC
- **Starting risk ratio: 500 / 400 = 1.25**
  **The path to liquidation:**

| SUI Price (USDC) | SUI Value (USDC) | Total Assets (USDC) | Risk Ratio | Status
| 1.50 | 400 | 500 | 1.25 | Safe (at min borrow ratio)
| 1.425 | 380 | 480 | 1.20 | Warning zone
| 1.35 | 360 | 460 | 1.15 | Danger zone
| 1.275 | 340 | 440 | 1.10 | Liquidatable
| 1.20 | 320 | 420 | 1.05 | Underwater

**What happens at 1.275 USDC per SUI:**

- Your risk ratio hits 1.1 (the liquidation threshold for SUI/USDC)
- Your position can now be liquidated by anyone
- A liquidator partially liquidates your position, repaying enough debt to restore your risk ratio to 1.25
- You pay liquidation rewards (5% total: 2% to liquidator, 3% to pool)
- Your remaining position has a 1.25 risk ratio, but with significantly less equity and smaller size
  With 5x leverage, a mere 15% adverse price movement can trigger liquidation. Without leverage, you would be down 15% on paper.

### Liquidation is immediate

Unlike traditional margin calls that give you time to add collateral, DeFi liquidations happen instantly:

- There's no grace period to deposit more funds
- Once your ratio hits the threshold, any liquidator can execute immediately
- You cannot cancel or prevent it once it's triggered
- While partial liquidation preserves some of your position, the equity loss from fees is permanent

### Leverage multiplies losses (and gains)

Cryptocurrency prices are highly volatile. Leverage amplifies this volatility on your equity, whether you're long or short.

| Leverage | 10% AdverseMove **Move** An open source programming language used for all activity on Sui. | 20% AdverseMove | 30% AdverseMove
| 1x (no leverage) | -10% equity | -20% equity | -30% equity
| 2x | -20% equity | -40% equity | -60% equity
| 3x | -30% equity | -60% equity | -90% equity
| 5x | -50% equity | Liquidated | Liquidated

An adversemove means:

- **Long positions** : Price moves down (you borrowed USDC to buy SUI, and SUI drops)
- **Short positions** : Price moves up (you borrowed SUI to sell for USDC, and SUI rises)
  With 5x leverage:

- A 10% adverse price movement = 50% loss on your equity
- A 15-20% adverse price movement = liquidation territory
  Crypto markets canmove 10-20% in hours. Flash crashes, short squeezes, exchange outages, or major news events can trigger rapid price movements that liquidate leveraged positions before you can react.

## Interest rate risk

When you borrow funds, you pay interest that accrues continuously. This interest is **variable** and can change significantly based on pool utilization.

### How interest rates fluctuate

DeepBook Margin uses a [kinked interest rate model](/onchain-finance/deepbook-margin/contract-information/interest-rates) where rates increase gradually up to an optimal utilization point, then spike dramatically.

**Current USDC pool parameters:**

| Utilization | Interest Rate (APR)
| 0% | 0%
| 50% | 7.5%
| 80% (optimal) | 12%
| 85% | 37%
| 90% (max) | 62%

### Example: Interest rate spike

Imagine you open a leveraged position expecting to pay approximately 12% APR (at 80% utilization):

1. Day 1: Pool utilization is 75%, you're paying approximately 11% APR
2. Day 3: A large borrower enters, pushing utilization to 85%
3. Your rate jumps to 37% APR, more than 3x what you expected
4. Day 7: Utilization hits 89%, your rate is now approximately 57% APR
   On a 400 USDC borrow:

- At 12% APR: approximately 0.13 USDC/day in interest
- At 57% APR: approximately 0.62 USDC/day in interest
  Over a month, this difference compounds significantly and can erode your position's equity even if prices don'tmove against you.

### Interest compounds your liquidation risk

Interest accrues to your debt, which means:

- Your total debt increases over time
- Your risk ratio decreases even if asset prices stay flat
- Long-term leveraged positions can drift toward liquidation purely from interest
  **Example:** Starting with a 1.25 risk ratio and 37% APR interest:

- After 30 days, approximately 3% is added to your debt
- Risk ratio drops from 1.25 to approximately 1.21
- You're now closer to liquidation without any price movement

## Oracle risk

DeepBook Margin uses Pyth price oracles to value your assets and debts. While the protocol includes several protections, some oracle-related risks remain:

- **Price delays:** Oracle prices might lag behind real market prices during extremely volatile periods. The protocol mitigates this by rejecting prices older than around 60 seconds, but brief delays within this window can still occur.
- **Price manipulation:** Although Pyth is designed to be manipulation-resistant andDeepBook validates prices against confidence intervals and EWMA (exponentially weighted moving average) prices, extreme market conditions could still affect price accuracy.

### Oracle protections

DeepBook Margin implements multiple safeguards against oracle issues:

- **Staleness protection:** Prices older than around 60 seconds are automatically rejected, preventing liquidations based on stale data
- **Confidence interval checks:** The protocol validates that Pyth price confidence intervals are within acceptable bounds
- **EWMA price verification:** Spot prices are validated against EWMA prices to detect and reject anomalous price spikes

## Risk mitigation strategies

### 1. Use less than maximum leverage

Just because you can borrow at 5x doesn't mean you should. Consider:

- Using 2-3x leverage instead of 5x
- This gives you more room for price fluctuations before liquidation

### 2. Monitor your risk ratio actively

- Check your position regularly, especially during volatile markets
- Set up alerts if possible
- Know your liquidation price

### 3. Use Take Profit / Stop Loss orders

DeepBook Margin supports [TPSL orders](/onchain-finance/deepbook-margin/contract-information/tpsl) that automatically close your position:

- Set a stop loss above your liquidation price
- This exits your position with a smaller loss rather than getting liquidated

### 4. Maintain collateral reserves

- Keep additional funds ready to deposit if your position approaches liquidation
- Remember that adding collateral improves your risk ratio

### 5. Understand the interest rate environment

- Check current pool utilization before borrowing
- Be prepared for rates to increase
- Factor interest costs into your position sizing

### 6. Start small

If you're new to margin trading:

- Start with small position sizes
- Learn how the system works with money you can afford to lose
- Gradually increase size as you gain experience

## Summary of key risks

| Risk | What Can Happen | How to Mitigate
| Liquidation | Price volatility causes position to be forcibly closed, lose collateral + fees | Use less leverage, set stop losses, monitor positions
| Interest rates | Borrowing costs spike unexpectedly | Check utilization, factor in rate variability
| Oracle risk | Prices might not reflect true market | Understand oracle mechanics, avoid extreme leverage

# Contract Information

URL: https://docs.sui.io/onchain-finance/deepbook-margin/contract-information

This page contains the contractaddresses **Address** A unique, anonymous identity on a blockchain network. , supported coins, margin pools, and risk parameters forDeepBook **DeepBook** A decentralized central limit order book (CLOB) built on Sui. Margin on SuiMainnet **Mainnet** Production network for live transactions and real-value assets. .

## Contract versions

DeepBook Margin uses upgradeable contracts. When a contract is upgraded, only `MARGIN_PACKAGE_ID` needs to be updated - previous versions remain compatible unless noted.

### Current version

| Parameter | Value
| Version | 3
| Package **Package** Smart contracts on Sui. ID | `0xfbd322126f1452fd4c89aedbaeb9fd0c44df9b5cedbe70d76bf80dc086031377`
| Registry ID | `0x0e40998b359a9ccbab22a98ed21bd4346abf19158bc7980c8291908086b3a742`

### Version history

| Version | Date | Package ID | Changes | Status
| 3 | Feb 10, 2026 | `0xfbd322126f1452fd4c89aedbaeb9fd0c44df9b5cedbe70d76bf80dc086031377` | Bug fix in market order function | Active
| 2 | Feb 10, 2026 | `0xcb4fc91921494ebe6979e201fdb2d67388ffdf6a1b1eb4952526259074de8d0b` | Oracle slippage prevention for margin managers | Disabled
| 1 | Jan 13, 2026 | `0x97d9473771b01f77b0940c589484184b49f6444627ec121314fae6a6d36fb86b` | Original deployment | Disabled

## Supported coins

SUI Token
| Parameter | Value
| Type | `0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI`
| Decimals | 9

Native USDC
| Parameter | Value
| Type | `0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC`
| Decimals | 6

DEEP Token
| Parameter | Value
| Type | `0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP`
| Decimals | 6

WAL Token
| Parameter | Value
| Type | `0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL`
| Decimals | 9

SUIUSDE Token
| Parameter | Value
| Type | `0x41d587e5336f1c86cad50d38a7136db99333bb9bda91cea4ba69115defeb1402::sui_usde::SUI_USDE`
| Decimals | 6

## Margin pools

Margin pools provide the liquidity for margin traders to borrow. Suppliers can deposit assets to earn interest from borrowers.

SUI Margin Pool
| Parameter | Value
| Pool ID | `0x53041c6f86c4782aabbfc1d4fe234a6d37160310c7ee740c915f0a01b7127344`
| Supply Cap | 500,000 SUI
| Max Utilization Rate | 90%
| Referral Spread | 20%
| Min Borrow | 0.1 SUI

USDC Margin Pool
| Parameter | Value
| Pool ID | `0xba473d9ae278f10af75c50a8fa341e9c6a1c087dc91a3f23e8048baf67d0754f`
| Supply Cap | 2,000,000 USDC
| Max Utilization Rate | 90%
| Referral Spread | 20%
| Min Borrow | 0.1 USDC

DEEP Margin Pool
| Parameter | Value
| Pool ID | `0x1d723c5cd113296868b55208f2ab5a905184950dd59c48eb7345607d6b5e6af7`
| Supply Cap | 30,000,000 DEEP
| Max Utilization Rate | 90%
| Referral Spread | 20%
| Min Borrow | 0.1 DEEP

WAL Margin Pool
| Parameter | Value
| Pool ID | `0x38decd3dbb62bd4723144349bf57bc403b393aee86a51596846a824a1e0c2c01`
| Supply Cap | 7,000,000 WAL
| Max Utilization Rate | 90%
| Referral Spread | 20%
| Min Borrow | 0.1 WAL

SUIUSDE Margin Pool
| Parameter | Value
| Pool ID | `0xbb990ca04a7743e6c0a25a7fb16f60fc6f6d8bf213624ff03a63f1bb04c3a12f`
| Supply Cap | 1,000,000 SUIUSDE
| Max Utilization Rate | 90%
| Referral Spread | 20%
| Min Borrow | 0.1 SUIUSDE

## Risk parameters

Risk parameters determine the leverage limits and liquidation thresholds for each trading pair. See [Risk Ratio](/onchain-finance/deepbook-margin/contract-information/risk-ratio) for a detailed explanation of how these parameters work.

### SUI/USDC (5x leverage)

| Parameter | Value | Description
| Min Withdraw Risk Ratio | 2.0 | Minimum ratio required to withdraw collateral
| Min Borrow Risk Ratio | 1.25 | Minimum ratio required to borrow
| Liquidation Risk Ratio | 1.1 | Ratio at which position becomes liquidatable
| Target Liquidation Risk Ratio | 1.25 | Target ratio after liquidation
| User Liquidation Reward | 2% | Reward to liquidator
| Pool Liquidation Reward | 3% | Reward to the pool

### WAL/USDC (3x leverage)

| Parameter | Value | Description
| Min Withdraw Risk Ratio | 2.0 | Minimum ratio required to withdraw collateral
| Min Borrow Risk Ratio | 1.5 | Minimum ratio required to borrow
| Liquidation Risk Ratio | 1.2 | Ratio at which position becomes liquidatable
| Target Liquidation Risk Ratio | 1.5 | Target ratio after liquidation
| User Liquidation Reward | 2% | Reward to liquidator
| Pool Liquidation Reward | 3% | Reward to the pool

### DEEP/USDC (3x leverage)

| Parameter | Value | Description
| Min Withdraw Risk Ratio | 2.0 | Minimum ratio required to withdraw collateral
| Min Borrow Risk Ratio | 1.5 | Minimum ratio required to borrow
| Liquidation Risk Ratio | 1.2 | Ratio at which position becomes liquidatable
| Target Liquidation Risk Ratio | 1.5 | Target ratio after liquidation
| User Liquidation Reward | 2% | Reward to liquidator
| Pool Liquidation Reward | 3% | Reward to the pool

# Margin Manager

URL: https://docs.sui.io/onchain-finance/deepbook-margin/contract-information/margin-manager

The `MarginManager` is a sharedobject **Object** The basic unit of storage on Sui. that wraps a `BalanceManager` and provides the necessary capabilities to deposit, withdraw, trade, and manage leveraged positions. It enables users to borrow assets from margin pools to amplify their trading positions while managing risk through collateralization.

Each `MarginManager` is associated with a specificDeepBook **DeepBook** A decentralized central limit order book (CLOB) built on Sui. pool and can borrow from margin pools that allow trading on that pool. The margin manager tracks borrowed positions and enforces risk ratio limits to maintain system solvency.

## API

Following are the different public functions that the `MarginManager` exposes.

### Create a `MarginManager`

The `new()` function creates and shares a `MarginManager` in onetransaction **Transaction** A number of commands that execute on inputs to define the result of the transaction. . It validates that margin trading is enabled for the specified pool.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_manager.move
public fun new<BaseAsset, QuoteAsset>(
pool: &Pool<BaseAsset, QuoteAsset>,
deepbook_registry: &Registry,
margin_registry: &mut MarginRegistry,
clock: &Clock,
ctx: &mut TxContext,
): ID {
let manager = new_margin_manager(pool, deepbook_registry, margin_registry, clock, ctx);
let margin_manager_id = manager.id();
transfer::share_object(manager);

    margin_manager_id

}

### Create a `MarginManager` with initializer

The `new_with_initializer()` function creates a `MarginManager` and returns it along with an initializer hot potato. The initializer ensures the margin manager is properly shared after creation using the `share()` function.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_manager.move
public fun new_with_initializer<BaseAsset, QuoteAsset>(
pool: &Pool<BaseAsset, QuoteAsset>,
deepbook_registry: &Registry,
margin_registry: &mut MarginRegistry,
clock: &Clock,
ctx: &mut TxContext,
): (MarginManager<BaseAsset, QuoteAsset>, ManagerInitializer) {
let manager = new_margin_manager(pool, deepbook_registry, margin_registry, clock, ctx);
let initializer = ManagerInitializer {
margin_manager_id: manager.id(),
};

    (manager, initializer)

}

public fun share<BaseAsset, QuoteAsset>(
manager: MarginManager<BaseAsset, QuoteAsset>,
initializer: ManagerInitializer,
) {
assert!(manager.id() == initializer.margin_manager_id, EInvalidManagerForSharing);
transfer::share_object(manager);

    let ManagerInitializer {
        margin_manager_id: _,
    } = initializer;

}

### Set or unset referral

The owner of a `MarginManager` can set or unset a pool-specific referral for trading fee benefits. The referral must be a `DeepBookPoolReferral` minted for the pool associated with the margin manager. Each margin manager can have different referrals for different pools.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_manager.move
/// Set the referral for the margin manager.
public fun set_margin_manager_referral<BaseAsset, QuoteAsset>(
self: &mut MarginManager<BaseAsset, QuoteAsset>,
referral_cap: &DeepBookPoolReferral,
ctx: &mut TxContext,
) {
self.validate_owner(ctx);
self.balance_manager.set_balance_manager_referral(referral_cap, &self.trade_cap);
}

/// Unset the referral for the margin manager.
public fun unset_margin_manager_referral<BaseAsset, QuoteAsset>(
self: &mut MarginManager<BaseAsset, QuoteAsset>,
pool_id: ID,
ctx: &mut TxContext,
) {
self.validate_owner(ctx);
self.balance_manager.unset_balance_manager_referral(pool_id, &self.trade_cap);
}

### Deposit funds

Only the owner can deposit funds into the `MarginManager` . The deposited asset must be either the base asset, quote asset, or DEEP token.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_manager.move
// === Public Functions - Margin Manager ===
/// Deposit a coin into the margin manager. The coin must be of the same type as either the base, quote, or DEEP.
public fun deposit<BaseAsset, QuoteAsset, DepositAsset>(
self: &mut MarginManager<BaseAsset, QuoteAsset>,
registry: &MarginRegistry,
base_oracle: &PriceInfoObject,
quote_oracle: &PriceInfoObject,
coin: Coin<DepositAsset>,
clock: &Clock,
ctx: &mut TxContext,
) {
registry.load_inner();
self.validate_owner(ctx);

    let deposit_amount = coin.value();
    self.deposit_int<BaseAsset, QuoteAsset, DepositAsset>(coin, ctx);

    let deposit_asset_type = type_name::with_defining_ids<DepositAsset>();
    let deposit_base_asset = deposit_asset_type == type_name::with_defining_ids<BaseAsset>();
    let deposit_quote_asset = deposit_asset_type == type_name::with_defining_ids<QuoteAsset>();
    // We return early here, because there is no need to emit a deposit collateral event if neither the base asset
    // nor the quote asset is deposited. This handles the case for DEEP deposits, when DEEP is not part of the base
    // or quote assets.
    if (!deposit_base_asset && !deposit_quote_asset) return;

    let (pyth_price, pyth_decimals) = if (deposit_base_asset) {
        get_pyth_price<BaseAsset>(base_oracle, registry, clock)
    } else {
        get_pyth_price<QuoteAsset>(quote_oracle, registry, clock)
    };

    event::emit(DepositCollateralEvent {
        margin_manager_id: self.id(),
        amount: deposit_amount,
        asset: deposit_asset_type,
        pyth_price,
        pyth_decimals,
        timestamp: clock.timestamp_ms(),
    });

}

### Withdraw funds

Only the owner can withdraw funds from the `MarginManager` . Withdrawals are subject to risk ratio limits when the manager has active loans.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_manager.move
/// Withdraw a specified amount of an asset from the margin manager. The asset must be of the same type as either the base, quote, or DEEP.
/// The withdrawal is subject to the risk ratio limit.
public fun withdraw<BaseAsset, QuoteAsset, WithdrawAsset>(
self: &mut MarginManager<BaseAsset, QuoteAsset>,
registry: &MarginRegistry,
base_margin_pool: &MarginPool<BaseAsset>,
quote_margin_pool: &MarginPool<QuoteAsset>,
base_oracle: &PriceInfoObject,
quote_oracle: &PriceInfoObject,
pool: &Pool<BaseAsset, QuoteAsset>,
withdraw_amount: u64,
clock: &Clock,
ctx: &mut TxContext,
): Coin<WithdrawAsset> {
registry.load_inner();
self.validate_owner(ctx);
assert!(pool.id() == self.deepbook_pool(), EIncorrectDeepBookPool);

    let balance_manager = &mut self.balance_manager;
    let withdraw_cap = &self.withdraw_cap;

    let coin = balance_manager.withdraw_with_cap<WithdrawAsset>(
        withdraw_cap,
        withdraw_amount,
        ctx,
    );

    if (self.margin_pool_id.contains(&base_margin_pool.id())) {
        let risk_ratio = self.risk_ratio_int(
            registry,
            base_oracle,
            quote_oracle,
            pool,
            base_margin_pool,
            clock,
        );
        assert!(registry.can_withdraw(pool.id(), risk_ratio), EWithdrawRiskRatioExceeded);
    } else if (self.margin_pool_id.contains(&quote_margin_pool.id())) {
        let risk_ratio = self.risk_ratio_int(
            registry,
            base_oracle,
            quote_oracle,
            pool,
            quote_margin_pool,
            clock,
        );
        assert!(registry.can_withdraw(pool.id(), risk_ratio), EWithdrawRiskRatioExceeded);
    };

    let withdraw_asset_type = type_name::with_defining_ids<WithdrawAsset>();
    let withdraw_base_asset = withdraw_asset_type == type_name::with_defining_ids<BaseAsset>();
    let withdraw_quote_asset = withdraw_asset_type == type_name::with_defining_ids<QuoteAsset>();
    // We return early here, because there is no need to emit a withdraw collateral event if neither the base asset
    // nor the quote asset is withdrawn. This handles the case for DEEP withdrawals, when DEEP is not part of the base
    // or quote assets.
    if (!withdraw_base_asset && !withdraw_quote_asset) return coin;

    let (
        _,
        _,
        _,
        remaining_base_asset,
        remaining_quote_asset,
        remaining_base_debt,
        remaining_quote_debt,
        base_pyth_price,
        base_pyth_decimals,
        quote_pyth_price,
        quote_pyth_decimals,
        _,
        _,
        _,
    ) = self.manager_state(
        registry,
        base_oracle,
        quote_oracle,
        pool,
        base_margin_pool,
        quote_margin_pool,
        clock,
    );

    event::emit(WithdrawCollateralEvent {
        margin_manager_id: self.id(),
        amount: withdraw_amount,
        asset: withdraw_asset_type,
        withdraw_base_asset,
        remaining_base_asset,
        remaining_quote_asset,
        remaining_base_debt,
        remaining_quote_debt,
        base_pyth_price,
        base_pyth_decimals,
        quote_pyth_price,
        quote_pyth_decimals,
        timestamp: clock.timestamp_ms(),
    });

    coin

}

### Borrow assets

Borrow base or quote assets from margin pools to increase position sizes. Borrowing is subject to risk ratio limits and the margin pool must allow trading on the manager'sDeepBook pool.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_manager.move
/// Borrow the base asset using the margin manager.
public fun borrow_base<BaseAsset, QuoteAsset>(
self: &mut MarginManager<BaseAsset, QuoteAsset>,
registry: &MarginRegistry,
base_margin_pool: &mut MarginPool<BaseAsset>,
base_oracle: &PriceInfoObject,
quote_oracle: &PriceInfoObject,
pool: &Pool<BaseAsset, QuoteAsset>,
loan_amount: u64,
clock: &Clock,
ctx: &mut TxContext,
) {
registry.load_inner();
self.validate_owner(ctx);
assert!(registry.pool_enabled(pool), EPoolNotEnabledForMarginTrading);
assert!(pool.id() == self.deepbook_pool, EIncorrectDeepBookPool);
assert!(self.can_borrow(base_margin_pool), ECannotHaveLoanInMoreThanOneMarginPool);
assert!(
base_margin_pool.deepbook_pool_allowed(self.deepbook_pool),
EDeepbookPoolNotAllowedForLoan,
);
let (coin, borrowed_shares) = base_margin_pool.borrow(loan_amount, clock, ctx);
self.borrowed_base_shares = self.borrowed_base_shares + borrowed_shares;
self.margin_pool_id = option::some(base_margin_pool.id());
self.deposit_int<BaseAsset, QuoteAsset, BaseAsset>(coin, ctx);
let risk_ratio = self.risk_ratio_int(
registry,
base_oracle,
quote_oracle,
pool,
base_margin_pool,
clock,
);
assert!(registry.can_borrow(pool.id(), risk_ratio), EBorrowRiskRatioExceeded);

    event::emit(LoanBorrowedEvent {
        margin_manager_id: self.id(),
        margin_pool_id: base_margin_pool.id(),
        loan_amount,
        loan_shares: borrowed_shares,
        timestamp: clock.timestamp_ms(),
    });

}

/// Borrow the quote asset using the margin manager.
public fun borrow_quote<BaseAsset, QuoteAsset>(
self: &mut MarginManager<BaseAsset, QuoteAsset>,
registry: &MarginRegistry,
quote_margin_pool: &mut MarginPool<QuoteAsset>,
base_oracle: &PriceInfoObject,
quote_oracle: &PriceInfoObject,
pool: &Pool<BaseAsset, QuoteAsset>,
loan_amount: u64,
clock: &Clock,
ctx: &mut TxContext,
) {
registry.load_inner();
self.validate_owner(ctx);
assert!(registry.pool_enabled(pool), EPoolNotEnabledForMarginTrading);
assert!(pool.id() == self.deepbook_pool, EIncorrectDeepBookPool);
assert!(self.can_borrow(quote_margin_pool), ECannotHaveLoanInMoreThanOneMarginPool);
assert!(
quote_margin_pool.deepbook_pool_allowed(self.deepbook_pool),
EDeepbookPoolNotAllowedForLoan,
);
let (coin, borrowed_shares) = quote_margin_pool.borrow(loan_amount, clock, ctx);
self.borrowed_quote_shares = self.borrowed_quote_shares + borrowed_shares;
self.margin_pool_id = option::some(quote_margin_pool.id());
self.deposit_int<BaseAsset, QuoteAsset, QuoteAsset>(coin, ctx);
let risk_ratio = self.risk_ratio_int(
registry,
base_oracle,
quote_oracle,
pool,
quote_margin_pool,
clock,
);
assert!(registry.can_borrow(pool.id(), risk_ratio), EBorrowRiskRatioExceeded);

    event::emit(LoanBorrowedEvent {
        margin_manager_id: self.id(),
        margin_pool_id: quote_margin_pool.id(),
        loan_amount,
        loan_shares: borrowed_shares,
        timestamp: clock.timestamp_ms(),
    });

}

### Repay loans

Repay borrowed assets to reduce debt. You can specify an exact amount or repay all available balance up to the total debt.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_manager.move
/// Repay the base asset loan using the margin manager.
/// Returns the total amount repaid
public fun repay_base<BaseAsset, QuoteAsset>(
self: &mut MarginManager<BaseAsset, QuoteAsset>,
registry: &MarginRegistry,
margin_pool: &mut MarginPool<BaseAsset>,
amount: Option<u64>,
clock: &Clock,
ctx: &mut TxContext,
): u64 {
registry.load_inner();
self.validate_owner(ctx);
assert!(self.margin_pool_id.contains(&margin_pool.id()), EIncorrectMarginPool);

    self.repay<BaseAsset, QuoteAsset, BaseAsset>(
        margin_pool,
        amount,
        clock,
        ctx,
    )

}

/// Repay the quote asset loan using the margin manager.
/// Returns the total amount repaid
public fun repay_quote<BaseAsset, QuoteAsset>(
self: &mut MarginManager<BaseAsset, QuoteAsset>,
registry: &MarginRegistry,
margin_pool: &mut MarginPool<QuoteAsset>,
amount: Option<u64>,
clock: &Clock,
ctx: &mut TxContext,
): u64 {
registry.load_inner();
self.validate_owner(ctx);
assert!(self.margin_pool_id.contains(&margin_pool.id()), EIncorrectMarginPool);

    self.repay<BaseAsset, QuoteAsset, QuoteAsset>(
        margin_pool,
        amount,
        clock,
        ctx,
    )

}

### Liquidate position

Liquidate an undercollateralized margin manager. The liquidator provides repayment and receives collateral assets plus a liquidation reward. The margin pool might also receive a reward or incur bad debt depending on the position's health.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_manager.move
// === Public Functions - Liquidation - Receive Assets After Liquidation ===
public fun liquidate<BaseAsset, QuoteAsset, DebtAsset>(
self: &mut MarginManager<BaseAsset, QuoteAsset>,
registry: &MarginRegistry,
base_oracle: &PriceInfoObject,
quote_oracle: &PriceInfoObject,
margin_pool: &mut MarginPool<DebtAsset>,
pool: &mut Pool<BaseAsset, QuoteAsset>,
mut repay_coin: Coin<DebtAsset>,
clock: &Clock,
ctx: &mut TxContext,
): (Coin<BaseAsset>, Coin<QuoteAsset>, Coin<DebtAsset>) {
// 1. Check that we can liquidate, cancel all open orders.
assert!(self.deepbook_pool == pool.id(), EIncorrectDeepBookPool);
assert!(self.margin_pool_id.contains(&margin_pool.id()), EIncorrectMarginPool);
let risk_ratio = self.risk_ratio_int(
registry,
base_oracle,
quote_oracle,
pool,
margin_pool,
clock,
);
assert!(registry.can_liquidate(pool.id(), risk_ratio), ECannotLiquidate);
assert!(repay_coin.value() >= margin_constants::min_liquidation_repay(), ERepayAmountTooLow);
let trade_proof = self.trade_proof(ctx);
pool.withdraw_settled_amounts(&mut self.balance_manager, &trade_proof);
pool.cancel_all_orders(&mut self.balance_manager, &trade_proof, clock, ctx);

    // 2. Calculate the maximum debt that can be repaid. The margin manager can be in three scenarios:
    // a) Assets <= Debt + user_reward: Full liquidation, repay as much debt as possible, lending pool may incur bad debt.
    // b) Debt + user_reward < Assets <= Debt + user_reward + pool_reward: There are enough assets to cover the debt, but pool may not get full rewards.
    // c) Debt + user_reward + pool_reward < Assets: There are enough assets to cover everything. We may not need to liquidate the full position.
    let borrowed_shares = self.borrowed_base_shares.max(self.borrowed_quote_shares);
    let debt = margin_pool.borrow_shares_to_amount(borrowed_shares, clock); // 350 USDC debt
    let debt_is_base =
        type_name::with_defining_ids<DebtAsset>() == type_name::with_defining_ids<BaseAsset>();
    let (assets_in_debt_unit, base_asset, quote_asset) = self.assets_in_debt_unit(
        registry,
        pool,
        base_oracle,
        quote_oracle,
        clock,
    ); // SUI/USDC pool. We have 90 SUI and 40 USDC, 350 USDC debt. This should be 400 USDC. (assume 1 SUI = 4 USDC)

    let liquidation_reward_with_user_pool =
        constants::float_scaling() + registry.user_liquidation_reward(pool.id()) + registry.pool_liquidation_reward(pool.id()); // 1.05

    let target_ratio = registry.target_liquidation_risk_ratio(pool.id()); // 1.25
    let numerator = math::mul(target_ratio, debt) - assets_in_debt_unit; // 1.25 * 350 - 400 = 437.5 - 400 = 37.5
    let denominator = target_ratio - liquidation_reward_with_user_pool; // 1.25 - 1.05 = 0.2
    let debt_repay = math::div(numerator, denominator); // 37.5 / 0.2 = 187.5
    // We have to pay the minimum between our current debt and the debt required to reach the target ratio.
    // In other words, if our assets are low, we pay off all debt (full liquidation)
    // if our assets are high, we pay off some of the debt (partial liquidation)
    let debt_repay = debt_repay.min(debt); // 187.5
    let debt_with_reward = math::mul(debt_repay, liquidation_reward_with_user_pool); // 187.5 * 1.05 = 196.875
    let debt_can_repay_with_rewards = debt_with_reward.min(assets_in_debt_unit); // 196.875
    let max_repay = math::div(debt_can_repay_with_rewards, liquidation_reward_with_user_pool); // 196.875 / 1.05 = 187.5
    let liquidation_reward_with_pool =
        constants::float_scaling() + registry.pool_liquidation_reward(pool.id()); // 1.03 (assume 3% pool reward, 2% user reward)

    let input_coin_without_pool_reward = math::div(
        repay_coin.value(),
        liquidation_reward_with_pool,
    ); // 100 / 1.03 = 97.087
    let repay_amount = max_repay.min(input_coin_without_pool_reward); // 97.087
    let repay_amount_with_pool_reward = math::mul(repay_amount, liquidation_reward_with_pool); // 97.087 * 1.03 = 100

    // If assets are insufficient to cover full debt + reward, the manager's collateral is
    // fully withdrawn at `max_repay`. Clear every borrow share so the shortfall is recorded
    // as `pool_default` rather than left as silent residual debt on an empty manager.
    let assets_exhausted = assets_in_debt_unit <= debt_with_reward;
    let repay_shares = if (assets_exhausted && repay_amount == max_repay) {
        borrowed_shares
    } else {
        math::mul(
            borrowed_shares,
            math::div(repay_amount, debt),
        )
    }; // Assume index 2, so borrowed_shares = 350/2 = 175. 97.087 / 350 = 0.2774 * 175 = 48.545 shares being repaid (97.087 USDC is repayment)
    assert!(repay_shares > 0, ERepaySharesTooLow);
    let (debt_repaid, pool_reward, pool_default) = margin_pool.repay_liquidation(
        repay_shares,
        repay_coin.split(repay_amount_with_pool_reward, ctx),
        clock,
    );
    // 97.087 debt repaid, pool reward is 100 - 97.087 = 2.913 (3%), pool_default is 0
    // We only default if this is a full liquidation

    if (debt_is_base) {
        self.borrowed_base_shares = self.borrowed_base_shares - repay_shares;
    } else {
        self.borrowed_quote_shares = self.borrowed_quote_shares - repay_shares;
    };

    // Clear margin_pool_id if fully liquidated
    if (self.borrowed_base_shares == 0 && self.borrowed_quote_shares == 0) {
        self.margin_pool_id = option::none();
    };

    // repay_amount * 1.05 is what the user should receive back, since the user provided both the repayment and pool reward
    // user should receive as much assets possible in the debt asset first, then the collateral asset

    let mut out_amount = math::mul(repay_amount, liquidation_reward_with_user_pool); // 97.087 * 1.05 = 101.941

    let (base_coin, quote_coin) = if (debt_is_base) {
        let base_out = out_amount.min(base_asset);
        out_amount = out_amount - base_out;
        let max_quote_out = calculate_target_currency<BaseAsset, QuoteAsset>(
            registry,
            base_oracle,
            quote_oracle,
            out_amount,
            clock,
        );
        let quote_out = max_quote_out.min(quote_asset);
        let base_coin = self.liquidation_withdraw(
            base_out,
            ctx,
        );
        let quote_coin = self.liquidation_withdraw(
            quote_out,
            ctx,
        );
        (base_coin, quote_coin)
    } else {
        let quote_out = out_amount.min(quote_asset);
        out_amount = out_amount - quote_out; // 101.941 - 40 = 61.941
        let max_base_out = calculate_target_currency<QuoteAsset, BaseAsset>(
            registry,
            quote_oracle,
            base_oracle,
            out_amount,
            clock,
        );
        let base_out = max_base_out.min(base_asset);
        let base_coin = self.liquidation_withdraw(
            base_out,
            ctx,
        );
        let quote_coin = self.liquidation_withdraw(
            quote_out,
            ctx,
        );
        (base_coin, quote_coin)
    };
    // We have 40 USDC which is used first in the second loop. Then SUI to reach the total of 101.941 USDC.

    let (remaining_base_asset, remaining_quote_asset) = self.calculate_assets(pool);
    let (remaining_base_debt, remaining_quote_debt) = if (self.margin_pool_id.is_some()) {
        self.calculate_debts(margin_pool, clock)
    } else {
        (0, 0)
    };
    let (base_pyth_price, base_pyth_decimals) = get_pyth_price<BaseAsset>(
        base_oracle,
        registry,
        clock,
    );
    let (quote_pyth_price, quote_pyth_decimals) = get_pyth_price<QuoteAsset>(
        quote_oracle,
        registry,
        clock,
    );

    event::emit(LiquidationEvent {
        margin_manager_id: self.id(),
        margin_pool_id: margin_pool.id(),
        liquidation_amount: debt_repaid,
        pool_reward,
        pool_default,
        risk_ratio,
        remaining_base_asset,
        remaining_quote_asset,
        remaining_base_debt,
        remaining_quote_debt,
        base_pyth_price,
        base_pyth_decimals,
        quote_pyth_price,
        quote_pyth_decimals,
        timestamp: clock.timestamp_ms(),
    });

    (base_coin, quote_coin, repay_coin)

}

### Calculate risk ratio

Returns the risk ratio of the margin manager, which represents the ratio of assets to debt. Higher ratios indicate healthier positions.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_manager.move
// Returns the risk ratio of the margin manager given the corresponding margin pools.
public fun risk_ratio<BaseAsset, QuoteAsset>(
self: &MarginManager<BaseAsset, QuoteAsset>,
registry: &MarginRegistry,
base_oracle: &PriceInfoObject,
quote_oracle: &PriceInfoObject,
pool: &Pool<BaseAsset, QuoteAsset>,
base_margin_pool: &MarginPool<BaseAsset>,
quote_margin_pool: &MarginPool<QuoteAsset>,
clock: &Clock,
): u64 {
let debt_is_base = self.borrowed_base_shares > 0;
if (debt_is_base) {
self.risk_ratio_int(
registry,
base_oracle,
quote_oracle,
pool,
base_margin_pool,
clock,
)
} else {
self.risk_ratio_int(
registry,
base_oracle,
quote_oracle,
pool,
quote_margin_pool,
clock,
)
}
}

### Read endpoints

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_manager.move
// === Public Functions - Read Only ===
public fun balance_manager<BaseAsset, QuoteAsset>(
self: &MarginManager<BaseAsset, QuoteAsset>,
): &BalanceManager {
&self.balance_manager
}

/// Returns (base*asset, quote_asset) for margin manager.
public fun calculate_assets<BaseAsset, QuoteAsset>(
self: &MarginManager<BaseAsset, QuoteAsset>,
pool: &Pool<BaseAsset, QuoteAsset>,
): (u64, u64) {
let balance_manager = self.balance_manager();
let (mut base, mut quote, *) = pool.locked_balance(balance_manager);
base = base + balance_manager.balance<BaseAsset>();
quote = quote + balance_manager.balance<QuoteAsset>();

    (base, quote)

}
public fun calculate_debts<BaseAsset, QuoteAsset, DebtAsset>(
self: &MarginManager<BaseAsset, QuoteAsset>,
margin_pool: &MarginPool<DebtAsset>,
clock: &Clock,
): (u64, u64) {
let margin_pool_id = margin_pool.id();
assert!(self.margin_pool_id.contains(&margin_pool_id), EIncorrectMarginPool);

    let debt_is_base = self.has_base_debt();
    let debt_shares = if (debt_is_base) {
        self.borrowed_base_shares
    } else {
        self.borrowed_quote_shares
    };

    let base_debt = if (debt_is_base) {
        assert!(
            type_name::with_defining_ids<DebtAsset>() == type_name::with_defining_ids<BaseAsset>(),
            EInvalidDebtAsset,
        );
        margin_pool.borrow_shares_to_amount(debt_shares, clock)
    } else {
        0
    };
    let quote_debt = if (debt_is_base) {
        0
    } else {
        assert!(
            type_name::with_defining_ids<DebtAsset>() == type_name::with_defining_ids<QuoteAsset>(),
            EInvalidDebtAsset,
        );
        margin_pool.borrow_shares_to_amount(debt_shares, clock)
    };

    (base_debt, quote_debt)

}
public fun owner<BaseAsset, QuoteAsset>(self: &MarginManager<BaseAsset, QuoteAsset>): address {
self.owner
}
public fun deepbook_pool<BaseAsset, QuoteAsset>(self: &MarginManager<BaseAsset, QuoteAsset>): ID {
self.deepbook_pool
}
public fun margin_pool_id<BaseAsset, QuoteAsset>(
self: &MarginManager<BaseAsset, QuoteAsset>,
): Option<ID> {
self.margin_pool_id
}
public fun borrowed_shares<BaseAsset, QuoteAsset>(
self: &MarginManager<BaseAsset, QuoteAsset>,
): (u64, u64) {
(self.borrowed_base_shares, self.borrowed_quote_shares)
}
public fun borrowed_base_shares<BaseAsset, QuoteAsset>(
self: &MarginManager<BaseAsset, QuoteAsset>,
): u64 {
self.borrowed_base_shares
}
public fun borrowed_quote_shares<BaseAsset, QuoteAsset>(
self: &MarginManager<BaseAsset, QuoteAsset>,
): u64 {
self.borrowed_quote_shares
}
public fun has_base_debt<BaseAsset, QuoteAsset>(self: &MarginManager<BaseAsset, QuoteAsset>): bool {
self.borrowed_base_shares > 0
}

## Events

### `MarginManagerCreatedEvent`

Emitted when a new margin manager is created.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_manager.move
// === Events ===
/// Event emitted when a new margin manager is created.
public struct MarginManagerCreatedEvent has copy, drop {
margin_manager_id: ID,
balance_manager_id: ID,
deepbook_pool_id: ID,
owner: address,
timestamp: u64,
}

### `DepositCollateralEvent`

Emitted when collateral is deposited into a margin manager.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_manager.move
/// Event emitted when user deposits collateral asset (either base or quote) into margin manager
public struct DepositCollateralEvent has copy, drop {
margin_manager_id: ID,
amount: u64,
asset: TypeName,
pyth_price: u64,
pyth_decimals: u8,
timestamp: u64,
}

### `WithdrawCollateralEvent`

Emitted when collateral is withdrawn from a margin manager.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_manager.move
/// Event emitted when user withdraws collateral asset (either base or quote) from margin manager
public struct WithdrawCollateralEvent has copy, drop {
margin_manager_id: ID,
amount: u64,
asset: TypeName,
withdraw_base_asset: bool,
remaining_base_asset: u64,
remaining_quote_asset: u64,
remaining_base_debt: u64,
remaining_quote_debt: u64,
base_pyth_price: u64,
base_pyth_decimals: u8,
quote_pyth_price: u64,
quote_pyth_decimals: u8,
timestamp: u64,
}

### `LoanBorrowedEvent`

Emitted when assets are borrowed from a margin pool.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_manager.move
/// Event emitted when loan is borrowed
public struct LoanBorrowedEvent has copy, drop {
margin_manager_id: ID,
margin_pool_id: ID,
loan_amount: u64,
loan_shares: u64,
timestamp: u64,
}

### `LoanRepaidEvent`

Emitted when borrowed assets are repaid.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_manager.move
/// Event emitted when loan is repaid
public struct LoanRepaidEvent has copy, drop {
margin_manager_id: ID,
margin_pool_id: ID,
repay_amount: u64,
repay_shares: u64,
timestamp: u64,
}

### `LiquidationEvent`

Emitted when a margin manager is liquidated.
github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_manager.move
/// Event emitted when margin manager is liquidated
public struct LiquidationEvent has copy, drop {
margin_manager_id: ID,
margin_pool_id: ID,
liquidation_amount: u64,
pool_reward: u64,
pool_default: u64,
risk_ratio: u64,
remaining_base_asset: u64,
remaining_quote_asset: u64,
remaining_base_debt: u64,
remaining_quote_debt: u64,
base_pyth_price: u64,
base_pyth_decimals: u8,
quote_pyth_price: u64,
quote_pyth_decimals: u8,
timestamp: u64,
}

# Margin Pool

URL: https://docs.sui.io/onchain-finance/deepbook-margin/contract-information/margin-pool

The `MarginPool` is a sharedobject **Object** The basic unit of storage on Sui. that manages liquidity for a specific asset, enabling lenders to supply assets and margin traders to borrow them. Each margin pool tracks supply and borrow positions, accrues interest over time, and enforces risk parameters to maintain system health.

Margin pools use a shares-based accounting system where suppliers receive shares representing their proportion of the total supply. Interest accrues continuously, increasing the value of these shares over time. Borrowers can only borrow from pools that have enabled their specificDeepBook **DeepBook** A decentralized central limit order book (CLOB) built on Sui. trading pool.

## API

Following are the different public functions that the `MarginPool` exposes.

### Mint a `SupplierCap`

Create a new `SupplierCap` that can be used to supply and withdraw from margin pools. One `SupplierCap` can be used across multiple margin pools.

github.com/MystenLabs/deepbookv3/packages/deepbook*margin/sources/margin_pool.move
// === Public Functions * LENDING \_ ===
/// Mint a new SupplierCap, which is used to supply and withdraw from margin pools.
/// One SupplierCap can be used to supply and withdraw from multiple margin pools.
public fun mint_supplier_cap(
registry: &MarginRegistry,
clock: &Clock,
ctx: &mut TxContext,
): SupplierCap {
registry.load_inner();
let id = object::new(ctx);

    event::emit(SupplierCapMinted {
        supplier_cap_id: id.to_inner(),
        timestamp: clock.timestamp_ms(),
    });

    SupplierCap { id }

}

### Supply liquidity

Supply assets to the margin pool to earn interest. Returns the total supply shares owned by the supplier after this operation.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_pool.move
/// Supply to the margin pool using a SupplierCap. Returns the new supply shares.
/// The `referral` parameter should be the ID of a SupplyReferral object if referral tracking is desired.
public fun supply<Asset>(
self: &mut MarginPool<Asset>,
registry: &MarginRegistry,
supplier_cap: &SupplierCap,
coin: Coin<Asset>,
referral: Option<ID>,
clock: &Clock,
): u64 {
registry.load_inner();
let margin_pool_id = self.id();
let supplier_cap_id = supplier_cap.id.to_inner();
let supply_amount = coin.value();
let (supply_shares, protocol_fees) = self
.state
.increase_supply(&self.config, supply_amount, clock);
self.protocol_fees.increase_fees_accrued(margin_pool_id, protocol_fees);

    let (total_user_supply_shares, previous_referral) = self
        .positions
        .increase_user_supply(supplier_cap_id, referral, supply_shares);

    self.protocol_fees.decrease_shares(previous_referral, total_user_supply_shares - supply_shares);
    self.protocol_fees.increase_shares(referral, total_user_supply_shares);

    let balance = coin.into_balance();
    self.vault.join(balance);
    self.rate_limiter.record_deposit(supply_amount, clock);

    assert!(self.state.total_supply() <= self.config.supply_cap(), ESupplyCapExceeded);

    event::emit(AssetSupplied {
        margin_pool_id: self.id(),
        asset_type: type_name::with_defining_ids<Asset>(),
        supplier_cap_id,
        supply_amount,
        supply_shares,
        timestamp: clock.timestamp_ms(),
    });

    total_user_supply_shares

}

### Withdraw liquidity

Withdraw supplied assets from the margin pool. You can specify an exact amount or withdraw all available shares.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_pool.move
/// Withdraw from the margin pool using a SupplierCap. Returns the withdrawn coin.
public fun withdraw<Asset>(
self: &mut MarginPool<Asset>,
registry: &MarginRegistry,
supplier_cap: &SupplierCap,
amount: Option<u64>,
clock: &Clock,
ctx: &mut TxContext,
): Coin<Asset> {
registry.load_inner();
let margin_pool_id = self.id();
let supplier_cap_id = supplier_cap.id.to_inner();
let supplied_shares = self.positions.user_supply_shares(supplier_cap_id);
let supplied_amount = self.state.supply_shares_to_amount(supplied_shares, &self.config, clock);
let withdraw_amount = amount.destroy_with_default(supplied_amount);
let withdraw_shares = math::mul_round_up(
supplied_shares,
math::div_round_up(withdraw_amount, supplied_amount),
);
assert!(
self.rate_limiter.check_and_record_withdrawal(withdraw_amount, clock),
ERateLimitExceeded,
);

    let (_, protocol_fees) = self
        .state
        .decrease_supply_shares(&self.config, withdraw_shares, clock);
    self.protocol_fees.increase_fees_accrued(margin_pool_id, protocol_fees);

    let (_, previous_referral) = self
        .positions
        .decrease_user_supply(supplier_cap_id, withdraw_shares);

    self.protocol_fees.decrease_shares(previous_referral, withdraw_shares);
    assert!(withdraw_amount <= self.vault.value(), ENotEnoughAssetInPool);
    let coin = self.vault.split(withdraw_amount).into_coin(ctx);

    event::emit(AssetWithdrawn {
        margin_pool_id: self.id(),
        asset_type: type_name::with_defining_ids<Asset>(),
        supplier_cap_id,
        withdraw_amount,
        withdraw_shares,
        timestamp: clock.timestamp_ms(),
    });

    coin

}

### Read endpoints

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_pool.move
// === Public-View Functions ===
/// Return the ID of the margin pool.
public fun id<Asset>(self: &MarginPool<Asset>): ID {
self.id.to_inner()
}

/// Return whether a margin manager for a given deepbook pool is allowed to borrow from the margin pool.
public fun deepbook_pool_allowed<Asset>(self: &MarginPool<Asset>, deepbook_pool_id: ID): bool {
self.allowed_deepbook_pools.contains(&deepbook_pool_id)
}

/// Return the current total supply of the margin pool.
public fun total_supply<Asset>(self: &MarginPool<Asset>): u64 {
self.state.total_supply()
}

/// Return the current total supply shares of the margin pool.
public fun supply_shares<Asset>(self: &MarginPool<Asset>): u64 {
self.state.supply_shares()
}

/// Return the current total borrow of the margin pool.
public fun total_borrow<Asset>(self: &MarginPool<Asset>): u64 {
self.state.total_borrow()
}

/// Return the current total borrow shares of the margin pool.
public fun borrow_shares<Asset>(self: &MarginPool<Asset>): u64 {
self.state.borrow_shares()
}

/// Return the last update timestamp of the margin pool.
public fun last_update_timestamp<Asset>(self: &MarginPool<Asset>): u64 {
self.state.last_update_timestamp()
}

/// Return the supply cap of the margin pool.
public fun supply_cap<Asset>(self: &MarginPool<Asset>): u64 {
self.config.supply_cap()
}

/// Return the current protocol fees of the margin pool.
public fun protocol_fees<Asset>(self: &MarginPool<Asset>): &ProtocolFees {
&self.protocol_fees
}

/// Return the current max utilization rate of the margin pool.
public fun max_utilization_rate<Asset>(self: &MarginPool<Asset>): u64 {
self.config.max_utilization_rate()
}

/// Return the current protocol spread of the margin pool.
public fun protocol_spread<Asset>(self: &MarginPool<Asset>): u64 {
self.config.protocol_spread()
}

/// Return the current min borrow of the margin pool.
public fun min_borrow<Asset>(self: &MarginPool<Asset>): u64 {
self.config.min_borrow()
}

/// Return the current interest rate of the margin pool. Represented in 9 decimal places.
public fun interest_rate<Asset>(self: &MarginPool<Asset>): u64 {
self.config.interest_rate(self.state.utilization_rate())
}

/// Return the current user supply shares of the margin pool.
public fun user_supply_shares<Asset>(self: &MarginPool<Asset>, supplier_cap_id: ID): u64 {
self.positions.user_supply_shares(supplier_cap_id)
}

/// Return the current user supply amount of the margin pool.
public fun user_supply_amount<Asset>(
self: &MarginPool<Asset>,
supplier_cap_id: ID,
clock: &Clock,
): u64 {
self
.state
.supply_shares_to_amount(self.user_supply_shares(supplier_cap_id), &self.config, clock)
}

## Events

### `MarginPoolCreated`

Emitted when a new margin pool is created.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_pool.move
// === Events ===
public struct MarginPoolCreated has copy, drop {
margin_pool_id: ID,
maintainer_cap_id: ID,
asset_type: TypeName,
config: ProtocolConfig,
timestamp: u64,
}

### `DeepbookPoolUpdated`

Emitted when aDeepBook pool is enabled or disabled for lending.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_pool.move
public struct DeepbookPoolUpdated has copy, drop {
margin_pool_id: ID,
deepbook_pool_id: ID,
pool_cap_id: ID,
enabled: bool,
timestamp: u64,
}

### `InterestParamsUpdated`

Emitted when interest rate parameters are updated.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_pool.move
public struct InterestParamsUpdated has copy, drop {
margin_pool_id: ID,
pool_cap_id: ID,
interest_config: InterestConfig,
timestamp: u64,
}

### `MarginPoolConfigUpdated`

Emitted when margin pool configuration is updated.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_pool.move
public struct MarginPoolConfigUpdated has copy, drop {
margin_pool_id: ID,
pool_cap_id: ID,
margin_pool_config: MarginPoolConfig,
timestamp: u64,
}

### `SupplierCapMinted`

Emitted when a new supplier cap is minted.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_pool.move
public struct SupplierCapMinted has copy, drop {
supplier_cap_id: ID,
timestamp: u64,
}

### `AssetSupplied`

Emitted when assets are supplied to a margin pool.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_pool.move
public struct AssetSupplied has copy, drop {
margin_pool_id: ID,
asset_type: TypeName,
supplier_cap_id: ID,
supply_amount: u64,
supply_shares: u64,
timestamp: u64,
}

### `AssetWithdrawn`

Emitted when assets are withdrawn from a margin pool.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_pool.move
public struct AssetWithdrawn has copy, drop {
margin_pool_id: ID,
asset_type: TypeName,
supplier_cap_id: ID,
withdraw_amount: u64,
withdraw_shares: u64,
timestamp: u64,
}

### `MaintainerFeesWithdrawn`

Emitted when maintainer fees are withdrawn.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_pool.move
public struct MaintainerFeesWithdrawn has copy, drop {
margin_pool_id: ID,
margin_pool_cap_id: ID,
maintainer_fees: u64,
timestamp: u64,
}

### `ProtocolFeesWithdrawn`

Emitted when protocol fees are withdrawn.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_pool.move
public struct ProtocolFeesWithdrawn has copy, drop {
margin_pool_id: ID,
protocol_fees: u64,
timestamp: u64,
}

# `ProtocolFeesIncreased`

Emitted when protocol fees are accrued from interest payments.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_pool/protocol_fees.move
public struct ProtocolFeesIncreasedEvent has copy, drop {
margin_pool_id: ID,
total_shares: u64,
referral_fees: u64,
maintainer_fees: u64,
protocol_fees: u64,
}

# Orders

URL: https://docs.sui.io/onchain-finance/deepbook-margin/contract-information/orders

The `pool_proxy`module **Module** A component of a Move package that defines interaction with on-chain objects. provides wrapper functions for trading with margin managers. These functions enable placing orders, modifying and canceling them, and managing staking and governance participation through a margin manager. All trading operations require the margin manager to be associated with the correctDeepBook **DeepBook** A decentralized central limit order book (CLOB) built on Sui. pool.

## API

Following are the different public functions for managing orders with margin managers.

### Place orders

Place limit and market orders through a margin manager. Orders can only be placed if margin trading is enabled for the pool.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/pool_proxy.move
// === Public Proxy Functions - Trading (v1 — DEPRECATED) ===
//
// The v1 trading entries below preserve their on-chain signatures so the v5
// package upgrade type-checks against existing dependents, but every body is
// replaced with `abort EDeprecatedUseV2`. Callers must migrate to the `_v2`
// variants further down, which add a post-trade `risk_ratio` invariant that
// prevents an order placement from leaving the manager in a state borrowing
// would already be forbidden from.

/// DEPRECATED. Use `place_limit_order_v2`.
public fun place_limit_order<BaseAsset, QuoteAsset>(
\_registry: &MarginRegistry,
\_margin_manager: &mut MarginManager<BaseAsset, QuoteAsset>,
\_pool: &mut Pool<BaseAsset, QuoteAsset>,
\_client_order_id: u64,
\_order_type: u8,
\_self_matching_option: u8,
\_price: u64,
\_quantity: u64,
\_is_bid: bool,
\_pay_with_deep: bool,
\_expire_timestamp: u64,
\_clock: &Clock,
\_ctx: &TxContext,
): OrderInfo {
abort EDeprecatedUseV2
}

/// DEPRECATED. Use `place_market_order_v2`.
public fun place_market_order<BaseAsset, QuoteAsset>(
\_registry: &MarginRegistry,
\_margin_manager: &mut MarginManager<BaseAsset, QuoteAsset>,
\_pool: &mut Pool<BaseAsset, QuoteAsset>,
\_client_order_id: u64,
\_self_matching_option: u8,
\_quantity: u64,
\_is_bid: bool,
\_pay_with_deep: bool,
\_clock: &Clock,
\_ctx: &TxContext,
): OrderInfo {
abort EDeprecatedUseV2
}

### Place reduce-only orders

Place reduce-only orders that can only decrease your debt position. These orders are useful when margin trading is disabled and you need to close existing positions.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/pool_proxy.move
/// DEPRECATED. Use `place_reduce_only_limit_order_v2`.
public fun place_reduce_only_limit_order<BaseAsset, QuoteAsset, DebtAsset>(
\_registry: &MarginRegistry,
\_margin_manager: &mut MarginManager<BaseAsset, QuoteAsset>,
\_pool: &mut Pool<BaseAsset, QuoteAsset>,
\_margin_pool: &MarginPool<DebtAsset>,
\_client_order_id: u64,
\_order_type: u8,
\_self_matching_option: u8,
\_price: u64,
\_quantity: u64,
\_is_bid: bool,
\_pay_with_deep: bool,
\_expire_timestamp: u64,
\_clock: &Clock,
\_ctx: &TxContext,
): OrderInfo {
abort EDeprecatedUseV2
}

/// DEPRECATED. Use `place_reduce_only_market_order_v2`.
public fun place_reduce_only_market_order<BaseAsset, QuoteAsset, DebtAsset>(
\_registry: &MarginRegistry,
\_margin_manager: &mut MarginManager<BaseAsset, QuoteAsset>,
\_pool: &mut Pool<BaseAsset, QuoteAsset>,
\_margin_pool: &MarginPool<DebtAsset>,
\_client_order_id: u64,
\_self_matching_option: u8,
\_quantity: u64,
\_is_bid: bool,
\_pay_with_deep: bool,
\_clock: &Clock,
\_ctx: &TxContext,
): OrderInfo {
abort EDeprecatedUseV2
}

### Modify order

Modify an existing order by changing its quantity.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/pool_proxy.move
/// Modifies an order
public fun modify_order<BaseAsset, QuoteAsset>(
registry: &MarginRegistry,
margin_manager: &mut MarginManager<BaseAsset, QuoteAsset>,
pool: &mut Pool<BaseAsset, QuoteAsset>,
order_id: u128,
new_quantity: u64,
clock: &Clock,
ctx: &TxContext,
) {
registry.load_inner();
assert!(margin_manager.deepbook_pool() == pool.id(), EIncorrectDeepBookPool);
let trade_proof = margin_manager.trade_proof(ctx);
let balance_manager = margin_manager.balance_manager_trading_mut(ctx);

    pool.modify_order(
        balance_manager,
        &trade_proof,
        order_id,
        new_quantity,
        clock,
        ctx,
    )

}

### Cancel orders

Cancel one, multiple, or all orders for the margin manager.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/pool_proxy.move
/// Cancels an order
public fun cancel_order<BaseAsset, QuoteAsset>(
registry: &MarginRegistry,
margin_manager: &mut MarginManager<BaseAsset, QuoteAsset>,
pool: &mut Pool<BaseAsset, QuoteAsset>,
order_id: u128,
clock: &Clock,
ctx: &TxContext,
) {
registry.load_inner();
assert!(margin_manager.deepbook_pool() == pool.id(), EIncorrectDeepBookPool);
let trade_proof = margin_manager.trade_proof(ctx);
let balance_manager = margin_manager.balance_manager_trading_mut(ctx);

    pool.cancel_order(
        balance_manager,
        &trade_proof,
        order_id,
        clock,
        ctx,
    );

}

/// Cancel multiple orders within a vector.
public fun cancel_orders<BaseAsset, QuoteAsset>(
registry: &MarginRegistry,
margin_manager: &mut MarginManager<BaseAsset, QuoteAsset>,
pool: &mut Pool<BaseAsset, QuoteAsset>,
order_ids: vector<u128>,
clock: &Clock,
ctx: &TxContext,
) {
registry.load_inner();
assert!(margin_manager.deepbook_pool() == pool.id(), EIncorrectDeepBookPool);
let trade_proof = margin_manager.trade_proof(ctx);
let balance_manager = margin_manager.balance_manager_trading_mut(ctx);

    pool.cancel_orders(
        balance_manager,
        &trade_proof,
        order_ids,
        clock,
        ctx,
    );

}

/// Cancels all orders for the given account.
public fun cancel_all_orders<BaseAsset, QuoteAsset>(
registry: &MarginRegistry,
margin_manager: &mut MarginManager<BaseAsset, QuoteAsset>,
pool: &mut Pool<BaseAsset, QuoteAsset>,
clock: &Clock,
ctx: &TxContext,
) {
registry.load_inner();
assert!(margin_manager.deepbook_pool() == pool.id(), EIncorrectDeepBookPool);
let trade_proof = margin_manager.trade_proof(ctx);
let balance_manager = margin_manager.balance_manager_trading_mut(ctx);

    pool.cancel_all_orders(
        balance_manager,
        &trade_proof,
        clock,
        ctx,
    );

}

### Withdraw settled amounts

Withdraw settled amounts from completed trades back to the margin manager's balance manager.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/pool_proxy.move
/// Withdraw settled amounts to balance_manager.
public fun withdraw_settled_amounts<BaseAsset, QuoteAsset>(
registry: &MarginRegistry,
margin_manager: &mut MarginManager<BaseAsset, QuoteAsset>,
pool: &mut Pool<BaseAsset, QuoteAsset>,
ctx: &TxContext,
) {
registry.load_inner();
assert!(margin_manager.deepbook_pool() == pool.id(), EIncorrectDeepBookPool);
let trade_proof = margin_manager.trade_proof(ctx);
let balance_manager = margin_manager.balance_manager_trading_mut(ctx);

    pool.withdraw_settled_amounts(
        balance_manager,
        &trade_proof,
    );

}

### Staking

Stake and unstake DEEP tokens through the margin manager. Margin managers for pools with DEEP as base or quote asset cannot stake.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/pool_proxy.move
/// Stake DEEP tokens to the pool.
public fun stake<BaseAsset, QuoteAsset>(
registry: &MarginRegistry,
margin_manager: &mut MarginManager<BaseAsset, QuoteAsset>,
pool: &mut Pool<BaseAsset, QuoteAsset>,
amount: u64,
ctx: &TxContext,
) {
registry.load_inner();
assert!(margin_manager.deepbook_pool() == pool.id(), EIncorrectDeepBookPool);
let base_asset_type = type_name::with_defining_ids<BaseAsset>();
let quote_asset_type = type_name::with_defining_ids<QuoteAsset>();
let deep_asset_type = type_name::with_defining_ids<DEEP>();
assert!(
base_asset_type != deep_asset_type && quote_asset_type != deep_asset_type,
ECannotStakeWithDeepMarginManager,
);

    let trade_proof = margin_manager.trade_proof(ctx);
    let balance_manager = margin_manager.balance_manager_trading_mut(ctx);

    pool.stake(
        balance_manager,
        &trade_proof,
        amount,
        ctx,
    );

}

/// Unstake DEEP tokens from the pool.
public fun unstake<BaseAsset, QuoteAsset>(
registry: &MarginRegistry,
margin_manager: &mut MarginManager<BaseAsset, QuoteAsset>,
pool: &mut Pool<BaseAsset, QuoteAsset>,
ctx: &TxContext,
) {
registry.load_inner();
assert!(margin_manager.deepbook_pool() == pool.id(), EIncorrectDeepBookPool);
let trade_proof = margin_manager.trade_proof(ctx);
let balance_manager = margin_manager.balance_manager_trading_mut(ctx);

    pool.unstake(
        balance_manager,
        &trade_proof,
        ctx,
    );

}

### Governance

Submit proposals and vote on governance decisions through the margin manager.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/pool_proxy.move
/// Submit proposal using the margin manager.
public fun submit_proposal<BaseAsset, QuoteAsset>(
registry: &MarginRegistry,
margin_manager: &mut MarginManager<BaseAsset, QuoteAsset>,
pool: &mut Pool<BaseAsset, QuoteAsset>,
taker_fee: u64,
maker_fee: u64,
stake_required: u64,
ctx: &TxContext,
) {
registry.load_inner();
assert!(margin_manager.deepbook_pool() == pool.id(), EIncorrectDeepBookPool);
let trade_proof = margin_manager.trade_proof(ctx);
let balance_manager = margin_manager.balance_manager_trading_mut(ctx);

    pool.submit_proposal(
        balance_manager,
        &trade_proof,
        taker_fee,
        maker_fee,
        stake_required,
        ctx,
    );

}

/// Vote on a proposal using the margin manager.
public fun vote<BaseAsset, QuoteAsset>(
registry: &MarginRegistry,
margin_manager: &mut MarginManager<BaseAsset, QuoteAsset>,
pool: &mut Pool<BaseAsset, QuoteAsset>,
proposal_id: ID,
ctx: &TxContext,
) {
registry.load_inner();
assert!(margin_manager.deepbook_pool() == pool.id(), EIncorrectDeepBookPool);
let trade_proof = margin_manager.trade_proof(ctx);
let balance_manager = margin_manager.balance_manager_trading_mut(ctx);

    pool.vote(
        balance_manager,
        &trade_proof,
        proposal_id,
        ctx,
    );

}

### Claim rebates

Claim trading rebates earned through the margin manager.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/pool_proxy.move
public fun claim_rebates<BaseAsset, QuoteAsset>(
registry: &MarginRegistry,
margin_manager: &mut MarginManager<BaseAsset, QuoteAsset>,
pool: &mut Pool<BaseAsset, QuoteAsset>,
ctx: &mut TxContext,
) {
registry.load_inner();
assert!(margin_manager.deepbook_pool() == pool.id(), EIncorrectDeepBookPool);
let trade_proof = margin_manager.trade_proof(ctx);
let balance_manager = margin_manager.balance_manager_trading_mut(ctx);

    pool.claim_rebates(balance_manager, &trade_proof, ctx);

}

# Maintainer

URL: https://docs.sui.io/onchain-finance/deepbook-margin/contract-information/maintainer

The maintainermodule **Module** A component of a Move package that defines interaction with on-chain objects. provides functions for managing margin pools, configuring interest rates, and controlling whichDeepBook **DeepBook** A decentralized central limit order book (CLOB) built on Sui. pools can access margin lending. These functions are restricted to maintainers with the appropriate capabilities.

## API

Following are the different maintainer functions that the `MarginPool` exposes.

### Create a margin pool

Creates and registers a new margin pool for a specific asset. Only one margin pool can exist per asset type.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_pool.move
public fun create_margin_pool<Asset>(
registry: &mut MarginRegistry,
config: ProtocolConfig,
maintainer_cap: &MaintainerCap,
clock: &Clock,
ctx: &mut TxContext,
): ID {
let id = object::new(ctx);
let margin_pool_id = id.to_inner();
let margin_pool = MarginPool<Asset> {
id,
vault: balance::zero<Asset>(),
state: margin_state::default(clock),
config,
protocol_fees: protocol_fees::default_protocol_fees(ctx),
positions: position_manager::create_position_manager(ctx),
allowed_deepbook_pools: vec_set::empty(),
rate_limiter: rate_limiter::new(
config.rate_limit_capacity(),
config.rate_limit_refill_rate_per_ms(),
config.rate_limit_enabled(),
clock,
),
extra_fields: vec_map::empty(),
};
transfer::share_object(margin_pool);

    let asset_type = type_name::with_defining_ids<Asset>();
    registry.register_margin_pool(asset_type, margin_pool_id, maintainer_cap, ctx);

    let maintainer_cap_id = maintainer_cap.maintainer_cap_id();
    event::emit(MarginPoolCreated {
        margin_pool_id,
        maintainer_cap_id,
        asset_type,
        config,
        timestamp: clock.timestamp_ms(),
    });

    margin_pool_id

}

### Enable or disableDeepBook pools

Control whichDeepBook pools can borrow from this margin pool. Only margin managers associated with enabled pools can take loans.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_pool.move
/// Allow a margin manager tied to a deepbook pool to borrow from the margin pool.
public fun enable_deepbook_pool_for_loan<Asset>(
self: &mut MarginPool<Asset>,
registry: &MarginRegistry,
deepbook_pool_id: ID,
margin_pool_cap: &MarginPoolCap,
clock: &Clock,
) {
registry.load_inner();
assert!(margin_pool_cap.margin_pool_id() == self.id(), EInvalidMarginPoolCap);
assert!(!self.allowed_deepbook_pools.contains(&deepbook_pool_id), EDeepbookPoolAlreadyAllowed);
self.allowed_deepbook_pools.insert(deepbook_pool_id);

    event::emit(DeepbookPoolUpdated {
        margin_pool_id: self.id(),
        pool_cap_id: margin_pool_cap.pool_cap_id(),
        deepbook_pool_id,
        enabled: true,
        timestamp: clock.timestamp_ms(),
    });

}

/// Disable a margin manager tied to a deepbook pool from borrowing from the margin pool.
public fun disable_deepbook_pool_for_loan<Asset>(
self: &mut MarginPool<Asset>,
registry: &MarginRegistry,
deepbook_pool_id: ID,
margin_pool_cap: &MarginPoolCap,
clock: &Clock,
) {
registry.load_inner();
assert!(margin_pool_cap.margin_pool_id() == self.id(), EInvalidMarginPoolCap);
assert!(self.allowed_deepbook_pools.contains(&deepbook_pool_id), EDeepbookPoolNotAllowed);
self.allowed_deepbook_pools.remove(&deepbook_pool_id);

    event::emit(DeepbookPoolUpdated {
        margin_pool_id: self.id(),
        pool_cap_id: margin_pool_cap.pool_cap_id(),
        deepbook_pool_id,
        enabled: false,
        timestamp: clock.timestamp_ms(),
    });

}

### Update pool parameters

Update interest rate parameters and margin pool configuration settings.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_pool.move
/// Updates interest params for the margin pool
public fun update_interest_params<Asset>(
self: &mut MarginPool<Asset>,
registry: &MarginRegistry,
interest_config: InterestConfig,
margin_pool_cap: &MarginPoolCap,
clock: &Clock,
) {
registry.load_inner();
assert!(margin_pool_cap.margin_pool_id() == self.id(), EInvalidMarginPoolCap);
let margin_pool_id = self.id();
let protocol_fees = self.state.update(&self.config, clock);
self.protocol_fees.increase_fees_accrued(margin_pool_id, protocol_fees);
self.config.set_interest_config(interest_config);

    event::emit(InterestParamsUpdated {
        margin_pool_id,
        pool_cap_id: margin_pool_cap.pool_cap_id(),
        interest_config,
        timestamp: clock.timestamp_ms(),
    });

}

/// Updates margin pool config
public fun update_margin_pool_config<Asset>(
self: &mut MarginPool<Asset>,
registry: &MarginRegistry,
margin_pool_config: MarginPoolConfig,
margin_pool_cap: &MarginPoolCap,
clock: &Clock,
) {
registry.load_inner();
assert!(margin_pool_cap.margin_pool_id() == self.id(), EInvalidMarginPoolCap);
let margin_pool_id = self.id();
let protocol_fees = self.state.update(&self.config, clock);
self.protocol_fees.increase_fees_accrued(margin_pool_id, protocol_fees);
self.config.set_margin_pool_config(margin_pool_config);
self
.rate_limiter
.update_config(
margin_pool_config.rate_limit_capacity_from_config(),
margin_pool_config.rate_limit_refill_rate_per_ms_from_config(),
margin_pool_config.rate_limit_enabled_from_config(),
clock,
);

    event::emit(MarginPoolConfigUpdated {
        margin_pool_id: self.id(),
        pool_cap_id: margin_pool_cap.pool_cap_id(),
        margin_pool_config,
        timestamp: clock.timestamp_ms(),
    });

}

### Withdraw fees

Withdraw accumulated maintainer and protocol fees from the margin pool.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_pool.move
/// Withdraw the maintainer fees.
/// The `margin_pool_cap` parameter is used to ensure the correct margin pool is being withdrawn from.
public fun withdraw_maintainer_fees<Asset>(
self: &mut MarginPool<Asset>,
registry: &MarginRegistry,
margin_pool_cap: &MarginPoolCap,
clock: &Clock,
ctx: &mut TxContext,
): Coin<Asset> {
registry.load_inner();
assert!(margin_pool_cap.margin_pool_id() == self.id(), EInvalidMarginPoolCap);
let maintainer_fees = self.protocol_fees.claim_maintainer_fees();
let coin = self.vault.split(maintainer_fees).into_coin(ctx);

    event::emit(MaintainerFeesWithdrawn {
        margin_pool_id: self.id(),
        margin_pool_cap_id: margin_pool_cap.pool_cap_id(),
        maintainer_fees,
        timestamp: clock.timestamp_ms(),
    });

    coin

}

/// Withdraw the protocol fees.
public fun withdraw_protocol_fees<Asset>(
self: &mut MarginPool<Asset>,
registry: &MarginRegistry,
\_admin_cap: &MarginAdminCap,
clock: &Clock,
ctx: &mut TxContext,
): Coin<Asset> {
registry.load_inner();
let protocol_fees = self.protocol_fees.claim_protocol_fees();
let coin = self.vault.split(protocol_fees).into_coin(ctx);

    event::emit(ProtocolFeesWithdrawn {
        margin_pool_id: self.id(),
        protocol_fees,
        timestamp: clock.timestamp_ms(),
    });

    coin

}

/// Withdraw the default referral fees (admin only).
/// The default referral at 0x0 doesn't have a SupplyReferral object,
public fun admin_withdraw_default_referral_fees<Asset>(
self: &mut MarginPool<Asset>,
registry: &MarginRegistry,
\_admin_cap: &MarginAdminCap,
ctx: &mut TxContext,
): Coin<Asset> {
registry.load_inner();
let referral_fees = self.protocol_fees.claim_default_referral_fees();
let coin = self.vault.split(referral_fees).into_coin(ctx);

    coin

}

## Events

### `MaintainerCapUpdated`

Emitted when a maintainer capability is updated.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_registry.move
// === Events ===
public struct MaintainerCapUpdated has copy, drop {
maintainer_cap_id: ID,
allowed: bool,
timestamp: u64,
}

### `PauseCapUpdated`

Emitted when a pause capability is updated.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_registry.move
public struct PauseCapUpdated has copy, drop {
pause_cap_id: ID,
allowed: bool,
timestamp: u64,
}

### `DeepbookPoolRegistered`

Emitted when aDeepBook pool is registered in the margin registry.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_registry.move
public struct DeepbookPoolRegistered has copy, drop {
pool_id: ID,
config: PoolConfig,
timestamp: u64,
}

### `DeepbookPoolUpdatedRegistry`

Emitted when aDeepBook pool's enabled status is updated in the registry.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_registry.move
public struct DeepbookPoolUpdated has copy, drop {
pool_id: ID,
enabled: bool,
timestamp: u64,
}

### `DeepbookPoolConfigUpdated`

Emitted when aDeepBook pool's configuration is updated in the registry.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_registry.move
public struct DeepbookPoolConfigUpdated has copy, drop {
pool_id: ID,
config: PoolConfig,
timestamp: u64,
}

# Take Profit Stop Loss

URL: https://docs.sui.io/onchain-finance/deepbook-margin/contract-information/tpsl

The Take Profit Stop Loss (TPSL)module **Module** A component of a Move package that defines interaction with on-chain objects. enables conditional orders that automatically execute when certain price conditions are met. This allows traders to set up automated trading strategies that protect against losses (stop loss) or lock in profits (take profit) without requiring constant monitoring.

## How TPSL works

1. **Create a condition:** Define whether the order should trigger when the price goes above or below a specified trigger price.
2. **Create a pending order:** Specify the order details (limit or market order) that will be placed when the condition is met.
3. **Add conditional order:** Combine the condition and pending order, and add them to your margin manager.
4. **Execution:** Anyone can call the permissionless `execute_conditional_orders` function to execute orders whose conditions are met. This is typically handled by keepers or bots monitoring the market.
   Conditional orders are stored in sorted vectors for efficient execution:

- `trigger_below` : Orders that trigger when price falls below the trigger price (sorted high to low)
- `trigger_above` : Orders that trigger when price rises above the trigger price (sorted low to high)

## API

### Helper functions

Use these functions to create conditions and pending orders for conditional orders.

### Create a condition

Create a new condition that specifies when the order should trigger.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/tpsl.move
public fun new_condition(trigger_below_price: bool, trigger_price: u64): Condition {
Condition {
trigger_below_price,
trigger_price,
}
}

### Create a pending limit order

Create a pending limit order that will be placed when the condition is met. Order type must be `no_restriction` or `immediate_or_cancel` .

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/tpsl.move
public fun new_pending_limit_order(
client_order_id: u64,
order_type: u8,
self_matching_option: u8,
price: u64,
quantity: u64,
is_bid: bool,
pay_with_deep: bool,
expire_timestamp: u64,
): PendingOrder {
assert!(
order_type == constants::no_restriction() || order_type == constants::immediate_or_cancel(),
EInvalidTPSLOrderType,
);
PendingOrder {
is_limit_order: true,
client_order_id,
order_type: option::some(order_type),
self_matching_option,
price: option::some(price),
quantity,
is_bid,
pay_with_deep,
expire_timestamp: option::some(expire_timestamp),
}
}

### Create a pending market order

Create a pending market order that will be placed when the condition is met.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/tpsl.move
public fun new_pending_market_order(
client_order_id: u64,
self_matching_option: u8,
quantity: u64,
is_bid: bool,
pay_with_deep: bool,
): PendingOrder {
PendingOrder {
is_limit_order: false,
client_order_id,
order_type: option::none(),
self_matching_option,
price: option::none(),
quantity,
is_bid,
pay_with_deep,
expire_timestamp: option::none(),
}
}

### Manage conditional orders

These functions are exposed on the `MarginManager` to manage conditional orders.

### Add conditional order

Add a conditional order to the margin manager. The order will be placed when the condition is met. Validates that the trigger condition is valid relative to the current price.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_manager.move
// === Functions - Take Profit Stop Loss ===
/// Add a conditional order.
/// Specifies the conditions under which the order is triggered and the pending order to be placed.
public fun add_conditional_order<BaseAsset, QuoteAsset>(
self: &mut MarginManager<BaseAsset, QuoteAsset>,
pool: &Pool<BaseAsset, QuoteAsset>,
base_price_info_object: &PriceInfoObject,
quote_price_info_object: &PriceInfoObject,
registry: &MarginRegistry,
conditional_order_id: u64,
condition: Condition,
pending_order: PendingOrder,
clock: &Clock,
ctx: &mut TxContext,
) {
registry.load_inner();
self.validate_owner(ctx);
let manager_id = self.id();
assert!(pool.id() == self.deepbook_pool(), EIncorrectDeepBookPool);
self
.take_profit_stop_loss
.add_conditional_order<BaseAsset, QuoteAsset>(
pool,
manager_id,
base_price_info_object,
quote_price_info_object,
registry,
conditional_order_id,
condition,
pending_order,
clock,
);
}

### Cancel conditional order

Cancel a specific conditional order by ID.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_manager.move
/// Cancel a conditional order.
public fun cancel_conditional_order<BaseAsset, QuoteAsset>(
self: &mut MarginManager<BaseAsset, QuoteAsset>,
conditional_order_id: u64,
clock: &Clock,
ctx: &TxContext,
) {
self.validate_owner(ctx);
let manager_id = self.id();
self.take_profit_stop_loss.cancel_conditional_order(manager_id, conditional_order_id, clock);
}

### Cancel all conditional orders

Cancel all conditional orders for the margin manager.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_manager.move
/// Cancel all conditional orders.
public fun cancel_all_conditional_orders<BaseAsset, QuoteAsset>(
self: &mut MarginManager<BaseAsset, QuoteAsset>,
clock: &Clock,
ctx: &TxContext,
) {
self.validate_owner(ctx);
let manager_id = self.id();
self.take_profit_stop_loss.cancel_all_conditional_orders(manager_id, clock);
}

### Execute conditional orders

Execute conditional orders that have been triggered. This is a permissionless function that can be called by anyone (typically keepers or bots).

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_manager.move
/// DEPRECATED. Use `execute_conditional_orders_v2`.
///
/// The v1 entry preserves its on-chain signature so the v5 package upgrade
/// type-checks against existing dependents, but the body is replaced with
/// `abort EDeprecatedUseV2`. The v2 variant adds margin-pool + oracle params
/// and enforces a post-fill `risk_ratio >= min_borrow_risk_ratio` invariant
/// inside `process_collected_orders_v2`.
public fun execute_conditional_orders<BaseAsset, QuoteAsset>(
\_self: &mut MarginManager<BaseAsset, QuoteAsset>,
\_pool: &mut Pool<BaseAsset, QuoteAsset>,
\_base_price_info_object: &PriceInfoObject,
\_quote_price_info_object: &PriceInfoObject,
\_registry: &MarginRegistry,
\_max_orders_to_execute: u64,
\_clock: &Clock,
\_ctx: &TxContext,
): vector<OrderInfo> {
abort EDeprecatedUseV2
}

### Read endpoints

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/tpsl.move
// === Read-Only Functions ===
public fun trigger_below_orders(self: &TakeProfitStopLoss): &vector<ConditionalOrder> {
&self.trigger_below
}
public fun trigger_above_orders(self: &TakeProfitStopLoss): &vector<ConditionalOrder> {
&self.trigger_above
}
public fun num_conditional_orders(self: &TakeProfitStopLoss): u64 {
(self.trigger_below.length() + self.trigger_above.length()) as u64
}
public fun get_conditional_order(
self: &TakeProfitStopLoss,
conditional_order_id: u64,
): Option<ConditionalOrder> {
let mut i = 0;
while (i < self.trigger_below.length()) {
let order = &self.trigger_below[i];
if (order.conditional_order_id == conditional_order_id) {
return option::some(\*order)
};
i = i + 1;
};

    i = 0;
    while (i < self.trigger_above.length()) {
        let order = &self.trigger_above[i];
        if (order.conditional_order_id == conditional_order_id) {
            return option::some(*order)
        };
        i = i + 1;
    };

    option::none()

}
public fun conditional_order_id(conditional_order: &ConditionalOrder): u64 {
conditional_order.conditional_order_id
}
public fun condition(conditional_order: &ConditionalOrder): Condition {
conditional_order.condition
}
public fun pending_order(conditional_order: &ConditionalOrder): PendingOrder {
conditional_order.pending_order
}
public fun trigger_below_price(condition: &Condition): bool {
condition.trigger_below_price
}
public fun trigger_price(condition: &Condition): u64 {
condition.trigger_price
}
public fun client_order_id(pending_order: &PendingOrder): u64 {
pending_order.client_order_id
}
public fun order_type(pending_order: &PendingOrder): Option<u8> {
pending_order.order_type
}
public fun self_matching_option(pending_order: &PendingOrder): u8 {
pending_order.self_matching_option
}
public fun price(pending_order: &PendingOrder): Option<u64> {
pending_order.price
}
public fun quantity(pending_order: &PendingOrder): u64 {
pending_order.quantity
}
public fun is_bid(pending_order: &PendingOrder): bool {
pending_order.is_bid
}
public fun pay_with_deep(pending_order: &PendingOrder): bool {
pending_order.pay_with_deep
}
public fun expire_timestamp(pending_order: &PendingOrder): Option<u64> {
pending_order.expire_timestamp
}
public fun is_limit_order(pending_order: &PendingOrder): bool {
pending_order.is_limit_order
}

## Events

### `ConditionalOrderAdded`

Emitted when a conditional order is added to a margin manager.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/tpsl.move
// === Events ===
public struct ConditionalOrderAdded has copy, drop {
manager_id: ID,
conditional_order_id: u64,
conditional_order: ConditionalOrder,
timestamp: u64,
}

### `ConditionalOrderCancelled`

Emitted when a conditional order is cancelled.
github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/tpsl.move
public struct ConditionalOrderCancelled has copy, drop {
manager_id: ID,
conditional_order_id: u64,
conditional_order: ConditionalOrder,
timestamp: u64,
}

### `ConditionalOrderExecuted`

Emitted when a conditional order is executed.
github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/tpsl.move
public struct ConditionalOrderExecuted has copy, drop {
manager_id: ID,
pool_id: ID,
conditional_order_id: u64,
conditional_order: ConditionalOrder,
timestamp: u64,
}

### `ConditionalOrderInsufficientFunds`

Emitted when a conditional order cannot be executed due to insufficient funds.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/tpsl.move
public struct ConditionalOrderInsufficientFunds has copy, drop {
manager_id: ID,
conditional_order_id: u64,
conditional_order: ConditionalOrder,
timestamp: u64,
}

# Interest Rates

URL: https://docs.sui.io/onchain-finance/deepbook-margin/contract-information/interest-rates

Margin pools use a kinked interest rate model where the borrow rate increases gradually up to an optimal utilization point, then rises sharply to discourage excessive borrowing and maintain liquidity for withdrawals.

## Borrow interest formula

The formula for the borrow interest rate (APR) is:

```text
if utilization < optimalUtilization:
    borrowRate = baseRate + utilization × baseSlope
else:
    borrowRate = baseRate + optimalUtilization × baseSlope + (utilization - optimalUtilization) × excessSlope
```

Where:

- **Utilization** : The ratio of total borrowed assets to total supplied assets
- **Base Rate** : The minimum interest rate when utilization is 0%
- **Base Slope** : The rate of increase in interest below optimal utilization
- **Optimal Utilization** : The target utilization rate (typically 80%)
- **Excess Slope** : The steep rate of increase above optimal utilization

## Current parameters

| Asset | Base Rate | Base Slope | Optimal Utilization | Excess Slope | Max Utilization
| USDC | 0% | 15% | 80% | 500% | 90%
| SUIUSDE | 0% | 15% | 80% | 500% | 90%
| SUI | 3% | 20% | 80% | 500% | 90%
| DEEP | 5% | 25% | 80% | 500% | 90%
| WAL | 5% | 25% | 80% | 500% | 90%

The **Max Utilization** rate caps how much of the pool's liquidity can be borrowed, ensuring suppliers can always withdraw a portion of their funds.

## Examples

**At 50% utilization in the USDC pool (below optimal):**

```text
borrowRate = 0% + 50% × 15% = 0% + 7.5% = 7.5% APR
```

**At 80% utilization (at optimal):**

```text
borrowRate = 0% + 80% × 15% = 0% + 12% = 12% APR
```

**At 85% utilization (above optimal, below max):**

```text
borrowRate = 0% + 80% × 15% + (85% - 80%) × 500% = 0% + 12% + 25% = 37% APR
```

# Risk Ratio

URL: https://docs.sui.io/onchain-finance/deepbook-margin/contract-information/risk-ratio

Risk ratios are the core mechanism that governs leverage limits and position safety inDeepBook **DeepBook** A decentralized central limit order book (CLOB) built on Sui. Margin. Understanding these ratios is essential for managing margin positions effectively.

## What is a risk ratio?

The **risk ratio** is defined as:

```text
risk_ratio = total_assets / total_debts
```

Where assets and debts are valued in a common denomination using oracle prices. A higher risk ratio indicates a safer position with more collateral relative to debt.

- **Risk ratio = 2.0** : You have 2 units of assets for every 1 unit of debt (50% LTV)
- **Risk ratio = 1.25** : You have 1.25 units of assets for every 1 unit of debt (80% LTV)
- **Risk ratio = 1.0** : Your assets exactly equal your debts (100% LTV, insolvent)

## Risk ratio thresholds

Each trading pair has four risk ratio thresholds that control different operations:

### Min Withdraw Risk Ratio

The minimum risk ratio required **after** withdrawing collateral.

- If a withdrawal would cause your position's risk ratio to fall below this threshold, the withdrawal is rejected
- This prevents users from extracting too much collateral and leaving an unsafe position
- Typically set to 2.0 (50% LTV), meaning you must maintain at least 2 units of assets per 1 unit of debt to withdraw

### Min Borrow Risk Ratio

The minimum risk ratio required **after** borrowing additional funds.

- If a borrow would cause your position's risk ratio to fall below this threshold, the borrow is rejected
- This determines the maximum leverage available for the trading pair
- A min borrow ratio of 1.25 allows approximately 5x leverage
- A min borrow ratio of 1.5 allows approximately 3x leverage

### Liquidation Risk Ratio

The risk ratio threshold at which a position becomes **eligible for liquidation** .

- When a position's risk ratio falls to or below this value, anyone can liquidate the position
- This is the danger zone - if price moves against you and your ratio hits this level, you can be liquidated
- Typically set between 1.1 and 1.2 depending on asset volatility

### Target Liquidation Risk Ratio

The target risk ratio that liquidation aims to restore the position to.

- Liquidation repays enough debt to bring the position back to a healthy state at this ratio
- This ensures the position is safe after liquidation, not just barely above the liquidation threshold
- Typically equals the Min Borrow Risk Ratio

## How leverage is determined

The maximum leverage for a trading pair is determined by the Min Borrow Risk Ratio:

Max Leverage ≈ 1 1 − 1 Min Borrow Risk Ratio \text{Max Leverage} \approx \frac{1}{1 - \frac{1}{\text{Min Borrow Risk Ratio}}} Max Leverage≈ 1 − Min Borrow Risk Ratio11

| Min Borrow Risk Ratio | Approximate Max Leverage
| 1.25 | 5x
| 1.5 | 3x
| 2.0 | 2x

## Example: SUI/USDC position lifecycle

Consider a SUI/USDC position with the following risk parameters:

- Min Withdraw Risk Ratio: 2.0
- Min Borrow Risk Ratio: 1.25
- Liquidation Risk Ratio: 1.1
- Target Liquidation Risk Ratio: 1.25
  **Opening a position:**

1. You deposit 100 USDC as collateral
2. You borrow 400 USDC worth of SUI
3. Total assets = 100 USDC collateral + 400 USDC worth of SUI = 500 USDC
4. Total debt = 400 USDC
5. Risk ratio = 500/400 = 1.25 (at the minimum borrow ratio)
6. You now have 5x leveraged exposure to SUI
   **Price moves in your favor:**

7. SUI price increases 10%, your SUI is now worth 440 USDC
8. Total assets = 100 + 440 = 540 USDC, debt is still 400 USDC
9. Risk ratio = 540/400 = 1.35 (safer position)
10. You can withdraw some profit, as long as ratio stays above 2.0
    **Price moves against you:**

11. SUI price drops 10%, your SUI is now worth 360 USDC
12. Total assets = 100 + 360 = 460 USDC, debt is still 400 USDC
13. Risk ratio = 460/400 = 1.15 (approaching liquidation)
14. If SUI drops further to 340 USDC worth, ratio = (100 + 340)/400 = 1.1 (liquidation threshold)
15. Your position can now be liquidated by anyone
16. Liquidator repays part of your debt and receives collateral plus a reward
17. After liquidation, your remaining position has a risk ratio of 1.25

## Liquidation rewards

When a position is liquidated:

- **User Liquidation Reward** : A percentage of the liquidated amount paid to the liquidator as incentive (typically 2%)
- **Pool Liquidation Reward** : A percentage paid to the margin pool to cover potential bad debt (typically 3%)
  These rewards ensure liquidators are incentivized to maintain system health and the protocol has reserves against defaults.

## Risk management best practices

1. **Monitor your risk ratio** : Keep track of your position's health, especially during volatile markets
2. **Maintain a buffer** : Don't borrow up to the maximum - leave room for price fluctuations
3. **Set stop losses** : Use [TPSL orders](/onchain-finance/deepbook-margin/contract-information/tpsl) to automatically close positions before liquidation
4. **Understand the assets** : Higher volatility assets typically have stricter risk parameters (lower leverage)

# Supply Referral

URL: https://docs.sui.io/onchain-finance/deepbook-margin/contract-information/supply-referral

The supply referral system allows users to earn a portion of the protocol fees generated by liquidity suppliers they refer. When a supplier deposits assets using your referral ID, you earn fees proportional to interest paid over time.

## How it works

1. **Create a referral** : Mint a `SupplyReferral`object **Object** The basic unit of storage on Sui. for a specific margin pool
2. **Referral ID** : Suppliers include your referral ID when supplying liquidity
3. **Earn fees** : As referred suppliers earn interest, a portion of protocol fees accrues to your referral
4. **Claim fees** : Withdraw accumulated referral fees at any time
   The referral system uses a shares-based tracking mechanism. When a supplier deposits with your referral:

- Your referral's shares increase proportionally to the supplier's position
- As interest accrues and protocol fees are collected, your claimable fees grow
- When a supplier withdraws, your referral's shares decrease accordingly

## API

Following are the functions for managing supply referrals.

### Mint a `SupplyReferral`

Create a new supply referral for earning fees from referred suppliers. The returned `SupplyReferral`object is transferable and can be used to claim accumulated fees.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_pool.move
/// Mint a supply referral.
public fun mint_supply_referral<Asset>(
self: &mut MarginPool<Asset>,
registry: &MarginRegistry,
clock: &Clock,
ctx: &mut TxContext,
): ID {
registry.load_inner();
let supply_referral_id = self.protocol_fees.mint_supply_referral(ctx);

    event::emit(SupplyReferralMinted {
        margin_pool_id: self.id(),
        supply_referral_id,
        owner: ctx.sender(),
        timestamp: clock.timestamp_ms(),
    });

    supply_referral_id

}

### Supply with referral

Supply assets to a margin pool with an optional referral ID. When a referral ID is provided, the referrer earns a portion of protocol fees from the supplier's position.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_pool.move
/// Supply to the margin pool using a SupplierCap. Returns the new supply shares.
/// The `referral` parameter should be the ID of a SupplyReferral object if referral tracking is desired.
public fun supply<Asset>(
self: &mut MarginPool<Asset>,
registry: &MarginRegistry,
supplier_cap: &SupplierCap,
coin: Coin<Asset>,
referral: Option<ID>,
clock: &Clock,
): u64 {
registry.load_inner();
let margin_pool_id = self.id();
let supplier_cap_id = supplier_cap.id.to_inner();
let supply_amount = coin.value();
let (supply_shares, protocol_fees) = self
.state
.increase_supply(&self.config, supply_amount, clock);
self.protocol_fees.increase_fees_accrued(margin_pool_id, protocol_fees);

    let (total_user_supply_shares, previous_referral) = self
        .positions
        .increase_user_supply(supplier_cap_id, referral, supply_shares);

    self.protocol_fees.decrease_shares(previous_referral, total_user_supply_shares - supply_shares);
    self.protocol_fees.increase_shares(referral, total_user_supply_shares);

    let balance = coin.into_balance();
    self.vault.join(balance);
    self.rate_limiter.record_deposit(supply_amount, clock);

    assert!(self.state.total_supply() <= self.config.supply_cap(), ESupplyCapExceeded);

    event::emit(AssetSupplied {
        margin_pool_id: self.id(),
        asset_type: type_name::with_defining_ids<Asset>(),
        supplier_cap_id,
        supply_amount,
        supply_shares,
        timestamp: clock.timestamp_ms(),
    });

    total_user_supply_shares

}

### Withdraw referral fees

Withdraw accumulated referral fees. Only the owner of the `SupplyReferral`object can claim its fees.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_pool.move
/// Withdraw the referral fees.
public fun withdraw_referral_fees<Asset>(
self: &mut MarginPool<Asset>,
registry: &MarginRegistry,
referral: &SupplyReferral,
ctx: &mut TxContext,
): Coin<Asset> {
registry.load_inner();
let referral_fees = self.protocol_fees.calculate_and_claim(referral, ctx);
let coin = self.vault.split(referral_fees).into_coin(ctx);

    coin

}

### Query referral tracker

Query the current shares and unclaimed fees for a referral.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_pool/protocol_fees.move
public fun referral_tracker(self: &ProtocolFees, referral: ID): (u64, u64) {
let referral_tracker = self.referrals.borrow(referral);
let fees_per_share_delta = self.fees_per_share - referral_tracker.last_fees_per_share;
let unclaimed_fees = math::mul(referral_tracker.current_shares, fees_per_share_delta);
(referral_tracker.current_shares, referral_tracker.unclaimed_fees + unclaimed_fees)
}

## Events

### `SupplyReferralMinted`

Emitted when a new supply referral is created.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_pool.move
public struct SupplyReferralMinted has copy, drop {
margin_pool_id: ID,
supply_referral_id: ID,
owner: address,
timestamp: u64,
}

### `ReferralFeesClaimed`

Emitted when referral fees are claimed by the referral owner.

github.com/MystenLabs/deepbookv3/packages/deepbook_margin/sources/margin_pool/protocol_fees.move
public struct ReferralFeesClaimedEvent has copy, drop {
referral_id: ID,
owner: address,
fees: u64,
}

## Fee distribution

The referral spread parameter (typically 20%) determines what portion of protocol fees goes to referrers. For example:

- **Without referral** : 100% of protocol fees go to the protocol
- **With referral** : 80% to protocol, 20% to referrer (at 20% referral spread)
  The referral spread is configured per margin pool and can be viewed in the [Contract Information](/onchain-finance/deepbook-margin/contract-information) .

# DeepBook Margin SDK

URL: https://docs.sui.io/onchain-finance/deepbook-margin-sdk/

TheDeepBook **DeepBook** A decentralized central limit order book (CLOB) built on Sui. Margin TypeScript SDK abstracts away thetransaction **Transaction** A number of commands that execute on inputs to define the result of the transaction. calls, allowing for direct interactions with the `DeepBook Margin`package **Package** Smart contracts on Sui. for leveraged trading.

- [SDK repository](https://github.com/MystenLabs/ts-sdks/tree/main/packages/deepbook-v3)
- [NPM version](https://www.npmjs.com/package/@mysten/deepbook-v3)

## Install

To use the SDK in your projects, install the `@mysten/deepbook-v3`package , which includes the margin trading functionality.

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

TheDeepBook SDK includes a constants file ( `/utils/constants.ts` ) that maintains the latest deployedaddresses **Address** A unique, anonymous identity on a blockchain network. forDeepBook Margin, as well as margin pools and configurations.

### `constants.ts`

[packages/deepbook-v3/src/utils/constants.ts](https://github.com/MystenLabs/sui/blob/main/packages/deepbook-v3/src/utils/constants.ts)

```ts
packages / deepbook - v3 / src / utils / constants.ts;
// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import type { Coin, Pool, MarginPool } from "../types/index.js";

export type CoinMap = Record<string, Coin>;
export type PoolMap = Record<string, Pool>;
export type MarginPoolMap = Record<string, MarginPool>;
export interface DeepbookPackageIds {
  DEEPBOOK_PACKAGE_ID?: string;
  REGISTRY_ID?: string;
  DEEP_TREASURY_ID?: string;
  MARGIN_PACKAGE_ID?: string;
  MARGIN_V1?: string;
  MARGIN_REGISTRY_ID?: string;
  LIQUIDATION_PACKAGE_ID?: string;
}

export const testnetPackageIds = {
  DEEPBOOK_PACKAGE_ID:
    "0x22be4cade64bf2d02412c7e8d0e8beea2f78828b948118d46735315409371a3c",
  REGISTRY_ID:
    "0x7c256edbda983a2cd6f946655f4bf3f00a41043993781f8674a7046e8c0e11d1",
  DEEP_TREASURY_ID:
    "0x69fffdae0075f8f71f4fa793549c11079266910e8905169845af1f5d00e09dcb",
  MARGIN_PACKAGE_ID:
    "0xd6a42f4df4db73d68cbeb52be66698d2fe6a9464f45ad113ca52b0c6ebd918b6",
  MARGIN_V1:
    "0xd6a42f4df4db73d68cbeb52be66698d2fe6a9464f45ad113ca52b0c6ebd918b6",
  MARGIN_REGISTRY_ID:
    "0x48d7640dfae2c6e9ceeada197a7a1643984b5a24c55a0c6c023dac77e0339f75",
  LIQUIDATION_PACKAGE_ID:
    "0x8d69c3ef3ef580e5bf87b933ce28de19a5d0323588d1a44b9c60b4001741aa24",
} satisfies DeepbookPackageIds;

export const mainnetPackageIds = {
  DEEPBOOK_PACKAGE_ID:
    "0x0e735f8c93a95722efd73521aca7a7652c0bb71ed1daf41b26dfd7d1ff71f748",
  REGISTRY_ID:
    "0xaf16199a2dff736e9f07a845f23c5da6df6f756eddb631aed9d24a93efc4549d",
  DEEP_TREASURY_ID:
    "0x032abf8948dda67a271bcc18e776dbbcfb0d58c8d288a700ff0d5521e57a1ffe",
  MARGIN_PACKAGE_ID:
    "0x124bb3d8105d6d301c0d40feaa54d65df6b301e4d8ddd5eb8475b0f8a18cff2e",
  MARGIN_V1:
    "0x97d9473771b01f77b0940c589484184b49f6444627ec121314fae6a6d36fb86b",
  MARGIN_REGISTRY_ID:
    "0x0e40998b359a9ccbab22a98ed21bd4346abf19158bc7980c8291908086b3a742",
  LIQUIDATION_PACKAGE_ID:
    "0xf17bff1bf21e9587acc5708714e520aa967f82f256f626938a33c4109b08adb9",
} satisfies DeepbookPackageIds;

export const testnetCoins: CoinMap = {
  DEEP: {
    address: `0x36dbef866a1d62bf7328989a10fb2f07d769f4ee587c0de4a0a256e57e0a58a8`,
    type: `0x36dbef866a1d62bf7328989a10fb2f07d769f4ee587c0de4a0a256e57e0a58a8::deep::DEEP`,
    scalar: 1000000,
    feed: "0x99137a18354efa7fb6840889d059fdb04c46a6ce21be97ab60d9ad93e91ac758", // DEEP uses HFT feed on testnet
    currencyId:
      "0xbf1b77e244f649c736a44898585cc8ac939fbb0bbdf1d8d2a183978cc312e613",
    priceInfoObjectId:
      "0x3d52fffa2cd9e54b39bb36d282bdda560b15b8b4fdf4766a3c58499ef172bafc",
  },
  SUI: {
    address: `0x0000000000000000000000000000000000000000000000000000000000000002`,
    type: `0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI`,
    scalar: 1000000000,
    feed: "0x50c67b3fd225db8912a424dd4baed60ffdde625ed2feaaf283724f9608fea266",
    currencyId:
      "0xf256d3fb6a50eaa748d94335b34f2982fbc3b63ceec78cafaa29ebc9ebaf2bbc",
    priceInfoObjectId:
      "0x1ebb295c789cc42b3b2a1606482cd1c7124076a0f5676718501fda8c7fd075a0",
  },
  DBUSDC: {
    address: `0xf7152c05930480cd740d7311b5b8b45c6f488e3a53a11c3f74a6fac36a52e0d7`,
    type: `0xf7152c05930480cd740d7311b5b8b45c6f488e3a53a11c3f74a6fac36a52e0d7::DBUSDC::DBUSDC`,
    scalar: 1000000,
    feed: "0x41f3625971ca2ed2263e78573fe5ce23e13d2558ed3f2e47ab0f84fb9e7ae722",
    currencyId:
      "0x509db0f9283c9ee4fdc5b99028a439d3639f49e9709e3d7a6de14b3bfdb0c784",
    priceInfoObjectId:
      "0x9c4dd4008297ffa5e480684b8100ec21cc934405ed9a25d4e4d7b6259aad9c81",
  },
  DBTC: {
    address: `0x6502dae813dbe5e42643c119a6450a518481f03063febc7e20238e43b6ea9e86`,
    type: `0x6502dae813dbe5e42643c119a6450a518481f03063febc7e20238e43b6ea9e86::dbtc::DBTC`,
    scalar: 100000000,
    feed: "0xf9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b",
    currencyId:
      "0x3ef2afa2126704bf721b9c8495d94288f6bd090fc454fe3e1613eb765a8a348f",
    priceInfoObjectId:
      "0x72431a238277695d3f31e4425225a4462674ee6cceeea9d66447b210755fffba",
  },
  DBUSDT: {
    address: `0xf7152c05930480cd740d7311b5b8b45c6f488e3a53a11c3f74a6fac36a52e0d7`,
    type: `0xf7152c05930480cd740d7311b5b8b45c6f488e3a53a11c3f74a6fac36a52e0d7::DBUSDT::DBUSDT`,
    scalar: 1000000,
  },
  WAL: {
    address: `0x9ef7676a9f81937a52ae4b2af8d511a28a0b080477c0c2db40b0ab8882240d76`,
    type: `0x9ef7676a9f81937a52ae4b2af8d511a28a0b080477c0c2db40b0ab8882240d76::wal::WAL`,
    scalar: 1000000000,
  },
};

export const mainnetCoins: CoinMap = {
  DEEP: {
    address: `0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270`,
    type: `0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP`,
    scalar: 1000000,
    feed: "0x29bdd5248234e33bd93d3b81100b5fa32eaa5997843847e2c2cb16d7c6d9f7ff",
    currencyId:
      "0x3f2afb7c5f245870a8b8a3808e6dd7042446a0e7504e9d2795372da053858cd9",
    priceInfoObjectId:
      "0x8c7f3a322b94cc69db2a2ac575cbd94bf5766113324c3a3eceac91e3e88a51ed",
  },
  SUI: {
    address: `0x0000000000000000000000000000000000000000000000000000000000000002`,
    type: `0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI`,
    scalar: 1000000000,
    feed: "0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744",
    currencyId:
      "0xf256d3fb6a50eaa748d94335b34f2982fbc3b63ceec78cafaa29ebc9ebaf2bbc",
    priceInfoObjectId:
      "0x801dbc2f0053d34734814b2d6df491ce7807a725fe9a01ad74a07e9c51396c37",
  },
  USDC: {
    address: `0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7`,
    type: `0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC`,
    scalar: 1000000,
    feed: "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
    currencyId:
      "0x75cfbbf8c962d542e99a1d15731e6069f60a00db895407785b15d14f606f2b4a",
    priceInfoObjectId:
      "0x5dec622733a204ca27f5a90d8c2fad453cc6665186fd5dff13a83d0b6c9027ab",
  },
  WAL: {
    address: `0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59`,
    type: `0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL`,
    scalar: 1000000000,
    feed: "0xeba0732395fae9dec4bae12e52760b35fc1c5671e2da8b449c9af4efe5d54341",
    currencyId:
      "0xb6a0c0bacb1c87c3be4dff20c22ef1012125b5724b5b0ff424f852a2651b23fa",
    priceInfoObjectId:
      "0xeb7e669f74d976c0b99b6ef9801e3a77716a95f1a15754e0f1399ce3fb60973d",
  },
  SUIUSDE: {
    address: `0x41d587e5336f1c86cad50d38a7136db99333bb9bda91cea4ba69115defeb1402`,
    type: `0x41d587e5336f1c86cad50d38a7136db99333bb9bda91cea4ba69115defeb1402::sui_usde::SUI_USDE`,
    scalar: 1000000,
    feed: "0x8cead549d0e770dea8fdf5e018a85d59585265cf8bff16ba83962fc7996dbb7f",
    currencyId:
      "0x44f0959110bd9e5e91af0483364c42075ac19f173b28f708989f419ef3560576",
    priceInfoObjectId:
      "0x9b2028bfc829127d2e5ead1691dc3002de9e9b8d8076b4915e5ecc7d9b99d63f",
  },
  XBTC: {
    address: `0x876a4b7bce8aeaef60464c11f4026903e9afacab79b9b142686158aa86560b50`,
    type: `0x876a4b7bce8aeaef60464c11f4026903e9afacab79b9b142686158aa86560b50::xbtc::XBTC`,
    scalar: 100000000,
    feed: "0xae8f269ed9c4bed616c99a98cf6dfe562bd3202e7f91821a471ff854713851b4",
    currencyId:
      "0x907bb173bffab7c57bbd3350a633aa32c8770937b496d7d88874087b59200bcc",
    priceInfoObjectId:
      "0xa4b9db1866ee6e2a156e8c36fc66be0f68f232388ebb578c949c2c6beb50128b",
  },
  USDSUI: {
    address: `0x44f838219cf67b058f3b37907b655f226153c18e33dfcd0da559a844fea9b1c1`,
    type: `0x44f838219cf67b058f3b37907b655f226153c18e33dfcd0da559a844fea9b1c1::usdsui::USDSUI`,
    scalar: 1000000,
    feed: "0xd510fcdb3a63f35d3bb118d5db3afc5815a3f13bc55d48abb893b63f0315902a",
    currencyId:
      "0x535e826a2acddab687c81cb6c6166553b479f61a9023800ec0020baba8d94731",
    priceInfoObjectId:
      "0x68644a3ab7a1aab113a4a68b6115a5b51eba4cb6aaac2d99b734be2e5e748425",
  },
  WUSDC: {
    address: `0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf`,
    type: `0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN`,
    scalar: 1000000,
  },
  WETH: {
    address: `0xaf8cd5edc19c4512f4259f0bee101a40d41ebed738ade5874359610ef8eeced5`,
    type: `0xaf8cd5edc19c4512f4259f0bee101a40d41ebed738ade5874359610ef8eeced5::coin::COIN`,
    scalar: 100000000,
  },
  BETH: {
    address: `0xd0e89b2af5e4910726fbcd8b8dd37bb79b29e5f83f7491bca830e94f7f226d29`,
    type: `0xd0e89b2af5e4910726fbcd8b8dd37bb79b29e5f83f7491bca830e94f7f226d29::eth::ETH`,
    scalar: 100000000,
  },
  WBTC: {
    address: `0x027792d9fed7f9844eb4839566001bb6f6cb4804f66aa2da6fe1ee242d896881`,
    type: `0x027792d9fed7f9844eb4839566001bb6f6cb4804f66aa2da6fe1ee242d896881::coin::COIN`,
    scalar: 100000000,
  },
  WUSDT: {
    address: `0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c`,
    type: `0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN`,
    scalar: 1000000,
  },
  NS: {
    address: `0x5145494a5f5100e645e4b0aa950fa6b68f614e8c59e17bc5ded3495123a79178`,
    type: `0x5145494a5f5100e645e4b0aa950fa6b68f614e8c59e17bc5ded3495123a79178::ns::NS`,
    scalar: 1000000,
  },
  TYPUS: {
    address: `0xf82dc05634970553615eef6112a1ac4fb7bf10272bf6cbe0f80ef44a6c489385`,
    type: `0xf82dc05634970553615eef6112a1ac4fb7bf10272bf6cbe0f80ef44a6c489385::typus::TYPUS`,
    scalar: 1000000000,
  },
  AUSD: {
    address: `0x2053d08c1e2bd02791056171aab0fd12bd7cd7efad2ab8f6b9c8902f14df2ff2`,
    type: `0x2053d08c1e2bd02791056171aab0fd12bd7cd7efad2ab8f6b9c8902f14df2ff2::ausd::AUSD`,
    scalar: 1000000,
  },
  DRF: {
    address: `0x294de7579d55c110a00a7c4946e09a1b5cbeca2592fbb83fd7bfacba3cfeaf0e`,
    type: `0x294de7579d55c110a00a7c4946e09a1b5cbeca2592fbb83fd7bfacba3cfeaf0e::drf::DRF`,
    scalar: 1000000,
  },
  SEND: {
    address: `0xb45fcfcc2cc07ce0702cc2d229621e046c906ef14d9b25e8e4d25f6e8763fef7`,
    type: `0xb45fcfcc2cc07ce0702cc2d229621e046c906ef14d9b25e8e4d25f6e8763fef7::send::SEND`,
    scalar: 1000000,
  },
  IKA: {
    address: `0x7262fb2f7a3a14c888c438a3cd9b912469a58cf60f367352c46584262e8299aa`,
    type: `0x7262fb2f7a3a14c888c438a3cd9b912469a58cf60f367352c46584262e8299aa::ika::IKA`,
    scalar: 1000000000,
  },
  ALKIMI: {
    address: `0x1a8f4bc33f8ef7fbc851f156857aa65d397a6a6fd27a7ac2ca717b51f2fd9489`,
    type: `0x1a8f4bc33f8ef7fbc851f156857aa65d397a6a6fd27a7ac2ca717b51f2fd9489::alkimi::ALKIMI`,
    scalar: 1000000000,
  },
  LZWBTC: {
    address: `0x0041f9f9344cac094454cd574e333c4fdb132d7bcc9379bcd4aab485b2a63942`,
    type: `0x0041f9f9344cac094454cd574e333c4fdb132d7bcc9379bcd4aab485b2a63942::wbtc::WBTC`,
    scalar: 100000000,
  },
  USDT: {
    address: `0x375f70cf2ae4c00bf37117d0c85a2c71545e6ee05c4a5c7d282cd66a4504b068`,
    type: `0x375f70cf2ae4c00bf37117d0c85a2c71545e6ee05c4a5c7d282cd66a4504b068::usdt::USDT`,
    scalar: 1000000,
  },
};

export const testnetPools: PoolMap = {
  DEEP_SUI: {
    address: `0x48c95963e9eac37a316b7ae04a0deb761bcdcc2b67912374d6036e7f0e9bae9f`,
    baseCoin: "DEEP",
    quoteCoin: "SUI",
  },
  SUI_DBUSDC: {
    address: `0x1c19362ca52b8ffd7a33cee805a67d40f31e6ba303753fd3a4cfdfacea7163a5`,
    baseCoin: "SUI",
    quoteCoin: "DBUSDC",
  },
  DEEP_DBUSDC: {
    address: `0xe86b991f8632217505fd859445f9803967ac84a9d4a1219065bf191fcb74b622`,
    baseCoin: "DEEP",
    quoteCoin: "DBUSDC",
  },
  DBUSDT_DBUSDC: {
    address: `0x83970bb02e3636efdff8c141ab06af5e3c9a22e2f74d7f02a9c3430d0d10c1ca`,
    baseCoin: "DBUSDT",
    quoteCoin: "DBUSDC",
  },
  WAL_DBUSDC: {
    address: `0xeb524b6aea0ec4b494878582e0b78924208339d360b62aec4a8ecd4031520dbb`,
    baseCoin: "WAL",
    quoteCoin: "DBUSDC",
  },
  WAL_SUI: {
    address: `0x8c1c1b186c4fddab1ebd53e0895a36c1d1b3b9a77cd34e607bef49a38af0150a`,
    baseCoin: "WAL",
    quoteCoin: "SUI",
  },
  DBTC_DBUSDC: {
    address: `0x0dce0aa771074eb83d1f4a29d48be8248d4d2190976a5241f66b43ec18fa34de`,
    baseCoin: "DBTC",
    quoteCoin: "DBUSDC",
  },
};

export const mainnetPools: PoolMap = {
  DEEP_SUI: {
    address: `0xb663828d6217467c8a1838a03793da896cbe745b150ebd57d82f814ca579fc22`,
    baseCoin: "DEEP",
    quoteCoin: "SUI",
  },
  SUI_USDC: {
    address: `0xe05dafb5133bcffb8d59f4e12465dc0e9faeaa05e3e342a08fe135800e3e4407`,
    baseCoin: "SUI",
    quoteCoin: "USDC",
  },
  DEEP_USDC: {
    address: `0xf948981b806057580f91622417534f491da5f61aeaf33d0ed8e69fd5691c95ce`,
    baseCoin: "DEEP",
    quoteCoin: "USDC",
  },
  WUSDT_USDC: {
    address: `0x4e2ca3988246e1d50b9bf209abb9c1cbfec65bd95afdacc620a36c67bdb8452f`,
    baseCoin: "WUSDT",
    quoteCoin: "USDC",
  },
  WUSDC_USDC: {
    address: `0xa0b9ebefb38c963fd115f52d71fa64501b79d1adcb5270563f92ce0442376545`,
    baseCoin: "WUSDC",
    quoteCoin: "USDC",
  },
  BETH_USDC: {
    address: `0x1109352b9112717bd2a7c3eb9a416fff1ba6951760f5bdd5424cf5e4e5b3e65c`,
    baseCoin: "BETH",
    quoteCoin: "USDC",
  },
  NS_USDC: {
    address: `0x0c0fdd4008740d81a8a7d4281322aee71a1b62c449eb5b142656753d89ebc060`,
    baseCoin: "NS",
    quoteCoin: "USDC",
  },
  NS_SUI: {
    address: `0x27c4fdb3b846aa3ae4a65ef5127a309aa3c1f466671471a806d8912a18b253e8`,
    baseCoin: "NS",
    quoteCoin: "SUI",
  },
  TYPUS_SUI: {
    address: `0xe8e56f377ab5a261449b92ac42c8ddaacd5671e9fec2179d7933dd1a91200eec`,
    baseCoin: "TYPUS",
    quoteCoin: "SUI",
  },
  SUI_AUSD: {
    address: `0x183df694ebc852a5f90a959f0f563b82ac9691e42357e9a9fe961d71a1b809c8`,
    baseCoin: "SUI",
    quoteCoin: "AUSD",
  },
  AUSD_USDC: {
    address: `0x5661fc7f88fbeb8cb881150a810758cf13700bb4e1f31274a244581b37c303c3`,
    baseCoin: "AUSD",
    quoteCoin: "USDC",
  },
  DRF_SUI: {
    address: `0x126865a0197d6ab44bfd15fd052da6db92fd2eb831ff9663451bbfa1219e2af2`,
    baseCoin: "DRF",
    quoteCoin: "SUI",
  },
  SEND_USDC: {
    address: `0x1fe7b99c28ded39774f37327b509d58e2be7fff94899c06d22b407496a6fa990`,
    baseCoin: "SEND",
    quoteCoin: "USDC",
  },
  WAL_USDC: {
    address: `0x56a1c985c1f1123181d6b881714793689321ba24301b3585eec427436eb1c76d`,
    baseCoin: "WAL",
    quoteCoin: "USDC",
  },
  WAL_SUI: {
    address: `0x81f5339934c83ea19dd6bcc75c52e83509629a5f71d3257428c2ce47cc94d08b`,
    baseCoin: "WAL",
    quoteCoin: "SUI",
  },
  XBTC_USDC: {
    address: `0x20b9a3ec7a02d4f344aa1ebc5774b7b0ccafa9a5d76230662fdc0300bb215307`,
    baseCoin: "XBTC",
    quoteCoin: "USDC",
  },
  IKA_USDC: {
    address: `0xfa732993af2b60d04d7049511f801e79426b2b6a5103e22769c0cead982b0f47`,
    baseCoin: "IKA",
    quoteCoin: "USDC",
  },
  ALKIMI_SUI: {
    address: `0x84752993c6dc6fce70e25ddeb4daddb6592d6b9b0912a0a91c07cfff5a721d89`,
    baseCoin: "ALKIMI",
    quoteCoin: "SUI",
  },
  LZWBTC_USDC: {
    address: `0xf5142aafa24866107df628bf92d0358c7da6acc46c2f10951690fd2b8570f117`,
    baseCoin: "LZWBTC",
    quoteCoin: "USDC",
  },
  USDT_USDC: {
    address:
      "0xfc28a2fb22579c16d672a1152039cbf671e5f4b9f103feddff4ea06ef3c2bc25",
    baseCoin: "USDT",
    quoteCoin: "USDC",
  },
  SUIUSDE_USDC: {
    address:
      "0x0fac1cebf35bde899cd9ecdd4371e0e33f44ba83b8a2902d69186646afa3a94b",
    baseCoin: "SUIUSDE",
    quoteCoin: "USDC",
  },
  SUI_SUIUSDE: {
    address:
      "0x034f3a42e7348de2084406db7a725f9d9d132a56c68324713e6e623601fb4fd7",
    baseCoin: "SUI",
    quoteCoin: "SUIUSDE",
  },
  SUI_USDSUI: {
    address:
      "0x826eeacb2799726334aa580396338891205a41cf9344655e526aae6ddd5dc03f",
    baseCoin: "SUI",
    quoteCoin: "USDSUI",
  },
  USDSUI_USDC: {
    address:
      "0xa374264d43e6baa5aa8b35ff18ff24fdba7443b4bcb884cb4c2f568d32cdac36",
    baseCoin: "USDSUI",
    quoteCoin: "USDC",
  },
};

export const testnetMarginPools = {
  SUI: {
    address:
      "0xcdbbe6a72e639b647296788e2e4b1cac5cea4246028ba388ba1332ff9a382eea",
    type: "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
  },
  DBUSDC: {
    address:
      "0xf08568da93834e1ee04f09902ac7b1e78d3fdf113ab4d2106c7265e95318b14d",
    type: "0xf7152c05930480cd740d7311b5b8b45c6f488e3a53a11c3f74a6fac36a52e0d7::DBUSDC::DBUSDC",
  },
  DEEP: {
    address:
      "0x610640613f21d9e688d6f8103d17df22315c32e0c80590ce64951a1991378b55",
    type: "0x36dbef866a1d62bf7328989a10fb2f07d769f4ee587c0de4a0a256e57e0a58a8::deep::DEEP",
  },
  DBTC: {
    address:
      "0xf3440b4aafcc8b12fc4b242e9590c52873b8238a0d0e52fbf9dae61d2970796a",
    type: "0x6502dae813dbe5e42643c119a6450a518481f03063febc7e20238e43b6ea9e86::dbtc::DBTC",
  },
};

export const mainnetMarginPools = {
  SUI: {
    address:
      "0x53041c6f86c4782aabbfc1d4fe234a6d37160310c7ee740c915f0a01b7127344",
    type: "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
  },
  USDC: {
    address:
      "0xba473d9ae278f10af75c50a8fa341e9c6a1c087dc91a3f23e8048baf67d0754f",
    type: "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
  },
  DEEP: {
    address:
      "0x1d723c5cd113296868b55208f2ab5a905184950dd59c48eb7345607d6b5e6af7",
    type: "0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP",
  },
  WAL: {
    address:
      "0x38decd3dbb62bd4723144349bf57bc403b393aee86a51596846a824a1e0c2c01",
    type: "0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL",
  },
  SUIUSDE: {
    address:
      "0xbb990ca04a7743e6c0a25a7fb16f60fc6f6d8bf213624ff03a63f1bb04c3a12f",
    type: "0x41d587e5336f1c86cad50d38a7136db99333bb9bda91cea4ba69115defeb1402::sui_usde::SUI_USDE",
  },
  XBTC: {
    address:
      "0x14dfbf54400e0b97e892349310d392bef6d187c2b6709d9b246b8f41c9a13de4",
    type: "0x876a4b7bce8aeaef60464c11f4026903e9afacab79b9b142686158aa86560b50::xbtc::XBTC",
  },
  USDSUI: {
    address:
      "0x78a0ddd02745d9b500fb7e9aae2ff8b665d974f00fd1f6060d59f4a8e891402c",
    type: "0x44f838219cf67b058f3b37907b655f226153c18e33dfcd0da559a844fea9b1c1::usdsui::USDSUI",
  },
};

export const testnetPythConfigs = {
  pythStateId:
    "0x243759059f4c3111179da5878c12f68d612c21a8d54d85edc86164bb18be1c7c",
  wormholeStateId:
    "0x31358d198147da50db32eda2562951d53973a0c0ad5ed738e9b17d88b213d790",
};

export const mainnetPythConfigs = {
  pythStateId:
    "0x1f9310238ee9298fb703c3419030b35b22bb1cc37113e3bb5007c99aec79e5b8",
  wormholeStateId:
    "0xaeab97f96cf9877fee2883315d459552b2b921edc16d7ceac6eab944dd88919c",
};
```

[View on GitHub](https://github.com/MystenLabs/ts-sdks/blob/main/packages/deepbook-v3/src/utils/constants.ts)

## DeepBookClient

To work withDeepBook Margin, use the client extension to addDeepBook functionality to a Sui client. The [Sui TypeScript SDK](https://sdk.mystenlabs.com/typescript) provides the `SuiGrpcClient` and key functionality necessary to process transactions. The following example imports those libraries, as well.

info
The code examples in this section use Sui Foundation-managed RPC endpoints for illustration purposes. For production use, replace the `baseUrl` value with your own RPC provider endpoint.

```tsx
import { deepbook, type DeepBookClient } from "@mysten/deepbook-v3";
import type { ClientWithExtensions } from "@mysten/sui/client";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

class DeepBookMarginTrader {
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

## Keys: Coin, Pool, and MarginManager

Functions that require the input of a coin, pool, or a margin manager require the key of any suchobject **Object** The basic unit of storage on Sui. as the parameter. The SDK manages a `key:value` relationship of this data in memory. Some default data comes with the SDK (as seen in `utils/constants.ts` ). Coins are stored in a `CoinMap` , pools in a `PoolMap` , and margin managers in a `MarginManagerMap` in the config.

### Margin manager

Before placing any margin trade, you must supply a margin manageraddress to the client. The manager key points to anobject defined by the `MarginManager` interface in the client. [MarginManager docs](/onchain-finance/deepbook-margin/contract-information/margin-manager) . Initialize the margin manager with the client. If you don't create a margin manager, you can rely on the client to create one, but then the user must reinitialize the client.

Example using an existing margin manager:

```tsx
import { deepbook, type DeepBookClient } from "@mysten/deepbook-v3";
import type { MarginManager } from "@mysten/deepbook-v3";
import type { ClientWithExtensions } from "@mysten/sui/client";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { config } from "dotenv";

config();

const MARGIN_MANAGER_KEY = "MARGIN_MANAGER_1";

class DeepBookMarginTrader {
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
        marginManagers: this.getMarginManagers(),
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

  getMarginManagers(): { [key: string]: MarginManager } {
    const marginManagerAddress = process.env.MARGIN_MANAGER_ADDRESS;
    const poolKey = process.env.POOL_KEY || "SUI_DBUSDC";
    if (!marginManagerAddress) {
      throw new Error("No margin manager address found");
    }
    return {
      [MARGIN_MANAGER_KEY]: {
        address: marginManagerAddress,
        poolKey: poolKey,
      },
    };
  }
}
```

Example creating a margin manager:

```tsx
import { deepbook, type DeepBookClient } from "@mysten/deepbook-v3";
import type { MarginManager } from "@mysten/deepbook-v3";
import type { ClientWithExtensions } from "@mysten/sui/client";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

const MARGIN_MANAGER_KEY = "MARGIN_MANAGER_1";

class DeepBookMarginTrader {
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
    marginManagers?: { [key: string]: MarginManager },
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
        marginManagers,
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

  async createMarginManagerAndReinitialize() {
    let tx = new Transaction();
    const poolKey = "SUI_DBUSDC";
    tx.add(this.client.deepbook.marginManager.newMarginManager(poolKey));

    const result = await this.client.core.signAndExecuteTransaction({
      transaction: tx,
      signer: this.keypair,
      include: { effects: true, objectTypes: true },
    });

    if (result.$kind === "FailedTransaction") {
      throw new Error("Transaction failed");
    }

    const objectTypes = result.Transaction?.objectTypes ?? {};
    const marginManagerAddress =
      result.Transaction?.effects?.changedObjects?.find(
        (obj) =>
          obj.idOperation === "Created" &&
          objectTypes[obj.objectId]?.includes("MarginManager"),
      )?.objectId;

    if (!marginManagerAddress) {
      throw new Error("Failed to create margin manager");
    }

    const marginManagers: { [key: string]: MarginManager } = {
      [MARGIN_MANAGER_KEY]: {
        address: marginManagerAddress,
        poolKey: poolKey,
      },
    };

    this.client = this.#createClient(this.env, marginManagers);
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
  You can also initialize the SDK with custom coins to interact with margin pools that are not supported by default. To do this, create a `CoinMap`object and pass it to the constructor of the client.

### Pool

Similar to coins, the SDK comes with default pools. You can provide a `PoolMap` during construction to override this behavior.

```tsx
import { deepbook, type DeepBookClient } from "@mysten/deepbook-v3";
import type { MarginManager } from "@mysten/deepbook-v3";
import type { ClientWithExtensions } from "@mysten/sui/client";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import type { Keypair } from "@mysten/sui/cryptography";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import type { Transaction } from "@mysten/sui/transactions";

export class DeepBookMarginTrader {
  keypair: Keypair;
  client: ClientWithExtensions<{ deepbook: DeepBookClient }>;

  constructor(
    keypair: string | Keypair,
    env: "testnet" | "mainnet",
    marginManagers?: { [key: string]: MarginManager },
    maintainerCap?: string,
  ) {
    if (typeof keypair === "string") {
      this.keypair = DeepBookMarginTrader.#getSignerFromPK(keypair);
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
        marginManagers,
        marginMaintainerCap: maintainerCap,
      }),
    );
  }

  static #getSignerFromPK = (privateKey: string) => {
    const { scheme, secretKey } = decodeSuiPrivateKey(privateKey);
    if (scheme === "ED25519") return Ed25519Keypair.fromSecretKey(secretKey);

    throw new Error(`Unsupported scheme: ${scheme}`);
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

The following example uses the default pools and coins provided, and demonstrates margin trading operations.

```tsx
import { Transaction } from "@mysten/sui/transactions";

import { DeepBookMarginTrader } from "./deepbookMarginTrader.js";

(async () => {
  const privateKey = ""; // Can encapsulate this in a .env file

  // Initialize with margin managers if created
  const marginManagers = {
    MARGIN_MANAGER_1: {
      address: "",
      poolKey: "SUI_DBUSDC",
    },
  };
  const traderClient = new DeepBookMarginTrader(
    privateKey,
    "testnet",
    marginManagers,
  );

  const tx = new Transaction();

  // Margin manager contract calls
  traderClient.client.deepbook.marginManager.deposit(
    "MARGIN_MANAGER_1",
    "DBUSDC",
    10000,
  )(tx);
  traderClient.client.deepbook.marginManager.borrowBase(
    "MARGIN_MANAGER_1",
    "SUI_DBUSDC",
    100,
  )(tx);

  // Place leveraged orders
  traderClient.client.deepbook.poolProxy.placeLimitOrder({
    poolKey: "SUI_DBUSDC",
    marginManagerKey: "MARGIN_MANAGER_1",
    clientOrderId: "12345",
    price: 2.5,
    quantity: 100,
    isBid: true,
    payWithDeep: true,
  })(tx);

  // Margin pool operations
  const supplierCap = tx.add(
    traderClient.client.deepbook.marginPool.mintSupplierCap(),
  );
  traderClient.client.deepbook.marginPool.supplyToMarginPool(
    "DBUSDC",
    supplierCap,
    5000,
  )(tx);

  let res = await traderClient.signAndExecute(tx);

  console.dir(res, { depth: null });
})();
```

## Margin manager referral functions

The SDK provides functions for managing referrals with margin managers. Referrals are pool-specific and must first be minted using the coreDeepBook SDK before they can be associated with a margin manager.

```tsx
// Set a referral for a margin manager (pool-specific)
// The referral must be a DeepBookPoolReferral minted for the pool the margin manager is associated with
traderClient.client.deepbook.marginManager.setMarginManagerReferral(
  "MARGIN_MANAGER_1",
  referralId,
)(tx);

// Unset the referral for a margin manager for a specific pool
traderClient.client.deepbook.marginManager.unsetMarginManagerReferral(
  "MARGIN_MANAGER_1",
  "SUI_DBUSDC",
)(tx);
```

info
To mint a referral, use the coreDeepBook SDK's `mintReferral` function. See the [DeepBookV3 SDK documentation](/onchain-finance/deepbookv3-sdk#referral-functions) for more details on minting and managing referrals.

# Margin Manager SDK

URL: https://docs.sui.io/onchain-finance/deepbook-margin-sdk/margin-manager

Managing margin accounts is essential for leveraged trading onDeepBook **DeepBook** A decentralized central limit order book (CLOB) built on Sui. . The Margin Manager SDK provides functions for creating margin managers, depositing collateral, borrowing assets, and managing risk.

## Margin manager functions

TheDeepBook Margin SDK provides the following functions for managing margin accounts.

### `newMarginManager`

Use `newMarginManager` to create and share a new margin manager in onetransaction **Transaction** A number of commands that execute on inputs to define the result of the transaction. . The call returns a function that takes a `Transaction`object **Object** The basic unit of storage on Sui. .

**Parameters**

- `poolKey` : String that identifies theDeepBook pool.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/marginManager.ts
  newMarginManager = (poolKey: string) => (tx: Transaction)

### `newMarginManagerWithInitializer`

Use `newMarginManagerWithInitializer` to create a margin manager and return it with an initializer. You must call `shareMarginManager` afterward to share it. The call returns anobject with `manager` and `initializer` .

**Parameters**

- `poolKey` : String that identifies theDeepBook pool.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/marginManager.ts
  newMarginManagerWithInitializer = (poolKey: string) => (tx: Transaction)

### `shareMarginManager`

Use `shareMarginManager` to share a margin manager created with `newMarginManagerWithInitializer` . The call returns a function that takes a `Transaction`object .

**Parameters**

- `poolKey` : String that identifies theDeepBook pool.
- `manager` : `TransactionArgument` representing the margin manager.
- `initializer` : `TransactionArgument` representing the initializer.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/marginManager.ts
  shareMarginManager =
  (poolKey: string, manager: TransactionArgument, initializer: TransactionArgument) =>
  (tx: Transaction)

### `depositDuringInitialization`

Use `depositDuringInitialization` to deposit funds into a margin manager during its creation, before it is shared. This must be called in the sametransaction as `newMarginManagerWithInitializer` and before `shareMarginManager` . The call returns a function that takes a `Transaction`object .

**Parameters**

- `manager` : `TransactionArgument` representing the margin manager returned by `newMarginManagerWithInitializer` .
- `poolKey` : String that identifies theDeepBook pool.
- `coinType` : String identifying the coin type to deposit (for example, `'SUI'` , `'DBUSDC'` , `'DEEP'` ).
- `amount` : Number representing the amount to deposit (provide either `amount` or `coin` , not both).
- `coin` : `TransactionArgument` representing a coinobject to deposit (provide either `amount` or `coin` , not both).
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/marginManager.ts
  depositDuringInitialization = (params: DepositDuringInitParams) => (tx: Transaction)

### `depositBase` , `depositQuote` , `depositDeep`

Use these functions to deposit assets into a margin manager. The call returns a function that takes a `Transaction`object .

**Parameters**

- `managerKey` : String that identifies the margin manager.
- `amount` : Number representing the amount to deposit.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/marginManager.ts
  depositBase = (params: DepositParams) => (tx: Transaction)
  depositQuote = (params: DepositParams) => (tx: Transaction)
  depositDeep = (params: DepositParams) => (tx: Transaction)

### `withdrawBase` , `withdrawQuote` , `withdrawDeep`

Use these functions to withdraw assets from a margin manager. Withdrawals are subject to risk ratio limits. The call returns a function that takes a `Transaction`object .

**Parameters**

- `managerKey` : String that identifies the margin manager.
- `amount` : Number representing the amount to withdraw.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/marginManager.ts
  withdrawBase = (managerKey: string, amount: number) => (tx: Transaction)
  withdrawQuote = (managerKey: string, amount: number) => (tx: Transaction)
  withdrawDeep = (managerKey: string, amount: number) => (tx: Transaction)

### `borrowBase` , `borrowQuote`

Use these functions to borrow assets from margin pools. Borrowing is subject to risk ratio limits. The call returns a function that takes a `Transaction`object .

**Parameters**

- `managerKey` : String that identifies the margin manager.
- `amount` : Number representing the amount to borrow.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/marginManager.ts
  borrowBase = (managerKey: string, amount: number) => (tx: Transaction)
  borrowQuote = (managerKey: string, amount: number) => (tx: Transaction)

### `repayBase` , `repayQuote`

Use these functions to repay borrowed assets. If no amount is specified, it repays the maximum available balance up to the total debt. The call returns a function that takes a `Transaction`object .

**Parameters**

- `managerKey` : String that identifies the margin manager.
- `amount` : Optional number representing the amount to repay.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/marginManager.ts
  repayBase = (managerKey: string, amount?: number) => (tx: Transaction)
  repayQuote = (managerKey: string, amount?: number) => (tx: Transaction)

### `liquidate`

Use `liquidate` to liquidate an undercollateralized margin manager. The call returns a function that takes a `Transaction`object .

**Parameters**

- `managerAddress` : String representing theaddress **Address** A unique, anonymous identity on a blockchain network. of the margin manager to liquidate.
- `poolKey` : String that identifies theDeepBook pool.
- `debtIsBase` : Boolean indicating whether the debt is in the base asset.
- `repayCoin` : `TransactionArgument` representing the coin to use for repayment.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/marginManager.ts
  liquidate =
  (
  managerAddress: string,
  poolKey: string,
  debtIsBase: boolean,
  repayCoin: TransactionArgument,
  ) =>
  (tx: Transaction)

### `setMarginManagerReferral`

Use `setMarginManagerReferral` to set a pool-specific referral for the margin manager. The referral must be a `DeepBookPoolReferral` minted for the pool associated with the margin manager. The call returns a function that takes a `Transaction`object .

**Parameters**

- `managerKey` : String that identifies the margin manager.
- `referral` : String representing the referral ID.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/marginManager.ts
  setMarginManagerReferral = (managerKey: string, referral: string) => (tx: Transaction)

### `unsetMarginManagerReferral`

Use `unsetMarginManagerReferral` to remove the referral association from a margin manager for a specific pool. The call returns a function that takes a `Transaction`object .

**Parameters**

- `managerKey` : String that identifies the margin manager.
- `poolKey` : String that identifies theDeepBook pool.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/marginManager.ts
  unsetMarginManagerReferral = (managerKey: string, poolKey: string) => (tx: Transaction)

## Read-only functions

The following functions query margin manager state without modifying it.

### `managerState`

Query comprehensive state information for a margin manager, including risk ratio, assets, debts, and Pyth price data.

github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/marginManager.ts
managerState = (poolKey: string, marginManagerId: string) => (tx: Transaction)

### `owner` , `deepbookPool` , `marginPoolId`

Query basic margin manager information.

github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/marginManager.ts
ownerByPoolKey = (poolKey: string, marginManagerId: string) => (tx: Transaction)
deepbookPool = (poolKey: string, marginManagerId: string) => (tx: Transaction)
marginPoolId = (poolKey: string, marginManagerId: string) => (tx: Transaction)

### `baseBalance` , `quoteBalance` , `deepBalance`

Query individual asset balances held in the margin manager.

github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/marginManager.ts
baseBalance = (poolKey: string, marginManagerId: string) => (tx: Transaction)
quoteBalance = (poolKey: string, marginManagerId: string) => (tx: Transaction)
deepBalance = (poolKey: string, marginManagerId: string) => (tx: Transaction)

### `borrowedShares` , `borrowedBaseShares` , `borrowedQuoteShares` , `hasBaseDebt`

Query borrowed position information.

github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/marginManager.ts
borrowedShares = (poolKey: string, marginManagerId: string) => (tx: Transaction)
borrowedBaseShares = (poolKey: string, marginManagerId: string) => (tx: Transaction)
borrowedQuoteShares = (poolKey: string, marginManagerId: string) => (tx: Transaction)
hasBaseDebt = (poolKey: string, marginManagerId: string) => (tx: Transaction)

### `balanceManager` , `calculateAssets` , `calculateDebts`

Query balance and debt information.

github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/marginManager.ts
balanceManager = (poolKey: string, marginManagerId: string) => (tx: Transaction)
calculateAssets = (poolKey: string, marginManagerId: string) => (tx: Transaction)
calculateDebts =
(poolKey: string, coinKey: string, marginManagerId: string) => (tx: Transaction)

## Examples

The following examples demonstrate common margin manager operations.

### Create a margin manager

```tsx
/**
 * @description Create a new margin manager
 * @param {string} poolKey The key to identify the pool
 * @returns A function that takes a Transaction object
 */
newMarginManager = (poolKey: string) => (tx: Transaction) => {};

// Example usage
createMarginManager = (tx: Transaction) => {
  const poolKey = "SUI_DBUSDC";
  tx.add(this.marginContract.newMarginManager(poolKey));
};
```

### Deposit collateral

```tsx
// Example: Deposit 100 SUI as collateral
depositCollateral = (tx: Transaction) => {
  const managerKey = "MARGIN_MANAGER_1";
  tx.add(this.marginContract.depositBase(managerKey, 100));
};
```

### Borrow assets

```tsx
// Example: Borrow 500 USDC
borrowFunds = (tx: Transaction) => {
  const managerKey = "MARGIN_MANAGER_1";
  tx.add(this.marginContract.borrowQuote(managerKey, 500));
};
```

### Repay loan

```tsx
// Example: Repay all borrowed quote assets
repayLoan = (tx: Transaction) => {
  const managerKey = "MARGIN_MANAGER_1";
  // No amount specified = repay all
  tx.add(this.marginContract.repayQuote(managerKey));
};
```

### Liquidate a position

```tsx
// Example: Liquidate an undercollateralized position
liquidatePosition = (tx: Transaction) => {
  const managerAddress = "0x..."; // Address of margin manager to liquidate
  const poolKey = "SUI_DBUSDC";
  const debtIsBase = false; // Debt is in USDC (quote)
  const repayCoin = tx.splitCoins(tx.gas, [500 * 1_000_000]); // 500 USDC
  tx.add(
    this.marginContract.liquidate(
      managerAddress,
      poolKey,
      debtIsBase,
      repayCoin,
    ),
  );
};
```

# Margin Pool SDK

URL: https://docs.sui.io/onchain-finance/deepbook-margin-sdk/margin-pool

Supplying liquidity to margin pools enables lenders to earn interest on their assets while providing borrowing capacity for margin traders. The Margin Pool SDK provides functions for managing liquidity positions and earning referral fees.

## Margin pool functions

TheDeepBook **DeepBook** A decentralized central limit order book (CLOB) built on Sui. Margin SDK provides the following functions for interacting with margin pools.

### `mintSupplierCap`

Use `mintSupplierCap` to create a new supplier capability that can be used to supply and withdraw from margin pools. One `SupplierCap` can be used across multiple margin pools. The call returns a function that takes a `Transaction`object **Object** The basic unit of storage on Sui. .

github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/marginPool.ts
mintSupplierCap = () => (tx: Transaction)

### `supplyToMarginPool`

Use `supplyToMarginPool` to supply assets to a margin pool and earn interest. You can optionally provide a referral ID to share fees with the referrer. The call returns a function that takes a `Transaction`object .

**Parameters**

- `coinKey` : String that identifies the asset type.
- `supplierCap` : `TransactionObjectArgument` representing the supplier cap.
- `amountToDeposit` : Number representing the amount to supply.
- `referralId` : Optional string representing the referral ID.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/marginPool.ts
  supplyToMarginPool =
  (
  coinKey: string,
  supplierCap: TransactionObjectArgument,
  amountToDeposit: number,
  referralId?: string,
  ) =>
  (tx: Transaction)

### `withdrawFromMarginPool`

Use `withdrawFromMarginPool` to withdraw supplied assets from a margin pool. If no amount is specified, it withdraws all available shares. The call returns a function that takes a `Transaction`object .

**Parameters**

- `coinKey` : String that identifies the asset type.
- `supplierCap` : `TransactionObjectArgument` representing the supplier cap.
- `amountToWithdraw` : Optional number representing the amount to withdraw.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/marginPool.ts
  withdrawFromMarginPool =
  (coinKey: string, supplierCap: TransactionObjectArgument, amountToWithdraw?: number) =>
  (tx: Transaction)

### `mintSupplyReferral`

Use `mintSupplyReferral` to create a supply referral for earning fees. The call returns a function that takes a `Transaction`object .

**Parameters**

- `coinKey` : String that identifies the asset type.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/marginPool.ts
  mintSupplyReferral = (coinKey: string) => (tx: Transaction)

### `withdrawReferralFees`

Use `withdrawReferralFees` to withdraw accumulated referral fees. The call returns a function that takes a `Transaction`object .

**Parameters**

- `coinKey` : String that identifies the asset type.
- `referralId` : String representing the referral ID.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/marginPool.ts
  withdrawReferralFees = (coinKey: string, referralId: string) => (tx: Transaction)

## Read-only functions

The following functions query margin pool state without modifying it.

### Pool information

Query basic pool information and configuration.

github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/marginPool.ts
getId = (coinKey: string) => (tx: Transaction)
deepbookPoolAllowed = (coinKey: string, deepbookPoolId: string) => (tx: Transaction)
supplyCap = (coinKey: string) => (tx: Transaction)
maxUtilizationRate = (coinKey: string) => (tx: Transaction)
protocolSpread = (coinKey: string) => (tx: Transaction)
minBorrow = (coinKey: string) => (tx: Transaction)

### Supply and borrow metrics

Query current supply and borrow amounts and shares.

github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/marginPool.ts
totalSupply = (coinKey: string) => (tx: Transaction)
supplyShares = (coinKey: string) => (tx: Transaction)
totalBorrow = (coinKey: string) => (tx: Transaction)
borrowShares = (coinKey: string) => (tx: Transaction)
lastUpdateTimestamp = (coinKey: string) => (tx: Transaction)

### Interest rate

Query the current interest rate based on utilization.

github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/marginPool.ts
interestRate = (coinKey: string) => (tx: Transaction)

### User positions

Query a supplier's position in the pool.

github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/marginPool.ts
userSupplyShares = (coinKey: string, supplierCapId: string) => (tx: Transaction)
userSupplyAmount = (coinKey: string, supplierCapId: string) => (tx: Transaction)

## Examples

The following examples demonstrate common margin pool operations.

### Create a supplier cap

```tsx
/**
 * @description Mint a supplier cap for margin pool
 * @returns A function that takes a Transaction object
 */
mintSupplierCap = () => (tx: Transaction) => {};

// Example usage
createSupplierCap = (tx: Transaction) => {
  const supplierCap = tx.add(this.marginPoolContract.mintSupplierCap());
  // Transfer to user or store for later use
  tx.transferObjects([supplierCap], tx.pure.address(this.config.address));
};
```

### Supply liquidity

```tsx
// Example: Supply 1000 USDC to the margin pool
supplyLiquidity = (tx: Transaction) => {
  const coinKey = "USDC";
  const supplierCapId = "0x..."; // ID of your supplier cap
  const supplierCap = tx.object(supplierCapId);
  const amountToSupply = 1000;

  tx.add(
    this.marginPoolContract.supplyToMarginPool(
      coinKey,
      supplierCap,
      amountToSupply,
      // Optional: provide referral ID
    ),
  );
};
```

### Supply with referral

```tsx
// Example: Supply 1000 USDC with a referral
supplyWithReferral = (tx: Transaction) => {
  const coinKey = "USDC";
  const supplierCapId = "0x...";
  const supplierCap = tx.object(supplierCapId);
  const referralId = "0x..."; // Referral object ID

  tx.add(
    this.marginPoolContract.supplyToMarginPool(
      coinKey,
      supplierCap,
      1000,
      referralId, // Referral will earn fees
    ),
  );
};
```

### Withdraw liquidity

```tsx
// Example: Withdraw 500 USDC from the margin pool
withdrawLiquidity = (tx: Transaction) => {
  const coinKey = "USDC";
  const supplierCapId = "0x...";
  const supplierCap = tx.object(supplierCapId);

  tx.add(
    this.marginPoolContract.withdrawFromMarginPool(coinKey, supplierCap, 500),
  );
};

// Example: Withdraw all available liquidity
withdrawAll = (tx: Transaction) => {
  const coinKey = "USDC";
  const supplierCapId = "0x...";
  const supplierCap = tx.object(supplierCapId);

  // No amount specified = withdraw all
  tx.add(this.marginPoolContract.withdrawFromMarginPool(coinKey, supplierCap));
};
```

### Create and manage referrals

```tsx
// Example: Create a supply referral
createReferral = (tx: Transaction) => {
  const coinKey = "USDC";
  tx.add(this.marginPoolContract.mintSupplyReferral(coinKey));
};

// Example: Withdraw referral fees
claimReferralFees = (tx: Transaction) => {
  const coinKey = "USDC";
  const referralId = "0x..."; // Your referral object ID
  tx.add(this.marginPoolContract.withdrawReferralFees(coinKey, referralId));
};
```

### Query pool state

```tsx
// Example: Check interest rate and utilization
checkPoolMetrics = async (tx: Transaction) => {
  const coinKey = "USDC";

  // Get total supply and borrow
  const totalSupply = tx.add(this.marginPoolContract.totalSupply(coinKey));
  const totalBorrow = tx.add(this.marginPoolContract.totalBorrow(coinKey));

  // Get current interest rate
  const interestRate = tx.add(this.marginPoolContract.interestRate(coinKey));

  // Query user position
  const supplierCapId = "0x...";
  const userShares = tx.add(
    this.marginPoolContract.userSupplyShares(coinKey, supplierCapId),
  );
  const userAmount = tx.add(
    this.marginPoolContract.userSupplyAmount(coinKey, supplierCapId),
  );
};
```

# Orders SDK

URL: https://docs.sui.io/onchain-finance/deepbook-margin-sdk/orders

Placing and managing orders through margin managers enables leveraged trading onDeepBook **DeepBook** A decentralized central limit order book (CLOB) built on Sui. . The Orders SDK provides functions for placing limit and market orders, managing positions, and participating in governance.

## Order functions

TheDeepBook Margin SDK provides the following functions for managing orders through margin managers.

### `placeLimitOrder`

Use `placeLimitOrder` to place a limit order through a margin manager. The call returns a function that takes a `Transaction`object **Object** The basic unit of storage on Sui. .

**Parameters**

- `params` : `PlaceMarginLimitOrderParams`object containing:
- `poolKey` : String that identifies theDeepBook pool
- `marginManagerKey` : String that identifies the margin manager
- `clientOrderId` : String for the client-side order ID
- `price` : Number representing the order price
- `quantity` : Number representing the order quantity
- `isBid` : Boolean indicating if this is a buy order
- `expiration` : Optional number for order expiration timestamp
- `orderType` : Optional `OrderType` enum
- `selfMatchingOption` : Optional `SelfMatchingOptions` enum
- `payWithDeep` : Optional boolean to pay fees with DEEP tokens
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/poolProxy.ts
  placeLimitOrder = (params: PlaceMarginLimitOrderParams) => (tx: Transaction)

### `placeMarketOrder`

Use `placeMarketOrder` to place a market order through a margin manager. The call returns a function that takes a `Transaction`object .

**Parameters**

- `params` : `PlaceMarginMarketOrderParams`object containing similar parameters to limit orders (without price and expiration).
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/poolProxy.ts
  placeMarketOrder = (params: PlaceMarginMarketOrderParams) => (tx: Transaction)

### `placeReduceOnlyLimitOrder`

Use `placeReduceOnlyLimitOrder` to place a limit order that can only reduce your existing debt position. Useful when margin trading is disabled and you need to close positions. The call returns a function that takes a `Transaction`object .

**Parameters**

- `params` : `PlaceMarginLimitOrderParams`object (same as `placeLimitOrder` ).
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/poolProxy.ts
  placeReduceOnlyLimitOrder = (params: PlaceMarginLimitOrderParams) => (tx: Transaction)

### `placeReduceOnlyMarketOrder`

Use `placeReduceOnlyMarketOrder` to place a market order that can only reduce your existing debt position. The call returns a function that takes a `Transaction`object .

**Parameters**

- `params` : `PlaceMarginMarketOrderParams`object (same as `placeMarketOrder` ).
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/poolProxy.ts
  placeReduceOnlyMarketOrder = (params: PlaceMarginMarketOrderParams) => (tx: Transaction)

### `modifyOrder`

Use `modifyOrder` to modify the quantity of an existing order. The call returns a function that takes a `Transaction`object .

warning
The `orderId` is the protocol `orderId` generated during order placement, which is different from the client `orderId` .

**Parameters**

- `marginManagerKey` : String that identifies the margin manager.
- `orderId` : String of the protocol order ID.
- `newQuantity` : Number representing the new order quantity.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/poolProxy.ts
  modifyOrder =
  (marginManagerKey: string, orderId: string, newQuantity: number) => (tx: Transaction)

### `cancelOrder` , `cancelOrders` , `cancelAllOrders`

Use these functions to cancel orders for a margin manager. The call returns a function that takes a `Transaction`object .

**Parameters**

- `marginManagerKey` : String that identifies the margin manager.
- `orderId` (cancelOrder only): String of the protocol order ID.
- `orderIds` (cancelOrders only): Array of protocol order IDs.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/poolProxy.ts
  cancelOrder = (marginManagerKey: string, orderId: string) => (tx: Transaction)
  cancelOrders = (marginManagerKey: string, orderIds: string[]) => (tx: Transaction)
  cancelAllOrders = (marginManagerKey: string) => (tx: Transaction)

### `withdrawSettledAmounts`

Use `withdrawSettledAmounts` to withdraw settled amounts from completed trades. The call returns a function that takes a `Transaction`object .

**Parameters**

- `marginManagerKey` : String that identifies the margin manager.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/poolProxy.ts
  withdrawSettledAmounts = (marginManagerKey: string) => (tx: Transaction)

### `stake` , `unstake`

Use these functions to stake and unstake DEEP tokens through the margin manager for trading fee benefits. The call returns a function that takes a `Transaction`object .

**Parameters**

- `marginManagerKey` : String that identifies the margin manager.
- `stakeAmount` (stake only): Number representing the amount to stake.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/poolProxy.ts
  stake = (marginManagerKey: string, stakeAmount: number) => (tx: Transaction)
  unstake = (marginManagerKey: string) => (tx: Transaction)

### `submitProposal` , `vote`

Use these functions to participate in pool governance through the margin manager. The call returns a function that takes a `Transaction`object .

**Parameters**

- `marginManagerKey` : String that identifies the margin manager.
- `params` (submitProposal): `MarginProposalParams`object with `takerFee` , `makerFee` , and `stakeRequired` .
- `proposalId` (vote): String representing the proposal ID.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/poolProxy.ts
  submitProposal =
  (marginManagerKey: string, params: MarginProposalParams) => (tx: Transaction)
  vote = (marginManagerKey: string, proposalId: string) => (tx: Transaction)

### `claimRebate`

Use `claimRebate` to claim trading rebates earned through the margin manager. The call returns a function that takes a `Transaction`object .

**Parameters**

- `marginManagerKey` : String that identifies the margin manager.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/poolProxy.ts
  claimRebate = (marginManagerKey: string) => (tx: Transaction)

### `withdrawMarginSettledAmounts`

Use `withdrawMarginSettledAmounts` to permissionlessly withdraw settled amounts for any margin manager by itsobject ID. Unlike `withdrawSettledAmounts` which requires ownership, this can be called by anyone. The call returns a function that takes a `Transaction`object .

**Parameters**

- `poolKey` : String that identifies theDeepBook pool.
- `marginManagerId` : String representing theobject ID of the margin manager.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/poolProxy.ts
  withdrawMarginSettledAmounts =
  (poolKey: string, marginManagerId: string) => (tx: Transaction)

### `updateCurrentPrice`

Use `updateCurrentPrice` to update the current price for a pool using the Pyth oracle. The call returns a function that takes a `Transaction`object .

**Parameters**

- `poolKey` : String that identifies theDeepBook pool.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/poolProxy.ts
  updateCurrentPrice = (poolKey: string) => (tx: Transaction)

## Examples

The following examples demonstrate common margin order operations.

### Place a limit order

```tsx
// Params for limit order
interface PlaceMarginLimitOrderParams {
  poolKey: string;
  marginManagerKey: string;
  clientOrderId: string;
  price: number;
  quantity: number;
  isBid: boolean;
  expiration?: number | bigint;
  orderType?: OrderType;
  selfMatchingOption?: SelfMatchingOptions;
  payWithDeep?: boolean;
}

// Example: Place a buy limit order for 10 SUI at $2.50
placeLimitOrder = (tx: Transaction) => {
  const poolKey = "SUI_DBUSDC";
  const managerKey = "MARGIN_MANAGER_1";
  tx.add(
    this.poolProxyContract.placeLimitOrder({
      poolKey,
      marginManagerKey: managerKey,
      clientOrderId: "12345",
      price: 2.5,
      quantity: 10,
      isBid: true,
      payWithDeep: true,
    }),
  );
};
```

### Place a market order

```tsx
// Example: Place a market sell order for 5 SUI
placeMarketOrder = (tx: Transaction) => {
  const poolKey = "SUI_DBUSDC";
  const managerKey = "MARGIN_MANAGER_1";
  tx.add(
    this.poolProxyContract.placeMarketOrder({
      poolKey,
      marginManagerKey: managerKey,
      clientOrderId: "12346",
      quantity: 5,
      isBid: false,
      payWithDeep: true,
    }),
  );
};
```

### Place a reduce-only order

```tsx
// Example: Place a reduce-only limit order to close a position
placeReduceOnly = (tx: Transaction) => {
  const poolKey = "SUI_DBUSDC";
  const managerKey = "MARGIN_MANAGER_1";
  tx.add(
    this.poolProxyContract.placeReduceOnlyLimitOrder({
      poolKey,
      marginManagerKey: managerKey,
      clientOrderId: "12347",
      price: 2.6,
      quantity: 10,
      isBid: true, // Buying back to reduce short position
      payWithDeep: true,
    }),
  );
};
```

### Modify and cancel orders

```tsx
// Example: Modify order quantity
modifyExistingOrder = (tx: Transaction) => {
  const managerKey = "MARGIN_MANAGER_1";
  const orderId = "123456789"; // Protocol order ID
  const newQuantity = 8; // Reduce from 10 to 8
  tx.add(this.poolProxyContract.modifyOrder(managerKey, orderId, newQuantity));
};

// Example: Cancel a single order
cancelSingleOrder = (tx: Transaction) => {
  const managerKey = "MARGIN_MANAGER_1";
  const orderId = "123456789";
  tx.add(this.poolProxyContract.cancelOrder(managerKey, orderId));
};

// Example: Cancel multiple orders
cancelMultipleOrders = (tx: Transaction) => {
  const managerKey = "MARGIN_MANAGER_1";
  const orderIds = ["123456789", "987654321"];
  tx.add(this.poolProxyContract.cancelOrders(managerKey, orderIds));
};

// Example: Cancel all orders
cancelAll = (tx: Transaction) => {
  const managerKey = "MARGIN_MANAGER_1";
  tx.add(this.poolProxyContract.cancelAllOrders(managerKey));
};
```

### Stake and participate in governance

```tsx
// Example: Stake DEEP tokens
stakeDeep = (tx: Transaction) => {
  const managerKey = "MARGIN_MANAGER_1";
  const stakeAmount = 1000; // Stake 1000 DEEP
  tx.add(this.poolProxyContract.stake(managerKey, stakeAmount));
};

// Example: Submit a governance proposal
submitGovernanceProposal = (tx: Transaction) => {
  const managerKey = "MARGIN_MANAGER_1";
  tx.add(
    this.poolProxyContract.submitProposal(managerKey, {
      takerFee: 0.0005, // 5 bps
      makerFee: 0.0002, // 2 bps
      stakeRequired: 1000,
    }),
  );
};

// Example: Vote on a proposal
voteOnProposal = (tx: Transaction) => {
  const managerKey = "MARGIN_MANAGER_1";
  const proposalId = "0x...";
  tx.add(this.poolProxyContract.vote(managerKey, proposalId));
};

// Example: Claim trading rebates
claimTradingRebate = (tx: Transaction) => {
  const managerKey = "MARGIN_MANAGER_1";
  tx.add(this.poolProxyContract.claimRebate(managerKey));
};
```

# Maintainer SDK

URL: https://docs.sui.io/onchain-finance/deepbook-margin-sdk/maintainer

The Maintainer SDK provides administrative functions for managing margin pools, configuring interest rates, and controlling whichDeepBook **DeepBook** A decentralized central limit order book (CLOB) built on Sui. pools can access margin lending. These functions are restricted to maintainers with the appropriate capabilities.

## Maintainer functions

TheDeepBook Margin SDK provides the following functions for pool administration and configuration.

### `createMarginPool`

Use `createMarginPool` to create a new margin pool for a specific asset. Requires the maintainer capability. The call returns a function that takes a `Transaction`object **Object** The basic unit of storage on Sui. .

**Parameters**

- `coinKey` : String that identifies the asset type.
- `poolConfig` : `TransactionArgument` representing the protocol configuration.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/marginMaintainer.ts
  createMarginPool = (coinKey: string, poolConfig: TransactionArgument) => (tx: Transaction)

### `newProtocolConfig`

Use `newProtocolConfig` to create a new protocol configurationobject combining margin pool settings and interest parameters. The call returns a function that takes a `Transaction`object .

**Parameters**

- `coinKey` : String that identifies the asset type.
- `marginPoolConfig` : `MarginPoolConfigParams`object with pool settings.
- `interestConfig` : `InterestConfigParams`object with interest rate parameters.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/marginMaintainer.ts
  newProtocolConfig =
  (
  coinKey: string,
  marginPoolConfig: MarginPoolConfigParams,
  interestConfig: InterestConfigParams,
  ) =>
  (tx: Transaction)

### `newMarginPoolConfig`

Use `newMarginPoolConfig` to create a margin pool configurationobject . The call returns a function that takes a `Transaction`object .

**Parameters**

- `coinKey` : String that identifies the asset type.
- `marginPoolConfig` : `MarginPoolConfigParams`object containing:
- `supplyCap` : Number representing maximum supply allowed
- `maxUtilizationRate` : Number representing maximum utilization (such as 0.8 for 80%)
- `referralSpread` : Number representing protocol spread percentage
- `minBorrow` : Number representing minimum borrow amount
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/marginMaintainer.ts
  newMarginPoolConfig =
  (coinKey: string, marginPoolConfig: MarginPoolConfigParams) => (tx: Transaction)

### `newInterestConfig`

Use `newInterestConfig` to create an interest configurationobject . The call returns a function that takes a `Transaction`object .

**Parameters**

- `interestConfig` : `InterestConfigParams`object containing:
- `baseRate` : Number representing base interest rate
- `baseSlope` : Number representing interest rate slope before kink
- `optimalUtilization` : Number representing the kink point (such as 0.8)
- `excessSlope` : Number representing interest rate slope after kink
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/marginMaintainer.ts
  newInterestConfig = (interestConfig: InterestConfigParams) => (tx: Transaction)

### `enableDeepbookPoolForLoan` , `disableDeepbookPoolForLoan`

Use these functions to control whichDeepBook pools can borrow from the margin pool. The call returns a function that takes a `Transaction`object .

**Parameters**

- `deepbookPoolKey` : String that identifies theDeepBook pool.
- `coinKey` : String that identifies the margin pool asset.
- `marginPoolCap` : String representing the margin pool capability ID.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/marginMaintainer.ts
  enableDeepbookPoolForLoan =
  (deepbookPoolKey: string, coinKey: string, marginPoolCap: TransactionObjectArgument) =>
  (tx: Transaction)
  disableDeepbookPoolForLoan =
  (deepbookPoolKey: string, coinKey: string, marginPoolCap: TransactionObjectArgument) =>
  (tx: Transaction)

### `updateInterestParams`

Use `updateInterestParams` to update the interest rate parameters for a margin pool. The call returns a function that takes a `Transaction`object .

**Parameters**

- `coinKey` : String that identifies the margin pool asset.
- `marginPoolCap` : String representing the margin pool capability ID.
- `interestConfig` : `InterestConfigParams`object with new interest parameters.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/marginMaintainer.ts
  updateInterestParams =
  (
  coinKey: string,
  marginPoolCap: TransactionObjectArgument,
  interestConfig: InterestConfigParams,
  ) =>
  (tx: Transaction)

### `updateMarginPoolConfig`

Use `updateMarginPoolConfig` to update the configuration settings for a margin pool. The call returns a function that takes a `Transaction`object .

**Parameters**

- `coinKey` : String that identifies the margin pool asset.
- `marginPoolCap` : String representing the margin pool capability ID.
- `marginPoolConfig` : `MarginPoolConfigParams`object with new pool settings.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/marginMaintainer.ts
  updateMarginPoolConfig =
  (
  coinKey: string,
  marginPoolCap: TransactionObjectArgument,
  marginPoolConfig: MarginPoolConfigParams,
  ) =>
  (tx: Transaction)

### `withdrawMaintainerFees`

Use `withdrawMaintainerFees` to withdraw accumulated maintainer fees from a margin pool. The call returns a function that takes a `Transaction`object .

**Parameters**

- `coinKey` : String that identifies the margin pool asset.
- `marginPoolCap` : String representing the margin pool capability ID.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/marginMaintainer.ts

### `withdrawProtocolFees`

Use `withdrawProtocolFees` to withdraw accumulated protocol fees from a margin pool. The call returns a function that takes a `Transaction`object .

**Parameters**

- `coinKey` : String that identifies the margin pool asset.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/marginMaintainer.ts

### `adminWithdrawDefaultReferralFees`

Use `adminWithdrawDefaultReferralFees` to withdraw default referral fees from a margin pool. The call returns a function that takes a `Transaction`object .

**Parameters**

- `coinKey` : String that identifies the margin pool asset.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/marginMaintainer.ts

## Examples

The following examples demonstrate common maintainer operations.

### Create a margin pool

```tsx
// Example: Create a USDC margin pool
createUsdcMarginPool = (tx: Transaction) => {
  const coinKey = "USDC";

  // Create pool configuration
  const poolConfig = tx.add(
    this.maintainerContract.newProtocolConfig(
      coinKey,
      {
        supplyCap: 10_000_000, // 10M USDC
        maxUtilizationRate: 0.8, // 80%
        referralSpread: 0.1, // 10% protocol spread
        minBorrow: 100, // 100 USDC minimum
      },
      {
        baseRate: 0.02, // 2% base rate
        baseSlope: 0.1, // 10% slope before kink
        optimalUtilization: 0.8, // 80% kink point
        excessSlope: 1.0, // 100% slope after kink
      },
    ),
  );

  // Create the pool
  tx.add(this.maintainerContract.createMarginPool(coinKey, poolConfig));
};
```

### Enable aDeepBook pool for borrowing

```tsx
// Example: Allow SUI/USDC pool to borrow from USDC margin pool
enablePoolForBorrowing = (tx: Transaction) => {
  const deepbookPoolKey = "SUI_DBUSDC";
  const coinKey = "USDC";
  const marginPoolCapId = "0x..."; // Margin pool cap ID

  tx.add(
    this.maintainerContract.enableDeepbookPoolForLoan(
      deepbookPoolKey,
      coinKey,
      marginPoolCapId,
    ),
  );
};
```

### Update interest rate parameters

```tsx
// Example: Update USDC margin pool interest rates
updateInterestRates = (tx: Transaction) => {
  const coinKey = "USDC";
  const marginPoolCapId = "0x...";

  tx.add(
    this.maintainerContract.updateInterestParams(coinKey, marginPoolCapId, {
      baseRate: 0.03, // Increase to 3% base rate
      baseSlope: 0.12, // Increase slope
      optimalUtilization: 0.75, // Lower kink to 75%
      excessSlope: 1.5, // Steeper excess slope
    }),
  );
};
```

### Update margin pool configuration

```tsx
// Example: Update USDC margin pool limits
updatePoolConfig = (tx: Transaction) => {
  const coinKey = "USDC";
  const marginPoolCapId = "0x...";

  tx.add(
    this.maintainerContract.updateMarginPoolConfig(coinKey, marginPoolCapId, {
      supplyCap: 20_000_000, // Increase to 20M USDC
      maxUtilizationRate: 0.85, // Allow 85% utilization
      referralSpread: 0.12, // Increase protocol spread
      minBorrow: 50, // Lower minimum to 50 USDC
    }),
  );
};
```

### Complete pool setup workflow

```tsx
// Example: Complete workflow for setting up a new margin pool
setupNewMarginPool = (tx: Transaction) => {
  const coinKey = "SUI";

  // Step 1: Create protocol config
  const poolConfig = tx.add(
    this.maintainerContract.newProtocolConfig(
      coinKey,
      {
        supplyCap: 1_000_000, // 1M SUI
        maxUtilizationRate: 0.75,
        referralSpread: 0.1,
        minBorrow: 10,
      },
      {
        baseRate: 0.01,
        baseSlope: 0.08,
        optimalUtilization: 0.8,
        excessSlope: 0.8,
      },
    ),
  );

  // Step 2: Create the margin pool
  tx.add(this.maintainerContract.createMarginPool(coinKey, poolConfig));

  // Step 3: Enable specific DeepBook pools for borrowing
  const marginPoolCapId = "0x..."; // Get from pool creation event
  tx.add(
    this.maintainerContract.enableDeepbookPoolForLoan(
      "SUI_DBUSDC",
      coinKey,
      marginPoolCapId,
    ),
  );
  tx.add(
    this.maintainerContract.enableDeepbookPoolForLoan(
      "SUI_USDT",
      coinKey,
      marginPoolCapId,
    ),
  );
};
```

# Take Profit Stop Loss SDK

URL: https://docs.sui.io/onchain-finance/deepbook-margin-sdk/tpsl

The TPSL (Take Profit Stop Loss) SDK provides functions for managing conditional orders that automatically execute when certain price conditions are met.

## TPSL functions

TheDeepBook **DeepBook** A decentralized central limit order book (CLOB) built on Sui. Margin SDK provides the following functions for managing conditional orders.

### `addConditionalOrder`

Use `addConditionalOrder` to add a conditional order that executes when a price condition is met. The call returns a function that takes a `Transaction`object **Object** The basic unit of storage on Sui. .

**Parameters**

- `marginManagerKey` : String that identifies the margin manager.
- `conditionalOrderId` : Number representing the unique ID for this conditional order.
- `triggerBelowPrice` : Boolean indicating whether to trigger when price falls below the trigger price.
- `triggerPrice` : Number representing the price at which to trigger the order.
- `pendingOrder` :Object containing the order details (either `PendingLimitOrderParams` or `PendingMarketOrderParams` ).
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/marginTPSL.ts
  addConditionalOrder = (params: AddConditionalOrderParams) => (tx: Transaction)

### `cancelConditionalOrder`

Use `cancelConditionalOrder` to cancel a specific conditional order. The call returns a function that takes a `Transaction`object .

**Parameters**

- `marginManagerKey` : String that identifies the margin manager.
- `conditionalOrderId` : String representing the ID of the conditional order to cancel.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/marginTPSL.ts
  cancelConditionalOrder =
  (marginManagerKey: string, conditionalOrderId: string) => (tx: Transaction)

### `cancelAllConditionalOrders`

Use `cancelAllConditionalOrders` to cancel all conditional orders for a margin manager. The call returns a function that takes a `Transaction`object .

**Parameters**

- `marginManagerKey` : String that identifies the margin manager.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/marginTPSL.ts
  cancelAllConditionalOrders = (marginManagerKey: string) => (tx: Transaction)

### `executeConditionalOrders`

Use `executeConditionalOrders` to execute conditional orders that have been triggered. This is a permissionless function that can be called by anyone. The call returns a function that takes a `Transaction`object .

**Parameters**

- `managerAddress` : String representing theaddress **Address** A unique, anonymous identity on a blockchain network. of the margin manager whose orders to execute.
- `poolKey` : String that identifies theDeepBook pool.
- `maxOrdersToExecute` : Number representing the maximum number of orders to execute in this call.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/marginTPSL.ts
  executeConditionalOrders =
  (managerAddress: string, poolKey: string, maxOrdersToExecute: number) => (tx: Transaction)

## Helper functions

These helper functions create conditions and pending orders for conditional orders.

### `newCondition`

Use `newCondition` to create a trigger condition for a conditional order. The call returns a function that takes a `Transaction`object .

**Parameters**

- `poolKey` : String that identifies the pool.
- `triggerBelowPrice` : Boolean indicating whether to trigger when price falls below the trigger price.
- `triggerPrice` : Number representing the price at which to trigger.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/marginTPSL.ts
  newCondition =
  (poolKey: string, triggerBelowPrice: boolean, triggerPrice: number | bigint) =>
  (tx: Transaction)

### `newPendingLimitOrder`

Use `newPendingLimitOrder` to create a pending limit order for use in conditional orders. The call returns a function that takes a `Transaction`object .

**Parameters**

- `poolKey` : String that identifies the pool.
- `params` : `PendingLimitOrderParams`object containing:
- `clientOrderId` : Number for client tracking.
- `orderType` : Optional order type (default: `NO_RESTRICTION` ).
- `selfMatchingOption` : Optional self-matching option (default: `SELF_MATCHING_ALLOWED` ).
- `price` : Number representing the limit price.
- `quantity` : Number representing the order quantity.
- `isBid` : Boolean indicating if this is a buy order.
- `payWithDeep` : Optional boolean for fee payment (default: `true` ).
- `expireTimestamp` : Optional expiration timestamp.
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/marginTPSL.ts
  newPendingLimitOrder =
  (poolKey: string, params: PendingLimitOrderParams) => (tx: Transaction)

### `newPendingMarketOrder`

Use `newPendingMarketOrder` to create a pending market order for use in conditional orders. The call returns a function that takes a `Transaction`object .

**Parameters**

- `poolKey` : String that identifies the pool.
- `params` : `PendingMarketOrderParams`object containing:
- `clientOrderId` : Number for client tracking.
- `selfMatchingOption` : Optional self-matching option (default: `SELF_MATCHING_ALLOWED` ).
- `quantity` : Number representing the order quantity.
- `isBid` : Boolean indicating if this is a buy order.
- `payWithDeep` : Optional boolean for fee payment (default: `true` ).
  github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/marginTPSL.ts
  newPendingMarketOrder =
  (poolKey: string, params: PendingMarketOrderParams) => (tx: Transaction)

## Read-only functions

### `conditionalOrderIds`

Query all conditional order IDs for a margin manager.

github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/marginTPSL.ts
conditionalOrderIds = (poolKey: string, marginManagerId: string) => (tx: Transaction)

### `conditionalOrder`

Query a specific conditional order by ID.

github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/marginTPSL.ts
conditionalOrder =
(poolKey: string, marginManagerId: string, conditionalOrderId: string) => (tx: Transaction)

### `lowestTriggerAbovePrice` , `highestTriggerBelowPrice`

Query trigger prices for conditional orders. `lowestTriggerAbovePrice` returns the lowest trigger price among trigger-above orders (or `max_u64` if none exist). `highestTriggerBelowPrice` returns the highest trigger price among trigger-below orders (or `0` if none exist).

github.com/MystenLabs/ts-sdks/packages/deepbook-v3/src/transactions/marginTPSL.ts
lowestTriggerAbovePrice = (poolKey: string, marginManagerId: string) => (tx: Transaction)
highestTriggerBelowPrice = (poolKey: string, marginManagerId: string) => (tx: Transaction)

## Examples

### Set up a stop loss order

```tsx
// Example: Create a stop loss order that sells when price drops below 2.0
const setStopLoss = (tx: Transaction) => {
  const managerKey = "MARGIN_MANAGER_1";
  traderClient.marginTPSL.addConditionalOrder({
    marginManagerKey: managerKey,
    conditionalOrderId: 1,
    triggerBelowPrice: true, // Trigger when price falls below
    triggerPrice: 2.0,
    pendingOrder: {
      clientOrderId: 100,
      quantity: 50,
      isBid: false, // Sell order
      payWithDeep: true,
    },
  })(tx);
};
```

### Set up a take profit order

```tsx
// Example: Create a take profit order that sells when price rises above 5.0
const setTakeProfit = (tx: Transaction) => {
  const managerKey = "MARGIN_MANAGER_1";
  traderClient.marginTPSL.addConditionalOrder({
    marginManagerKey: managerKey,
    conditionalOrderId: 2,
    triggerBelowPrice: false, // Trigger when price rises above
    triggerPrice: 5.0,
    pendingOrder: {
      clientOrderId: 101,
      price: 5.0, // Limit order at 5.0
      quantity: 50,
      isBid: false, // Sell order
      payWithDeep: true,
    },
  })(tx);
};
```

### Execute triggered orders (keeper)

```tsx
// Example: Execute conditional orders as a keeper
const executeOrders = (tx: Transaction) => {
  const managerAddress = "0x..."; // Address of margin manager
  // Execute up to 10 triggered orders
  traderClient.marginTPSL.executeConditionalOrders(
    managerAddress,
    "SUI_USDC",
    10,
  )(tx);
};
```

# DeepBook Margin Indexer

URL: https://docs.sui.io/onchain-finance/deepbook-margin/deepbook-margin-indexer

TheDeepBook **DeepBook** A decentralized central limit order book (CLOB) built on Sui. Margin Indexer extends the DeepBookV3 Indexer with endpoints for margin trading data. These endpoints provide access to margin manager events, margin pool operations, and liquidation monitoring.

## Public endpoints

The margin endpoints are available through the same public indexer as DeepBookV3.

- **Mainnet **Mainnet** Production network for live transactions and real-value assets.** : `https://deepbook-indexer.mainnet.mystenlabs.com/`
- **Testnet **Testnet** Staging network for testing changes before production deployment.** : `https://deepbook-indexer.testnet.mystenlabs.com/`

## Common query parameters

All margin endpoints support the following common query parameters:

- `start_time` : Start of time range in Unix timestamp seconds (defaults to 24 hours ago)
- `end_time` : End of time range in Unix timestamp seconds (defaults to current time)
- `limit` : Maximum number of results to return (defaults to 1)

## Margin manager endpoints

### Get margin manager creation events

```http
/margin_manager_created?margin_manager_id=<ID>
```

Returns events for when margin managers are created.

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
    "margin_manager_id": "0x1234...",
    "balance_manager_id": "0x5678...",
    "deepbook_pool_id": "0x9abc...",
    "owner": "0xabcd...",
    "onchain_timestamp": 1738000000000
  }
]
```

### Get loan borrowed events

```http
/loan_borrowed?margin_manager_id=<ID>&margin_pool_id=<ID>
```

Returns events for when assets are borrowed from margin pools.

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
    "margin_manager_id": "0x1234...",
    "margin_pool_id": "0x5678...",
    "loan_amount": 1000000000,
    "loan_shares": 1000000000,
    "onchain_timestamp": 1738000000000
  }
]
```

### Get loan repaid events

```http
/loan_repaid?margin_manager_id=<ID>&margin_pool_id=<ID>
```

Returns events for when borrowed assets are repaid.

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
    "margin_manager_id": "0x1234...",
    "margin_pool_id": "0x5678...",
    "repay_amount": 1000000000,
    "repay_shares": 1000000000,
    "onchain_timestamp": 1738000000000
  }
]
```

### Get liquidation events

```http
/liquidation?margin_manager_id=<ID>&margin_pool_id=<ID>
```

Returns events for when margin managers are liquidated.

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
    "margin_manager_id": "0x1234...",
    "margin_pool_id": "0x5678...",
    "liquidation_amount": 1000000000,
    "pool_reward": 10000000,
    "pool_default": 0,
    "risk_ratio": 800000000,
    "onchain_timestamp": 1738000000000,
    "remaining_base_asset": "500000000",
    "remaining_quote_asset": "2000000000",
    "remaining_base_debt": "0",
    "remaining_quote_debt": "0",
    "base_pyth_price": 100000000,
    "base_pyth_decimals": 8,
    "quote_pyth_price": 100000000,
    "quote_pyth_decimals": 8
  }
]
```

### Get margin managers information

```http
/margin_managers_info
```

Returns an aggregate view of all margin managers with their associated pool and asset information.

#### Response

```json
[
  {
    "margin_manager_id": "0x1234...",
    "deepbook_pool_id": "0x5678...",
    "base_asset_id": "0xabcd...",
    "base_asset_symbol": "SUI",
    "quote_asset_id": "0xefgh...",
    "quote_asset_symbol": "USDC",
    "base_margin_pool_id": "0x1111...",
    "quote_margin_pool_id": "0x2222..."
  }
]
```

### Get margin manager states

```http
/margin_manager_states?max_risk_ratio=<FLOAT>&deepbook_pool_id=<ID>
```

Returns the current state of margin managers. This endpoint is useful for monitoring positions that might be at risk of liquidation.

- `max_risk_ratio` : Filter to return only margin managers with a risk ratio below this threshold; useful for finding liquidation opportunities
- `deepbook_pool_id` : Filter by specificDeepBook pool

#### Response

```json
[
  {
    "id": 1,
    "margin_manager_id": "0x1234...",
    "deepbook_pool_id": "0x5678...",
    "base_margin_pool_id": "0x1111...",
    "quote_margin_pool_id": "0x2222...",
    "base_asset_id": "0xabcd...",
    "base_asset_symbol": "SUI",
    "quote_asset_id": "0xefgh...",
    "quote_asset_symbol": "USDC",
    "risk_ratio": "1.5",
    "base_asset": "1000000000",
    "quote_asset": "5000000000",
    "base_debt": "500000000",
    "quote_debt": "2000000000",
    "base_pyth_price": 100000000,
    "base_pyth_decimals": 8,
    "quote_pyth_price": 100000000,
    "quote_pyth_decimals": 8,
    "created_at": "2025-01-01 00:00:00",
    "updated_at": "2025-01-01 12:00:00",
    "current_price": "2.5",
    "lowest_trigger_above_price": null,
    "highest_trigger_below_price": null
  }
]
```

## Margin pool endpoints

### Get asset supplied events

```http
/asset_supplied?margin_pool_id=<ID>&supplier=<ADDRESS>
```

Returns events for when assets are supplied to margin pools.

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
    "margin_pool_id": "0x1234...",
    "asset_type": "0x2::sui::SUI",
    "supplier": "0xabcd...",
    "amount": 1000000000,
    "shares": 1000000000,
    "onchain_timestamp": 1738000000000
  }
]
```

### Get asset withdrawn events

```http
/asset_withdrawn?margin_pool_id=<ID>&supplier=<ADDRESS>
```

Returns events for when assets are withdrawn from margin pools.

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
    "margin_pool_id": "0x1234...",
    "asset_type": "0x2::sui::SUI",
    "supplier": "0xabcd...",
    "amount": 1000000000,
    "shares": 1000000000,
    "onchain_timestamp": 1738000000000
  }
]
```

### Get margin pool creation events

```http
/margin_pool_created?margin_pool_id=<ID>
```

Returns events for when margin pools are created.

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
    "margin_pool_id": "0x1234...",
    "maintainer_cap_id": "0x5678...",
    "asset_type": "0x2::sui::SUI",
    "config_json": {
      "margin_pool_config": {
        "supply_cap": 10000000000000,
        "max_utilization_rate": 950000000,
        "protocol_spread": 50000000,
        "min_borrow": 1000000
      },
      "interest_config": {
        "base_rate": 100000,
        "base_slope": 200000,
        "optimal_utilization": 800000000,
        "excess_slope": 500000
      }
    },
    "onchain_timestamp": 1738000000000
  }
]
```

### GetDeepBook pool updated events

```http
/deepbook_pool_updated?margin_pool_id=<ID>&deepbook_pool_id=<ID>
```

Returns events for whenDeepBook pools are enabled or disabled for a margin pool.

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
    "margin_pool_id": "0x1234...",
    "deepbook_pool_id": "0x5678...",
    "pool_cap_id": "0x9abc...",
    "enabled": true,
    "onchain_timestamp": 1738000000000
  }
]
```

### Get interest parameter update events

```http
/interest_params_updated?margin_pool_id=<ID>
```

Returns events for when interest rate parameters are updated.

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
    "margin_pool_id": "0x1234...",
    "pool_cap_id": "0x5678...",
    "config_json": {
      "base_rate": 100000,
      "base_slope": 200000,
      "optimal_utilization": 800000000,
      "excess_slope": 500000
    },
    "onchain_timestamp": 1738000000000
  }
]
```

### Get margin pool configuration update events

```http
/margin_pool_config_updated?margin_pool_id=<ID>
```

Returns events for when margin pool configuration is updated.

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
    "margin_pool_id": "0x1234...",
    "pool_cap_id": "0x5678...",
    "config_json": {
      "supply_cap": 10000000000000,
      "max_utilization_rate": 950000000,
      "protocol_spread": 50000000,
      "min_borrow": 1000000
    },
    "onchain_timestamp": 1738000000000
  }
]
```

### Get supplier cap minted events

```http
/supplier_cap_minted?supplier_cap_id=<ID>
```

Returns events for when supplier capabilities are minted.

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
    "supplier_cap_id": "0x1234...",
    "onchain_timestamp": 1738000000000
  }
]
```

### Get supply referral minted events

```http
/supply_referral_minted?margin_pool_id=<ID>&owner=<ADDRESS>
```

Returns events for when supply referrals are minted.

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
    "margin_pool_id": "0x5678...",
    "supply_referral_id": "0x1234...",
    "owner": "0xabcd...",
    "onchain_timestamp": 1738000000000
  }
]
```

### Get protocol fees increased events

```http
/protocol_fees_increased?margin_pool_id=<ID>
```

Returns events for when protocol fees are increased.

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
    "margin_pool_id": "0x1234...",
    "total_shares": 1000000000,
    "referral_fees": 100000,
    "maintainer_fees": 200000,
    "protocol_fees": 300000,
    "onchain_timestamp": 1738000000000
  }
]
```

### Get referral fees claimed events

```http
/referral_fees_claimed?referral_id=<ID>&owner=<ADDRESS>
```

Returns events for when referral fees are claimed.

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
    "referral_id": "0x1234...",
    "owner": "0xabcd...",
    "fees": 1000000,
    "onchain_timestamp": 1738000000000
  }
]
```

### Get collateral events

```http
/collateral_events?margin_manager_id=<ID>&type=<"Deposit" | "Withdraw">&is_base=<BOOLEAN>
```

Returns events for when collateral is deposited or withdrawn from margin managers. This endpoint provides detailed tracking of all collateral movements including Pyth price data at the time of the event.

- `margin_manager_id` : Filter by specific margin manager
- `type` : Filter by event type ( `Deposit` or `Withdraw` )
- `is_base` : Filter by whether the collateral is the base asset ( `true` ) or quote asset ( `false` )

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
    "event_type": "Deposit",
    "margin_manager_id": "0x1234...",
    "amount": "1000000000",
    "asset_type": "0x2::sui::SUI",
    "pyth_decimals": 8,
    "pyth_price": "100000000",
    "withdraw_base_asset": null,
    "base_pyth_decimals": 8,
    "base_pyth_price": "100000000",
    "quote_pyth_decimals": 8,
    "quote_pyth_price": "100000000",
    "remaining_base_asset": "500000000",
    "remaining_quote_asset": "2000000000",
    "remaining_base_debt": "0",
    "remaining_quote_debt": "0",
    "onchain_timestamp": 1738000000000
  }
]
```

## Admin and registry endpoints

### Get maintainer cap updated events

```http
/maintainer_cap_updated?maintainer_cap_id=<ID>
```

Returns events for when maintainer capabilities are updated.

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
    "maintainer_cap_id": "0x1234...",
    "allowed": true,
    "onchain_timestamp": 1738000000000
  }
]
```

### Get maintainer fees withdrawn events

```http
/maintainer_fees_withdrawn?margin_pool_id=<ID>
```

Returns events for when maintainer fees are withdrawn.

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
    "margin_pool_id": "0x1234...",
    "margin_pool_cap_id": "0x5678...",
    "maintainer_fees": 1000000,
    "onchain_timestamp": 1738000000000
  }
]
```

### Get protocol fees withdrawn events

```http
/protocol_fees_withdrawn?margin_pool_id=<ID>
```

Returns events for when protocol fees are withdrawn.

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
    "margin_pool_id": "0x1234...",
    "protocol_fees": 1000000,
    "onchain_timestamp": 1738000000000
  }
]
```

### Get pause cap updated events

```http
/pause_cap_updated?pause_cap_id=<ID>
```

Returns events for when pause capabilities are updated.

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
    "pause_cap_id": "0x1234...",
    "allowed": true,
    "onchain_timestamp": 1738000000000
  }
]
```

### GetDeepBook pool registered events

```http
/deepbook_pool_registered?pool_id=<ID>
```

Returns events for whenDeepBook pools are registered in the margin registry.

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
    "config_json": {
      "base_margin_pool_id": "0x5678...",
      "quote_margin_pool_id": "0x9abc...",
      "risk_ratios": {
        "min_withdraw_risk_ratio": 1200000000,
        "min_borrow_risk_ratio": 1100000000,
        "liquidation_risk_ratio": 1000000000,
        "target_liquidation_risk_ratio": 1050000000
      },
      "user_liquidation_reward": 50000000,
      "pool_liquidation_reward": 10000000,
      "enabled": true
    },
    "onchain_timestamp": 1738000000000
  }
]
```

### GetDeepBook pool registry updated events

```http
/deepbook_pool_updated_registry?pool_id=<ID>
```

Returns events for whenDeepBook pool registry entries are updated.

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
    "enabled": true,
    "onchain_timestamp": 1738000000000
  }
]
```

### GetDeepBook pool config updated events

```http
/deepbook_pool_config_updated?pool_id=<ID>
```

Returns events for whenDeepBook pool configurations are updated.

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
    "config_json": {
      "base_margin_pool_id": "0x5678...",
      "quote_margin_pool_id": "0x9abc...",
      "risk_ratios": {
        "min_withdraw_risk_ratio": 1200000000,
        "min_borrow_risk_ratio": 1100000000,
        "liquidation_risk_ratio": 1000000000,
        "target_liquidation_risk_ratio": 1050000000
      },
      "user_liquidation_reward": 50000000,
      "pool_liquidation_reward": 10000000,
      "enabled": true
    },
    "onchain_timestamp": 1738000000000
  }
]
```
