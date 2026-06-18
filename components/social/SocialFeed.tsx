"use client";

/**
 * Social — the live DeepBook Predict activity feed + top traders.
 *
 * Replaces the legacy DEX-backend social page. Everything here is real on-chain
 * data from the public Predict indexer: the feed is /api/feed (mints), the
 * trader board is /api/leaderboard (IV-Edge). No off-chain backend.
 */
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import PredictFeed from "@/components/prediction/PredictFeed";

interface LeaderRow {
  rank: number;
  owner: string;
  pnl: number;
  returnOnExposure: number;
}
interface LeaderResponse {
  ok: boolean;
  rows: LeaderRow[];
}

const addr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const medal: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function TopTraders() {
  const q = useQuery<LeaderResponse>({
    queryKey: ["predict", "leaderboard"],
    queryFn: () => fetch("/api/leaderboard").then((r) => r.json()),
    refetchInterval: 30_000,
  });
  const rows = (q.data?.rows ?? []).slice(0, 5);

  return (
    <div className="rounded-xl border border-border bg-card/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Top traders</h2>
        <Link href="/prediction/top-traders" className="text-xs text-emerald-400 hover:underline">
          Full board →
        </Link>
      </div>
      {q.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-9 animate-pulse rounded-md bg-muted/10" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No ranked traders yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.owner} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2">
                <span className="w-5 text-center">{medal[r.rank] ?? r.rank}</span>
                <a
                  href={`https://testnet.suivision.xyz/account/${r.owner}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-foreground hover:text-emerald-400"
                >
                  {addr(r.owner)}
                </a>
              </span>
              <span className="font-semibold text-emerald-400">
                {(r.returnOnExposure * 100).toFixed(0)}% ROE
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function SocialFeed() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold">Social</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every live DeepBook Predict trade, on-chain. Tap{" "}
          <span className="text-foreground font-medium">Mirror</span> on any trade to copy it into
          your own ticket. Structured trade data only Predict can expose, because every position is
          priced against the on-chain SVI surface.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
        <div>
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Live activity</h2>
          <div className="rounded-xl border border-border bg-card/40 p-2">
            <PredictFeed />
          </div>
        </div>
        <div className="space-y-4">
          <TopTraders />
          <div className="rounded-xl border border-border bg-card/50 p-4 text-xs text-muted-foreground">
            <p className="mb-1 text-sm font-medium text-foreground">Copy-trading</p>
            <p>
              Mirror pre-fills the Predict ticket with another trader&apos;s strike, range and size —
              you choose how much to put up before signing.
            </p>
          </div>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Live from predict-server · Not financial advice · Testnet only.
      </p>
    </div>
  );
}
