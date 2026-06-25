"use client";

/**
 * Predict activity tape — the live on-chain mint feed rendered like the spot/
 * margin "Trades" tab: a dense 3-column tape (Position · Size · Time) instead of
 * social cards, so it fits the pro terminal's narrow book column. Direction
 * colours the position the way trade side colours price on the Trades tape.
 *
 * Shares the ["predict","feed"] query key with PredictFeed, so both dedupe to a
 * single poll.
 */
import { useQuery } from "@tanstack/react-query";
import type { FeedTrade } from "@/lib/types";
import { cn } from "@/lib/utils";
import { compactUsd } from "./types";

interface FeedResponse {
  trades: FeedTrade[];
  live: boolean;
}

const hms = (ms: number) =>
  new Date(ms).toLocaleTimeString("en-US", { hour12: false });

export default function PredictActivityTape() {
  const q = useQuery<FeedResponse>({
    queryKey: ["predict", "feed"],
    queryFn: () => fetch("/api/feed").then((r) => r.json()),
    refetchInterval: 15_000,
  });
  const rows = q.data?.trades ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-1.5 text-[11px] text-nav-inactive">
        <span>Position</span>
        <span className="text-right">Size (dUSDC)</span>
        <span className="text-right">Time</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-1">
        {q.isLoading ? (
          <div className="p-4 text-xs text-nav-inactive">Loading activity…</div>
        ) : rows.length === 0 ? (
          <div className="p-4 text-xs text-nav-inactive">
            No Predict trades yet.
          </div>
        ) : (
          rows.map((t) => {
            const isRange = t.range.strikeLow !== t.range.strikeHigh;
            const up = t.direction === "up";
            const arrow = up ? "↑" : "↓";
            const label = isRange
              ? `${arrow} ${compactUsd(t.range.strikeLow)}–${compactUsd(
                  t.range.strikeHigh,
                )}`
              : `${arrow} ${compactUsd(t.range.strikeLow)}`;
            return (
              <div
                key={t.id}
                className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-[3px] text-xs hover:bg-[#1A1D1F]"
              >
                <span
                  className={cn(
                    "truncate font-mono tabular-nums",
                    up ? "text-primary" : "text-[#FF4D4F]",
                  )}
                  title={t.sender}
                >
                  {label}
                </span>
                <span className="text-right tabular-nums text-white">
                  {t.sizeDusdc.toFixed(2)}
                </span>
                <span className="text-right tabular-nums text-nav-inactive">
                  {hms(t.timestamp)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
