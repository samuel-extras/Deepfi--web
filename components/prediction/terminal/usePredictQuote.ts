"use client";

/**
 * Live quote for the current ticket selection.
 *
 * Primary source: on-chain `get_trade_amounts` / `get_range_trade_amounts` via
 * devInspect — the protocol's real post-spread ask/bid, no wallet required
 * (read-only, any sender). Fallback while loading / on error: fair value from
 * the on-chain SVI surface (per-strike IV → risk-neutral probability).
 *
 * Prices are per $1-payout contract, so price ≈ implied probability.
 */
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { bcs } from "@mysten/sui/bcs";
import { OBJECTS, TARGETS, toStrikeU64 } from "@/lib/deepbook";
import { ivFromRawSvi, probInRange } from "@/lib/svi";
import type { OracleDTO, Selection, SviResponse } from "./types";

const Q0 = 1_000_000; // 1.0 contract probe (6dp quantity units)
const DEV_INSPECT_SENDER = "0x" + "0".repeat(64); // reads don't check ownership
const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;

export type Quote = {
  /** dUSDC you pay per contract (chain ask) */
  ask: number | null;
  /** dUSDC you'd receive per contract selling now (chain bid) */
  bid: number | null;
  /** SVI fair probability of the selection paying out */
  estProb: number | null;
  /** Best display price per contract: chain ask, else SVI fair value */
  price: number | null;
  /** true when `price` is the protocol's real post-spread ask */
  isLive: boolean;
  isFetching: boolean;
};

function selectionKey(sel: Selection): string {
  return sel.posType === "binary"
    ? `b:${sel.strikeUsd}:${sel.direction}`
    : `r:${sel.lowerUsd}:${sel.higherUsd}`;
}

function selectionValid(sel: Selection): boolean {
  if (sel.posType === "binary") return sel.strikeUsd != null && sel.strikeUsd > 0;
  return (
    sel.lowerUsd != null &&
    sel.higherUsd != null &&
    sel.higherUsd > sel.lowerUsd &&
    sel.lowerUsd > 0
  );
}

export function usePredictQuote(
  oracle: OracleDTO | null,
  sel: Selection,
  svi?: SviResponse,
): Quote {
  const client = useSuiClient();
  const account = useCurrentAccount();
  const live = !!oracle && oracle.status === "active" && oracle.expiry > Date.now();
  const enabled = live && selectionValid(sel);

  const chainQ = useQuery({
    queryKey: ["predict", "quote", oracle?.oracleId, selectionKey(sel)],
    enabled,
    refetchInterval: 6_000,
    staleTime: 4_000,
    placeholderData: keepPreviousData,
    retry: 1,
    queryFn: async () => {
      if (!oracle) return null;
      const tx = new Transaction();
      if (sel.posType === "binary") {
        const key = tx.moveCall({
          target: sel.direction === "up" ? TARGETS.marketKeyUp : TARGETS.marketKeyDown,
          arguments: [
            tx.pure.id(oracle.oracleId),
            tx.pure.u64(oracle.expiry),
            tx.pure.u64(toStrikeU64(sel.strikeUsd!)),
          ],
        });
        tx.moveCall({
          target: TARGETS.getTradeAmounts,
          arguments: [
            tx.object(OBJECTS.predict),
            tx.object(oracle.oracleId),
            key,
            tx.pure.u64(Q0),
            tx.object(OBJECTS.clock),
          ],
        });
      } else {
        const key = tx.moveCall({
          target: TARGETS.rangeKeyNew,
          arguments: [
            tx.pure.id(oracle.oracleId),
            tx.pure.u64(oracle.expiry),
            tx.pure.u64(toStrikeU64(sel.lowerUsd!)),
            tx.pure.u64(toStrikeU64(sel.higherUsd!)),
          ],
        });
        tx.moveCall({
          target: TARGETS.getRangeTradeAmounts,
          arguments: [
            tx.object(OBJECTS.predict),
            tx.object(oracle.oracleId),
            key,
            tx.pure.u64(Q0),
            tx.object(OBJECTS.clock),
          ],
        });
      }
      const res = await client.devInspectTransactionBlock({
        sender: account?.address ?? DEV_INSPECT_SENDER,
        transactionBlock: tx,
      });
      const rv = res.results?.at(-1)?.returnValues;
      if (!rv || rv.length < 2) return null;
      const cost = Number(bcs.U64.parse(Uint8Array.from(rv[0][0])));
      const payout = Number(bcs.U64.parse(Uint8Array.from(rv[1][0])));
      // cost/payout are 1e6 dUSDC units for Q0=1e6 quantity → per-contract price
      return { ask: cost / Q0, bid: payout / Q0 };
    },
  });

  // SVI fair-value estimate — always computable when the surface is loaded
  let estProb: number | null = null;
  if (oracle && svi?.params && svi.forward && selectionValid(sel)) {
    const tYears = Math.max(1e-9, (oracle.expiry - Date.now()) / MS_PER_YEAR);
    if (sel.posType === "binary") {
      const iv = ivFromRawSvi(sel.strikeUsd!, svi.forward, svi.params, tYears);
      const pUp = probInRange(svi.forward, sel.strikeUsd!, Infinity, iv, tYears);
      estProb = sel.direction === "up" ? pUp : 1 - pUp;
    } else {
      const mid = (sel.lowerUsd! + sel.higherUsd!) / 2;
      const iv = ivFromRawSvi(mid, svi.forward, svi.params, tYears);
      estProb = probInRange(svi.forward, sel.lowerUsd!, sel.higherUsd!, iv, tYears);
    }
  }

  const ask = chainQ.data?.ask ?? null;
  const bid = chainQ.data?.bid ?? null;
  return {
    ask,
    bid,
    estProb,
    price: ask ?? estProb,
    isLive: ask != null,
    isFetching: chainQ.isFetching,
  };
}
