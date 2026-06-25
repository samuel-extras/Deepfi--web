"use client";

/**
 * useVenueTransfer — the real cross-venue transfer, wallet-as-hub.
 *
 * On testnet the venues don't share one coin (Predict=dUSDC, Spot=DBUSDC,
 * Margin=SUI collateral), so every "transfer" is a coin-correct deposit or
 * withdraw between ONE venue and the wallet:
 *   - Predictions ⇄ wallet  in dUSDC  (predict_manager::deposit / withdraw)
 *   - Spot        ⇄ wallet  in DBUSDC (DeepBook BalanceManager, via useSpotActions)
 *   - Margin      ⇄ wallet  in SUI    (MarginManager collateral, via useMarginActions —
 *                                      Pyth-refreshed + risk-checked)
 *
 * Spot/Margin reuse the app's existing, hardened deposit/withdraw actions
 * (devInspect-before-sign, oracle refresh, query invalidation). The Predict
 * legs are built here and run through the same simulate→sign→confirm pattern.
 */
import { useCallback, useRef, useState } from "react";
import { useSuiClient } from "@mysten/dapp-kit";
import { useSignAndExecuteTransaction } from "@/lib/zklogin/useSponsoredExecute";
import { toast } from "sonner";
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { useRefreshAfterTx } from "@/hooks/useRefreshAfterTx";
import { useSpotActions } from "@/lib/deepbook/hooks/useSpotActions";
import { useBalanceManager } from "@/lib/deepbook/hooks/account";
import { DEFAULT_POOL_KEY } from "@/lib/deepbook/core";
import {
  useMarginActions,
  useMarginManager,
} from "@/hooks/useDeepBookMargin";
import { DEFAULT_MARGIN_POOL_KEY } from "@/lib/sui/deepbookMargin";
import { COIN_TYPES } from "@/lib/deepbook";
import { buildCreateManagerTx } from "@/lib/ptb/predict";
import {
  buildPredictDepositTx,
  buildPredictWithdrawTx,
} from "@/lib/ptb/transfer";

export type Venue = "spot" | "margin" | "predictions";
export type TransferDirection = "deposit" | "withdraw"; // deposit = wallet→venue

/** Coin moved for each venue (the only coin that venue + the wallet share). */
export const VENUE_COIN: Record<Venue, string> = {
  spot: "DBUSDC",
  margin: "SUI",
  predictions: "dUSDC",
};

/** DeepBook BalanceManager coin key for the Spot venue. */
const SPOT_COIN_KEY = "DBUSDC";

const DUSDC = COIN_TYPES.dusdc;

function humanizePredict(error: string | undefined): string {
  const e = error ?? "Transaction failed";
  if (/InsufficientCoinBalance|EInsufficient|balance/i.test(e))
    return "Insufficient dUSDC for this transfer.";
  if (/InsufficientGas|insufficient gas/i.test(e))
    return "Not enough SUI for gas. Top up SUI and retry.";
  return `Transfer reverted: ${e.slice(0, 160)}`;
}

export function useVenueTransfer() {
  const account = useActiveAccount();
  const client = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  // Refresh every balance / position / wallet source after a confirmed transfer.
  const refreshBalances = useRefreshAfterTx();

  // Spot venue — DeepBook BalanceManager deposit/withdraw (DBUSDC).
  const spot = useSpotActions(DEFAULT_POOL_KEY);
  const { managerId: spotManagerId, create: createSpotManager } =
    useBalanceManager();

  // Margin venue — collateral deposit/withdraw (SUI), Pyth-refreshed.
  const margin = useMarginActions(DEFAULT_MARGIN_POOL_KEY);
  const { managerId: marginManagerId, create: createMarginManager } =
    useMarginManager(DEFAULT_MARGIN_POOL_KEY);

  // Predict venue — local execution state (Spot/Margin carry their own).
  const [predictPending, setPredictPending] = useState(false);
  const [predictStatus, setPredictStatus] = useState<string | null>(null);
  const predictManagerRef = useRef<string | null>(null);

  /** Resolve the caller's PredictManager id (indexer); null if none yet. */
  const resolvePredictManager = useCallback(
    async (owner: string): Promise<string | null> => {
      if (predictManagerRef.current) return predictManagerRef.current;
      const res = await fetch(`/api/managers?owner=${owner}`)
        .then((r) => r.json())
        .catch(() => ({}));
      if (res?.managerId) {
        predictManagerRef.current = res.managerId as string;
        return predictManagerRef.current;
      }
      return null;
    },
    [],
  );

  /** Resolve or create the caller's PredictManager (create shares a new one). */
  const ensurePredictManager = useCallback(
    async (owner: string): Promise<string> => {
      const existing = await resolvePredictManager(owner);
      if (existing) return existing;

      setPredictStatus("Creating Predictions account…");
      const created = await signAndExecute({
        transaction: buildCreateManagerTx(),
      });
      await client.waitForTransaction({ digest: created.digest });
      const full = await client.getTransactionBlock({
        digest: created.digest,
        options: { showObjectChanges: true },
      });
      const mgr = full.objectChanges?.find(
        (c) =>
          c.type === "created" &&
          "objectType" in c &&
          c.objectType.includes("::predict_manager::PredictManager"),
      );
      const id = mgr && "objectId" in mgr ? mgr.objectId : null;
      if (!id) throw new Error("PredictManager creation returned no id");
      predictManagerRef.current = id;
      return id;
    },
    [client, resolvePredictManager, signAndExecute],
  );

  /** Predict simulate → sign → confirm. `build` yields a fresh tx per call. */
  const runPredict = useCallback(
    async (
      build: () => import("@mysten/sui/transactions").Transaction,
      owner: string,
      successMsg: string,
    ) => {
      setPredictStatus("Simulating…");
      const sim = await client.devInspectTransactionBlock({
        sender: owner,
        transactionBlock: build(),
      });
      if (sim.effects?.status?.status !== "success") {
        throw new Error(humanizePredict(sim.effects?.status?.error));
      }
      setPredictStatus("Awaiting signature…");
      const res = await signAndExecute({ transaction: build() });
      setPredictStatus("Confirming…");
      await client.waitForTransaction({ digest: res.digest });
      toast.success(`${successMsg} · ${res.digest.slice(0, 10)}…`);
      return res.digest;
    },
    [client, signAndExecute],
  );

  const transferPredict = useCallback(
    async (
      direction: TransferDirection,
      amount: number,
      owner: string,
    ): Promise<string | undefined> => {
      setPredictPending(true);
      try {
        if (direction === "deposit") {
          const managerId = await ensurePredictManager(owner);
          setPredictStatus("Reading dUSDC…");
          const { data: coins } = await client.getCoins({
            owner,
            coinType: DUSDC,
          });
          const ids = coins.map((c) => c.coinObjectId);
          if (ids.length === 0)
            throw new Error("No dUSDC in wallet — claim from the faucet first");
          return await runPredict(
            () =>
              buildPredictDepositTx({
                managerId,
                amountDusdc: amount,
                dusdcCoinIds: ids,
              }),
            owner,
            `Deposited ${amount} dUSDC to Predictions`,
          );
        }
        const managerId = await resolvePredictManager(owner);
        if (!managerId) throw new Error("No Predictions balance to withdraw yet");
        return await runPredict(
          () =>
            buildPredictWithdrawTx({
              managerId,
              amountDusdc: amount,
              recipient: owner,
            }),
          owner,
          `Withdrew ${amount} dUSDC to wallet`,
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/reject/i.test(msg)) toast.info("Transaction cancelled");
        else toast.error(msg.slice(0, 200));
        return undefined;
      } finally {
        setPredictPending(false);
        setPredictStatus(null);
      }
    },
    [client, ensurePredictManager, resolvePredictManager, runPredict],
  );

  const transfer = useCallback(
    async (args: {
      venue: Venue;
      direction: TransferDirection;
      amount: number;
    }): Promise<void> => {
      const { venue, direction, amount } = args;
      const owner = account?.address;
      if (!owner) {
        toast.error("Connect your wallet first");
        return;
      }
      if (!(amount > 0)) {
        toast.error("Enter an amount");
        return;
      }

      let digest: string | undefined;

      if (venue === "predictions") {
        digest = await transferPredict(direction, amount, owner);
      } else if (venue === "spot") {
        if (direction === "deposit" && !spotManagerId) {
          await createSpotManager();
          toast.info("Spot account created — tap Transfer again to deposit");
          return;
        }
        digest =
          direction === "deposit"
            ? await spot.deposit(SPOT_COIN_KEY, amount)
            : await spot.withdraw(SPOT_COIN_KEY, amount);
      } else {
        // margin
        if (direction === "deposit" && !marginManagerId) {
          await createMarginManager();
          toast.info("Margin account created — tap Transfer again to deposit");
          return;
        }
        if (!marginManagerId) {
          toast.error("No Margin account yet — deposit collateral first");
          return;
        }
        // side "base" = SUI collateral on the SUI/DBUSDC margin pool.
        digest =
          direction === "deposit"
            ? await margin.depositCollateral("base", amount)
            : await margin.withdrawCollateral("base", amount);
      }

      // Confirmed on-chain → pull fresh balances now (don't wait for the poll).
      if (digest) refreshBalances();
    },
    [
      account?.address,
      transferPredict,
      spot,
      spotManagerId,
      createSpotManager,
      margin,
      marginManagerId,
      createMarginManager,
      refreshBalances,
    ],
  );

  const isPending = predictPending || spot.isPending || margin.isPending;
  const status = predictStatus ?? spot.status ?? margin.status ?? null;

  return { transfer, isPending, status };
}
