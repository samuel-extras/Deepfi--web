"use client";

/**
 * React Query read hooks over the typed DeepBook REST client. Query keys all
 * start with `["deepbook"]` so a single `invalidateQueries({queryKey:
 * ["deepbook"]})` after a trade refreshes book, stats, and orders together.
 *
 * Refetch intervals are tuned per surface and match the pre-refactor values:
 * the order book is the same key everywhere so concurrent consumers dedupe to
 * one poll.
 */
import { useQuery } from "@tanstack/react-query";
import { deepbookApi } from "./client";

/** Live order book (mid, depth, best bid/ask). Shared key → one poll. */
export function useOrderbook(poolKey: string, ticks = 100) {
  return useQuery({
    queryKey: ["deepbook", "book", poolKey],
    refetchInterval: 3000,
    queryFn: () => deepbookApi.orderbook(poolKey, ticks),
  });
}

/** 24h stats for every pool, keyed by pool name. */
export function useMarketSummary() {
  return useQuery({
    queryKey: ["deepbook", "summary"],
    refetchInterval: 5000,
    queryFn: async () => (await deepbookApi.summary()).summary ?? {},
  });
}

/** Single-pool ticker (last price + 24h stats). */
export function useTicker(poolKey: string) {
  return useQuery({
    queryKey: ["deepbook", "ticker", poolKey],
    refetchInterval: 15000,
    queryFn: () => deepbookApi.ticker(poolKey),
  });
}

/** Recent trade tape for a pool. */
export function useTrades(poolKey: string, limit = 40) {
  return useQuery({
    queryKey: ["deepbook", "trades", poolKey],
    refetchInterval: 4000,
    queryFn: async () => (await deepbookApi.trades(poolKey, limit)).trades ?? [],
  });
}

/** Order history for a pool, scoped to a BalanceManager. */
export function useOrderHistory(
  poolKey: string,
  managerId: string | null | undefined,
  limit = 50
) {
  return useQuery({
    queryKey: ["deepbook", "orderHistory", poolKey, managerId],
    enabled: !!managerId,
    refetchInterval: 10_000,
    queryFn: async () =>
      (await deepbookApi.orderHistory(poolKey, managerId!, limit)).orders ?? [],
  });
}
