"use client";

/**
 * Market identity strip: asset badge, live spot with tick-direction color,
 * settle time, and a 1s countdown that turns amber inside the final 2 minutes.
 */
import { Clock } from "lucide-react";
import type { OracleDTO, PricePoint } from "./types";
import { DOWN_TEXT, UP, clockTime, usd2 } from "./types";
import { useCountdown } from "./useCountdown";

function StatusChip({ status }: { status: string }) {
  const s = status.toLowerCase();
  const styles: Record<string, string> = {
    active: "bg-[#02DA8B]/10 text-[#02DA8B] border-[#02DA8B]/25",
    live: "bg-[#02DA8B]/10 text-[#02DA8B] border-[#02DA8B]/25",
    settled: "bg-blue-500/10 text-blue-400 border-blue-500/25",
    pending: "bg-amber-500/10 text-amber-400 border-amber-500/25",
  };
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
        styles[s] ?? "border-white/10 bg-white/5 text-[#6B7280]"
      }`}
    >
      {s === "pending" ? "settling" : s}
    </span>
  );
}

export default function MarketHeader({
  oracle,
  points,
  atmIv,
}: {
  oracle: OracleDTO;
  points: PricePoint[];
  atmIv?: number;
}) {
  const cd = useCountdown(oracle.expiry);
  const last = points.at(-1);
  const prev = points.at(-2);
  const tickUp = last && prev ? last.spot >= prev.spot : true;

  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      {/* identity + spot */}
      <div className="flex items-center gap-3.5">
        <div className="flex h-10 w-11 items-center justify-center rounded-xl bg-orange-500/15 text-xl font-bold text-orange-400">
          ₿
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-white">
              {oracle.asset} · {clockTime(oracle.expiry)} settlement
            </h1>
            <StatusChip status={oracle.status} />
          </div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span
              className="font-mono text-2xl font-bold tabular-nums transition-colors duration-300"
              style={{ color: last ? (tickUp ? UP : DOWN_TEXT) : "#fff" }}
            >
              {last ? usd2(last.spot) : "—"}
            </span>
            <span className="text-[11px] text-[#6B7280]">
              oracle spot · ~1s feed
            </span>
          </div>
        </div>
      </div>

      {/* countdown + vol */}
      <div className="flex items-center gap-5">
        {atmIv != null ? (
          <div className="text-right">
            <div className="text-[10px] font-medium uppercase tracking-wider text-[#6B7280]">
              ATM vol
            </div>
            <div className="font-mono text-sm font-semibold text-white tabular-nums">
              {atmIv.toFixed(1)}%
            </div>
          </div>
        ) : null}
        <div
          className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 ${
            cd.urgency === "closing"
              ? "animate-pulse border-amber-500/40 bg-amber-500/10"
              : cd.urgency === "expired"
                ? "border-red-500/40 bg-red-500/10"
                : "border-white/10 bg-white/[0.03]"
          }`}
        >
          <Clock
            className={`h-4 w-4 ${
              cd.urgency === "closing"
                ? "text-amber-400"
                : cd.urgency === "expired"
                  ? "text-red-400"
                  : "text-[#02DA8B]"
            }`}
          />
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-[#6B7280]">
              {cd.urgency === "expired" ? "Awaiting settle" : "Closes in"}
            </div>
            <div
              className={`font-mono text-base font-bold leading-tight tabular-nums ${
                cd.urgency === "closing"
                  ? "text-amber-400"
                  : cd.urgency === "expired"
                    ? "text-red-400"
                    : "text-white"
              }`}
            >
              {cd.label}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
