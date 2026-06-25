"use client";

/**
 * Market stats strip — the strike to beat, the live oracle spot (tick-direction
 * coloured), ATM vol, and a 1s countdown that turns amber in the final 2
 * minutes. The market title + status live in OracleHeader above, not here.
 */
import type { OracleDTO, PricePoint, Selection } from "./types";
import { DOWN_TEXT, UP, usd0, usd2 } from "./types";
import { useCountdown } from "./useCountdown";
import { TokenIcon } from "@/components/ui/token-icon";
import { cn } from "@/lib/utils";

export default function MarketHeader({
  oracle,
  points,
  sel,
  atmIv,
}: {
  oracle: OracleDTO;
  points: PricePoint[];
  sel: Selection;
  atmIv?: number;
}) {
  const cd = useCountdown(oracle.expiry);
  const last = points.at(-1);
  const prev = points.at(-2);
  const tickUp = last && prev ? last.spot >= prev.spot : true;

  // the level BTC has to settle past to win — a single strike for a binary,
  // the band for a range. This is the number the whole ticket is about.
  const isRange = sel.posType === "range";
  const strikeValue = isRange
    ? sel.lowerUsd != null && sel.higherUsd != null
      ? `${usd0(sel.lowerUsd)} – ${usd0(sel.higherUsd)}`
      : "—"
    : sel.strikeUsd != null
      ? usd0(sel.strikeUsd)
      : "—";
  const strikeCaption = isRange ? "Target range" : "Strike price";

  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      {/* strike + live spot */}
      <div className="flex items-center gap-3.5">
        <div>
          <div className="flex  gap-3 items-center">
            <TokenIcon symbol="BTC" size={isRange ? 40 : 40} />
            <div className="mt-0.5 flex flex-col items-start">
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "font-mono font-bold tabular-nums text-foreground",
                    isRange ? "text-base" : "text-xl",
                  )}
                >
                  {strikeValue}
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                {strikeCaption}
              </span>
            </div>
            <div className="h-10 w-px bg-muted"></div>
            <div className="mt-0.5 flex flex-col items-baseline">
              <span
                className="font-mono text-xl font-bold tabular-nums transition-colors duration-300"
                style={{ color: last ? (tickUp ? UP : DOWN_TEXT) : "#fff" }}
              >
                {last ? usd2(last.spot) : "—"}
              </span>
              <span className="text-[11px] text-muted-foreground">
                oracle spot · ~1s feed
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* countdown + vol */}
      <div className="flex items-center gap-5">
        {atmIv != null ? (
          <div className="text-right">
            <div className="text-[10px] font-normal uppercase tracking-wider text-muted-foreground">
              ATM vol
            </div>
            <div className="font-mono text-sm font-bold text-foreground tabular-nums">
              {atmIv.toFixed(1)}%
            </div>
          </div>
        ) : null}
        <div className="flex items-center gap-2 rounded-xl  px-3.5 py-2">
          <div>
            <div
              className={`font-mono text-2xl font-bold leading-tight tabular-nums ${
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
