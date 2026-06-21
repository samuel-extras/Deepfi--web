/**
 * GET /api/oracles/live — Server-Sent Events stream of live Predict oracle
 * events (OraclePricesUpdated / OracleSVIUpdated / OracleSettled / OracleActivated),
 * relayed from a single shared fullnode poll. Lower latency than the REST indexer.
 *
 * Each message: `data: <OracleLiveEvent json>\n\n`. Heartbeat comments keep the
 * connection warm. Use the REST indexer for history.
 */
import { subscribeOracleEvents } from "@/lib/predict/liveEvents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Requires a persistent Node server (the relay is a process singleton). On
// serverless the poll isn't shared across instances — the app still works, it
// just degrades to the indexer, since the live stream is purely additive.
const MAX_STREAM_MS = 10 * 60_000; // recycle connections ~every 10 min

export async function GET(req: Request) {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let lifetime: ReturnType<typeof setTimeout> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          /* controller already closed */
        }
      };
      const cleanup = () => {
        if (heartbeat) clearInterval(heartbeat);
        if (lifetime) clearTimeout(lifetime);
        unsubscribe?.();
        unsubscribe = null;
      };
      const end = () => {
        cleanup();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      send(`: connected\n\n`);
      unsubscribe = subscribeOracleEvents((e) =>
        send(`data: ${JSON.stringify(e)}\n\n`),
      );
      heartbeat = setInterval(() => send(`: ping\n\n`), 20_000);
      // Recycle long-lived connections; EventSource auto-reconnects. Bounds
      // per-connection resource use and survives proxies that drop idle sockets.
      lifetime = setTimeout(end, MAX_STREAM_MS);

      req.signal.addEventListener("abort", end); // client disconnected
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      if (lifetime) clearTimeout(lifetime);
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
