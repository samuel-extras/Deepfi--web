"use client";

/**
 * Pair selector — shadcn Combobox (Popover + Command). Searchable list of
 * markets with live price + 24h change; each row has a Star that pins the
 * market to the favorites ticker. cmdk handles the search/filtering.
 */
import { useMemo, useState } from "react";
import { ChevronDownIcon, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TokenIcon } from "@/components/ui/token-icon";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  formatAmount,
  getSpotPool,
  type SpotPoolMeta,
} from "@/lib/deepbook/core";
import type { SummaryRow } from "@/lib/deepbook/api/types";
import { useFavoriteMarketsStore } from "@/stores/useFavoriteMarketsStore";
import { pctColor } from "./MarketStat";

export default function PairDropdown({
  poolKey,
  onSelect,
  summary,
  pools,
}: {
  poolKey: string;
  onSelect: (key: string) => void;
  summary: Record<string, SummaryRow> | undefined;
  pools: SpotPoolMeta[];
}) {
  const [open, setOpen] = useState(false);
  const pool = getSpotPool(poolKey);

  const favorites = useFavoriteMarketsStore((s) => s.favorites);
  const toggleFavorite = useFavoriteMarketsStore((s) => s.toggleFavorite);
  const favSet = useMemo(() => new Set(favorites), [favorites]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          className="shrink-0 gap-2 rounded-full hover:bg-transparent"
        >
          <TokenIcon symbol={pool.base} size={10} isSpot />
          <span className="font-semibold whitespace-nowrap">
            {pool.base} / {pool.quote}
          </span>
          <ChevronDownIcon
            data-icon="inline-end"
            className={cn("transition-transform", open && "rotate-180")}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="min-w-full w-full p-0 sm:w-full">
        <Command>
          <CommandInput placeholder="Search pairs" />
          <CommandList>
            <CommandEmpty>No pairs found.</CommandEmpty>
            <CommandGroup>
              {pools.map((p) => {
                const stats = summary?.[p.key];
                const isFav = favSet.has(p.key);
                const pct = stats?.price_change_percent_24h ?? 0;
                return (
                  <CommandItem
                    key={p.key}
                    value={p.key}
                    keywords={[p.base, p.quote, p.label]}
                    data-checked={p.key === poolKey ? "true" : undefined}
                    onSelect={() => {
                      onSelect(p.key);
                      setOpen(false);
                    }}
                    className="bg-transparent data-selected:bg-transparent"
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      data-state={isFav ? "on" : "off"}
                      data-checked={isFav ? "true" : undefined}
                      aria-pressed={isFav}
                      aria-label={
                        isFav
                          ? `Unfavorite ${p.base}/${p.quote}`
                          : `Favorite ${p.base}/${p.quote}`
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(p.key);
                      }}
                      className="flex items-center"
                    >
                      <Star
                        className={cn(
                          isFav
                            ? "fill-[#EF8D17] text-[#EF8D17]"
                            : "text-muted-foreground",
                        )}
                      />
                    </Button>
                    <TokenIcon symbol={p.base} size={10} isSpot />
                    <span>
                      {p.base}
                      <span className="text-muted-foreground">
                        {" "}
                        / {p.quote}
                      </span>
                    </span>
                    <span className="ml-auto flex items-center gap-3 tabular-nums">
                      <span>
                        {stats ? formatAmount(stats.last_price, 6) : "—"}
                      </span>
                      <span className={cn("w-16 text-right", pctColor(pct))}>
                        {stats
                          ? `${pct >= 0 ? "+" : ""}${formatAmount(pct, 2)}%`
                          : "—"}
                      </span>
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
