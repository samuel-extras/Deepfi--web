"use client";

/**
 * Vault strategy backtest — surfaces the /api/simulation results: three Predict
 * vault strategies replayed over real BTC 15m candles, with honest metrics and a
 * methodology disclosure. Satisfies the hackathon's "proper simulation result"
 * requirement for vault strategies.
 */
import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

interface Metrics {
  totalReturn: number; sharpe: number; maxDrawdown: number; winRate: number;
  numCycles: number; cagr: number; annualizedVol: number; endEquity: number; startEquity: number;
}
interface Result {
  name: string; blurb: string; metrics: Metrics; equity: { t: number; equity: number }[];
}
interface SimResponse {
  ok: boolean; source: string; candles: number; from: number; to: number;
  config: { spread: number; stakeFraction: number; volWindow: number };
  results: Result[];
}

const COLORS: Record<string, string> = {
  "Range Ladder": "#f59e0b",
  "PLP Supply": "#34d399",
  "PLP + Hedge": "#a78bfa",
};

const pct = (n: number, d = 1) => `${(n * 100).toFixed(d)}%`;
const day = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default function VaultSimulation() {
  const [data, setData] = useState<SimResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let off = false;
    fetch("/api/simulation")
      .then(r => r.json())
      .then((d: SimResponse) => { if (!off) (d.ok ? setData(d) : setErr("Simulation failed")); })
      .catch(() => { if (!off) setErr("Could not load simulation"); });
    return () => { off = true; };
  }, []);

  if (err) return <div className="rounded-lg border border-border bg-card p-4 text-sm text-amber-400">{err}</div>;
  if (!data) return <div className="h-64 animate-pulse rounded-lg border border-border bg-card/50" />;

  const hero = data.results.find(r => r.name === "PLP + Hedge") ?? data.results[0];

  // Merge the three downsampled curves by index (same candles → aligned).
  const len = Math.max(...data.results.map(r => r.equity.length));
  const chart = Array.from({ length: len }, (_, i) => {
    const row: Record<string, number> = { t: data.results[0].equity[i]?.t ?? 0 };
    for (const r of data.results) if (r.equity[i]) row[r.name] = Math.round(r.equity[i].equity);
    return row;
  });

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">Strategy Backtest</h2>
            <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-violet-300 ring-1 ring-violet-500/30">
              vault sim
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Three Predict vault strategies replayed over real BTC 15m candles.
          </p>
        </div>
        <div className="text-right text-[11px] text-muted-foreground">
          <div>{data.candles.toLocaleString()} candles · {day(data.from)} – {day(data.to)} 2026</div>
          <div className="text-muted-foreground/70">source: {data.source}</div>
        </div>
      </div>

      {/* hero metrics — the product (PLP + Hedge) */}
      <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: COLORS[hero.name] }} />
          <span className="text-sm font-semibold text-foreground">{hero.name}</span>
          <span className="text-xs text-muted-foreground">— {hero.blurb}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Sharpe (ann.)" value={hero.metrics.sharpe.toFixed(2)} good={hero.metrics.sharpe > 0} />
          <Metric label="Return (52d)" value={pct(hero.metrics.totalReturn)} good={hero.metrics.totalReturn > 0} />
          <Metric label="Max drawdown" value={pct(hero.metrics.maxDrawdown)} good={false} muted />
          <Metric label="Win rate" value={pct(hero.metrics.winRate, 0)} good={hero.metrics.winRate > 0.5} />
        </div>
      </div>

      {/* equity curves */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-2 text-xs font-medium text-muted-foreground">
          Equity curve · $10,000 start · fixed-notional (no compounding)
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chart} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" opacity={0.3} />
            <XAxis dataKey="t" tickFormatter={day} tick={{ fontSize: 10 }} stroke="currentColor" className="text-muted-foreground" minTickGap={40} />
            <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} stroke="currentColor" className="text-muted-foreground" width={42} />
            <Tooltip
              contentStyle={{ background: "#0a0a0a", border: "1px solid #262626", borderRadius: 8, fontSize: 12 }}
              labelFormatter={t => day(Number(t))}
              formatter={v => `$${Number(v).toLocaleString()}`}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {data.results.map(r => (
              <Line key={r.name} type="monotone" dataKey={r.name} stroke={COLORS[r.name]} dot={false} strokeWidth={1.75} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* comparison table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-2 font-medium">Strategy</th>
              <th className="px-3 py-2 text-right font-medium">Return</th>
              <th className="px-3 py-2 text-right font-medium">Sharpe</th>
              <th className="px-3 py-2 text-right font-medium">Max DD</th>
              <th className="px-3 py-2 text-right font-medium">Win</th>
            </tr>
          </thead>
          <tbody>
            {data.results.map(r => (
              <tr key={r.name} className="border-b border-border/50 last:border-0">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: COLORS[r.name] }} />
                    <div>
                      <div className="font-medium text-foreground">{r.name}</div>
                      <div className="text-[11px] text-muted-foreground">{r.blurb}</div>
                    </div>
                  </div>
                </td>
                <td className={`px-3 py-2.5 text-right font-mono ${r.metrics.totalReturn >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {pct(r.metrics.totalReturn)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-foreground">{r.metrics.sharpe.toFixed(2)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">{pct(r.metrics.maxDrawdown)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">{pct(r.metrics.winRate, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* methodology disclosure */}
      <details className="rounded-xl border border-border bg-card/50 p-4 text-xs text-muted-foreground">
        <summary className="cursor-pointer font-medium text-foreground">Methodology & assumptions</summary>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>Real BTC <span className="text-foreground">15-minute candles</span> ({data.candles.toLocaleString()}, ~52 days, {data.source}). Each candle is one expiry cycle.</li>
          <li>Ranges/binaries are priced <span className="text-foreground">empirically</span> off the trailing {data.config.volWindow}-candle (2-day) return distribution — this captures BTC&apos;s fat tails, so a strategy&apos;s edge reflects the vault spread rather than a Black-Scholes mispricing.</li>
          <li>Vault spread <span className="text-foreground">{pct(data.config.spread, 0)}</span> on fair value; positions settle against the actual next close.</li>
          <li><span className="text-foreground">Fixed-notional</span> sizing ({pct(data.config.stakeFraction, 0)} of capital/cycle), no compounding. Sharpe & vol annualized from daily returns.</li>
          <li>Idealized: no fees, slippage, or adverse selection, and the spread is captured cleanly — so figures are <span className="text-foreground">indicative, not live PnL</span>. This window was a BTC downtrend, which flatters the downside crash hedge.</li>
        </ul>
      </details>

      <p className="text-center text-[11px] text-muted-foreground">Not financial advice. Backtest on testnet-context data.</p>
    </div>
  );
}

function Metric({ label, value, good, muted }: { label: string; value: string; good: boolean; muted?: boolean }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${muted ? "text-foreground" : good ? "text-emerald-400" : "text-red-400"}`}>
        {value}
      </div>
    </div>
  );
}
