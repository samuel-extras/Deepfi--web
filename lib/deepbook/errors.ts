/**
 * Map raw Move aborts from DeepBook into actionable, user-facing messages.
 * Used by the devInspect-before-sign path so reverts surface as clean errors
 * before the wallet prompt.
 */

/** Map raw Move aborts from DeepBook into actionable user messages. */
export function humanizeDeepBookError(error: string | undefined): string {
  const e = error ?? "Transaction simulation failed";
  if (/EInsufficientFunds|EInsufficientBalance|balance_manager.*[0-9]\)/i.test(e))
    return "Insufficient funds in your trading account — deposit more first.";
  if (/EOrderInvalidPrice|invalid_price/i.test(e))
    return "Price is outside the allowed range or not a multiple of the tick size.";
  if (/EOrderBelowMinimumSize|below_min/i.test(e))
    return "Order size is below the pool's minimum.";
  if (/EOrderInvalidLotSize|lot_size/i.test(e))
    return "Quantity must be a multiple of the pool's lot size.";
  if (/EInvalidExpireTimestamp/i.test(e))
    return "Order expiration is in the past.";
  if (/ESelfMatching/i.test(e))
    return "Order would self-match against your own resting order.";
  if (/EFOKOrderCannotBeFullyFilled/i.test(e))
    return "Fill-or-kill order can't be fully filled at this price.";
  if (/EPOSTOrderCrossesOrderbook|post_only/i.test(e))
    return "Post-only order would cross the book — adjust the price.";
  if (/InsufficientGas|InsufficientCoinBalance|GasBalanceTooLow/i.test(e))
    return "Not enough SUI for gas. Top up from the Sui testnet faucet.";
  if (/EIneligibleWhitelist|whitelist/i.test(e))
    return "This pool doesn't support that fee mode.";
  if (/MovePrimitiveRuntimeError|MoveAbort/i.test(e))
    return `On-chain abort: ${e.slice(0, 200)}`;
  return e.slice(0, 220);
}
