"use client";

/**
 * DeepBook spot write actions — place/cancel orders, deposit/withdraw, claim
 * settled funds. Every write follows the app's devInspect-before-sign pattern
 * so reverts surface as clean errors before the wallet prompt. A successful
 * write invalidates the whole `["deepbook"]` query tree.
 */
import { useCallback, useState } from "react";
import {
  useSuiClient,
} from "@mysten/dapp-kit";
import { useSignAndExecuteTransaction } from "@/lib/zklogin/useSponsoredExecute";
import { Transaction } from "@mysten/sui/transactions";
import { OrderType } from "@mysten/deepbook-v3";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  MANAGER_KEY,
  formatAmount,
  getSpotPool,
  humanizeDeepBookError,
} from "@/lib/deepbook/core";
import { slippageLimitPrice } from "@/lib/deepbook/domain/slippage";
import { useDeepBookClient } from "./account";
import { usePoolParams } from "./reads";

export type PlaceOrderArgs = {
  type: "limit" | "market";
  isBid: boolean;
  /** Quantity in BASE units (human). */
  quantity: number;
  /** Limit price (quote per base) — required for limit orders. */
  price?: number;
  /** Optional deposit composed into the same PTB (auto top-up). */
  deposit?: { coinKey: string; amount: number };
  /** Post-only etc. — defaults to no restriction. */
  postOnly?: boolean;
  /** Time in force for limit orders (GTC default). */
  tif?: "GTC" | "IOC" | "FOK";
  /** Market-order slippage bound (%); needs markPrice. DeepBook market
   * orders are unbounded, so this becomes an IOC limit at mark ± slippage. */
  slippagePct?: number;
  markPrice?: number;
};

export function useSpotActions(poolKey: string) {
  const suiClient = useSuiClient();
  const queryClient = useQueryClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const { client, address, managerId } = useDeepBookClient();
  const { data: poolParams } = usePoolParams(poolKey);
  const [isPending, setIsPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  /** Simulate, sign, wait, refresh. Returns the digest on success. */
  const execute = useCallback(
    async (
      build: (tx: Transaction) => void,
      successMsg: string,
      /** Optional: derive a result-specific toast (e.g. actual fill) from the
       *  confirmed tx. Returns null to fall back to the default success toast. */
      resolveResult?: (
        digest: string
      ) => Promise<{ text: string; ok: boolean } | null>
    ): Promise<string | undefined> => {
      if (!client || !address) {
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
          throw new Error(humanizeDeepBookError(sim.effects?.status?.error));
        }

        setStatus("Awaiting signature…");
        const res = await signAndExecute({ transaction: makeTx() });
        setStatus("Confirming…");
        await suiClient.waitForTransaction({ digest: res.digest });

        let handled = false;
        if (resolveResult) {
          try {
            const r = await resolveResult(res.digest);
            if (r) {
              (r.ok ? toast.success : toast.warning)(r.text);
              handled = true;
            }
          } catch {
            /* fall back to the default toast below */
          }
        }
        if (!handled) toast.success(`${successMsg} · ${res.digest.slice(0, 10)}…`);
        queryClient.invalidateQueries({ queryKey: ["deepbook"] });
        return res.digest;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // user rejecting in the wallet shouldn't read like a failure
        if (/reject/i.test(msg)) toast.info("Transaction cancelled");
        else toast.error(msg.slice(0, 200));
      } finally {
        setIsPending(false);
        setStatus(null);
      }
    },
    [client, address, suiClient, signAndExecute, queryClient]
  );

  const placeOrder = useCallback(
    async (args: PlaceOrderArgs) => {
      if (!managerId) {
        toast.error("Create your trading account first");
        return;
      }
      const payWithDeep = poolParams?.whitelisted ?? false;
      const clientOrderId = Date.now().toString();

      return execute(tx => {
        if (args.deposit && args.deposit.amount > 0) {
          tx.add(
            client!.balanceManager.depositIntoManager(
              MANAGER_KEY,
              args.deposit.coinKey,
              args.deposit.amount
            )
          );
        }
        // bounded market = IOC limit at mark ± slippage (DeepBook market
        // orders carry no price bound of their own)
        const tick = poolParams?.tickSize ?? 0;
        const iocPrice =
          args.type === "market" && args.slippagePct != null && args.markPrice
            ? slippageLimitPrice(args.markPrice, args.isBid, args.slippagePct, tick)
            : null;

        if (args.type === "limit" || iocPrice != null) {
          tx.add(
            client!.deepBook.placeLimitOrder({
              poolKey,
              balanceManagerKey: MANAGER_KEY,
              clientOrderId,
              price: iocPrice ?? args.price!,
              quantity: args.quantity,
              isBid: args.isBid,
              payWithDeep,
              ...(iocPrice != null || args.tif === "IOC"
                ? { orderType: OrderType.IMMEDIATE_OR_CANCEL }
                : args.tif === "FOK"
                  ? { orderType: OrderType.FILL_OR_KILL }
                  : args.postOnly
                    ? { orderType: OrderType.POST_ONLY }
                    : {}),
            })
          );
        } else {
          tx.add(
            client!.deepBook.placeMarketOrder({
              poolKey,
              balanceManagerKey: MANAGER_KEY,
              clientOrderId,
              quantity: args.quantity,
              isBid: args.isBid,
              payWithDeep,
            })
          );
        }
      }, `${args.isBid ? "Buy" : "Sell"} order placed`, async digest => {
        // Read the actual fill from the OrderInfo event so a 0-fill market
        // order (IOC bound that never crossed the book) doesn't masquerade
        // as a success.
        const tb = await suiClient.getTransactionBlock({
          digest,
          options: { showEvents: true },
        });
        const oi = tb.events?.find(e => e.type.endsWith("OrderInfo"));
        const p = oi?.parsedJson as
          | { original_quantity?: string | number; executed_quantity?: string | number }
          | undefined;
        if (!p) return null;
        const pool = getSpotPool(poolKey);
        const orig = Number(p.original_quantity ?? 0) / pool.baseScalar;
        const exec = Number(p.executed_quantity ?? 0) / pool.baseScalar;
        const side = args.isBid ? "Buy" : "Sell";
        const immediate =
          args.type === "market" || args.tif === "IOC" || args.tif === "FOK";
        if (exec <= 1e-12) {
          return immediate
            ? {
                ok: false,
                text: `${side} didn't fill — the best price was beyond your ${
                  args.slippagePct ?? 0
                }% slippage. Raise slippage or place a limit order.`,
              }
            : { ok: true, text: `${side} limit order placed — resting on the book` };
        }
        if (exec < orig - 1e-9) {
          return {
            ok: true,
            text: `${side} partially filled ${formatAmount(exec)} / ${formatAmount(orig)} ${pool.base}`,
          };
        }
        return { ok: true, text: `${side} filled ${formatAmount(exec)} ${pool.base}` };
      });
    },
    [client, managerId, poolKey, poolParams?.whitelisted, poolParams?.tickSize, execute, suiClient]
  );

  const cancelOrder = useCallback(
    (orderId: string) =>
      // NOTE: testnet package predates pool::cancel_live_order; plain
      // cancel_order aborts if the order already filled — sim catches that.
      execute(
        tx => tx.add(client!.deepBook.cancelOrder(poolKey, MANAGER_KEY, orderId)),
        "Order cancelled"
      ),
    [client, poolKey, execute]
  );

  const cancelAllOrders = useCallback(
    () =>
      execute(
        tx => tx.add(client!.deepBook.cancelAllOrders(poolKey, MANAGER_KEY)),
        "All orders cancelled"
      ),
    [client, poolKey, execute]
  );

  const deposit = useCallback(
    (coinKey: string, amount: number) =>
      execute(
        tx =>
          tx.add(
            client!.balanceManager.depositIntoManager(MANAGER_KEY, coinKey, amount)
          ),
        `Deposited ${amount} ${coinKey}`
      ),
    [client, execute]
  );

  const withdraw = useCallback(
    (coinKey: string, amount: number | "all") =>
      execute(tx => {
        if (amount === "all") {
          tx.add(
            client!.balanceManager.withdrawAllFromManager(
              MANAGER_KEY,
              coinKey,
              address!
            )
          );
        } else {
          tx.add(
            client!.balanceManager.withdrawFromManager(
              MANAGER_KEY,
              coinKey,
              amount,
              address!
            )
          );
        }
      }, `Withdrew ${amount === "all" ? "all" : amount} ${coinKey}`),
    [client, address, execute]
  );

  const claimSettled = useCallback(
    () =>
      execute(
        tx => tx.add(client!.deepBook.withdrawSettledAmounts(poolKey, MANAGER_KEY)),
        "Settled funds claimed"
      ),
    [client, poolKey, execute]
  );

  return {
    placeOrder,
    cancelOrder,
    cancelAllOrders,
    deposit,
    withdraw,
    claimSettled,
    isPending,
    status,
  };
}
