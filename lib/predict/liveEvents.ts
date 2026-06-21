/**
 * Live oracle event relay (server-only singleton).
 *
 * Public testnet fullnodes disable `subscribeEvent`, so for low-latency oracle
 * state we POLL the fullnode's `queryEvents` (the source of truth — fresher than
 * the indexed predict-server) ~every 1.5s, filtered to events DEFINED in the
 * Predict `oracle` module, and fan them out to SSE clients (one poll, N clients).
 *
 * Watches: OraclePricesUpdated · OracleSVIUpdated · OracleSettled · OracleActivated.
 * Use the REST indexer for history; this for freshness.
 */
import { EventEmitter } from "node:events";
import { getSuiClient } from "@/lib/sui/client";
import { PACKAGES } from "@/lib/deepbook";

export type OracleEventType =
  | "OraclePricesUpdated"
  | "OracleSVIUpdated"
  | "OracleSettled"
  | "OracleActivated";

export interface OracleLiveEvent {
  type: OracleEventType;
  oracleId: string | null;
  parsedJson: unknown;
  txDigest: string;
  eventSeq: string;
  timestampMs: number | null;
}

const MODULE = "oracle";
const POLL_MS = 1500;
const PAGE = 50;
const MAX_PAGES = 6; // catch up to ~300 events/tick before dropping (burst guard)
const MAX_BACKOFF_MS = 30_000; // cap between polls when the fullnode errors / throttles
const WANTED = new Set<OracleEventType>([
  "OraclePricesUpdated",
  "OracleSVIUpdated",
  "OracleSettled",
  "OracleActivated",
]);

// Singleton across HMR reloads / route invocations in the same Node process.
interface LiveState {
  emitter: EventEmitter;
  subscribers: number;
  timer: ReturnType<typeof setTimeout> | null;
  lastKey: string | null; // `${txDigest}:${eventSeq}` of the newest emitted event
  primed: boolean;
  errStreak: number;
}
const g = globalThis as unknown as { __oracleLive?: LiveState };
const state: LiveState = (g.__oracleLive ??= {
  emitter: new EventEmitter(),
  subscribers: 0,
  timer: null,
  lastKey: null,
  primed: false,
  errStreak: 0,
});
state.emitter.setMaxListeners(0);

function shortType(typeTag: string): OracleEventType | null {
  const name = typeTag.split("::").pop() ?? "";
  return WANTED.has(name as OracleEventType) ? (name as OracleEventType) : null;
}

function oracleIdOf(parsedJson: unknown): string | null {
  if (!parsedJson || typeof parsedJson !== "object") return null;
  const o = parsedJson as Record<string, unknown>;
  const id = o.oracle_id ?? o.oracleId ?? o.id;
  if (typeof id === "string") return id;
  if (id && typeof id === "object" && typeof (id as { id?: unknown }).id === "string")
    return (id as { id: string }).id;
  return null;
}

async function poll(): Promise<boolean> {
  try {
    const query = {
      MoveEventModule: { package: PACKAGES.predict, module: MODULE },
    };
    let res = await getSuiClient().queryEvents({
      query,
      order: "descending",
      limit: PAGE,
    });
    let data = res.data ?? [];
    if (!data.length) return true;

    const newestKey = `${data[0].id.txDigest}:${data[0].id.eventSeq}`;

    if (!state.primed) {
      // First poll: record the cursor, don't replay history.
      state.lastKey = newestKey;
      state.primed = true;
      return true;
    }

    // Page back (newest → older) until we reach the last event we emitted, so a
    // burst of >PAGE events between ticks (e.g. a settle amid many price ticks)
    // isn't dropped. Bounded by MAX_PAGES.
    const fresh: typeof data = [];
    let pages = 0;
    let reached = false;
    while (true) {
      for (const ev of data) {
        if (`${ev.id.txDigest}:${ev.id.eventSeq}` === state.lastKey) {
          reached = true;
          break;
        }
        fresh.push(ev);
      }
      if (reached || !res.hasNextPage || !res.nextCursor || ++pages >= MAX_PAGES)
        break;
      res = await getSuiClient().queryEvents({
        query,
        order: "descending",
        cursor: res.nextCursor,
        limit: PAGE,
      });
      data = res.data ?? [];
      if (!data.length) break;
    }
    if (!fresh.length) return true;
    state.lastKey = newestKey;

    // Emit oldest-first so consumers see chronological order.
    for (const ev of fresh.reverse()) {
      const type = shortType(ev.type);
      if (!type) continue;
      const out: OracleLiveEvent = {
        type,
        oracleId: oracleIdOf(ev.parsedJson),
        parsedJson: ev.parsedJson,
        txDigest: ev.id.txDigest,
        eventSeq: ev.id.eventSeq,
        timestampMs: ev.timestampMs ? Number(ev.timestampMs) : null,
      };
      state.emitter.emit("event", out);
    }
    return true;
  } catch {
    // RPC error / rate-limit. lastKey is unchanged on failure, so the next
    // successful poll re-reads these events (no loss). The scheduler backs off.
    return false;
  }
}

async function tick(): Promise<void> {
  if (state.subscribers <= 0) {
    state.timer = null; // nobody listening — stop the loop
    return;
  }
  const ok = await poll();
  let delay = POLL_MS;
  if (ok) {
    state.errStreak = 0;
  } else {
    // Exponential backoff so we don't hammer a throttling / down fullnode.
    state.errStreak = Math.min(state.errStreak + 1, 8);
    delay = Math.min(POLL_MS * 2 ** state.errStreak, MAX_BACKOFF_MS);
  }
  state.timer = setTimeout(() => void tick(), delay);
}

function ensurePoller(): void {
  if (state.timer) return;
  state.primed = false;
  state.lastKey = null;
  state.errStreak = 0;
  void tick();
}

/** Subscribe to live oracle events; returns an unsubscribe fn. Starts/stops the shared poller. */
export function subscribeOracleEvents(
  onEvent: (e: OracleLiveEvent) => void,
): () => void {
  state.subscribers++;
  ensurePoller();
  state.emitter.on("event", onEvent);
  return () => {
    state.emitter.off("event", onEvent);
    state.subscribers = Math.max(0, state.subscribers - 1);
    if (state.subscribers === 0 && state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
  };
}
