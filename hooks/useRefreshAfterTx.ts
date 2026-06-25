"use client";

/**
 * One call to refresh every data source a transaction can touch, so the UI feels
 * real-time after any mint / redeem / trade / transfer:
 *   - DeepBook reads        (["deepbook"] — book, balances, snapshot, orders)
 *   - Predict reads         (["predict"]  — oracles, svi, prices, feed,
 *                            portfolio, account summary, ladder quotes)
 *   - wallet reads          (dapp-kit getBalance / getCoins / getAllBalances /
 *                            getOwnedObjects)
 *   - the balance store      (requestRefresh → useDeepBookPortfolioSync re-sync,
 *                            drives the navbar total + portfolio cards)
 *
 * Indexers lag a confirmed tx by a beat, so it fires as a short burst rather
 * than once. Call it right after a tx confirms.
 */
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useBalanceStore } from "@/stores/useBalanceStore";

const BURST_MS = [0, 2500, 6000];
const WALLET_READS = /^get(Balance|Coins|AllBalances|OwnedObjects)$/;

export function useRefreshAfterTx() {
  const queryClient = useQueryClient();
  const requestRefresh = useBalanceStore((s) => s.requestRefresh);

  return useCallback(() => {
    const run = () => {
      requestRefresh();
      queryClient.invalidateQueries({ queryKey: ["deepbook"] });
      queryClient.invalidateQueries({ queryKey: ["predict"] });
      queryClient.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey;
          return (
            Array.isArray(k) &&
            typeof k[1] === "string" &&
            WALLET_READS.test(k[1])
          );
        },
      });
    };
    for (const ms of BURST_MS) {
      if (ms === 0) run();
      else setTimeout(run, ms);
    }
  }, [queryClient, requestRefresh]);
}
