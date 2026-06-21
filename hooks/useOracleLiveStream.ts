"use client";

/**
 * Connects to the live oracle SSE stream and (a) feeds the live store, (b)
 * bridges freshness into react-query: when a price/SVI/oracle event lands, the
 * indexed views (surface, markets, prices) are stale, so we invalidate them.
 *
 * The invalidate is THROTTLED (leading-gap, trailing-edge) to at most once per
 * THROTTLE_MS — so it fires periodically under a continuous stream rather than
 * being starved by a pure debounce. EventSource auto-reconnects on drop.
 */
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useOracleLiveStore,
  type OracleLiveEventInput,
} from "@/stores/useOracleLiveStore";

const THROTTLE_MS = 2000;
const STALE_KEYS = [
  ["predict", "oracles"],
  ["predict", "svi"],
  ["predict", "surface"],
  ["predict", "prices"],
];

export function useOracleLiveStream() {
  const qc = useQueryClient();
  const setConnected = useOracleLiveStore((s) => s.setConnected);
  const apply = useOracleLiveStore((s) => s.apply);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRun = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined")
      return;

    const refresh = () => {
      lastRun.current = Date.now();
      for (const key of STALE_KEYS) void qc.invalidateQueries({ queryKey: key });
    };
    const scheduleRefresh = () => {
      if (timer.current) return; // already pending → this burst is covered
      const wait = Math.max(0, THROTTLE_MS - (Date.now() - lastRun.current));
      timer.current = setTimeout(() => {
        timer.current = null;
        refresh();
      }, wait);
    };

    const es = new EventSource("/api/oracles/live");
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false); // EventSource retries automatically
    es.onmessage = (msg) => {
      let e: OracleLiveEventInput;
      try {
        e = JSON.parse(msg.data);
      } catch {
        return;
      }
      apply(e);
      // Price ticks are constant, and the cards already read forward from the
      // live store while the chart polls /api/prices itself. Only refetch the
      // indexed views on the infrequent STRUCTURAL events — otherwise we'd hammer
      // the indexer ~every 2s and risk stale responses.
      if (e.type !== "OraclePricesUpdated") scheduleRefresh();
    };

    return () => {
      es.close();
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      setConnected(false);
    };
  }, [qc, setConnected, apply]);
}
