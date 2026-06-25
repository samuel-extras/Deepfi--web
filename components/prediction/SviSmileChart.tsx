"use client";

/**
 * SVI Smile Chart — plots implied volatility (IV%) across strikes.
 * Client-only (recharts needs browser dimensions). Exported with a
 * dynamic wrapper to suppress SSR. The actual chart is only rendered
 * after hydration in the browser.
 */

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";

interface Point {
  strike: number;
  iv: number;
}

interface SviSmileChartProps {
  points: Point[];
  forward?: number;
  lowerStrike?: number;
  higherStrike?: number;
  /** px number, or a percent like "100%" to fill a flex container. */
  height?: number | `${number}%`;
}

const usd = (n: number) =>
  n >= 1000
    ? `$${(n / 1000).toFixed(1)}k`
    : `$${n.toFixed(0)}`;

const pct = (n: number) => `${n.toFixed(1)}%`;

export default function SviSmileChart({
  points,
  forward,
  lowerStrike,
  higherStrike,
  height = 120,
}: SviSmileChartProps) {
  if (!points.length) return null;

  return (
    <ResponsiveContainer
      width="100%"
      height={height}
      minWidth={100}
      minHeight={typeof height === "number" ? height : 0}
    >
      <AreaChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
        <defs>
          <linearGradient id="smileGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0.04} />
          </linearGradient>
        </defs>

        <XAxis
          dataKey="strike"
          tickFormatter={usd}
          tick={{ fontSize: 9, fill: "#6b7280" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          dataKey="iv"
          tickFormatter={pct}
          tick={{ fontSize: 9, fill: "#6b7280" }}
          tickLine={false}
          axisLine={false}
          domain={["auto", "auto"]}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as Point;
            return (
              <div className="rounded-md border border-border bg-popover px-2 py-1 text-xs text-foreground shadow-md">
                <div className="text-muted-foreground">{usd(d.strike)}</div>
                <div className="font-semibold text-emerald-400">IV {pct(d.iv)}</div>
              </div>
            );
          }}
        />

        {lowerStrike != null && higherStrike != null ? (
          <>
            <ReferenceLine x={lowerStrike} stroke="#f59e0b" strokeDasharray="3 2" strokeWidth={1.5} />
            <ReferenceLine x={higherStrike} stroke="#f59e0b" strokeDasharray="3 2" strokeWidth={1.5} />
          </>
        ) : null}

        {forward != null ? (
          <ReferenceLine
            x={forward}
            stroke="#10b981"
            strokeWidth={1.5}
            label={{ value: "F", position: "insideTopRight", fontSize: 9, fill: "#10b981" }}
          />
        ) : null}

        <Area
          type="monotone"
          dataKey="iv"
          stroke="#10b981"
          strokeWidth={1.5}
          fill="url(#smileGrad)"
          dot={false}
          activeDot={{ r: 3, fill: "#10b981" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
