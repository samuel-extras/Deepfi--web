"use client";

/**
 * DeepBook Predict — Range Ladder mint.
 *
 * Mints a strip of adjacent vertical ranges (the "Range Ladder Vault" strategy)
 * in ONE atomic PTB: deposit the full dUSDC once, then mint_range for each leg.
 * Each leg is priced independently via get_range_trade_amounts (devInspect) so
 * the equal-split stake buys the right quantity per rung.
 *
 * Mirrors usePredictMint / usePredictBinaryMint (same manager + coin handling)
 * so the trade ticket can drive it like any other position type.
 */
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { useCallback, useRef, useState } from "react";
import { useSuiClient } from "@mysten/dapp-kit";
import { useSignAndExecuteTransaction } from "@/lib/zklogin/useSponsoredExecute";
import { Transaction } from "@mysten/sui/transactions";
import { bcs } from "@mysten/sui/bcs";
import { toast } from "sonner";
import { COIN_TYPES, OBJECTS, TARGETS, toDusdcU64, toStrikeU64 } from "@/lib/deepbook";
import { buildCreateManagerTx } from "@/lib/ptb/predict";

const DUSDC = COIN_TYPES.dusdc;
const Q0 = 1_000_000; // probe quantity for linear cost sizing

export type LadderLeg = { lowerUsd: number; higherUsd: number };
export type PredictLadderArgs = {
  oracleId: string;
  expiryMs: number;
  legs: LadderLeg[];
  /** total dUSDC, split equally across legs */
  amountDusdc: number;
};

export function usePredictLadderMint() {
  const account = useActiveAccount();
  const client = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const [isMinting, setIsMinting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const managerIdRef = useRef<string | null>(null);

  const ensureManager = useCallback(
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

  const mint = useCallback(
    async (a: PredictLadderArgs) => {
      if (!account?.address) {
        toast.error("Connect your wallet to deploy");
        return;
      }
      if (!(a.amountDusdc > 0) || a.legs.length === 0) {
        toast.error("Enter a valid amount and ladder");
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

        // price each leg independently and back-solve its contract quantity
        setStatus("Pricing legs…");
        const perLeg = a.amountDusdc / a.legs.length;
        const quantities: string[] = [];
        for (const leg of a.legs) {
          const tx = new Transaction();
          const key = tx.moveCall({
            target: TARGETS.rangeKeyNew,
            arguments: [
              tx.pure.id(a.oracleId),
              tx.pure.u64(a.expiryMs),
              tx.pure.u64(toStrikeU64(leg.lowerUsd)),
              tx.pure.u64(toStrikeU64(leg.higherUsd)),
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
          if (!rv?.length) throw new Error("A rung isn't priceable right now");
          const askCost = Number(bcs.U64.parse(Uint8Array.from(rv[0][0])));
          if (askCost <= 0) throw new Error("A rung isn't mintable right now");
          const qty = Math.floor((Number(toDusdcU64(perLeg)) * Q0) / askCost);
          if (qty <= 0)
            throw new Error("Amount too small to split across this many rungs");
          quantities.push(String(qty));
        }

        // one atomic PTB: deposit once, then mint_range for every leg
        setStatus("Building ladder PTB…");
        const tx = new Transaction();
        const [primary, ...rest] = coins;
        const src = tx.object(primary.coinObjectId);
        if (rest.length)
          tx.mergeCoins(src, rest.map(c => tx.object(c.coinObjectId)));
        const [deposit] = tx.splitCoins(src, [
          tx.pure.u64(toDusdcU64(a.amountDusdc)),
        ]);
        tx.moveCall({
          target: TARGETS.managerDeposit,
          typeArguments: [DUSDC],
          arguments: [tx.object(managerId), deposit],
        });
        a.legs.forEach((leg, i) => {
          const key = tx.moveCall({
            target: TARGETS.rangeKeyNew,
            arguments: [
              tx.pure.id(a.oracleId),
              tx.pure.u64(a.expiryMs),
              tx.pure.u64(toStrikeU64(leg.lowerUsd)),
              tx.pure.u64(toStrikeU64(leg.higherUsd)),
            ],
          });
          tx.moveCall({
            target: TARGETS.mintRange,
            typeArguments: [DUSDC],
            arguments: [
              tx.object(OBJECTS.predict),
              tx.object(managerId),
              tx.object(a.oracleId),
              key,
              tx.pure.u64(quantities[i]),
              tx.object(OBJECTS.clock),
            ],
          });
        });

        setStatus("Awaiting signature…");
        const res = await signAndExecute({ transaction: tx });
        await client.waitForTransaction({ digest: res.digest });
        toast.success(
          `Range ladder · ${a.legs.length} rungs · ${a.amountDusdc} dUSDC · ${res.digest.slice(0, 8)}…`,
        );
        return res.digest;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error(`Ladder failed: ${msg.slice(0, 160)}`);
      } finally {
        setIsMinting(false);
        setStatus(null);
      }
    },
    [account?.address, client, signAndExecute, ensureManager],
  );

  return { mint, isMinting, status, isConnected: Boolean(account?.address) };
}
