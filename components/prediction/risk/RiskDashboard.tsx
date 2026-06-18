"use client";

/**
 * PLP Risk Dashboard (#10) — "is PLP safe?".
 *
 * Authoritative health metrics (TVL, share price, utilization, withdrawal
 * limiter) from the vault summary; an interactive ±σ stress simulator that
 * shocks BTC and shows the vault's settlement payout liability; per-oracle
 * exposure; and a share-price drawdown replay. Data from /api/vault/risk.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  stressCurve,
  shockGrid,
  drawdownSeries,
  type OpenPos,
} from "@/lib/risk/scenario";

type Exposure = {
  oracleId: string;
  asset: string;
  minutesToExpiry: number;
  openContracts: number;
  premium: number;
  positions: number;
};
type RiskResp = {
  ok: boolean;
  asOf: number;
  spot: number;
  sigma1Pct: number;
  premium: number;
  summary: {
    tvl: number;
    vaultBalance: number;
    sharePrice: number;
    utilization: number;
    maxPayoutUtilization: number;
    availableWithdrawal: number;
    availableLiquidity: number;
    totalMaxPayout: number;
    totalMtm: number;
    plpTotalSupply: number;
  };
  exposure: Exposure[];
  openPositions: OpenPos[];
  points: { t: number; sharePrice: number; vaultValue: number | null }[];
};

const usd = (n: number, max = 0) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: max,
  });
const compact = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}k` : usd(n, 0);

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-foreground">
        {value}
      </div>
      {sub ? <div className="text-[10px] text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

export default function RiskDashboard() {
  const q = useQuery({
    queryKey: ["predict", "vault-risk"],
    queryFn: () => fetch("/api/vault/risk").then((r) => r.json() as Promise<RiskResp>),
    refetchInterval: 15_000,
  });
  const [shock, setShock] = useState(0);

  const data = q.data;

  // APY annualized from the share-price history.
  const apy = useMemo(() => {
    const pts = data?.points ?? [];
    if (pts.length < 2) return null;
    const first = pts[0];
    const last = pts[pts.length - 1];
    const years = (last.t - first.t) / (365 * 24 * 60 * 60 * 1000);
    if (years <= 0 || first.sharePrice <= 0) return null;
    return Math.pow(last.sharePrice / first.sharePrice, 1 / years) - 1;
  }, [data]);

  const maxPct = useMemo(
    () => Math.min(20, Math.max(12, (data?.sigma1Pct ?? 5) * 2)),
    [data],
  );
  const curve = useMemo(() => {
    if (!data) return [];
    return stressCurve(
      data.openPositions,
      data.spot,
      data.summary.totalMaxPayout,
      data.premium,
      shockGrid(maxPct, 61),
    );
  }, [data, maxPct]);
  const atShock = useMemo(() => {
    if (!data) return null;
    return stressCurve(
      data.openPositions,
      data.spot,
      data.summary.totalMaxPayout,
      data.premium,
      [shock],
    )[0];
  }, [data, shock]);

  const drawdown = useMemo(() => {
    const pts = data?.points ?? [];
    const dd = drawdownSeries(pts.map((p) => ({ t: p.t, sharePrice: p.sharePrice })));
    return dd;
  }, [data]);
  const maxDrawdown = useMemo(
    () => drawdown.reduce((m, p) => Math.min(m, p.drawdownPct), 0),
    [drawdown],
  );

  if (q.isLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-6">
        <Skeleton className="h-9 w-64" />
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
          <Skeleton className="h-[460px] rounded-xl" />
          <Skeleton className="h-[460px] rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data?.ok) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-6">
        <Empty className="py-16">
          <EmptyHeader>
            <EmptyTitle>Risk data unavailable</EmptyTitle>
            <EmptyDescription>
              Couldn&apos;t reach the predict indexer for the vault risk snapshot.
              It refreshes automatically — try again shortly.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const s = data.summary;
  const util = s.utilization * 100;
  const maxPayoutUtil = s.maxPayoutUtilization * 100;
  const lockedPct =
    s.tvl > 0 ? Math.max(0, ((s.tvl - s.availableWithdrawal) / s.tvl) * 100) : 0;
  const healthy = util < 20 && maxPayoutUtil < 50;
  const sigma = data.sigma1Pct;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      {/* header */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">PLP Risk Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Is PLP safe? Live vault health, per-oracle exposure, and a ±σ BTC
            stress test against the vault&apos;s payout liability.
          </p>
        </div>
        <Badge variant={healthy ? "success" : "destructive"}>
          {healthy ? "Healthy ✓" : "Elevated risk"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* ── left: stress test + exposure ── */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">±σ Stress test</CardTitle>
              <CardDescription className="text-xs">
                Vault settlement payout if BTC (spot {usd(data.spot)}) moves now,
                against the vault&apos;s {compact(s.tvl)} TVL. 1σ ≈ {sigma.toFixed(1)}%.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[230px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={curve} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                    <defs>
                      <linearGradient id="payoutFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#ffffff0d" vertical={false} />
                    <XAxis
                      dataKey="shockPct"
                      tickFormatter={(v) => `${v > 0 ? "+" : ""}${Math.round(v)}%`}
                      stroke="#6B7280"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tickFormatter={(v) => compact(v)}
                      stroke="#6B7280"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      width={48}
                    />
                    <Tooltip
                      cursor={{ stroke: "#ffffff30" }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const p = payload[0].payload as (typeof curve)[number];
                        return (
                          <div className="rounded-lg border border-white/10 bg-[#1E2024]/95 px-3 py-2 text-xs shadow-xl">
                            <div className="text-muted-foreground">
                              BTC {p.shockPct > 0 ? "+" : ""}
                              {p.shockPct.toFixed(1)}% → {usd(p.settle)}
                            </div>
                            <div className="mt-0.5 font-semibold text-red-400">
                              Payout {usd(p.payout, 2)} ({(p.triggeredFrac * 100).toFixed(0)}% of max)
                            </div>
                            <div className="text-muted-foreground">
                              {((p.payout / s.tvl) * 100).toFixed(3)}% of TVL
                            </div>
                          </div>
                        );
                      }}
                    />
                    <ReferenceLine x={0} stroke="#6B7280" strokeDasharray="3 3" />
                    {sigma <= maxPct ? (
                      <>
                        <ReferenceLine x={-sigma} stroke="#f59e0b" strokeOpacity={0.5} strokeDasharray="2 3" label={{ value: "−1σ", fontSize: 9, fill: "#f59e0b", position: "insideTopLeft" }} />
                        <ReferenceLine x={sigma} stroke="#f59e0b" strokeOpacity={0.5} strokeDasharray="2 3" label={{ value: "+1σ", fontSize: 9, fill: "#f59e0b", position: "insideTopRight" }} />
                      </>
                    ) : null}
                    <Area type="monotone" dataKey="payout" stroke="#ef4444" strokeWidth={1.8} fill="url(#payoutFill)" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* shock slider + readout */}
              <div className="mt-3 flex items-center gap-3">
                <span className="text-xs text-muted-foreground">Shock</span>
                <Slider
                  value={[shock]}
                  onValueChange={([v]) => setShock(v)}
                  min={-maxPct}
                  max={maxPct}
                  step={0.5}
                  className="flex-1"
                />
                <span className="w-14 text-right font-mono text-xs tabular-nums text-foreground">
                  {shock > 0 ? "+" : ""}
                  {shock.toFixed(1)}%
                </span>
              </div>
              {atShock ? (
                <div className="mt-3 grid grid-cols-3 gap-3 rounded-lg bg-white/[0.03] p-3 text-center">
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Settles</div>
                    <div className="font-mono text-sm font-semibold text-foreground">{usd(atShock.settle)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Payout</div>
                    <div className="font-mono text-sm font-semibold text-red-400">{usd(atShock.payout, 2)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">% of TVL</div>
                    <div className="font-mono text-sm font-semibold text-foreground">
                      {((atShock.payout / s.tvl) * 100).toFixed(3)}%
                    </div>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Per-oracle exposure</CardTitle>
              <CardDescription className="text-xs">
                The vault is the short side of every open position (recent book).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.exposure.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No open positions on active oracles right now.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <span>Expiry</span>
                    <span className="text-right">Positions</span>
                    <span className="text-right">Premium</span>
                  </div>
                  {data.exposure.map((e) => {
                    const maxPrem = Math.max(...data.exposure.map((x) => x.premium), 1e-9);
                    return (
                      <div key={e.oracleId} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-1">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 rounded-full bg-white/[0.06]">
                            <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.round((e.premium / maxPrem) * 100)}%` }} />
                          </div>
                          <span className="font-mono text-xs text-foreground">{e.minutesToExpiry}m</span>
                        </div>
                        <span className="text-right font-mono text-xs tabular-nums text-muted-foreground">{e.positions}</span>
                        <span className="w-16 text-right font-mono text-xs tabular-nums text-foreground">{usd(e.premium, 2)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── right: health + limiter + drawdown ── */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Vault health</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <Stat label="TVL" value={compact(s.tvl)} />
                <Stat label="PLP share" value={`$${s.sharePrice.toFixed(4)}`} sub={apy != null ? `${(apy * 100).toFixed(1)}% APY` : undefined} />
                <Stat label="Utilization" value={`${util.toFixed(2)}%`} />
                <Stat label="Max-payout util" value={`${maxPayoutUtil.toFixed(2)}%`} sub={`max payout ${usd(s.totalMaxPayout, 0)}`} />
              </div>
              {/* utilization gauge */}
              <div>
                <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
                  <span>Capital deployed</span>
                  <span>{util.toFixed(2)}% of TVL</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(util, 0.5))}%` }} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Withdrawal limiter</CardTitle>
              <CardDescription className="text-xs">
                How much PLP can exit right now (token-bucket).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-muted-foreground">Withdrawable now</span>
                <span className="font-mono text-foreground">{compact(s.availableWithdrawal)}</span>
              </div>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-red-500/30">
                <div className="h-full bg-primary" style={{ width: `${Math.min(100, 100 - lockedPct)}%` }} />
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
                <span>{(100 - lockedPct).toFixed(1)}% free</span>
                <span>{lockedPct.toFixed(1)}% locked in open risk</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">PLP share price &amp; drawdown</CardTitle>
              <CardDescription className="text-xs">
                Max drawdown {maxDrawdown.toFixed(2)}% over {drawdown.length} snapshots.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[150px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={drawdown} margin={{ top: 6, right: 8, bottom: 0, left: -12 }}>
                    <YAxis hide domain={["dataMin", "dataMax"]} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const p = payload[0].payload as (typeof drawdown)[number];
                        return (
                          <div className="rounded-lg border border-white/10 bg-[#1E2024]/95 px-2 py-1 text-xs shadow-xl">
                            <div className="font-mono text-foreground">${p.sharePrice.toFixed(5)}</div>
                            <div className="text-red-400">{p.drawdownPct.toFixed(2)}% DD</div>
                          </div>
                        );
                      }}
                    />
                    <Line type="monotone" dataKey="sharePrice" stroke="#02DA8B" strokeWidth={1.6} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <p className="mt-6 text-center text-[11px] text-muted-foreground">
        Headline metrics from the on-chain vault summary · exposure &amp; stress from the recent open book · indicative, not advice · testnet
      </p>
    </div>
  );
}
