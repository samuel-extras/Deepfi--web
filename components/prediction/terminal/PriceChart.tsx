"use client";

/**
 * Live oracle price chart with the selection's win zone painted on it.
 *
 *  - emerald area = "you win if BTC settles here" (above/below strike, or the band)
 *  - dashed rails mark strikes, with $ tags on the left edge
 *  - last price rides the right edge as a live tag
 *  - the amber flag at the right is settlement — the empty space before it is
 *    the time remaining, so urgency is *visible*
 */
import { useMemo } from "react";
import {
  Area,
  ComposedChart,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PricePoint, Selection } from "./types";
import { AXIS, DOWN, UP, clockTime, compactUsd, usd0, usd2 } from "./types";

const GRID = "#ffffff14";

type Props = {
  points: PricePoint[];
  expiry: number;
  sel: Selection;
  height?: number;
};

/** Right-edge price tag rendered as a ReferenceLine label. */
function PriceTag(props: {
  viewBox?: { x?: number; y?: number; width?: number; height?: number };
  value: string;
  fill: string;
  textFill?: string;
}) {
  const { viewBox, value, fill, textFill = "#081A12" } = props;
  if (!viewBox || viewBox.y == null) return null;
  const w = 8 + value.length * 6.4;
  const x = (viewBox.x ?? 0) + (viewBox.width ?? 0) - w + 52;
  return (
    <g transform={`translate(${x},${viewBox.y - 9})`}>
      <rect width={w} height={18} rx={4} fill={fill} />
      <text
        x={w / 2}
        y={12.5}
        textAnchor="middle"
        fontSize={10}
        fontWeight={700}
        fill={textFill}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </text>
    </g>
  );
}

/** Left-edge strike tag. */
function StrikeTag(props: {
  viewBox?: { x?: number; y?: number; width?: number };
  value: string;
}) {
  const { viewBox, value } = props;
  if (!viewBox || viewBox.y == null) return null;
  const w = 10 + value.length * 6;
  return (
    <g transform={`translate(${(viewBox.x ?? 0) + 4},${viewBox.y - 9})`}>
      <rect width={w} height={18} rx={4} fill="#1E2024" stroke="#ffffff1f" />
      <text
        x={w / 2}
        y={12.5}
        textAnchor="middle"
        fontSize={10}
        fontWeight={600}
        fill="#E5E7EB"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </text>
    </g>
  );
}

export default function PriceChart({ points, expiry, sel, height = 340 }: Props) {
  const last = points.at(-1) ?? null;

  const { yMin, yMax } = useMemo(() => {
    const ys = points.map(p => p.spot);
    if (sel.posType === "binary" && sel.strikeUsd != null) ys.push(sel.strikeUsd);
    if (sel.posType === "range" && sel.lowerUsd != null && sel.higherUsd != null)
      ys.push(sel.lowerUsd, sel.higherUsd);
    if (!ys.length) return { yMin: 0, yMax: 1 };
    const lo = Math.min(...ys);
    const hi = Math.max(...ys);
    const pad = Math.max((hi - lo) * 0.18, hi * 0.0004);
    return { yMin: lo - pad, yMax: hi + pad };
  }, [points, sel]);

  const xMin = points[0]?.t ?? Date.now() - 60_000;
  const xMax = Math.max(expiry, last?.t ?? 0);

  const winZone: [number, number] | null = useMemo(() => {
    if (sel.posType === "binary" && sel.strikeUsd != null) {
      return sel.direction === "up" ? [sel.strikeUsd, yMax] : [yMin, sel.strikeUsd];
    }
    if (sel.posType === "range" && sel.lowerUsd != null && sel.higherUsd != null) {
      return [sel.lowerUsd, sel.higherUsd];
    }
    return null;
  }, [sel, yMin, yMax]);

  const inZone =
    winZone && last ? last.spot >= winZone[0] && last.spot <= winZone[1] : false;

  if (!points.length) {
    return (
      <div
        className="w-full animate-pulse rounded-xl bg-white/[0.03]"
        style={{ height }}
      />
    );
  }

  const xTicks = (() => {
    const n = 4;
    const out: number[] = [];
    for (let i = 0; i <= n; i++) out.push(xMin + ((xMax - xMin) * i) / n);
    return out;
  })();

  return (
    <div className="relative w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 14, right: 56, bottom: 0, left: 8 }}>
          <defs>
            <linearGradient id="spotFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={UP} stopOpacity={0.22} />
              <stop offset="100%" stopColor={UP} stopOpacity={0} />
            </linearGradient>
          </defs>

          <XAxis
            dataKey="t"
            type="number"
            domain={[xMin, xMax]}
            ticks={xTicks}
            tickFormatter={t => clockTime(t)}
            stroke={AXIS}
            fontSize={10}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <YAxis
            domain={[yMin, yMax]}
            orientation="right"
            stroke={AXIS}
            fontSize={10}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={v => (yMax - yMin < 2500 ? usd0(v) : compactUsd(v))}
          />

          {/* win zone */}
          {winZone ? (
            <ReferenceArea
              y1={winZone[0]}
              y2={winZone[1]}
              fill={UP}
              fillOpacity={0.07}
              stroke="none"
              label={{
                value: "WIN ZONE",
                position: "insideTopLeft",
                fontSize: 9,
                fontWeight: 700,
                fill: UP,
                opacity: 0.7,
                offset: 8,
              }}
            />
          ) : null}

          {/* strike rails */}
          {sel.posType === "binary" && sel.strikeUsd != null ? (
            <ReferenceLine
              y={sel.strikeUsd}
              stroke={UP}
              strokeOpacity={0.8}
              strokeDasharray="5 4"
              label={<StrikeTag value={usd0(sel.strikeUsd)} />}
            />
          ) : null}
          {sel.posType === "range" && sel.lowerUsd != null ? (
            <ReferenceLine
              y={sel.lowerUsd}
              stroke={UP}
              strokeOpacity={0.8}
              strokeDasharray="5 4"
              label={<StrikeTag value={usd0(sel.lowerUsd)} />}
            />
          ) : null}
          {sel.posType === "range" && sel.higherUsd != null ? (
            <ReferenceLine
              y={sel.higherUsd}
              stroke={UP}
              strokeOpacity={0.8}
              strokeDasharray="5 4"
              label={<StrikeTag value={usd0(sel.higherUsd)} />}
            />
          ) : null}

          {/* settlement flag */}
          <ReferenceLine
            x={expiry}
            stroke="#F59E0B"
            strokeOpacity={0.9}
            strokeDasharray="3 3"
            label={{
              value: `Settles ${clockTime(expiry)}`,
              position: "insideTopRight",
              fontSize: 9,
              fontWeight: 600,
              fill: "#F59E0B",
              offset: 8,
            }}
          />

          {/* grid-lite: just a baseline */}
          <ReferenceLine y={yMin} stroke={GRID} />

          <Tooltip
            cursor={{ stroke: "#ffffff30", strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as PricePoint;
              return (
                <div className="rounded-lg border border-white/10 bg-[#1E2024]/95 px-3 py-2 shadow-xl backdrop-blur-md">
                  <div className="font-mono text-[10px] text-[#A9A9A9]">
                    {new Date(d.t).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </div>
                  <div className="mt-0.5 font-mono text-sm font-semibold text-white">
                    {usd2(d.spot)}
                  </div>
                </div>
              );
            }}
          />

          <Area
            type="monotone"
            dataKey="spot"
            stroke={UP}
            strokeWidth={1.8}
            fill="url(#spotFill)"
            dot={false}
            isAnimationActive={false}
            activeDot={{ r: 3.5, fill: UP, strokeWidth: 0 }}
          />

          {/* live price marker + right-edge tag */}
          {last ? (
            <>
              <ReferenceDot
                x={last.t}
                y={last.spot}
                r={3.5}
                fill={inZone || !winZone ? UP : DOWN}
                stroke="#121417"
                strokeWidth={1.5}
              />
              <ReferenceLine
                y={last.spot}
                stroke={inZone || !winZone ? UP : DOWN}
                strokeOpacity={0.35}
                strokeDasharray="2 3"
                label={
                  <PriceTag
                    value={usd2(last.spot)}
                    fill={inZone || !winZone ? UP : DOWN}
                    textFill={inZone || !winZone ? "#081A12" : "#FFFFFF"}
                  />
                }
              />
            </>
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
