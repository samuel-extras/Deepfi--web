/**
 * DeepBook Margin — client-side helpers (testnet by default).
 *
 * A MarginManager (shared object, one per DeepBook pool per user) wraps a
 * BalanceManager and adds borrow/repay against per-asset MarginPools, gated by
 * oracle-priced risk ratios. Trading goes through the margin package's
 * `pool_proxy` (the *_v2 entry points the SDK targets).
 *
 * Oracle rule on testnet: deposits, withdrawals, borrows and proxy orders read
 * Pyth PriceInfoObjects that nobody keeper-refreshes — so those PTBs must
 * prepend a Hermes update. The SDK's `getPriceInfoObjects(tx, coinKeys)` does
 * exactly that (hermes-beta on testnet) and is awaited into every such tx.
 */
import type { Transaction } from "@mysten/sui/transactions";
import { bcs } from "@mysten/sui/bcs";
import {
  MAX_TIMESTAMP,
  mainnetMarginPools,
  testnetMarginPools,
} from "@mysten/deepbook-v3";
import {
  DB_NETWORK,
  DB_PKG,
  SPOT_POOLS,
  humanToRawPrice,
  humanToRawQuantity,
  type SpotPoolMeta,
} from "./deepbookSpot";

export const DB_MARGIN_POOLS: Record<string, { address: string; type: string }> =
  DB_NETWORK === "mainnet" ? mainnetMarginPools : testnetMarginPools;

/** Key for the user's MarginManager in the SDK config map. */
export const MARGIN_KEY = "MARGIN_MANAGER";
/** Key for that manager's wrapped BalanceManager (read paths reuse spot machinery). */
export const MARGIN_BM_KEY = "MARGIN_BM";

/**
 * Pools that can support margin: both legs need a lending MarginPool.
 * (Runtime additionally checks `isPoolEnabledForMargin` — registry state.)
 * Verified live on testnet 2026-06-11: SUI_DBUSDC, DEEP_DBUSDC, DBTC_DBUSDC,
 * DEEP_SUI are all enabled, minBorrow 1.25 (≈5x), liquidation 1.1.
 */
export const MARGIN_POOL_CANDIDATES: SpotPoolMeta[] = SPOT_POOLS.filter(
  p => DB_MARGIN_POOLS[p.base] && DB_MARGIN_POOLS[p.quote]
);

export const DEFAULT_MARGIN_POOL_KEY = MARGIN_POOL_CANDIDATES.some(
  p => p.key === "SUI_DBUSDC"
)
  ? "SUI_DBUSDC"
  : MARGIN_POOL_CANDIDATES[0]?.key ?? "";

export function getMarginPoolMeta(poolKey: string): SpotPoolMeta {
  const pool = MARGIN_POOL_CANDIDATES.find(p => p.key === poolKey);
  if (!pool) throw new Error(`Pool ${poolKey} does not support margin`);
  return pool;
}

export const marginManagerStorageKey = (address: string, poolKey: string) =>
  `deepfi.deepbook.marginManager.${DB_NETWORK}.${address}.${poolKey}`;

/* ------------------------- v1 order builders --------------------------- */
/**
 * The TESTNET margin package predates the SDK's `pool_proxy::*_v2` targets —
 * v1 entry points take no margin pools and no oracles (ABI-verified):
 *   place_limit_order(registry, manager, pool, client_order_id, order_type,
 *     self_matching, price, quantity, is_bid, pay_with_deep, expire, clock)
 *   place_market_order(registry, manager, pool, client_order_id,
 *     self_matching, quantity, is_bid, pay_with_deep, clock)
 */

export type MarginOrderCommon = {
  pool: SpotPoolMeta;
  marginManagerId: string;
  clientOrderId: string;
  quantity: number; // human base units
  isBid: boolean;
  payWithDeep: boolean;
};

export type Tif = "GTC" | "IOC" | "FOK";

/** 0 = no restriction (GTC), 1 = IOC, 2 = FOK, 3 = post-only (GTC only). */
export const orderTypeU8 = (o?: {
  postOnly?: boolean;
  ioc?: boolean;
  tif?: Tif;
}) =>
  o?.postOnly ? 3 : o?.ioc || o?.tif === "IOC" ? 1 : o?.tif === "FOK" ? 2 : 0;

export function addMarginLimitOrderV1(
  tx: Transaction,
  args: MarginOrderCommon & {
    price: number;
    postOnly?: boolean;
    ioc?: boolean;
    tif?: Tif;
  }
) {
  tx.moveCall({
    target: `${DB_PKG.MARGIN_PACKAGE_ID}::pool_proxy::place_limit_order`,
    arguments: [
      tx.object(DB_PKG.MARGIN_REGISTRY_ID),
      tx.object(args.marginManagerId),
      tx.object(args.pool.address),
      tx.pure.u64(args.clientOrderId),
      tx.pure.u8(orderTypeU8(args)),
      tx.pure.u8(0), // SELF_MATCHING_ALLOWED
      tx.pure.u64(humanToRawPrice(args.price, args.pool)),
      tx.pure.u64(humanToRawQuantity(args.quantity, args.pool)),
      tx.pure.bool(args.isBid),
      tx.pure.bool(args.payWithDeep),
      tx.pure.u64(MAX_TIMESTAMP),
      tx.object.clock(),
    ],
    typeArguments: [args.pool.baseType, args.pool.quoteType],
  });
}

export function addMarginMarketOrderV1(tx: Transaction, args: MarginOrderCommon) {
  tx.moveCall({
    target: `${DB_PKG.MARGIN_PACKAGE_ID}::pool_proxy::place_market_order`,
    arguments: [
      tx.object(DB_PKG.MARGIN_REGISTRY_ID),
      tx.object(args.marginManagerId),
      tx.object(args.pool.address),
      tx.pure.u64(args.clientOrderId),
      tx.pure.u8(0), // SELF_MATCHING_ALLOWED
      tx.pure.u64(humanToRawQuantity(args.quantity, args.pool)),
      tx.pure.bool(args.isBid),
      tx.pure.bool(args.payWithDeep),
      tx.object.clock(),
    ],
    typeArguments: [args.pool.baseType, args.pool.quoteType],
  });
}

/** Debt-side margin pool + coin type (3rd type arg of reduce-only calls). */
function debtPoolFor(pool: SpotPoolMeta, debtIsBase: boolean) {
  const coinKey = debtIsBase ? pool.base : pool.quote;
  const mp = DB_MARGIN_POOLS[coinKey];
  if (!mp) throw new Error(`No margin pool for ${coinKey}`);
  return { address: mp.address, type: debtIsBase ? pool.baseType : pool.quoteType };
}

/**
 * Reduce-only orders may only DECREASE the manager's debt (testnet v1 ABI:
 * registry, manager, pool, margin_pool<Debt>, client_order_id, [order_type,]
 * self_matching, [price,] quantity, is_bid, pay_with_deep, [expire,] clock).
 */
export function addMarginReduceOnlyLimitOrderV1(
  tx: Transaction,
  args: MarginOrderCommon & {
    price: number;
    postOnly?: boolean;
    ioc?: boolean;
    tif?: Tif;
    debtIsBase: boolean;
  }
) {
  const debt = debtPoolFor(args.pool, args.debtIsBase);
  tx.moveCall({
    target: `${DB_PKG.MARGIN_PACKAGE_ID}::pool_proxy::place_reduce_only_limit_order`,
    arguments: [
      tx.object(DB_PKG.MARGIN_REGISTRY_ID),
      tx.object(args.marginManagerId),
      tx.object(args.pool.address),
      tx.object(debt.address),
      tx.pure.u64(args.clientOrderId),
      tx.pure.u8(orderTypeU8(args)),
      tx.pure.u8(0), // SELF_MATCHING_ALLOWED
      tx.pure.u64(humanToRawPrice(args.price, args.pool)),
      tx.pure.u64(humanToRawQuantity(args.quantity, args.pool)),
      tx.pure.bool(args.isBid),
      tx.pure.bool(args.payWithDeep),
      tx.pure.u64(MAX_TIMESTAMP),
      tx.object.clock(),
    ],
    typeArguments: [args.pool.baseType, args.pool.quoteType, debt.type],
  });
}

export function addMarginReduceOnlyMarketOrderV1(
  tx: Transaction,
  args: MarginOrderCommon & { debtIsBase: boolean }
) {
  const debt = debtPoolFor(args.pool, args.debtIsBase);
  tx.moveCall({
    target: `${DB_PKG.MARGIN_PACKAGE_ID}::pool_proxy::place_reduce_only_market_order`,
    arguments: [
      tx.object(DB_PKG.MARGIN_REGISTRY_ID),
      tx.object(args.marginManagerId),
      tx.object(args.pool.address),
      tx.object(debt.address),
      tx.pure.u64(args.clientOrderId),
      tx.pure.u8(0), // SELF_MATCHING_ALLOWED
      tx.pure.u64(humanToRawQuantity(args.quantity, args.pool)),
      tx.pure.bool(args.isBid),
      tx.pure.bool(args.payWithDeep),
      tx.object.clock(),
    ],
    typeArguments: [args.pool.baseType, args.pool.quoteType, debt.type],
  });
}

/**
 * Orders + settled funds for a margin account. The testnet package has no
 * margin_manager::get_account_order_details / ::account (newer additions the
 * SDK targets) — instead we chain margin_manager::balance_manager (returns a
 * &BalanceManager) into the deepbook pool's read functions in the same PTB.
 * Appends exactly 3 commands: [balance_manager, get_account_order_details, account].
 */
export function addMarginAccountReads(
  tx: Transaction,
  pool: SpotPoolMeta,
  marginManagerId: string
) {
  const typeArguments = [pool.baseType, pool.quoteType];
  const bmRef = tx.moveCall({
    target: `${DB_PKG.MARGIN_PACKAGE_ID}::margin_manager::balance_manager`,
    arguments: [tx.object(marginManagerId)],
    typeArguments,
  });
  tx.moveCall({
    target: `${DB_PKG.DEEPBOOK_PACKAGE_ID}::pool::get_account_order_details`,
    arguments: [tx.object(pool.address), bmRef],
    typeArguments,
  });
  tx.moveCall({
    target: `${DB_PKG.DEEPBOOK_PACKAGE_ID}::pool::account`,
    arguments: [tx.object(pool.address), bmRef],
    typeArguments,
  });
}

/* -------------------------------- TPSL --------------------------------- */

/** BCS layout of tpsl::ConditionalOrder — field order from the testnet ABI. */
export const ConditionalOrderBcs = bcs.struct("ConditionalOrder", {
  conditional_order_id: bcs.u64(),
  condition: bcs.struct("Condition", {
    trigger_below_price: bcs.bool(),
    trigger_price: bcs.u64(),
  }),
  pending_order: bcs.struct("PendingOrder", {
    is_limit_order: bcs.bool(),
    client_order_id: bcs.u64(),
    order_type: bcs.option(bcs.u8()),
    self_matching_option: bcs.u8(),
    price: bcs.option(bcs.u64()),
    quantity: bcs.u64(),
    is_bid: bcs.bool(),
    pay_with_deep: bcs.bool(),
    expire_timestamp: bcs.option(bcs.u64()),
  }),
});

export type TpslOrder = {
  id: string;
  triggerBelowPrice: boolean;
  triggerPrice: number; // human, quote per base
  isLimit: boolean;
  limitPrice: number | null; // human
  quantity: number; // human base units
  isBid: boolean;
};

export function normalizeTpsl(
  raw: ReturnType<typeof ConditionalOrderBcs.parse>,
  pool: SpotPoolMeta
): TpslOrder {
  const toHuman = (rawPrice: number) =>
    (rawPrice * pool.baseScalar) / (1_000_000_000 * pool.quoteScalar);
  return {
    id: raw.conditional_order_id,
    triggerBelowPrice: raw.condition.trigger_below_price,
    triggerPrice: toHuman(Number(raw.condition.trigger_price)),
    isLimit: raw.pending_order.is_limit_order,
    limitPrice:
      raw.pending_order.price != null
        ? toHuman(Number(raw.pending_order.price))
        : null,
    quantity: Number(raw.pending_order.quantity) / pool.baseScalar,
    isBid: raw.pending_order.is_bid,
  };
}

/** Read one conditional order by id (returns ConditionalOrder by value). */
export function addConditionalOrderRead(
  tx: Transaction,
  pool: SpotPoolMeta,
  marginManagerId: string,
  conditionalOrderId: string
) {
  tx.moveCall({
    target: `${DB_PKG.MARGIN_PACKAGE_ID}::margin_manager::conditional_order`,
    arguments: [tx.object(marginManagerId), tx.pure.u64(conditionalOrderId)],
    typeArguments: [pool.baseType, pool.quoteType],
  });
}

/**
 * Keeper entry — TESTNET runs v1 execute_conditional_orders
 * (manager, pool, base_oracle, quote_oracle, registry, max_orders, clock);
 * the SDK targets *_v2 which isn't deployed there.
 */
export function addExecuteConditionalOrdersV1(
  tx: Transaction,
  pool: SpotPoolMeta,
  marginManagerId: string,
  basePriceInfoObjectId: string,
  quotePriceInfoObjectId: string,
  maxOrders = 10
) {
  tx.moveCall({
    target: `${DB_PKG.MARGIN_PACKAGE_ID}::margin_manager::execute_conditional_orders`,
    arguments: [
      tx.object(marginManagerId),
      tx.object(pool.address),
      tx.object(basePriceInfoObjectId),
      tx.object(quotePriceInfoObjectId),
      tx.object(DB_PKG.MARGIN_REGISTRY_ID),
      tx.pure.u64(maxOrders),
      tx.object.clock(),
    ],
    typeArguments: [pool.baseType, pool.quoteType],
  });
}

/* ------------------------------ earn/supply ---------------------------- */

/** Owned-object type for supplier caps (one cap works across all pools). */
export const SUPPLIER_CAP_TYPE = `${DB_PKG.MARGIN_PACKAGE_ID}::margin_pool::SupplierCap`;

/* ----------------------------- risk math ------------------------------ */

export type RiskParams = {
  minBorrow: number; // e.g. 1.25 → ~5x
  minWithdraw: number; // e.g. 2.0
  liquidation: number; // e.g. 1.1
  target: number; // e.g. 1.25
};

/** Max leverage implied by the min-borrow risk ratio: 1.25 → 5x, 1.5 → 3x. */
export function maxLeverage(minBorrow: number): number {
  if (minBorrow <= 1) return 1;
  return 1 / (1 - 1 / minBorrow);
}

export type MarginPosition = {
  baseAsset: number;
  quoteAsset: number;
  baseDebt: number;
  quoteDebt: number;
};

/** Risk ratio at a given base price (assets / debts, quote terms). ∞ if no debt. */
export function riskRatioAt(pos: MarginPosition, price: number): number {
  const assets = pos.baseAsset * price + pos.quoteAsset;
  const debts = pos.baseDebt * price + pos.quoteDebt;
  if (debts <= 0) return Infinity;
  return assets / debts;
}

/**
 * Base price at which the position hits the liquidation ratio.
 * Solves (B·p + Q) = liq·(Db·p + Dq); null when the position can't be
 * liquidated by price movement alone (e.g. no debt, or debt-free side).
 */
export function liquidationPrice(
  pos: MarginPosition,
  liq: number
): number | null {
  const { baseAsset: B, quoteAsset: Q, baseDebt: Db, quoteDebt: Dq } = pos;
  if (Db <= 0 && Dq <= 0) return null;
  const denom = B - liq * Db;
  if (Math.abs(denom) < 1e-12) return null;
  const p = (liq * Dq - Q) / denom;
  return p > 0 ? p : null;
}

/**
 * Headroom: how much MORE of an asset can be borrowed before risk ratio hits
 * minBorrow. Borrowed funds land in the manager, so assets rise with debts:
 * (A + x)/(D + x) ≥ r  →  x ≤ (A − r·D)/(r − 1). Returned in quote terms.
 */
export function maxAdditionalBorrowQuote(
  pos: MarginPosition,
  price: number,
  minBorrow: number
): number {
  const assets = pos.baseAsset * price + pos.quoteAsset;
  const debts = pos.baseDebt * price + pos.quoteDebt;
  if (minBorrow <= 1) return 0;
  return Math.max(0, (assets - minBorrow * debts) / (minBorrow - 1));
}

/**
 * Borrow headroom at a TARGET leverage L (≤ the pool max). The required
 * post-borrow risk ratio is r = L/(L−1), so x ≤ (L−1)·A − L·D (quote terms).
 * L=5 reproduces the protocol minimum (r=1.25).
 */
export function maxBorrowAtLeverage(
  pos: MarginPosition,
  price: number,
  leverage: number
): number {
  if (leverage <= 1) return 0;
  const assets = pos.baseAsset * price + pos.quoteAsset;
  const debts = pos.baseDebt * price + pos.quoteDebt;
  return Math.max(0, (leverage - 1) * assets - leverage * debts);
}

/** IOC-limit price that emulates a market order with bounded slippage.
 *  Single source of truth now lives in the shared DeepBook domain layer. */
export { slippageLimitPrice } from "@/lib/deepbook/domain/slippage";

/** Effective leverage = gross assets / equity. */
export function effectiveLeverage(pos: MarginPosition, price: number): number {
  const assets = pos.baseAsset * price + pos.quoteAsset;
  const debts = pos.baseDebt * price + pos.quoteDebt;
  const equity = assets - debts;
  if (equity <= 0) return Infinity;
  return assets / equity;
}

/* --------------------------- error humanizer -------------------------- */

export function humanizeMarginError(error: string | undefined): string {
  const e = error ?? "Transaction simulation failed";
  if (/check_price_is_fresh|price.*fresh|stale/i.test(e))
    return "Pyth price feed went stale mid-flight — retry (prices refresh automatically).";
  if (/EBorrowRiskRatioExceeded|borrow_risk/i.test(e))
    return "Borrow would push risk ratio below the minimum (1.25). Borrow less or add collateral.";
  if (/EWithdrawRiskRatioExceeded|withdraw_risk/i.test(e))
    return "Withdrawal would push risk ratio below 2.0. Repay debt first or withdraw less.";
  if (/ECannotHaveLoanInMoreThanOneMarginPool/i.test(e))
    return "You already have a loan on the other side — repay it before borrowing this asset.";
  if (/EDeepbookPoolNotAllowedForLoan|EPoolNotEnabledForMargin/i.test(e))
    return "Margin isn't enabled for this pool.";
  if (/EIncorrectMarginPool/i.test(e))
    return "Repay side doesn't match your outstanding loan.";
  if (/ECannotLiquidate/i.test(e))
    return "Position is above the liquidation threshold.";
  if (/ENotReduceOnlyOrder|place_reduce_only[^]*?,\s*3\)/i.test(e))
    return "Reduce-only rejected: the order must shrink your net debt (debt must exceed assets on that side, and order size must fit within the shortfall).";
  if (/EInvalidManagerOwner|not.*owner/i.test(e))
    return "Only the margin account owner can do this.";
  if (/min_borrow|EBorrowAmountTooLow/i.test(e))
    return "Borrow amount is below the pool minimum (0.1).";
  if (/ENotEnoughAssetInPool|max_utilization|ERateLimitExceeded/i.test(e))
    return "The lending pool can't serve this amount right now (utilization/rate limits).";
  if (/InsufficientGas|InsufficientCoinBalance|GasBalanceTooLow/i.test(e))
    return "Not enough SUI for gas. Top up from the Sui testnet faucet.";
  return e.slice(0, 220);
}
