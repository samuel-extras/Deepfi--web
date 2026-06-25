"use client";

/**
 * Shared market-data + selection state for the prediction terminals.
 *
 * Encapsulates the oracle list / rail, the selected market, its SVI + price
 * tape, and the binary/range Selection lifecycle (reset on market switch,
 * auto-advance past expiry, fill ATM defaults). Both the classic hero terminal
 * and the margin-style pro terminal read from this so they price identically.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  OracleDTO,
  OraclesResponse,
  PricesResponse,
  Selection,
  SviResponse,
} from "./types";
import { cadenceByOracle, PREDICT_CADENCES, snapToTick, volStep } from "./types";

const RAIL_MAX = 9;

async function fetchJSON<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
  return (await r.json()) as T;
}

export function usePredictMarket(initialOracleId?: string) {
  const [selectedId, setSelectedId] = useState<string | null>(
    initialOracleId ?? null,
  );
  const [sel, setSel] = useState<Selection>({
    posType: "binary",
    direction: "up",
    strikeUsd: null,
    lowerUsd: null,
    higherUsd: null,
  });
  // Preferred market interval/cadence ("all" = every duration).
  const [selectedInterval, setSelectedInterval] = useState<string>("all");

  const oraclesQ = useQuery({
    queryKey: ["predict", "oracles"],
    queryFn: () => fetchJSON<OraclesResponse>("/api/oracles"),
    refetchInterval: 10_000,
  });
  const active = useMemo(() => oraclesQ.data?.active ?? [], [oraclesQ.data]);
  const settledOracles = useMemo(
    () => oraclesQ.data?.settled ?? [],
    [oraclesQ.data],
  );

  const fetchedAt = oraclesQ.dataUpdatedAt;

  // Each live oracle's rolling cadence, from the gap between consecutive
  // expiries (NOT the market's lifetime — see cadenceByOracle).
  const cadence = useMemo(
    () => cadenceByOracle(active.filter((o) => o.expiry > fetchedAt)),
    [active, fetchedAt],
  );

  // Distinct cadences present, shortest-first — drives the interval selector.
  const intervals = useMemo(() => {
    const present = new Set(cadence.values());
    return PREDICT_CADENCES.map((c) => c.label).filter((l) => present.has(l));
  }, [cadence]);

  const railOracles = useMemo(() => {
    const seen = new Set<number>();
    const out: OracleDTO[] = [];
    const live = active
      .filter((o) => o.expiry > fetchedAt)
      .filter(
        (o) =>
          selectedInterval === "all" ||
          cadence.get(o.oracleId) === selectedInterval,
      )
      .sort((a, b) => a.expiry - b.expiry);
    for (const o of live) {
      if (seen.has(o.expiry)) continue;
      seen.add(o.expiry);
      out.push(o);
      if (out.length >= RAIL_MAX) break;
    }
    return out;
  }, [active, fetchedAt, selectedInterval, cadence]);

  const oracle: OracleDTO | null = useMemo(
    () =>
      active.find((o) => o.oracleId === selectedId) ??
      settledOracles.find((o) => o.oracleId === selectedId) ??
      railOracles[0] ??
      null,
    [active, settledOracles, railOracles, selectedId],
  );

  const sviQ = useQuery({
    queryKey: ["predict", "svi", oracle?.oracleId],
    queryFn: () =>
      fetchJSON<SviResponse>(
        oracle ? `/api/svi?oracleId=${oracle.oracleId}` : "/api/svi",
      ),
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
  const points = useMemo(() => pricesQ.data?.points ?? [], [pricesQ.data]);
  const spot = pricesQ.data?.spot ?? null;

  // Stale-tape detection (testnet feeders stall). "now" is the query's fetch
  // timestamp — a pure render value that refreshes every 3s refetch.
  const now = pricesQ.dataUpdatedAt || 0;
  const lastTickT = points.at(-1)?.t ?? 0;
  const tickAgeMs = lastTickT && now ? now - lastTickT : 0;
  const staleTape = lastTickT > 0 && tickAgeMs > 15 * 60_000;
  const staleAgo = (() => {
    const m = Math.floor(tickAgeMs / 60_000);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
  })();

  // ── selection lifecycle ───────────────────────────────────────────────────
  const tick = Math.max(oracle?.tickSize ?? 1, 1);
  const ref = svi?.forward ?? spot;
  const atm =
    oracle && ref != null ? snapToTick(ref, oracle.minStrike, tick) : null;
  const step =
    oracle && ref != null ? volStep(ref, svi?.atmIv, oracle.expiry, tick) : tick;

  // reset strikes when the market changes
  const prevOracleId = useRef<string | null>(null);
  useEffect(() => {
    if (!oracle) return;
    if (prevOracleId.current && prevOracleId.current !== oracle.oracleId) {
      setSel((s) => ({ ...s, strikeUsd: null, lowerUsd: null, higherUsd: null }));
    }
    prevOracleId.current = oracle.oracleId;
  }, [oracle]);

  // auto-advance to the next live market when this one expires
  useEffect(() => {
    if (!oracle) return;
    if (settledOracles.some((o) => o.oracleId === oracle.oracleId)) return;
    const advance = () => {
      const next = railOracles.find(
        (o) => o.oracleId !== oracle.oracleId && o.expiry > Date.now(),
      );
      if (next) setSelectedId(next.oracleId);
    };
    const msLeft = oracle.expiry - Date.now();
    if (msLeft <= 0) {
      advance();
      return;
    }
    const id = setTimeout(advance, msLeft + 200);
    return () => clearTimeout(id);
  }, [oracle, railOracles, settledOracles]);

  // fill ATM defaults once the grid is known
  useEffect(() => {
    if (!oracle || atm == null) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- seed ATM defaults once the strike grid is known
    setSel((s) => ({
      ...s,
      strikeUsd: s.strikeUsd ?? atm,
      lowerUsd: s.lowerUsd ?? Math.max(oracle.minStrike, atm - step),
      higherUsd: s.higherUsd ?? atm + step,
    }));
  }, [oracle, atm, step]);

  const patchSel = (patch: Partial<Selection>) =>
    setSel((s) => ({ ...s, ...patch }));

  // Switch the preferred interval and jump to that cadence's soonest market
  // (clearing the manual selection so the oracle falls back to the filtered rail).
  const chooseInterval = (iv: string) => {
    setSelectedInterval(iv);
    setSelectedId(null);
  };

  return {
    oracle,
    railOracles,
    settledOracles,
    selectedId: oracle?.oracleId ?? null,
    setSelectedId,
    svi,
    points,
    spot,
    sel,
    patchSel,
    step,
    atm,
    interval: selectedInterval,
    intervals,
    chooseInterval,
    oraclesLoading: oraclesQ.isLoading,
    serverOk: oraclesQ.isSuccess && !!oraclesQ.data?.ok,
    activeCount: active.length,
    staleTape,
    staleAgo,
  };
}
