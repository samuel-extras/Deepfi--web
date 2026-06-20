"use client";

/**
 * DeepBook Predict mint flow (the hackathon core).
 *
 * Mints a vertical RANGE position on a live Predict oracle, paid in dUSDC, signed
 * by the connected Slush wallet. Steps (atomic where possible):
 *   1. Ensure a PredictManager (create + share on first use, cache the id).
 *   2. Size the contract quantity for the target dUSDC via devInspect
 *      (get_range_trade_amounts is linear in quantity).
 *   3. Merge dUSDC, split the spend, deposit into the manager + mint_range — one PTB.
 *
 * Pure mint (no spot swap) — works with the user's own dUSDC, so it doesn't need
 * the (undeployed) SUI/dUSDC pool the combo trade would.
 */
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { useCallback, useRef, useState } from "react";
import { useSuiClient } from "@mysten/dapp-kit";
import { useSignAndExecuteTransaction } from "@/lib/zklogin/useSponsoredExecute";
import { Transaction } from "@mysten/sui/transactions";
import { bcs } from "@mysten/sui/bcs";
import { toast } from "sonner";
import { COIN_TYPES, OBJECTS, TARGETS, toDusdcU64, toStrikeU64 } from "@/lib/deepbook";
import { buildCreateManagerTx, addDepositMintRange } from "@/lib/ptb/predict";

const DUSDC = COIN_TYPES.dusdc;
const Q0 = 1_000_000; // probe quantity for linear cost sizing

export type PredictMintArgs = {
  oracleId: string;
  expiryMs: number;
  lowerUsd: number;
  higherUsd: number;
  amountDusdc: number;
};

export function usePredictMint() {
  const account = useActiveAccount();
  const client = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const [isMinting, setIsMinting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  // Cache the manager id for the session — prevents duplicate creation when
  // the indexer hasn't indexed a freshly-created manager yet.
  const managerIdRef = useRef<string | null>(null);

  const ensureManager = useCallback(
    async (owner: string): Promise<string> => {
      // Fast path: already resolved in this session
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
          c.objectType.includes("::predict_manager::PredictManager")
      );
      const id = mgr && "objectId" in mgr ? mgr.objectId : null;
      if (!id) throw new Error("PredictManager creation returned no id");
      managerIdRef.current = id;
      return id;
    },
    [client, signAndExecute]
  );

  const sizeQuantity = useCallback(
    async (owner: string, a: PredictMintArgs): Promise<string> => {
      const tx = new Transaction();
      const key = tx.moveCall({
        target: TARGETS.rangeKeyNew,
        arguments: [
          tx.pure.id(a.oracleId),
          tx.pure.u64(a.expiryMs),
          tx.pure.u64(toStrikeU64(a.lowerUsd)),
          tx.pure.u64(toStrikeU64(a.higherUsd)),
        ],
      });
      tx.moveCall({
        target: TARGETS.getRangeTradeAmounts,
        arguments: [
          tx.object(OBJECTS.predict),
          tx.object(a.oracleId),
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
      const qty = Math.floor((Number(toDusdcU64(a.amountDusdc)) * Q0) / askCost);
      if (qty <= 0) throw new Error("Amount too small for this range");
      return String(qty);
    },
    [client]
  );

  const mint = useCallback(
    async (a: PredictMintArgs) => {
      if (!account?.address) {
        toast.error("Connect your wallet to mint");
        return;
      }
      if (!(a.amountDusdc > 0) || !(a.higherUsd > a.lowerUsd)) {
        toast.error("Enter a valid amount and range");
        return;
      }
      const owner = account.address;
      setIsMinting(true);
      try {
        const managerId = await ensureManager(owner);

        setStatus("Loading dUSDC…");
        const { data: coins } = await client.getCoins({ owner, coinType: DUSDC });
        if (!coins.length)
          throw new Error("No dUSDC — get testnet dUSDC from the faucet first");
        const total = coins.reduce((s, c) => s + Number(c.balance), 0);
        if (total < Number(toDusdcU64(a.amountDusdc)))
          throw new Error(`Insufficient dUSDC (need ${a.amountDusdc})`);

        setStatus("Pricing range…");
        const quantity = await sizeQuantity(owner, a);

        setStatus("Building mint…");
        const tx = new Transaction();
        const [primary, ...rest] = coins;
        const src = tx.object(primary.coinObjectId);
        if (rest.length)
          tx.mergeCoins(src, rest.map(c => tx.object(c.coinObjectId)));
        const [spend] = tx.splitCoins(src, [tx.pure.u64(toDusdcU64(a.amountDusdc))]);
        addDepositMintRange(tx, {
          managerId,
          depositCoin: spend,
          leg: {
            oracleId: a.oracleId,
            expiryMs: a.expiryMs,
            lowerStrikeUsd: a.lowerUsd,
            higherStrikeUsd: a.higherUsd,
            quantity,
          },
        });

        setStatus("Awaiting signature…");
        const res = await signAndExecute({ transaction: tx });
        await client.waitForTransaction({ digest: res.digest });
        toast.success(`Minted ${a.amountDusdc} dUSDC range · ${res.digest.slice(0, 8)}…`);
        return res.digest;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error(`Mint failed: ${msg.slice(0, 160)}`);
      } finally {
        setIsMinting(false);
        setStatus(null);
      }
    },
    [account?.address, client, signAndExecute, ensureManager, sizeQuantity]
  );

  return { mint, isMinting, status, isConnected: Boolean(account?.address) };
}
