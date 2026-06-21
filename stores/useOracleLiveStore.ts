"use client";

/**
 * Live oracle state, fed by the SSE stream (`/api/oracles/live`). Holds the
 * connection status + the latest fullnode snapshot per oracle (forward/spot/SVI/
 * status) so UI can read on-chain-fresh values ahead of the lagging indexer.
 *
 * Fields are merged per event type — a later OracleSVIUpdated won't clobber the
 * forward set by an earlier OraclePricesUpdated, and vice-versa.
 */
import { create } from "zustand";
import { fromPriceU64 } from "@/lib/deepbook";

export interface OracleSnapshot {
  forward?: number; // USD (scaled from u64)
  spot?: number; // USD
  sviParams?: unknown; // raw OracleSVIUpdated payload
  status?: string;
  lastType: string;
  ts: number;
}

export interface OracleLiveEventInput {
  type: string;
  oracleId: string | null;
  parsedJson: unknown;
  timestampMs: number | null;
}

interface OracleLiveState {
  connected: boolean;
  lastEventAt: number | null;
  eventCount: number;
  byOracle: Record<string, OracleSnapshot>;
  setConnected: (c: boolean) => void;
  apply: (e: OracleLiveEventInput) => void;
}

function scale(raw: unknown): number | undefined {
  if (typeof raw !== "string" && typeof raw !== "number") return undefined;
  const n = fromPriceU64(raw);
  return Number.isFinite(n) ? n : undefined;
}

const MAX_ORACLES = 64; // cap live snapshots as oracles roll (newest kept)

export const useOracleLiveStore = create<OracleLiveState>((set) => ({
  connected: false,
  lastEventAt: null,
  eventCount: 0,
  byOracle: {},
  setConnected: (connected) => set({ connected }),
  apply: (e) =>
    set((s) => {
      const ts = e.timestampMs ?? Date.now();
      const base = { lastEventAt: ts, eventCount: s.eventCount + 1 };
      if (!e.oracleId) return base;

      const prev = s.byOracle[e.oracleId];
      const next: OracleSnapshot = {
        ...prev,
        lastType: e.type,
        ts,
      };
      const pj = (e.parsedJson ?? {}) as Record<string, unknown>;
      if (e.type === "OraclePricesUpdated") {
        const f = scale(pj.forward);
        const sp = scale(pj.spot);
        if (f !== undefined) next.forward = f;
        if (sp !== undefined) next.spot = sp;
      } else if (e.type === "OracleSVIUpdated") {
        next.sviParams = pj;
      } else if (e.type === "OracleSettled") {
        next.status = "settled";
      } else if (e.type === "OracleActivated") {
        next.status = "active";
      }

      let byOracle = { ...s.byOracle, [e.oracleId]: next };
      // Cap memory as oracles roll — keep the most-recently-updated ones.
      if (Object.keys(byOracle).length > MAX_ORACLES) {
        byOracle = Object.fromEntries(
          Object.entries(byOracle)
            .sort((a, b) => b[1].ts - a[1].ts)
            .slice(0, MAX_ORACLES),
        );
      }
      return { ...base, byOracle };
    }),
}));

/** Latest fullnode forward (USD) for an oracle from the live stream, else undefined. */
export function useLiveForward(oracleId: string | undefined): number | undefined {
  return useOracleLiveStore((s) =>
    oracleId ? s.byOracle[oracleId]?.forward : undefined,
  );
}

/**
 * Freshest live forward (USD) among the given oracles — the most recently
 * updated one wins. For a single-asset (BTC) board this is a stable "current
 * forward" for headlines, robust to any one oracle going quiet. Else undefined.
 */
export function useLiveForwardAny(
  oracleIds: (string | undefined)[],
): number | undefined {
  return useOracleLiveStore((s) => {
    let best: OracleSnapshot | undefined;
    for (const id of oracleIds) {
      if (!id) continue;
      const snap = s.byOracle[id];
      if (snap?.forward !== undefined && (!best || snap.ts > best.ts)) best = snap;
    }
    return best?.forward;
  });
}
