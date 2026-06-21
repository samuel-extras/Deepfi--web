"use client";

/** Small indicator that the live oracle event stream is connected + flowing. */
import { useOracleLiveStore } from "@/stores/useOracleLiveStore";
import { cn } from "@/lib/utils";

export function OracleLiveBadge({ className }: { className?: string }) {
  const connected = useOracleLiveStore((s) => s.connected);
  const count = useOracleLiveStore((s) => s.eventCount);

  return (
    <span
      title="Live on-chain oracle events (Sui fullnode) — fresher than the indexer"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold",
        connected
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
          : "border-white/10 bg-white/5 text-muted-foreground",
        className,
      )}
    >
      <span
        className={cn(
          "inline-block size-1.5 rounded-full",
          connected ? "animate-pulse bg-emerald-400" : "bg-muted-foreground",
        )}
      />
      {connected ? "Live" : "Connecting…"}
      {connected && count > 0 ? (
        <span className="opacity-60 tabular-nums">· {count}</span>
      ) : null}
    </span>
  );
}
