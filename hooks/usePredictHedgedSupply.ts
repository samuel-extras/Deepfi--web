"use client";

/**
 * DeepBook Predict — Hedged PLP (#2, Level 1).
 *
 * One atomic PTB that BOTH supplies dUSDC to the PLP vault (earning the protocol
 * spread) AND mints an out-of-the-money DOWN binary as crash insurance — "PLP
 * yield minus left-tail." Mirrors usePredictBinaryMint's manager + sizing flow.
 */
import { useCallback, useRef, useState } from "react";
import {
  useCurrentAccount,
  useSuiClient,
  useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { bcs } from "@mysten/sui/bcs";
import { toast } from "sonner";
import { COIN_TYPES, OBJECTS, TARGETS, toDusdcU64, toStrikeU64 } from "@/lib/deepbook";
import {
  buildCreateManagerTx,
  addDepositMintBinary,
  addSupply,
} from "@/lib/ptb/predict";

const DUSDC = COIN_TYPES.dusdc;
const Q0 = 1_000_000;

export type HedgedSupplyArgs = {
  oracleId: string;
  expiryMs: number;
  /** dUSDC to supply to the PLP vault. */
  supplyDusdc: number;
  /** dUSDC to spend on the OTM down-binary hedge (0 = supply only). */
  hedgeDusdc: number;
  /** OTM down strike (USD) for the hedge. */
  hedgeStrikeUsd: number;
};

export function usePredictHedgedSupply() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const [isPending, setIsPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const managerIdRef = useRef<string | null>(null);

  const ensureManager = useCallback(
    async (owner: string): Promise<string> => {
      if (managerIdRef.current) return managerIdRef.current;
      const known = await fetch(`/api/managers?owner=${owner}`)
        .then((r) => r.json())
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
        (c) =>
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

  /** devInspect-price the down binary, back-solve contract quantity. */
  const sizeHedge = useCallback(
    async (owner: string, a: HedgedSupplyArgs): Promise<string> => {
      const tx = new Transaction();
      const key = tx.moveCall({
        target: TARGETS.marketKeyDown,
        arguments: [
          tx.pure.id(a.oracleId),
          tx.pure.u64(a.expiryMs),
          tx.pure.u64(toStrikeU64(a.hedgeStrikeUsd)),
        ],
      });
      tx.moveCall({
        target: TARGETS.getTradeAmounts,
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
      if (!rv?.length) throw new Error("Couldn't price the hedge right now");
      const askCost = Number(bcs.U64.parse(Uint8Array.from(rv[0][0])));
      if (askCost <= 0) throw new Error("Hedge not currently mintable");
      const qty = Math.floor((Number(toDusdcU64(a.hedgeDusdc)) * Q0) / askCost);
      if (qty <= 0) throw new Error("Hedge amount too small");
      return String(qty);
    },
    [client],
  );

  const execute = useCallback(
    async (a: HedgedSupplyArgs) => {
      if (!account?.address) {
        toast.error("Connect your wallet");
        return;
      }
      if (!(a.supplyDusdc > 0)) {
        toast.error("Enter a supply amount");
        return;
      }
      const owner = account.address;
      const hedgeOn = a.hedgeDusdc > 0;
      setIsPending(true);
      try {
        const managerId = hedgeOn ? await ensureManager(owner) : "";

        setStatus("Loading dUSDC…");
        const { data: coins } = await client.getCoins({ owner, coinType: DUSDC });
        if (!coins.length)
          throw new Error("No dUSDC — claim from the faucet first");
        const need = a.supplyDusdc + (hedgeOn ? a.hedgeDusdc : 0);
        const total = coins.reduce((s, c) => s + Number(c.balance), 0);
        if (total < Number(toDusdcU64(need)))
          throw new Error(`Insufficient dUSDC (need ${need})`);

        let quantity = "0";
        if (hedgeOn) {
          setStatus("Pricing hedge…");
          quantity = await sizeHedge(owner, a);
        }

        setStatus("Building Supply + Hedge PTB…");
        const tx = new Transaction();
        const [primary, ...rest] = coins;
        const src = tx.object(primary.coinObjectId);
        if (rest.length)
          tx.mergeCoins(src, rest.map((c) => tx.object(c.coinObjectId)));

        addSupply(tx, { amountDusdc: a.supplyDusdc, source: src, sender: owner });

        if (hedgeOn) {
          const [hedgeCoin] = tx.splitCoins(src, [
            tx.pure.u64(toDusdcU64(a.hedgeDusdc)),
          ]);
          addDepositMintBinary(tx, {
            managerId,
            depositCoin: hedgeCoin,
            leg: {
              oracleId: a.oracleId,
              expiryMs: a.expiryMs,
              strikeUsd: a.hedgeStrikeUsd,
              isUp: false,
              quantity,
            },
          });
        }

        setStatus("Awaiting signature…");
        const res = await signAndExecute({ transaction: tx });
        await client.waitForTransaction({ digest: res.digest });
        toast.success(
          hedgeOn
            ? `Supplied ${a.supplyDusdc} dUSDC + crash hedge · ${res.digest.slice(0, 8)}…`
            : `Supplied ${a.supplyDusdc} dUSDC`,
        );
        return res.digest;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error(`Failed: ${msg.slice(0, 160)}`);
      } finally {
        setIsPending(false);
        setStatus(null);
      }
    },
    [account?.address, client, signAndExecute, ensureManager, sizeHedge],
  );

  return { execute, isPending, status, isConnected: Boolean(account?.address) };
}
