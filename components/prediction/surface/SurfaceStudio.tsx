"use client";

/**
 * Predict Surface Studio (#9) — the live SVI volatility surface.
 *
 * Renders the on-chain vol surface as per-expiry IV smiles (strike × expiry → IV)
 * via a shadcn/recharts line chart, with a heatmap alternative, a time-travel
 * slider that replays past surface states, and a no-arbitrage checker (butterfly
 * via Gatheral g(k); calendar via total-variance monotonicity). Data + checks
 * come from /api/surface[?at=].
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

type Expiry = {
  oracleId: string;
  asset: string;
  expiry: number;
  minutesToExpiry: number;
  forward: number;
  atmIv: number;
  iv: number[];
  butterflyKs: number[];
};
type SurfaceResp = {
  ok: boolean;
  asOf: number;
  at: number | null;
  mode: "live" | "historical";
  range: { earliest: number; latest: number };
  moneyness: number[];
  expiries: Expiry[];
  arb: {
    butterflyExpiries: number[];
    calendarBreaches: number;
    calendarPairs: string[];
  };
};

const pct = (n: number) => `${n.toFixed(1)}%`;

/** teal → amber → red ramp for IV level (t in 0..1). */
function ivColor(t: number): string {
  const stops = [
    [2, 218, 139],
    [245, 158, 11],
    [239, 68, 68],
  ];
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  const a = stops[i];
  const b = stops[Math.min(i + 1, stops.length - 1)];
  const c = a.map((v, k) => Math.round(v + (b[k] - v) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export default function SurfaceStudio() {
  const [view, setView] = useState<"surface" | "heatmap">("surface");
  // time-travel: `at` is the committed timestamp the query fetches (null = live);
  // `scrub` is the slider's live position (for the label while dragging).
  const [at, setAt] = useState<number | null>(null);
  const [scrub, setScrub] = useState<number | null>(null);

  const q = useQuery({
    queryKey: ["predict", "surface", at],
    queryFn: () =>
      fetch(`/api/surface${at != null ? `?at=${at}` : ""}`).then(
        (r) => r.json() as Promise<SurfaceResp>,
      ),
    refetchInterval: at == null ? 10_000 : false,
  });

  const data = q.data;
  const expiries = useMemo(() => data?.expiries ?? [], [data]);
  const moneyness = data?.moneyness ?? [];
  const range = data?.range ?? {
    earliest: (data?.asOf ?? 0) - 3_600_000,
    latest: data?.asOf ?? 0,
  };

  const { ivMin, ivMax } = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const e of expiries)
      for (const v of e.iv) {
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    if (!Number.isFinite(lo)) return { ivMin: 0, ivMax: 1 };
    return { ivMin: lo, ivMax: hi };
  }, [expiries]);
  const ivRange = Math.max(1e-6, ivMax - ivMin);
  const norm = (v: number) => (v - ivMin) / ivRange;

  if (q.isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="mt-4 h-[520px] w-full rounded-xl" />
      </div>
    );
  }

  if (!data?.ok) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        <Empty className="py-16">
          <EmptyHeader>
            <EmptyTitle>Surface unavailable</EmptyTitle>
            <EmptyDescription>
              Couldn&apos;t reach the predict indexer to build the surface. It
              refreshes automatically — try again in a moment.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const M = moneyness.length;
  const E = expiries.length;
  const hasData = E > 0 && M > 0;
  const arbFree =
    data.arb.butterflyExpiries.length === 0 && data.arb.calendarBreaches === 0;

  const isLive =
    at == null && (scrub == null || scrub >= range.latest - 30_000);
  const displayTs = scrub ?? at ?? range.latest;
  const agoMin = Math.max(0, Math.round((range.latest - displayTs) / 60_000));

  // ── smile chart: one line per expiry, IV (y) by moneyness (x) ─────────────
  const chartData = moneyness.map((m, i) => {
    const row: Record<string, number> = { m };
    expiries.forEach((e, j) => {
      row[`e${j}`] = e.iv[i];
    });
    return row;
  });
  const chartConfig: ChartConfig = Object.fromEntries(
    expiries.map((e, j) => [
      `e${j}`,
      { label: `${e.minutesToExpiry}m`, color: ivColor(norm(e.atmIv)) },
    ]),
  );

  return (
    <div className="mx-auto w-full max-w-350 px-4 xl:px-16 py-6">
      {/* header */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Vol Surface Studio
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The live on-chain SVI surface — IV by strike × expiry across {E}{" "}
            active {expiries[0]?.asset ?? "BTC"} market{E === 1 ? "" : "s"}.
          </p>
        </div>
        <Badge variant={arbFree ? "success" : "destructive"}>
          {arbFree ? "Arbitrage-free ✓" : "Arb violations"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* ── surface / heatmap ── */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
              <TabsList>
                <TabsTrigger value="surface">Smiles</TabsTrigger>
                <TabsTrigger value="heatmap">Heatmap</TabsTrigger>
              </TabsList>
            </Tabs>
            {/* time-travel — beside the tabs to save vertical space */}
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setAt(null);
                  setScrub(null);
                }}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold transition-colors",
                  isLive
                    ? "bg-primary/15 text-primary"
                    : "bg-white/6 text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "inline-block size-1.5 rounded-full",
                    isLive ? "animate-pulse bg-primary" : "bg-muted-foreground",
                  )}
                />
                Live
              </button>
              <Slider
                value={[
                  Math.min(range.latest, Math.max(range.earliest, displayTs)),
                ]}
                onValueChange={([v]) => setScrub(v)}
                onValueCommit={([v]) =>
                  setAt(v >= range.latest - 30_000 ? null : v)
                }
                min={range.earliest}
                max={range.latest}
                step={60_000}
                className="flex-1"
              />
              <span className="w-16 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
                {isLive ? "now" : `−${agoMin}m`}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {!hasData ? (
              <div className="flex h-[360px] items-center justify-center text-center text-sm text-muted-foreground">
                No surface at this timestamp — scrub back toward Live.
              </div>
            ) : view === "surface" ? (
              <ChartContainer
                config={chartConfig}
                className="aspect-auto h-[420px] w-full"
              >
                <AreaChart
                  data={chartData}
                  margin={{ top: 8, right: 16, bottom: 4, left: 4 }}
                >
                  <CartesianGrid vertical={false} stroke="#ffffff10" />
                  <XAxis
                    dataKey="m"
                    type="number"
                    domain={[-6, 6]}
                    ticks={[-6, -3, 0, 3, 6]}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(v) =>
                      v === 0 ? "ATM" : `${v > 0 ? "+" : ""}${v}%`
                    }
                  />
                  <YAxis
                    width={44}
                    tickLine={false}
                    axisLine={false}
                    domain={["auto", "auto"]}
                    tickFormatter={(v: number) => `${Math.round(v)}%`}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(_, p) => {
                          const m = Number(p?.[0]?.payload?.m ?? 0);
                          return m === 0
                            ? "ATM"
                            : `${m > 0 ? "+" : ""}${m}% moneyness`;
                        }}
                      />
                    }
                  />
                  {expiries.map((e, j) => (
                    <Area
                      key={e.oracleId}
                      dataKey={`e${j}`}
                      type="monotone"
                      stroke={`var(--color-e${j})`}
                      strokeWidth={1.8}
                      fill={`var(--color-e${j})`}
                      fillOpacity={0.12}
                      dot={false}
                      activeDot={{ r: 3 }}
                      isAnimationActive={false}
                    />
                  ))}
                </AreaChart>
              </ChartContainer>
            ) : (
              // ── heatmap ──
              <svg viewBox="0 0 820 420" className="w-full">
                {(() => {
                  const ml = 56,
                    mt = 18,
                    mr = 16,
                    mb = 52;
                  const gw = 820 - ml - mr;
                  const gh = 420 - mt - mb;
                  const cw = gw / M;
                  const ch = gh / E;
                  return (
                    <>
                      {expiries.map((e, j) =>
                        e.iv.map((v, i) => (
                          <rect
                            key={`${j}-${i}`}
                            x={ml + i * cw}
                            y={mt + j * ch}
                            width={cw + 0.5}
                            height={ch + 0.5}
                            fill={ivColor(norm(v))}
                          >
                            <title>{`${e.minutesToExpiry}m · ${moneyness[i] > 0 ? "+" : ""}${moneyness[i]}% · IV ${pct(v)}`}</title>
                          </rect>
                        )),
                      )}
                      {expiries.map((e, j) => (
                        <text
                          key={e.oracleId}
                          x={ml - 8}
                          y={mt + j * ch + ch / 2 + 3}
                          textAnchor="end"
                          fontSize={9}
                          fill="#9CA3AF"
                        >
                          {e.minutesToExpiry}m
                        </text>
                      ))}
                      {[0, Math.floor((M - 1) / 2), M - 1].map((i) => (
                        <text
                          key={i}
                          x={ml + i * cw + cw / 2}
                          y={420 - mb + 18}
                          textAnchor="middle"
                          fontSize={10}
                          fill="#6B7280"
                        >
                          {i === Math.floor((M - 1) / 2)
                            ? "ATM"
                            : `${moneyness[i] > 0 ? "+" : ""}${moneyness[i]}%`}
                        </text>
                      ))}
                      <text
                        x={ml + gw / 2}
                        y={414}
                        textAnchor="middle"
                        fontSize={10}
                        fill="#6B7280"
                      >
                        moneyness
                      </text>
                    </>
                  );
                })()}
              </svg>
            )}

            {/* IV color legend */}
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">
                {pct(ivMin)}
              </span>
              <div
                className="h-2 flex-1 rounded-full"
                style={{
                  background:
                    "linear-gradient(90deg, rgb(2,218,139), rgb(245,158,11), rgb(239,68,68))",
                }}
              />
              <span className="text-[10px] text-muted-foreground">
                {pct(ivMax)}
              </span>
              <span className="ml-1 text-[10px] text-muted-foreground">
                implied vol
              </span>
            </div>
          </CardContent>
        </Card>

        {/* ── side panel: arb checks + term structure ── */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">No-arbitrage checks</CardTitle>
              <CardDescription className="text-xs">
                Butterfly (Gatheral g(k) ≥ 0) per slice · calendar (total
                variance ↑ in expiry).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Butterfly</span>
                {data.arb.butterflyExpiries.length === 0 ? (
                  <Badge variant="success">clean</Badge>
                ) : (
                  <Badge variant="destructive">
                    {data.arb.butterflyExpiries.map((m) => `${m}m`).join(", ")}
                  </Badge>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Calendar</span>
                {data.arb.calendarBreaches === 0 ? (
                  <Badge variant="success">clean</Badge>
                ) : (
                  <Badge variant="destructive">
                    {data.arb.calendarBreaches} breaches
                  </Badge>
                )}
              </div>
              {data.arb.calendarPairs.length > 0 ? (
                <p className="text-[10px] leading-relaxed text-muted-foreground">
                  {data.arb.calendarPairs.join(" · ")}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">ATM term structure</CardTitle>
              <CardDescription className="text-xs">
                At-the-money IV by expiry.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5">
              {expiries.map((e) => (
                <div
                  key={e.oracleId}
                  className="flex items-center gap-2 text-xs"
                >
                  <span
                    className="inline-block size-2 shrink-0 rounded-full"
                    style={{ background: ivColor(norm(e.atmIv)) }}
                  />
                  <span className="w-10 text-muted-foreground">
                    {e.minutesToExpiry}m
                  </span>
                  <div className="h-1.5 flex-1 rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.round(norm(e.atmIv) * 100)}%`,
                        background: ivColor(norm(e.atmIv)),
                      }}
                    />
                  </div>
                  <span className="w-14 text-right font-mono tabular-nums text-foreground">
                    {pct(e.atmIv)}
                  </span>
                </div>
              ))}
              {!hasData ? (
                <p className="text-xs text-muted-foreground">
                  No data at this time.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <p className="mt-6 text-center text-[11px] text-muted-foreground">
        {isLive
          ? "Live · prices derive from the on-chain SVI volatility surface · updates every ~10s · testnet"
          : `Replaying surface from ${agoMin}m ago · on-chain SVI history · testnet`}
      </p>
    </div>
  );
}
