"use client";

/**
 * DeepBook Predict — IV-Edge Leaderboard.
 *
 * Ranks traders by return-on-exposure, with IV-edge Sharpe as the headline
 * hackathon metric (only possible because Predict has on-chain SVI).
 *
 * Data from /api/leaderboard (server-aggregated PredictManager summaries).
 */
import { useQuery } from "@tanstack/react-query";

interface LeaderboardRow {
  rank: number;
  owner: string;
  pnl: number;
  accountValue: number;
  positions: number;
  entrySize: number;
  returnOnExposure: number;
  ivEdge: number | null;
  tradeCount: number;
}

interface LeaderboardResponse {
  ok: boolean;
  rows: LeaderboardRow[];
  total: number;
  error?: string;
}

const fmt$ = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

const fmtPnl = (n: number) => {
  const s = fmt$(n);
  return n >= 0 ? `+${s}` : s;
};

const addr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

const ROE_MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export default function PredictLeaderboard() {
  const q = useQuery<LeaderboardResponse>({
    queryKey: ["predict", "leaderboard"],
    queryFn: () => fetch("/api/leaderboard").then(r => r.json()),
    refetchInterval: 30_000,
  });

  const rows = q.data?.rows ?? [];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold">Top Traders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ranked by IV-Edge — vol-adjusted return on the premium put at risk
          (PnL ÷ entry premium ÷ ATM IV). Only possible because{" "}
          <span className="text-foreground font-medium">DeepBook Predict has on-chain SVI</span>{" "}
          — the same volatility surface that prices every trade.
        </p>
      </div>

      {/* explanation card */}
      <div className="mb-6 rounded-lg border border-emerald-600/30 bg-emerald-600/5 p-4 text-sm">
        <p className="font-medium text-emerald-400">What is IV-Edge?</p>
        <p className="mt-1 text-muted-foreground text-xs">
          IV-Edge = (net PnL ÷ total entry premium) ÷ ATM implied vol. A positive IV-edge means you
          bought options cheaper than the SVI fair price. Only Predict can compute this on-chain
          because every trade is priced against the live SVI surface. Higher is better.
        </p>
      </div>

      {/* table */}
      {q.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg border border-border bg-muted/10" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {q.data?.ok === false ? `Error: ${q.data.error}` : "No traders indexed yet. Mint a position to appear here!"}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/5 text-left text-xs text-muted-foreground">
                <th className="w-12 px-4 py-3 text-center">#</th>
                <th className="px-4 py-3">Trader</th>
                <th className="px-4 py-3 text-right">PnL</th>
                <th className="px-4 py-3 text-right hidden sm:table-cell">Account value</th>
                <th className="px-4 py-3 text-right hidden md:table-cell">Trades</th>
                <th className="px-4 py-3 text-right">ROE</th>
                <th className="px-4 py-3 text-right hidden lg:table-cell">
                  IV-Edge
                  <span className="ml-1 text-[10px] opacity-60" title="(PnL ÷ entry premium) ÷ ATM IV — vol-adjusted return">ⓘ</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(r => (
                <tr key={r.owner} className="hover:bg-muted/5 transition-colors">
                  <td className="px-4 py-3 text-center text-base">
                    {ROE_MEDAL[r.rank] ?? <span className="text-muted-foreground text-xs">{r.rank}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={`https://testnet.suivision.xyz/account/${r.owner}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-xs text-foreground hover:text-emerald-400 transition-colors"
                    >
                      {addr(r.owner)}
                    </a>
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${r.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {fmtPnl(r.pnl)}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground hidden sm:table-cell">
                    {fmt$(r.accountValue)}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground hidden md:table-cell">
                    {r.tradeCount}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-semibold ${r.returnOnExposure >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {(r.returnOnExposure * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right hidden lg:table-cell">
                    {r.ivEdge != null ? (
                      <span className={`font-semibold ${r.ivEdge >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {r.ivEdge.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {q.data?.total != null && q.data.total > rows.length ? (
            <div className="border-t border-border px-4 py-2 text-center text-xs text-muted-foreground">
              Showing top {rows.length} of {q.data.total} traders
            </div>
          ) : null}
        </div>
      )}

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Rankings update every 30 s. Not financial advice. Testnet only.
      </p>
    </div>
  );
}
