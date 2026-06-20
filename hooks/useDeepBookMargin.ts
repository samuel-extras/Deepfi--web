"use client";

/**
 * DeepBook Margin hooks (testnet).
 *
 * The MarginManager wraps its BalanceManager (the BM is NOT a top-level
 * object), so all account reads go through margin_manager-level Move calls.
 * One devInspect per refresh fetches the full position snapshot — with a Pyth
 * price update prepended, because manager_state prices assets via oracles and
 * testnet feeds are stale unless refreshed in the same transaction.
 *
 * Writes follow the spot pattern (simulate → sign → invalidate), with the
 * same in-PTB Pyth refresh for oracle-gated calls (deposit/withdraw/borrow/
 * proxy orders). Repay and cancels need no oracles.
 */
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { useCallback, useMemo, useState } from "react";
import { useSuiClient } from "@mysten/dapp-kit";
import { useSignAndExecuteTransaction } from "@/lib/zklogin/useSponsoredExecute";
import { Transaction } from "@mysten/sui/transactions";
import { bcs } from "@mysten/sui/bcs";
import { Account, DeepBookClient, Order } from "@mysten/deepbook-v3";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DB_NETWORK,
  formatAmount,
  makeDeepBookClient,
  normalizeOrder,
  rawPriceToHuman,
  type OpenOrder,
} from "@/lib/sui/deepbookSpot";
import {
  ConditionalOrderBcs,
  DB_MARGIN_POOLS,
  MARGIN_KEY,
  MARGIN_POOL_CANDIDATES,
  SUPPLIER_CAP_TYPE,
  addConditionalOrderRead,
  addMarginAccountReads,
  addMarginLimitOrderV1,
  addMarginMarketOrderV1,
  addMarginReduceOnlyLimitOrderV1,
  addMarginReduceOnlyMarketOrderV1,
  getMarginPoolMeta,
  humanizeMarginError,
  marginManagerStorageKey,
  normalizeTpsl,
  slippageLimitPrice,
  type RiskParams,
  type TpslOrder,
} from "@/lib/sui/deepbookMargin";
import { usePoolParams } from "./useDeepBookSpot";
import { DEV_ADDRESS } from "@/lib/sui/network";

const FLOAT_SCALAR = 1_000_000_000;

function useAddress(): string | undefined {
  return useActiveAccount()?.address;
}

/* ------------------------- pools & risk params ------------------------ */

/** Margin-capable pools, runtime-gated by the on-chain registry. */
export function useMarginEnabledPools() {
  const suiClient = useSuiClient();
  return useQuery({
    queryKey: ["deepbook", "marginEnabledPools", DB_NETWORK],
    staleTime: Infinity,
    queryFn: async () => {
      const db = makeDeepBookClient(suiClient, DEV_ADDRESS);
      const flags = await Promise.all(
        MARGIN_POOL_CANDIDATES.map(p =>
          db.isPoolEnabledForMargin(p.key).catch(() => false)
        )
      );
      return MARGIN_POOL_CANDIDATES.filter((_, i) => flags[i]);
    },
  });
}

export function useRiskParams(poolKey: string) {
  const suiClient = useSuiClient();
  return useQuery({
    queryKey: ["deepbook", "marginRiskParams", DB_NETWORK, poolKey],
    staleTime: Infinity,
    queryFn: async (): Promise<RiskParams> => {
      const db = makeDeepBookClient(suiClient, DEV_ADDRESS);
      const [minBorrow, minWithdraw, liquidation, target] = await Promise.all([
        db.getMinBorrowRiskRatio(poolKey),
        db.getMinWithdrawRiskRatio(poolKey),
        db.getLiquidationRiskRatio(poolKey),
        db.getTargetLiquidationRiskRatio(poolKey),
      ]);
      return { minBorrow, minWithdraw, liquidation, target };
    },
  });
}

/** Lending-pool stats for both legs (utilization-based borrow APR). */
export function useMarginPoolStats(poolKey: string) {
  const suiClient = useSuiClient();
  const pool = getMarginPoolMeta(poolKey);
  return useQuery({
    queryKey: ["deepbook", "marginPoolStats", DB_NETWORK, poolKey],
    refetchInterval: 30_000,
    queryFn: async () => {
      const db = makeDeepBookClient(suiClient, DEV_ADDRESS);
      const load = async (coinKey: string) => {
        const [rate, supply, borrow] = await Promise.all([
          db.getMarginPoolInterestRate(coinKey),
          db.getMarginPoolTotalSupply(coinKey),
          db.getMarginPoolTotalBorrow(coinKey),
        ]);
        const supplyN = Number(supply);
        return {
          borrowAprPct: rate * 100,
          utilizationPct: supplyN > 0 ? (Number(borrow) / supplyN) * 100 : 0,
          available: Math.max(0, supplyN - Number(borrow)),
        };
      };
      const [base, quote] = await Promise.all([load(pool.base), load(pool.quote)]);
      return { base, quote };
    },
  });
}

/* ----------------------------- the manager ---------------------------- */

/** Discover (registry + object lookup + cache) or create the per-pool MarginManager. */
export function useMarginManager(poolKey: string) {
  const suiClient = useSuiClient();
  const address = useAddress();
  const queryClient = useQueryClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const [isCreating, setIsCreating] = useState(false);
  const pool = getMarginPoolMeta(poolKey);

  const query = useQuery({
    queryKey: ["deepbook", "marginManager", DB_NETWORK, address, poolKey],
    enabled: !!address,
    staleTime: 60_000,
    queryFn: async (): Promise<string | null> => {
      if (!address) return null;
      const db = makeDeepBookClient(suiClient, address);
      const cached = localStorage.getItem(marginManagerStorageKey(address, poolKey));
      let ids: string[] = [];
      try {
        ids = await db.getMarginManagerIdsForOwner(address);
      } catch {
        // registry read failure shouldn't lock out a cached manager
      }
      if (cached && ids.includes(cached)) return cached;
      if (ids.length === 0) return cached || null;
      // map each manager to its DeepBook pool via the object's fields
      const objs = await suiClient.multiGetObjects({
        ids,
        options: { showContent: true },
      });
      for (const obj of objs) {
        const content = obj.data?.content;
        const fields =
          content && "fields" in content
            ? (content.fields as { deepbook_pool?: string })
            : null;
        if (fields?.deepbook_pool === pool.address && obj.data?.objectId) {
          localStorage.setItem(
            marginManagerStorageKey(address, poolKey),
            obj.data.objectId
          );
          return obj.data.objectId;
        }
      }
      return cached || null;
    },
  });

  const create = useCallback(async (): Promise<string | undefined> => {
    if (!address) {
      toast.error("Connect your Sui wallet first");
      return;
    }
    setIsCreating(true);
    try {
      const db = makeDeepBookClient(suiClient, address);
      const tx = new Transaction();
      tx.add(db.marginManager.newMarginManager(poolKey));
      const res = await signAndExecute({ transaction: tx });
      await suiClient.waitForTransaction({ digest: res.digest });
      const full = await suiClient.getTransactionBlock({
        digest: res.digest,
        options: { showObjectChanges: true },
      });
      const created = full.objectChanges?.find(
        c =>
          c.type === "created" &&
          "objectType" in c &&
          c.objectType.includes("::margin_manager::MarginManager")
      );
      const id = created && "objectId" in created ? created.objectId : null;
      if (!id) throw new Error("MarginManager creation returned no object id");
      localStorage.setItem(marginManagerStorageKey(address, poolKey), id);
      queryClient.setQueryData(
        ["deepbook", "marginManager", DB_NETWORK, address, poolKey],
        id
      );
      toast.success("Margin account created");
      return id;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Couldn't create margin account: ${msg.slice(0, 160)}`);
    } finally {
      setIsCreating(false);
    }
  }, [address, poolKey, signAndExecute, suiClient, queryClient]);

  return {
    managerId: query.data ?? null,
    isLoading: query.isLoading,
    create,
    isCreating,
  };
}

/** SDK client with the margin manager registered under MARGIN_KEY. */
export function useMarginClient(poolKey: string) {
  const suiClient = useSuiClient();
  const address = useAddress();
  const { managerId } = useMarginManager(poolKey);

  const client = useMemo(() => {
    if (!address) return null;
    return new DeepBookClient({
      client: suiClient as never,
      network: DB_NETWORK,
      address,
      marginManagers: managerId
        ? { [MARGIN_KEY]: { address: managerId, poolKey } }
        : {},
    });
  }, [suiClient, address, managerId, poolKey]);

  return { client, address, managerId };
}

/* --------------------------- position snapshot ------------------------ */

export type MarginSnapshot = {
  /** Oracle-priced risk ratio from manager_state (∞ shown as null). */
  riskRatio: number | null;
  baseAsset: number;
  quoteAsset: number;
  baseDebt: number;
  quoteDebt: number;
  /** Pool's current oracle price (quote per base). */
  currentPrice: number | null;
  /** Free (placeable) funds inside the margin account. */
  balances: { base: number; quote: number; deep: number };
  orders: OpenOrder[];
  settled: { base: number; quote: number; deep: number };
  /** Active TP/SL conditional order ids (details via useConditionalOrders). */
  conditionalOrderIds: string[];
};

const u64 = (rv: [number[], string]) => Number(bcs.U64.parse(Uint8Array.from(rv[0])));

/**
 * Full position snapshot in ONE devInspect:
 * [pyth refresh…] + manager_state + base/quote/deep balance + orders + account.
 */
export function useMarginSnapshot(poolKey: string) {
  const suiClient = useSuiClient();
  const { client, address, managerId } = useMarginClient(poolKey);
  const pool = getMarginPoolMeta(poolKey);

  return useQuery({
    queryKey: ["deepbook", "marginSnapshot", poolKey, managerId],
    enabled: !!client && !!address && !!managerId,
    refetchInterval: 10_000,
    queryFn: async (): Promise<MarginSnapshot> => {
      const db = client!;
      const tx = new Transaction();
      tx.setSender(address!);
      // refresh stale feeds in the same (simulated) tx so manager_state's
      // oracle reads pass the freshness check
      await db.getPriceInfoObjects(tx, [pool.base, pool.quote]);
      tx.add(db.marginManager.managerState(poolKey, managerId!));
      tx.add(db.marginManager.baseBalance(poolKey, managerId!));
      tx.add(db.marginManager.quoteBalance(poolKey, managerId!));
      tx.add(db.marginManager.deepBalance(poolKey, managerId!));
      tx.add(db.marginTPSL.conditionalOrderIds(poolKey, managerId!));
      // testnet pkg lacks margin_manager::get_account_order_details/account —
      // chain &BalanceManager into the deepbook pool reads instead
      addMarginAccountReads(tx, pool, managerId!);

      const res = await suiClient.devInspectTransactionBlock({
        sender: address!,
        transactionBlock: tx,
      });
      if (res.effects?.status?.status !== "success" || !res.results) {
        throw new Error(humanizeMarginError(res.effects?.status?.error));
      }
      // from the end: account, orderDetails, balance_manager(ref), condIds,
      // deepBal, quoteBal, baseBal, managerState — refresh commands precede
      const r = res.results;
      const state = r[r.length - 8].returnValues!;
      const baseBal = u64(r[r.length - 7].returnValues![0] as [number[], string]);
      const quoteBal = u64(r[r.length - 6].returnValues![0] as [number[], string]);
      const deepBal = u64(r[r.length - 5].returnValues![0] as [number[], string]);
      const condIdsBcs = r[r.length - 4].returnValues![0] as [number[], string];
      const ordersBcs = r[r.length - 2].returnValues![0] as [number[], string];
      const accountBcs = r[r.length - 1].returnValues![0] as [number[], string];

      const riskRaw = u64(state[2] as [number[], string]);
      const currentPriceRaw = u64(state[11] as [number[], string]);
      const conditionalOrderIds = bcs
        .vector(bcs.u64())
        .parse(Uint8Array.from(condIdsBcs[0]));
      const account = Account.parse(Uint8Array.from(accountBcs[0]));
      const orders = bcs
        .vector(Order)
        .parse(Uint8Array.from(ordersBcs[0]))
        .map(o => normalizeOrder(o, pool))
        .sort((a, b) => b.price - a.price);

      // protocol returns 1000.0 as the "no debt" sentinel (verified on testnet)
      const MAX_RISK = 999;
      const risk = riskRaw / FLOAT_SCALAR;
      return {
        riskRatio: risk >= MAX_RISK ? null : risk,
        baseAsset: u64(state[3] as [number[], string]) / pool.baseScalar,
        quoteAsset: u64(state[4] as [number[], string]) / pool.quoteScalar,
        baseDebt: u64(state[5] as [number[], string]) / pool.baseScalar,
        quoteDebt: u64(state[6] as [number[], string]) / pool.quoteScalar,
        currentPrice:
          currentPriceRaw > 0 ? rawPriceToHuman(currentPriceRaw, pool) : null,
        balances: {
          base: baseBal / pool.baseScalar,
          quote: quoteBal / pool.quoteScalar,
          deep: deepBal / 1_000_000,
        },
        orders,
        settled: {
          base: Number(account.settled_balances.base) / pool.baseScalar,
          quote: Number(account.settled_balances.quote) / pool.quoteScalar,
          deep: Number(account.settled_balances.deep) / 1_000_000,
        },
        conditionalOrderIds,
      };
    },
  });
}

/** Full details for the snapshot's conditional (TP/SL) orders. */
export function useConditionalOrders(poolKey: string) {
  const suiClient = useSuiClient();
  const { address, managerId } = useMarginClient(poolKey);
  const { data: snap } = useMarginSnapshot(poolKey);
  const ids = snap?.conditionalOrderIds ?? [];
  const pool = getMarginPoolMeta(poolKey);

  return useQuery({
    queryKey: ["deepbook", "tpslOrders", poolKey, managerId, ids.join(",")],
    enabled: !!address && !!managerId && ids.length > 0,
    queryFn: async (): Promise<TpslOrder[]> => {
      const tx = new Transaction();
      tx.setSender(address!);
      for (const id of ids) addConditionalOrderRead(tx, pool, managerId!, id);
      const res = await suiClient.devInspectTransactionBlock({
        sender: address!,
        transactionBlock: tx,
      });
      if (res.effects?.status?.status !== "success" || !res.results) {
        throw new Error(humanizeMarginError(res.effects?.status?.error));
      }
      return res.results.map(r =>
        normalizeTpsl(
          ConditionalOrderBcs.parse(
            Uint8Array.from((r.returnValues![0] as [number[], string])[0])
          ),
          pool
        )
      );
    },
  });
}

/* ------------------------------- actions ------------------------------ */

export type MarginSide = "base" | "quote";

export function useMarginActions(poolKey: string) {
  const suiClient = useSuiClient();
  const queryClient = useQueryClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const { client, address, managerId } = useMarginClient(poolKey);
  const { data: poolParams } = usePoolParams(poolKey);
  const pool = getMarginPoolMeta(poolKey);
  const [isPending, setIsPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  /** Simulate → sign → wait → refresh. withOracle prepends a Pyth update. */
  const execute = useCallback(
    async (
      build: (tx: Transaction) => void,
      successMsg: string,
      withOracle = false
    ): Promise<string | undefined> => {
      if (!client || !address) {
        toast.error("Connect your Sui wallet first");
        return;
      }
      if (!managerId) {
        toast.error("Create your margin account first");
        return;
      }
      setIsPending(true);
      try {
        const makeTx = async () => {
          const tx = new Transaction();
          tx.setSenderIfNotSet(address);
          if (withOracle) {
            await client.getPriceInfoObjects(tx, [pool.base, pool.quote]);
          }
          build(tx);
          return tx;
        };

        setStatus("Simulating…");
        const sim = await suiClient.devInspectTransactionBlock({
          sender: address,
          transactionBlock: await makeTx(),
        });
        if (sim.effects?.status?.status !== "success") {
          throw new Error(humanizeMarginError(sim.effects?.status?.error));
        }

        setStatus("Awaiting signature…");
        const res = await signAndExecute({ transaction: await makeTx() });
        setStatus("Confirming…");
        await suiClient.waitForTransaction({ digest: res.digest });

        toast.success(`${successMsg} · ${res.digest.slice(0, 10)}…`);
        queryClient.invalidateQueries({ queryKey: ["deepbook"] });
        return res.digest;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/reject/i.test(msg)) toast.info("Transaction cancelled");
        else toast.error(msg.slice(0, 200));
      } finally {
        setIsPending(false);
        setStatus(null);
      }
    },
    [client, address, managerId, pool.base, pool.quote, suiClient, signAndExecute, queryClient]
  );

  const depositCollateral = useCallback(
    (side: MarginSide | "deep", amount: number) =>
      execute(
        tx => {
          const params = { managerKey: MARGIN_KEY, amount };
          if (side === "base") tx.add(client!.marginManager.depositBase(params));
          else if (side === "quote") tx.add(client!.marginManager.depositQuote(params));
          else tx.add(client!.marginManager.depositDeep(params));
        },
        `Deposited ${amount} ${side === "base" ? pool.base : side === "quote" ? pool.quote : "DEEP"}`,
        true
      ),
    [client, execute, pool.base, pool.quote]
  );

  const withdrawCollateral = useCallback(
    (side: MarginSide | "deep", amount: number) =>
      execute(
        tx => {
          const fn =
            side === "base"
              ? client!.marginManager.withdrawBase
              : side === "quote"
                ? client!.marginManager.withdrawQuote
                : client!.marginManager.withdrawDeep;
          const coin = tx.add(fn(MARGIN_KEY, amount));
          tx.transferObjects([coin], address!);
        },
        `Withdrew ${amount} ${side === "base" ? pool.base : side === "quote" ? pool.quote : "DEEP"}`,
        true
      ),
    [client, address, execute, pool.base, pool.quote]
  );

  const borrow = useCallback(
    (side: MarginSide, amount: number) =>
      execute(
        tx => {
          if (side === "base") tx.add(client!.marginManager.borrowBase(MARGIN_KEY, amount));
          else tx.add(client!.marginManager.borrowQuote(MARGIN_KEY, amount));
        },
        `Borrowed ${amount} ${side === "base" ? pool.base : pool.quote}`,
        true
      ),
    [client, execute, pool.base, pool.quote]
  );

  const repay = useCallback(
    (side: MarginSide, amount?: number) =>
      execute(
        tx => {
          if (side === "base") tx.add(client!.marginManager.repayBase(MARGIN_KEY, amount));
          else tx.add(client!.marginManager.repayQuote(MARGIN_KEY, amount));
        },
        amount
          ? `Repaid ${amount} ${side === "base" ? pool.base : pool.quote}`
          : "Repaid full loan"
      ),
    [client, execute, pool.base, pool.quote]
  );

  const placeOrder = useCallback(
    (args: {
      type: "limit" | "market";
      isBid: boolean;
      quantity: number;
      price?: number;
      postOnly?: boolean;
      /** Reduce-only: order may only decrease the debt on the given side. */
      reduceOnly?: { debtIsBase: boolean };
      /** Market-order slippage bound (%); needs markPrice. Executed as an
       * IOC limit at mark ± slippage since DeepBook markets are unbounded. */
      slippagePct?: number;
      markPrice?: number;
      /** Time in force for limit orders (GTC default; IOC/FOK exclusive of post-only). */
      tif?: "GTC" | "IOC" | "FOK";
      /** Auto-deposit wallet collateral into the manager, same transaction. */
      deposits?: { side: MarginSide; amount: number }[];
      /** Leverage: borrow this amount first, in the same transaction. */
      borrow?: { side: MarginSide; amount: number };
      /** Attach TP/SL triggers for the position, same transaction. */
      tpsl?: { takeProfit?: number; stopLoss?: number };
    }) => {
      // testnet runs the v1 pool_proxy (no oracle args) — hand-built calls;
      // the SDK's placeLimitOrder targets *_v2 which isn't deployed there
      const common = {
        pool,
        marginManagerId: managerId!,
        clientOrderId: Date.now().toString(),
        quantity: args.quantity,
        isBid: args.isBid,
        payWithDeep: poolParams?.whitelisted ?? false,
      };
      // bounded market = IOC limit at mark ± slippage
      const iocPrice =
        args.type === "market" && args.slippagePct != null && args.markPrice
          ? slippageLimitPrice(
              args.markPrice,
              args.isBid,
              args.slippagePct,
              poolParams?.tickSize ?? 0
            )
          : null;

      const parts = [
        args.deposits?.length ? "deposit" : null,
        args.borrow ? `borrow ${formatAmount(args.borrow.amount, 4)}` : null,
        `${args.reduceOnly ? "reduce-only " : ""}${args.isBid ? "long" : "short"}`,
        args.tpsl?.takeProfit ? "TP" : null,
        args.tpsl?.stopLoss ? "SL" : null,
      ].filter(Boolean);
      const label = `${parts.join(" + ")} placed`;

      // deposits, borrows and conditional orders all read the oracles
      const withOracle =
        !!args.borrow || !!args.tpsl || (args.deposits?.length ?? 0) > 0;

      return execute(
        tx => {
          for (const d of args.deposits ?? []) {
            const params = { managerKey: MARGIN_KEY, amount: d.amount };
            if (d.side === "base")
              tx.add(client!.marginManager.depositBase(params));
            else tx.add(client!.marginManager.depositQuote(params));
          }
          if (args.borrow) {
            if (args.borrow.side === "base")
              tx.add(client!.marginManager.borrowBase(MARGIN_KEY, args.borrow.amount));
            else
              tx.add(client!.marginManager.borrowQuote(MARGIN_KEY, args.borrow.amount));
          }

          if (args.reduceOnly) {
            if (args.type === "limit" || iocPrice != null) {
              addMarginReduceOnlyLimitOrderV1(tx, {
                ...common,
                price: iocPrice ?? args.price!,
                postOnly: args.postOnly,
                ioc: iocPrice != null,
                tif: args.tif,
                debtIsBase: args.reduceOnly.debtIsBase,
              });
            } else {
              addMarginReduceOnlyMarketOrderV1(tx, {
                ...common,
                debtIsBase: args.reduceOnly.debtIsBase,
              });
            }
          } else if (args.type === "limit" || iocPrice != null) {
            addMarginLimitOrderV1(tx, {
              ...common,
              price: iocPrice ?? args.price!,
              postOnly: args.postOnly,
              ioc: iocPrice != null,
              tif: args.tif,
            });
          } else {
            addMarginMarketOrderV1(tx, common);
          }

          // TP/SL close the position → opposite side, market, same size.
          // Long: TP triggers above, SL below; short: inverted.
          if (args.tpsl) {
            const payWithDeep = poolParams?.whitelisted ?? false;
            const closeIsBid = !args.isBid;
            const arm = (triggerPrice: number, triggerBelowPrice: boolean, n: number) =>
              tx.add(
                client!.marginTPSL.addConditionalOrder({
                  marginManagerKey: MARGIN_KEY,
                  conditionalOrderId: (Date.now() + n).toString(),
                  triggerBelowPrice,
                  triggerPrice,
                  pendingOrder: {
                    clientOrderId: (Date.now() + n).toString(),
                    quantity: args.quantity,
                    isBid: closeIsBid,
                    payWithDeep,
                  },
                })
              );
            if (args.tpsl.takeProfit)
              arm(args.tpsl.takeProfit, !args.isBid ? true : false, 1);
            if (args.tpsl.stopLoss)
              arm(args.tpsl.stopLoss, args.isBid ? true : false, 2);
          }
        },
        label,
        withOracle
      );
    },
    [client, execute, pool, managerId, poolParams?.whitelisted, poolParams?.tickSize]
  );

  /** Shrink an open order (protocol allows reducing quantity only). */
  const modifyOrder = useCallback(
    (orderId: string, newQuantity: number) =>
      execute(
        tx =>
          tx.add(client!.poolProxy.modifyOrder(MARGIN_KEY, orderId, newQuantity)),
        "Order size reduced"
      ),
    [client, execute]
  );

  const cancelOrder = useCallback(
    (orderId: string) =>
      execute(
        tx => tx.add(client!.poolProxy.cancelOrder(MARGIN_KEY, orderId)),
        "Order cancelled"
      ),
    [client, execute]
  );

  const cancelAllOrders = useCallback(
    () =>
      execute(
        tx => tx.add(client!.poolProxy.cancelAllOrders(MARGIN_KEY)),
        "All orders cancelled"
      ),
    [client, execute]
  );

  const claimSettled = useCallback(
    () =>
      execute(
        tx => tx.add(client!.poolProxy.withdrawSettledAmounts(MARGIN_KEY)),
        "Settled funds claimed"
      ),
    [client, execute]
  );

  /** Take-profit / stop-loss: a trigger condition + the order it fires. */
  const addTpsl = useCallback(
    (args: {
      triggerPrice: number;
      triggerBelowPrice: boolean;
      order: {
        type: "limit" | "market";
        isBid: boolean;
        quantity: number;
        price?: number;
      };
    }) => {
      const payWithDeep = poolParams?.whitelisted ?? false;
      const base = {
        clientOrderId: Date.now().toString(),
        quantity: args.order.quantity,
        isBid: args.order.isBid,
        payWithDeep,
      };
      return execute(
        tx =>
          tx.add(
            client!.marginTPSL.addConditionalOrder({
              marginManagerKey: MARGIN_KEY,
              conditionalOrderId: Date.now().toString(),
              triggerBelowPrice: args.triggerBelowPrice,
              triggerPrice: args.triggerPrice,
              pendingOrder:
                args.order.type === "limit"
                  ? { ...base, price: args.order.price! }
                  : base,
            })
          ),
        `${args.triggerBelowPrice ? "Stop" : "Take-profit"} order armed`,
        true // add_conditional_order validates the trigger vs oracle price
      );
    },
    [client, execute, poolParams?.whitelisted]
  );

  const cancelConditional = useCallback(
    (conditionalOrderId: string) =>
      execute(
        tx =>
          tx.add(
            client!.marginTPSL.cancelConditionalOrder(
              MARGIN_KEY,
              conditionalOrderId
            )
          ),
        "Conditional order cancelled"
      ),
    [client, execute]
  );

  const cancelAllConditionals = useCallback(
    () =>
      execute(
        tx => tx.add(client!.marginTPSL.cancelAllConditionalOrders(MARGIN_KEY)),
        "All conditional orders cancelled"
      ),
    [client, execute]
  );

  return {
    depositCollateral,
    withdrawCollateral,
    borrow,
    repay,
    placeOrder,
    modifyOrder,
    cancelOrder,
    cancelAllOrders,
    claimSettled,
    addTpsl,
    cancelConditional,
    cancelAllConditionals,
    isPending,
    status,
  };
}

/* ----------------------------- earn (supply) --------------------------- */

/** The user's SupplierCap (one cap serves every margin pool). */
export function useSupplierCap() {
  const suiClient = useSuiClient();
  const address = useAddress();
  return useQuery({
    queryKey: ["deepbook", "supplierCap", address],
    enabled: !!address,
    staleTime: 60_000,
    queryFn: async (): Promise<string | null> => {
      const res = await suiClient.getOwnedObjects({
        owner: address!,
        filter: { StructType: SUPPLIER_CAP_TYPE },
        options: {},
      });
      return res.data[0]?.data?.objectId ?? null;
    },
  });
}

export type EarnPoolRow = {
  coinKey: string;
  borrowAprPct: number;
  utilizationPct: number;
  totalSupply: number;
  available: number;
  mySupply: number;
};

/** Lending overview for every margin pool + the user's supplied amounts. */
export function useEarnPools() {
  const suiClient = useSuiClient();
  const address = useAddress();
  const { data: capId } = useSupplierCap();

  return useQuery({
    queryKey: ["deepbook", "earnPools", DB_NETWORK, capId],
    refetchInterval: 30_000,
    queryFn: async (): Promise<EarnPoolRow[]> => {
      const db = makeDeepBookClient(suiClient, address ?? DEV_ADDRESS);
      return Promise.all(
        Object.keys(DB_MARGIN_POOLS).map(async coinKey => {
          const [rate, supply, borrow, mine] = await Promise.all([
            db.getMarginPoolInterestRate(coinKey),
            db.getMarginPoolTotalSupply(coinKey),
            db.getMarginPoolTotalBorrow(coinKey),
            capId
              ? db
                  .getUserSupplyAmount(coinKey, capId, 9)
                  .then(Number)
                  .catch(() => 0)
              : Promise.resolve(0),
          ]);
          const supplyN = Number(supply);
          const borrowN = Number(borrow);
          return {
            coinKey,
            borrowAprPct: rate * 100,
            utilizationPct: supplyN > 0 ? (borrowN / supplyN) * 100 : 0,
            totalSupply: supplyN,
            available: Math.max(0, supplyN - borrowN),
            mySupply: mine,
          };
        })
      );
    },
  });
}

/** Supply/withdraw against the lending pools (no margin manager needed). */
export function useEarnActions() {
  const suiClient = useSuiClient();
  const queryClient = useQueryClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const address = useAddress();
  const { data: capId } = useSupplierCap();
  const [isPending, setIsPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const run = useCallback(
    async (build: (tx: Transaction) => void, successMsg: string) => {
      if (!address) {
        toast.error("Connect your Sui wallet first");
        return;
      }
      setIsPending(true);
      try {
        const makeTx = () => {
          const tx = new Transaction();
          tx.setSenderIfNotSet(address);
          build(tx);
          return tx;
        };
        setStatus("Simulating…");
        const sim = await suiClient.devInspectTransactionBlock({
          sender: address,
          transactionBlock: makeTx(),
        });
        if (sim.effects?.status?.status !== "success") {
          throw new Error(humanizeMarginError(sim.effects?.status?.error));
        }
        setStatus("Awaiting signature…");
        const res = await signAndExecute({ transaction: makeTx() });
        setStatus("Confirming…");
        await suiClient.waitForTransaction({ digest: res.digest });
        toast.success(`${successMsg} · ${res.digest.slice(0, 10)}…`);
        queryClient.invalidateQueries({ queryKey: ["deepbook"] });
        return res.digest;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/reject/i.test(msg)) toast.info("Transaction cancelled");
        else toast.error(msg.slice(0, 200));
      } finally {
        setIsPending(false);
        setStatus(null);
      }
    },
    [address, suiClient, signAndExecute, queryClient]
  );

  const supply = useCallback(
    (coinKey: string, amount: number) =>
      run(tx => {
        const db = makeDeepBookClient(suiClient, address!);
        // first-time suppliers mint the cap in the same transaction
        const cap = capId
          ? tx.object(capId)
          : tx.add(db.marginPool.mintSupplierCap());
        tx.add(db.marginPool.supplyToMarginPool(coinKey, cap, amount));
        if (!capId) tx.transferObjects([cap], address!);
      }, `Supplied ${amount} ${coinKey}`),
    [run, suiClient, address, capId]
  );

  const withdraw = useCallback(
    (coinKey: string, amount?: number) =>
      run(tx => {
        if (!capId) throw new Error("No supplier position");
        const db = makeDeepBookClient(suiClient, address!);
        const coin = tx.add(
          db.marginPool.withdrawFromMarginPool(coinKey, tx.object(capId), amount)
        );
        tx.transferObjects([coin], address!);
      }, `Withdrew ${amount ?? "all"} ${coinKey}`),
    [run, suiClient, address, capId]
  );

  return { supply, withdraw, isPending, status };
}
