"use client";

/**
 * Per-oracle ticket data for the quick-bet modal — fetches the oracle + SVI +
 * prices for a single oracleId and manages the binary/range selection, mirroring
 * PredictTerminal so the same `TradeTicket` can render outside the oracle page.
 *
 * Reuses PredictTerminal's React Query keys, so an already-loaded market costs
 * no extra fetches.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  Direction,
  OracleDTO,
  OraclesResponse,
  PricesResponse,
  Selection,
  SviResponse,
} from "@/components/prediction/terminal/types";
import { snapToTick, volStep } from "@/components/prediction/terminal/types";

async function fetchJSON<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
  return (await r.json()) as T;
}

export function usePredictTicket(
  oracleId: string | null,
  direction: Direction,
) {
  const oraclesQ = useQuery({
    queryKey: ["predict", "oracles"],
    queryFn: () => fetchJSON<OraclesResponse>("/api/oracles"),
    refetchInterval: 10_000,
    enabled: oracleId != null,
  });
  const oracle: OracleDTO | null = useMemo(() => {
    const all = [
      ...(oraclesQ.data?.active ?? []),
      ...(oraclesQ.data?.settled ?? []),
    ];
    return all.find((o) => o.oracleId === oracleId) ?? null;
  }, [oraclesQ.data, oracleId]);

  const sviQ = useQuery({
    queryKey: ["predict", "svi", oracle?.oracleId],
    queryFn: () =>
      fetchJSON<SviResponse>(`/api/svi?oracleId=${oracle!.oracleId}`),
    enabled: !!oracle,
    refetchInterval: 10_000,
  });
  const svi = sviQ.data;

  const pricesQ = useQuery({
    queryKey: ["predict", "prices", oracle?.oracleId],
    queryFn: () =>
      fetchJSON<PricesResponse>(`/api/prices?oracleId=${oracle!.oracleId}`),
    enabled: !!oracle,
    refetchInterval: 3_000,
  });
  const spot = pricesQ.data?.spot ?? null;

  const tick = Math.max(oracle?.tickSize ?? 1, 1);
  const ref = svi?.forward ?? spot;
  const atm =
    oracle && ref != null ? snapToTick(ref, oracle.minStrike, tick) : null;
  const step =
    oracle && ref != null ? volStep(ref, svi?.atmIv, oracle.expiry, tick) : tick;

  const [sel, setSel] = useState<Selection>({
    posType: "binary",
    direction,
    strikeUsd: null,
    lowerUsd: null,
    higherUsd: null,
  });
  const patchSel = (patch: Partial<Selection>) =>
    setSel((s) => ({ ...s, ...patch }));

  // switching markets resets strikes to that market's ATM defaults
  const prevId = useRef<string | null>(null);
  useEffect(() => {
    if (!oracle) return;
    if (prevId.current && prevId.current !== oracle.oracleId) {
      setSel((s) => ({
        ...s,
        strikeUsd: null,
        lowerUsd: null,
        higherUsd: null,
      }));
    }
    prevId.current = oracle.oracleId;
  }, [oracle]);

  // follow the direction passed in from the URL (clicking a different side)
  useEffect(() => {
    setSel((s) => (s.direction === direction ? s : { ...s, direction }));
  }, [direction]);

  // fill empty strikes once the grid is known
  useEffect(() => {
    if (!oracle || atm == null) return;
    setSel((s) => ({
      ...s,
      strikeUsd: s.strikeUsd ?? atm,
      lowerUsd: s.lowerUsd ?? Math.max(oracle.minStrike, atm - step),
      higherUsd: s.higherUsd ?? atm + step,
    }));
  }, [oracle, atm, step]);

  return { oracle, svi, sel, patchSel, step };
}
