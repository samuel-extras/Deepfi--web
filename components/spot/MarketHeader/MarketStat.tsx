"use client";

/** A single labelled stat cell in the market header, plus the shared
 *  percent-change color helper. */
import { cn } from "@/lib/utils";

export const pctColor = (pct: number) =>
  pct > 0 ? "text-primary" : pct < 0 ? "text-[#FF4D4F]" : "text-white";

export function MarketStat({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 shrink-0">
      <span className="text-[11px] text-nav-inactive whitespace-nowrap">{label}</span>
      <span className={cn("text-xs font-medium tabular-nums text-white", valueClass)}>
        {value}
      </span>
    </div>
  );
}
