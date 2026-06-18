/**
 * @deprecated Canonical home is now `@/lib/deepbook/hooks/*`. Kept as a thin
 * re-export shim so existing spot/margin imports keep resolving while call sites
 * migrate. New code should import from:
 *   - `@/lib/deepbook/hooks/account`        (useDeepBookAddress, useBalanceManager, useDeepBookClient)
 *   - `@/lib/deepbook/hooks/reads`          (usePoolParams, useWalletBalances, useManagerBalances, useOpenOrders)
 *   - `@/lib/deepbook/hooks/useSpotActions` (useSpotActions, PlaceOrderArgs)
 */
export * from "@/lib/deepbook/hooks/account";
export * from "@/lib/deepbook/hooks/reads";
export * from "@/lib/deepbook/hooks/useSpotActions";
