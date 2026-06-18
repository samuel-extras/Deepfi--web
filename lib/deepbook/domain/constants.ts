/**
 * Shared DeepBook trading constants. Buffers and reserves the UI applies on top
 * of raw on-chain amounts, plus presentation presets for the order book and
 * ticket. Pure values — no imports.
 */

/** SUI we leave untouched in the wallet so a trade still has gas to settle. */
export const SUI_GAS_RESERVE = 0.3;

/** Quote-side cushion on buys for taker fees (skipped on whitelisted pools). */
export const FEE_BUFFER = 0.02;

/** Display-only taker fee % shown in the ticket summary (non-whitelisted). */
export const TAKER_FEE_PCT = 0.1;

/** Expiry timestamps at/after this (ms) are treated as "good till cancel". */
export const GTC_CUTOFF_MS = 4_102_444_800_000;

/** Tick multipliers offered in the order-book grouping control. */
export const GROUP_MULTIPLIERS = [1, 2, 5, 10, 100] as const;

/** Preset chips in the market-order slippage control (%). */
export const SLIPPAGE_PRESETS = [0.1, 0.5, 1] as const;
