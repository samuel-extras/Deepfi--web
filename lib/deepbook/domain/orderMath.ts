/**
 * Spot order-ticket math — pure derivation of everything the ticket needs from
 * its raw inputs: effective price, base quantity, order value, the coin + amount
 * required, what's available (manager + optional wallet top-up), and whether an
 * auto-deposit covers the shortfall. No React; fully unit-testable.
 */
import type { SpotPoolMeta } from "../pools";
import { FEE_BUFFER, SUI_GAS_RESERVE } from "./constants";

export type OrderSide = "buy" | "sell";
export type OrderType = "limit" | "market";

export type OrderPlanInput = {
  pool: SpotPoolMeta;
  side: OrderSide;
  orderType: OrderType;
  /** Parsed limit price (quote per base); used when orderType === "limit". */
  priceNum: number;
  /** Live mid; used as the effective price for market orders. */
  midPrice: number | null;
  /** Parsed size, expressed in `sizeUnit`. */
  sizeNum: number;
  /** Unit the size is entered in — pool.base or pool.quote. */
  sizeUnit: string;
  whitelisted: boolean;
  managerBal: Record<string, number> | undefined;
  walletBal: Record<string, number> | undefined;
  autoDeposit: boolean;
};

export type Deposit = { coinKey: string; amount: number };

export type OrderPlan = {
  isBid: boolean;
  /** Price used for sizing/value — limit price, or mid for market orders. */
  effPrice: number;
  /** Order quantity in BASE units. */
  qty: number;
  /** Order notional in QUOTE units. */
  orderValue: number;
  feeBuffer: number;
  /** Coin the order must spend (quote on buys, base on sells). */
  needCoin: string;
  /** Amount of `needCoin` required, incl. fee cushion on buys. */
  needAmt: number;
  inManager: number;
  /** Spendable wallet balance (SUI keeps a gas reserve). */
  inWallet: number;
  /** Manager + (auto-deposit ? wallet : 0). */
  available: number;
  /** How much more than the manager balance the order needs. */
  shortfall: number;
  /** Top-up deposit composed into the order PTB, if auto-deposit covers it. */
  deposit: Deposit | undefined;
  insufficient: boolean;
};

/** Spendable wallet balance for a coin (SUI keeps a gas reserve). */
export function spendableWallet(coin: string, walletRaw: number): number {
  return coin === "SUI" ? Math.max(0, walletRaw - SUI_GAS_RESERVE) : walletRaw;
}

/** Derive all ticket figures from the raw inputs. */
export function computeOrderPlan(input: OrderPlanInput): OrderPlan {
  const {
    pool, side, orderType, priceNum, midPrice, sizeNum, sizeUnit,
    whitelisted, managerBal, walletBal, autoDeposit,
  } = input;

  const isBid = side === "buy";
  const effPrice = orderType === "limit" ? priceNum : midPrice ?? 0;
  const qty =
    sizeUnit === pool.base ? sizeNum : effPrice > 0 ? sizeNum / effPrice : 0;
  const orderValue = qty * effPrice;

  const feeBuffer = whitelisted ? 0 : FEE_BUFFER;
  const needCoin = isBid ? pool.quote : pool.base;
  const needAmt = isBid ? orderValue * (1 + feeBuffer) : qty;

  const inManager = managerBal?.[needCoin] ?? 0;
  const inWallet = spendableWallet(needCoin, walletBal?.[needCoin] ?? 0);
  const available = inManager + (autoDeposit ? inWallet : 0);

  const shortfall = Math.max(0, needAmt - inManager);
  const deposit: Deposit | undefined =
    autoDeposit && shortfall > 0
      ? { coinKey: needCoin, amount: Math.min(inWallet, shortfall * 1.001) }
      : undefined;
  const insufficient =
    qty > 0 && shortfall > 0 && (!autoDeposit || shortfall > inWallet + 1e-9);

  return {
    isBid, effPrice, qty, orderValue, feeBuffer, needCoin, needAmt,
    inManager, inWallet, available, shortfall, deposit, insufficient,
  };
}

/**
 * Max base quantity affordable for a percentage of available funds. Buys are
 * bounded by the effective price plus the fee cushion; sells spend base directly.
 */
export function maxQtyForPercent(
  available: number,
  isBid: boolean,
  effPrice: number,
  feeBuffer: number
): number {
  return isBid ? available / (effPrice * (1 + feeBuffer)) : available;
}
