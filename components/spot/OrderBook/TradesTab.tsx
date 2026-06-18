"use client";

/** Recent-trades tape for the selected pool. Renders a plain panel body — the
 *  parent (tab content or section) provides the flex-col container. */
import { cn } from "@/lib/utils";
import { formatAmount, getSpotPool } from "@/lib/deepbook/core";
import { useTrades } from "@/lib/deepbook/api/queries";

export default function TradesTab({ poolKey }: { poolKey: string }) {
  const pool = getSpotPool(poolKey);
  const trades = useTrades(poolKey, 40);
  const rows = trades.data ?? [];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="grid grid-cols-3 px-4 py-1.5 text-[11px] text-nav-inactive">
        <span>Price ({pool.quote})</span>
        <span className="text-right">Size ({pool.base})</span>
        <span className="text-right">Time</span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto pb-1">
        {trades.isLoading ? (
          <div className="p-4 text-xs text-nav-inactive">Loading trades…</div>
        ) : rows.length === 0 ? (
          <div className="p-4 text-xs text-nav-inactive">No recent trades.</div>
        ) : (
          rows.map(t => (
            <div
              key={t.trade_id}
              className="grid grid-cols-3 px-4 py-[3px] text-xs hover:bg-[#1A1D1F]"
            >
              <span
                className={cn(
                  "tabular-nums",
                  t.type === "buy" ? "text-primary" : "text-[#FF4D4F]"
                )}
              >
                {formatAmount(t.price, 6)}
              </span>
              <span className="text-right text-white tabular-nums">
                {formatAmount(t.base_volume, 4)}
              </span>
              <span className="text-right text-nav-inactive tabular-nums">
                {new Date(t.timestamp).toLocaleTimeString("en-US", { hour12: false })}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
