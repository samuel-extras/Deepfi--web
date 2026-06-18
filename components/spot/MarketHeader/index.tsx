"use client";

/**
 * Terminal market header — searchable pair dropdown + live 24h stats.
 * Desktop: single row. Mobile: pair + price with expandable stats grid.
 *
 * Shared trading UI: the margin terminal reuses this with its own `pools`
 * subset and `extraStats` (leverage / borrow APRs).
 */
import { useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedValue } from "@/components/ui/animated-value";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Divider } from "@/components/ui/divider";
import {
  SPOT_POOLS,
  formatAmount,
  getSpotPool,
  type SpotPoolMeta,
} from "@/lib/deepbook/core";
import { useMarketSummary } from "@/lib/deepbook/api/queries";
import PairDropdown from "./PairDropdown";
import MarketTicker from "./MarketTicker";
import { MarketStat, pctColor } from "./MarketStat";

export default function MarketHeader({
  poolKey,
  onSelectPool,
  pools = SPOT_POOLS,
  extraStats,
}: {
  poolKey: string;
  onSelectPool: (key: string) => void;
  /** Pools offered in the dropdown (margin page passes only margin pools). */
  pools?: SpotPoolMeta[];
  /** Extra stat cells appended on desktop (e.g. leverage, borrow APRs). */
  extraStats?: React.ReactNode;
}) {
  const [statsExpanded, setStatsExpanded] = useState(false);
  const pool = getSpotPool(poolKey);
  const { data: summary } = useMarketSummary();
  const row = summary?.[poolKey];

  const priceStr = row ? formatAmount(row.last_price, 6) : "—";
  const pct = row?.price_change_percent_24h ?? 0;
  const changeStr = row
    ? `${pct >= 0 ? "+" : ""}${formatAmount(pct, 2)}%`
    : "—";

  return (
    <div className="relative z-30 w-full bg-[#121417]">
      <MarketTicker
        pools={pools}
        summary={summary}
        activePoolKey={poolKey}
        onSelectPool={onSelectPool}
      />
      <div className="py-2 px-4 lg:py-3">
        {/* desktop */}
        <div className="hidden lg:flex items-center gap-8">
          <PairDropdown
            poolKey={poolKey}
            onSelect={onSelectPool}
            summary={summary}
            pools={pools}
          />
          <ScrollArea className="min-w-0 flex-1">
            <div className="flex items-center gap-8 w-max py-0.5">
              <div className="flex flex-col">
                <AnimatedValue
                  value={priceStr}
                  showColorFlash
                  className="text-xl font-semibold text-white tabular-nums"
                />
              </div>
              <MarketStat
                label="24h Change"
                value={changeStr}
                valueClass={pctColor(pct)}
              />
              <MarketStat
                label="24h High"
                value={row ? formatAmount(row.highest_price_24h, 6) : "—"}
              />
              <MarketStat
                label="24h Low"
                value={row ? formatAmount(row.lowest_price_24h, 6) : "—"}
              />
              <MarketStat
                label={`24h Volume (${pool.base})`}
                value={row ? formatAmount(row.base_volume, 0) : "—"}
              />
              <MarketStat
                label={`24h Volume (${pool.quote})`}
                value={row ? formatAmount(row.quote_volume, 0) : "—"}
              />
              {extraStats}
            </div>
          </ScrollArea>
        </div>

        {/* mobile */}
        <div className="lg:hidden">
          <div className="flex items-center justify-between gap-2">
            <PairDropdown
              poolKey={poolKey}
              onSelect={onSelectPool}
              summary={summary}
              pools={pools}
            />
            <div className="flex flex-col items-end min-w-0">
              <AnimatedValue
                value={priceStr}
                showColorFlash
                className="text-lg font-semibold text-white tabular-nums"
              />
              <span className={cn("text-xs tabular-nums", pctColor(pct))}>
                {changeStr}
              </span>
            </div>
            <button
              onClick={() => setStatsExpanded((v) => !v)}
              className="w-8 h-8 shrink-0 bg-[#1A1D1F] border border-border rounded-full flex justify-center items-center"
              aria-label={statsExpanded ? "Hide stats" : "Show stats"}
            >
              <ChevronDownIcon
                className={cn(
                  "w-4 h-4 text-white transition-transform duration-300",
                  statsExpanded && "rotate-180",
                )}
              />
            </button>
          </div>
          <div
            className={cn(
              "grid transition-all duration-300 ease-in-out overflow-hidden",
              statsExpanded
                ? "grid-rows-[1fr] opacity-100 mt-3"
                : "grid-rows-[0fr] opacity-0",
            )}
          >
            <div className="overflow-hidden grid grid-cols-2 gap-3">
              <MarketStat
                label="24h High"
                value={row ? formatAmount(row.highest_price_24h, 6) : "—"}
              />
              <MarketStat
                label="24h Low"
                value={row ? formatAmount(row.lowest_price_24h, 6) : "—"}
              />
              <MarketStat
                label={`24h Vol (${pool.base})`}
                value={row ? formatAmount(row.base_volume, 0) : "—"}
              />
              <MarketStat
                label={`24h Vol (${pool.quote})`}
                value={row ? formatAmount(row.quote_volume, 0) : "—"}
              />
            </div>
          </div>
        </div>
      </div>
      <Divider />
    </div>
  );
}
