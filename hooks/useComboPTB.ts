"use client";

/**
 * useComboPTB — executes the three-protocol Combo Trade PTB.
 *
 * Single transaction that atomically:
 *   1. DeepBook Margin  — creates a MarginManager, deposits SUI collateral
 *   2. DeepBook Predict — deposits dUSDC + mints a range position
 *   3. PLP Vault        — optional: supplies dUSDC, returns PLP to caller
 *
 * This is the hackathon's flagship three-protocol composability demo.
 * Any leg failure reverts the whole tx.
 */
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { useCallback, useRef, useState } from "react";
import { useSuiClient } from "@mysten/dapp-kit";
import { useSignAndExecuteTransaction } from "@/lib/zklogin/useSponsoredExecute";
import { Transaction } from "@mysten/sui/transactions";
import { bcs } from "@mysten/sui/bcs";
import { toast } from "sonner";
import {
  COIN_TYPES,
  MARGIN_OBJECTS,
  OBJECTS,
  PYTH,
  TARGETS,
  toDusdcU64,
  toStrikeU64,
} from "@/lib/deepbook";
import { buildCreateManagerTx } from "@/lib/ptb/predict";
import { buildMarginPredictTx } from "@/lib/ptb/comboTrade";
import { fetchPythAccumulatorUpdate } from "@/lib/ptb/pyth";

const DUSDC = COIN_TYPES.dusdc;
const SUI_MIST_PER_SUI = 1_000_000_000;
const Q0 = 1_000_000; // probe quantity for linear cost sizing

/**
 * Turn a raw Move/devInspect abort string into a user-readable message.
 * Recognizes the failure modes specific to this combo PTB.
 */
function humanizeAbort(error: string | undefined): string {
  const e = error ?? "Transaction simulation failed";
  if (/check_price_is_fresh/i.test(e))
    return "Pyth price feed went stale — please try again (prices refresh every few seconds).";
  if (/InsufficientGas|insufficient gas|InsufficientCoinBalance/i.test(e))
    return "Not enough SUI for gas + collateral. Top up SUI and retry.";
  if (/check_price_confidence|confidence/i.test(e))
    return "Pyth price confidence too wide right now — please retry shortly.";
  if (/risk_ratio|RiskRatio|undercollateral/i.test(e))
    return "Collateral too low for this position — add more SUI collateral.";
  if (/balance|Insufficient.*dUSDC|EInsufficient/i.test(e))
    return "Insufficient dUSDC for the predict + PLP legs.";
  // Fall back to the raw reason, trimmed
  return `Simulation reverted: ${e.slice(0, 160)}`;
}

export interface ComboTradeArgs {
  /** SUI collateral for the margin leg, in SUI (e.g. 0.5 = 500_000_000 MIST). */
  suiCollateralSui: number;
  /** Oracle object id for the Predict range. */
  oracleId: string;
  /** Expiry timestamp in ms (from oracle). */
  expiryMs: number;
  /** Lower range strike in USD (e.g. 69000). */
  lowerUsd: number;
  /** Higher range strike in USD (e.g. 71000). */
  higherUsd: number;
  /** dUSDC to spend on the Predict range. */
  predictDusdc: number;
  /** dUSDC to supply to PLP vault (0 = skip PLP leg). */
  plpDusdc: number;
}

export interface ComboTradeResult {
  digest: string;
  marginManagerId?: string;
}

export function useComboPTB() {
  const account = useActiveAccount();
  const client = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const [isExecuting, setIsExecuting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  // Cache predict manager id so we don't create duplicates within a session
  const managerIdRef = useRef<string | null>(null);

  // ──────────────────────────────────────────────────────────────
  // Ensure the caller has a PredictManager (create once, cache)
  // ──────────────────────────────────────────────────────────────
  const ensurePredictManager = useCallback(
    async (owner: string): Promise<string> => {
      if (managerIdRef.current) return managerIdRef.current;

      const known = await fetch(`/api/managers?owner=${owner}`)
        .then(r => r.json())
        .catch(() => ({}));
      if (known?.managerId) {
        managerIdRef.current = known.managerId as string;
        return managerIdRef.current;
      }

      setStatus("Creating PredictManager…");
      const created = await signAndExecute({ transaction: buildCreateManagerTx() });
      await client.waitForTransaction({ digest: created.digest });
      const full = await client.getTransactionBlock({
        digest: created.digest,
        options: { showObjectChanges: true },
      });
      const mgr = full.objectChanges?.find(
        c =>
          c.type === "created" &&
          "objectType" in c &&
          c.objectType.includes("::predict_manager::PredictManager"),
      );
      const id = mgr && "objectId" in mgr ? mgr.objectId : null;
      if (!id) throw new Error("PredictManager creation returned no id");
      managerIdRef.current = id;
      return id;
    },
    [client, signAndExecute],
  );

  // ──────────────────────────────────────────────────────────────
  // devInspect to size contract quantity from a dUSDC spend target
  // ──────────────────────────────────────────────────────────────
  const sizeRangeQuantity = useCallback(
    async (
      owner: string,
      oracleId: string,
      expiryMs: number,
      lowerUsd: number,
      higherUsd: number,
      amountDusdc: number,
    ): Promise<string> => {
      const tx = new Transaction();
      const key = tx.moveCall({
        target: TARGETS.rangeKeyNew,
        arguments: [
          tx.pure.id(oracleId),
          tx.pure.u64(expiryMs),
          tx.pure.u64(toStrikeU64(lowerUsd)),
          tx.pure.u64(toStrikeU64(higherUsd)),
        ],
      });
      tx.moveCall({
        target: TARGETS.getRangeTradeAmounts,
        arguments: [
          tx.object(OBJECTS.predict),
          tx.object(oracleId),
          key,
          tx.pure.u64(Q0),
          tx.object(OBJECTS.clock),
        ],
      });
      const res = await client.devInspectTransactionBlock({
        sender: owner,
        transactionBlock: tx,
      });
      const rv = res.results?.at(-1)?.returnValues;
      if (!rv?.length) throw new Error("Could not price this range (no live quote)");
      const askCost = Number(bcs.U64.parse(Uint8Array.from(rv[0][0])));
      if (askCost <= 0) throw new Error("Range not currently mintable");
      const qty = Math.floor((Number(toDusdcU64(amountDusdc)) * Q0) / askCost);
      if (qty <= 0) throw new Error("Amount too small for this range");
      return String(qty);
    },
    [client],
  );

  // ──────────────────────────────────────────────────────────────
  // Main execute function
  // ──────────────────────────────────────────────────────────────
  const execute = useCallback(
    async (args: ComboTradeArgs): Promise<ComboTradeResult | undefined> => {
      if (!account?.address) {
        toast.error("Connect your wallet first");
        return;
      }
      const {
        suiCollateralSui,
        oracleId,
        expiryMs,
        lowerUsd,
        higherUsd,
        predictDusdc,
        plpDusdc,
      } = args;

      if (suiCollateralSui <= 0) { toast.error("Enter SUI collateral amount"); return; }
      if (predictDusdc <= 0)    { toast.error("Enter dUSDC predict amount"); return; }
      if (higherUsd <= lowerUsd){ toast.error("High strike must be above low strike"); return; }

      const owner = account.address;
      setIsExecuting(true);
      try {
        // 1. Ensure predict manager
        const predictManagerId = await ensurePredictManager(owner);

        // 2. Check dUSDC balance
        setStatus("Checking dUSDC balance…");
        const { data: coins } = await client.getCoins({ owner, coinType: DUSDC });
        if (!coins.length)
          throw new Error("No dUSDC in wallet — claim from faucet first");
        const totalNeeded = toDusdcU64(predictDusdc + (plpDusdc || 0));
        const totalHeld = coins.reduce((s, c) => s + Number(c.balance), 0);
        if (totalHeld < Number(totalNeeded))
          throw new Error(
            `Need ${predictDusdc + (plpDusdc || 0)} dUSDC, wallet has ${totalHeld / 1e6}`,
          );

        // 3. Price the range via devInspect
        setStatus("Pricing range…");
        const quantity = await sizeRangeQuantity(
          owner,
          oracleId,
          expiryMs,
          lowerUsd,
          higherUsd,
          predictDusdc,
        );

        // 4. Merge dUSDC coins if needed
        setStatus("Building Combo PTB…");
        const suiCollateralMist = Math.round(suiCollateralSui * SUI_MIST_PER_SUI);

        // For a clean PTB, merge dUSDC into one coin via a pre-step tx if > 1 object
        // — OR handle inline via the SDK's coin merging in the same tx.
        // We use the SDK approach: pass a merged coin reference in the PTB.
        const [primary, ...rest] = coins;
        let dusdcCoinId = primary.coinObjectId;

        // If there are multiple dUSDC objects, merge them first in a lightweight tx
        if (rest.length > 0) {
          const mergeTx = new Transaction();
          const src = mergeTx.object(primary.coinObjectId);
          mergeTx.mergeCoins(src, rest.map(c => mergeTx.object(c.coinObjectId)));
          setStatus("Merging dUSDC coins…");
          const mergeRes = await signAndExecute({ transaction: mergeTx });
          await client.waitForTransaction({ digest: mergeRes.digest });
          // After merge, the primary coin object holds all balance
          dusdcCoinId = primary.coinObjectId;
        }

        // 5. Fetch a fresh Pyth update (testnet feeds aren't keeper-kept, so the
        //    margin deposit would otherwise abort on check_price_is_fresh).
        setStatus("Refreshing Pyth prices…");
        const accumulatorMsg = await fetchPythAccumulatorUpdate([
          PYTH.feeds.sui,
          PYTH.feeds.dbusdc,
        ]);

        // 6. Build the three-protocol combo PTB (pure builder, so we can build
        //    it twice — once to simulate, once to sign).
        const comboParams = {
          predictManagerId,
          suiCollateralMist,
          leg: {
            oracleId,
            expiryMs,
            lowerStrikeUsd: lowerUsd,
            higherStrikeUsd: higherUsd,
            quantity,
          },
          dusdcCoinId,
          depositDusdc: predictDusdc,
          plpSupplyDusdc: plpDusdc > 0 ? plpDusdc : undefined,
          pythUpdate: {
            accumulatorMsg,
            feeds: [
              { feedId: PYTH.feeds.sui, priceInfoObjectId: MARGIN_OBJECTS.suiPriceInfo },
              { feedId: PYTH.feeds.dbusdc, priceInfoObjectId: MARGIN_OBJECTS.dbusdcPriceInfo },
            ],
          },
          sender: owner,
        };

        // 7. Dry-run first: simulate the whole PTB so a revert surfaces as a
        //    clean error BEFORE the user signs (no wasted gas, no scary wallet
        //    rejection). devInspect executes the same Move logic as a real tx.
        setStatus("Simulating transaction…");
        const sim = await client.devInspectTransactionBlock({
          sender: owner,
          transactionBlock: buildMarginPredictTx(comboParams),
        });
        if (sim.effects?.status?.status !== "success") {
          throw new Error(humanizeAbort(sim.effects?.status?.error));
        }

        // 8. Simulation passed — build a fresh tx and sign for real.
        setStatus("Awaiting wallet signature…");
        const res = await signAndExecute({
          transaction: buildMarginPredictTx(comboParams),
        });
        await client.waitForTransaction({ digest: res.digest });

        // 9. Extract the new MarginManager id from object changes
        const full = await client.getTransactionBlock({
          digest: res.digest,
          options: { showObjectChanges: true },
        });
        const marginMgr = full.objectChanges?.find(
          c =>
            c.type === "created" &&
            "objectType" in c &&
            c.objectType.includes("::margin_manager::MarginManager"),
        );
        const marginManagerId =
          marginMgr && "objectId" in marginMgr ? marginMgr.objectId : undefined;

        toast.success(
          `Combo PTB executed · ${res.digest.slice(0, 10)}…`,
        );
        return { digest: res.digest, marginManagerId };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error(`Combo trade failed: ${msg.slice(0, 180)}`);
      } finally {
        setIsExecuting(false);
        setStatus(null);
      }
    },
    [
      account?.address,
      client,
      signAndExecute,
      ensurePredictManager,
      sizeRangeQuantity,
    ],
  );

  return {
    execute,
    isExecuting,
    status,
    isConnected: Boolean(account?.address),
  };
}
