"use client";

/**
 * Live DeepBook Predict trade feed — shows on-chain mints from the indexer.
 *
 * This feeds /api/feed (aggregates ranges/minted + positions/minted from the
 * Predict indexer). Each trade card shows:
 *   - Trader address (Sui Explorer link)
 *   - Position type: Range or Binary, direction, strike/range
 *   - Size in dUSDC
 *   - Timestamp
 *   - "Mirror" button → pre-fills the mint form
 *
 * This is the hackathon's Social + Copy-Trade layer. On-chain Predict is the
 * only DeFi protocol on Sui with this kind of structured trade data.
 */
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { FeedTrade } from "@/lib/types";
import Link from "next/link";

interface FeedResponse {
  trades: FeedTrade[];
  live: boolean;
}

function relTime(ms: number): string {
  const d = Date.now() - ms;
  if (d < 60_000) return "just now";
  const m = Math.floor(d / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const usd = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

function addr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export default function PredictFeed({
  compact = false,
}: {
  compact?: boolean;
}) {
  const router = useRouter();
  const q = useQuery<FeedResponse>({
    queryKey: ["predict", "feed"],
    queryFn: () => fetch("/api/feed").then((r) => r.json()),
    refetchInterval: 15_000,
  });

  const trades = q.data?.trades ?? [];

  const mirror = (t: FeedTrade) => {
    const params = new URLSearchParams({
      oracle: t.range.expiryMinutes.toString(),
      low: t.range.strikeLow.toString(),
      high: t.range.strikeHigh.toString(),
      size: t.sizeDusdc.toString(),
    });
    router.push(`/prediction?${params.toString()}`);
  };

  if (q.isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-xl border border-border bg-muted/10"
          />
        ))}
      </div>
    );
  }

  if (!trades.length) {
    return (
      <div className="rounded-xl border border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
        No Predict trades yet. Mint a position to appear here.
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {!q.data?.live ? (
        <div className="mb-2 rounded-md bg-amber-500/10 px-3 py-1.5 text-xs text-amber-400">
          Indexer offline — showing cached data
        </div>
      ) : null}
      {(compact ? trades.slice(0, 8) : trades).map((t) => (
        <TradeCard key={t.id} trade={t} onMirror={mirror} />
      ))}
      {compact && trades.length > 8 ? (
        <Link
          href="/social"
          className="block pt-2 text-center text-xs text-emerald-400 hover:underline"
        >
          View all {trades.length} trades →
        </Link>
      ) : null}
    </div>
  );
}

function TradeCard({
  trade: t,
  onMirror,
}: {
  trade: FeedTrade;
  onMirror: (t: FeedTrade) => void;
}) {
  const isRange = t.range.strikeLow !== t.range.strikeHigh;
  const dir = t.direction === "up" ? "↑" : "↓";
  const label = isRange
    ? `${dir} ${usd(t.range.strikeLow)}–${usd(t.range.strikeHigh)}`
    : `${dir} ${usd(t.range.strikeLow)}`;

  return (
    <div className="border-b border-border py-3 hover:bg-muted/5 transition-colors px-1">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          {/* avatar placeholder */}
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600/20 text-xs font-bold text-emerald-400">
            {t.sender.slice(2, 4).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs">
              <a
                href={`https://testnet.suivision.xyz/account/${t.sender}`}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-foreground hover:text-emerald-400 font-mono transition-colors"
              >
                {addr(t.sender)}
              </a>
              <span className="text-muted-foreground">minted</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">
                {relTime(t.timestamp)}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${t.direction === "up" ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"}`}
              >
                {label}
              </span>
              <span className="text-xs text-muted-foreground">
                {t.range.expiryMinutes}m · {t.sizeDusdc.toFixed(2)} dUSDC
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={() => onMirror(t)}
          className="shrink-0 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:border-emerald-600/50 hover:text-emerald-400 transition-colors"
        >
          Mirror
        </button>
      </div>
    </div>
  );
}
