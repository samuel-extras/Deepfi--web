"use client";

/**
 * DeepBook on-chain reads via React Query (devInspect under the hood):
 * static pool params, wallet balances, trading-account balances, and open
 * orders + settled funds. Query keys start with `["deepbook"]` so a single
 * invalidate after a trade refreshes them all.
 */
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSuiClient } from "@mysten/dapp-kit";
import { normalizeStructTag } from "@mysten/sui/utils";
import {
  ACCOUNT_COINS,
  DB_COINS,
  DB_NETWORK,
  MANAGER_KEY,
  getSpotPool,
  makeDeepBookClient,
  normalizeOrder,
  type OpenOrder,
} from "@/lib/deepbook/core";
import { DEV_ADDRESS } from "@/lib/sui/network";
import { useDeepBookAddress, useDeepBookClient } from "./account";

/** tick/lot/min size + whitelist status for a pool (static per pool). */
export function usePoolParams(poolKey: string) {
  const suiClient = useSuiClient();
  const address = useDeepBookAddress();

  return useQuery({
    queryKey: ["deepbook", "poolParams", DB_NETWORK, poolKey],
    staleTime: Infinity,
    queryFn: async () => {
      // reads work with any sender; fall back to the dev address
      const db = makeDeepBookClient(suiClient, address ?? DEV_ADDRESS);
      const [bookParams, whitelisted] = await Promise.all([
        db.poolBookParams(poolKey),
        db.whitelisted(poolKey).catch(() => false),
      ]);
      return { ...bookParams, whitelisted };
    },
  });
}

/** Wallet balances for all DeepBook coins, in human units. */
export function useWalletBalances() {
  const suiClient = useSuiClient();
  const address = useDeepBookAddress();

  return useQuery({
    queryKey: ["deepbook", "walletBalances", address],
    enabled: !!address,
    refetchInterval: 10_000,
    queryFn: async (): Promise<Record<string, number>> => {
      const all = await suiClient.getAllBalances({ owner: address! });
      // `getAllBalances` returns SUI as the short `0x2::sui::SUI`, while the SDK's
      // coin types are full-length (`0x000…0002::sui::SUI`). Normalize both sides
      // so the lookup matches — otherwise SUI (and any other short-form coin)
      // silently reads 0 even with a funded wallet.
      const byType = new Map(
        all.map(b => [normalizeStructTag(b.coinType), b.totalBalance]),
      );
      const out: Record<string, number> = {};
      for (const key of ACCOUNT_COINS) {
        const coin = DB_COINS[key];
        const raw = byType.get(normalizeStructTag(coin.type));
        out[key] = raw ? Number(raw) / coin.scalar : 0;
      }
      return out;
    },
  });
}

/** Trading-account (BalanceManager) balances, in human units. */
export function useManagerBalances() {
  const { client, managerId } = useDeepBookClient();

  return useQuery({
    queryKey: ["deepbook", "managerBalances", managerId],
    enabled: !!client && !!managerId,
    refetchInterval: 10_000,
    queryFn: async (): Promise<Record<string, number>> => {
      const res = await client!.checkManagerBalancesWithAddress(
        [managerId!],
        ACCOUNT_COINS
      );
      const byCoin = res[managerId!] ?? {};
      // keyed by coin TYPE in the SDK result; re-key by coin key
      const out: Record<string, number> = {};
      for (const key of ACCOUNT_COINS) {
        const coin = DB_COINS[key];
        out[key] = byCoin[coin.type] ?? byCoin[key] ?? 0;
      }
      return out;
    },
  });
}

export type OpenOrdersData = {
  orders: OpenOrder[];
  settled: { base: number; quote: number; deep: number };
};

/** Open orders + settled (claimable) funds for the selected pool. */
export function useOpenOrders(poolKey: string) {
  const { client, managerId } = useDeepBookClient();
  const pool = getSpotPool(poolKey);

  return useQuery({
    queryKey: ["deepbook", "openOrders", poolKey, managerId],
    enabled: !!client && !!managerId,
    refetchInterval: 5_000,
    queryFn: async (): Promise<OpenOrdersData> => {
      const [rawOrders, account] = await Promise.all([
        client!.getAccountOrderDetails(poolKey, MANAGER_KEY),
        client!.account(poolKey, MANAGER_KEY).catch(() => null),
      ]);
      const orders = (rawOrders ?? [])
        .map(o => normalizeOrder(o, pool))
        .sort((a, b) => b.price - a.price);
      return {
        orders,
        settled: account?.settled_balances ?? { base: 0, quote: 0, deep: 0 },
      };
    },
  });
}

/**
 * Live orderbook mid for a pool (shared 3s poll). Call this in the leaf that
 * needs the mark price instead of prop-drilling it from a parent — the shared
 * `["deepbook","book",poolKey]` cache means every caller rides one fetch, and
 * only the leaves that read the mid re-render on each tick.
 */
export function useOrderbookMid(poolKey: string): number | null {
  const q = useQuery({
    queryKey: ["deepbook", "book", poolKey],
    refetchInterval: 3_000,
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (await fetch(`/api/deepbook/orderbook?pool=${poolKey}&ticks=100`, {
        cache: "no-store",
      }).then(r => r.json())) as { mid: number | null },
    select: d => d.mid ?? null,
  });
  return q.data ?? null;
}
