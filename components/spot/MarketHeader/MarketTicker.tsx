"use client";

/**
 * Markets ticker — horizontally-scrollable strip of the available DeepBook
 * markets with live price + 24h change. Clicking a chip switches the active
 * pool. Driven by the data the market header already holds (pools + summary),
 * so it adds no extra fetching.
 *
 * Shared trading UI: the spot and margin headers both render this (each passes
 * its own `pools` subset).
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedValue } from "@/components/ui/animated-value";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatAmount, type SpotPoolMeta } from "@/lib/deepbook/core";
import type { SummaryRow } from "@/lib/deepbook/api/types";
import { useFavoriteMarketsStore } from "@/stores/useFavoriteMarketsStore";

type TickerItem = {
  key: string;
  name: string;
  price: string;
  change: string;
  changeUp: boolean;
};

export default function MarketTicker({
  pools,
  summary,
  activePoolKey,
  onSelectPool,
}: {
  pools: SpotPoolMeta[];
  summary: Record<string, SummaryRow> | undefined;
  activePoolKey: string;
  onSelectPool: (key: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const items: TickerItem[] = useMemo(
    () =>
      pools.map((p) => {
        const s = summary?.[p.key];
        const pct = s?.price_change_percent_24h ?? 0;
        return {
          key: p.key,
          name: `${p.base}/${p.quote}`,
          price: s ? formatAmount(s.last_price, 6) : "—",
          change: s ? `${pct >= 0 ? "+" : ""}${formatAmount(pct, 2)}%` : "—",
          changeUp: pct >= 0,
        };
      }),
    [pools, summary],
  );

  // Favorites live in a persisted (localStorage) store. `mounted` is false on the
  // server + first client render, then true after hydration — so the persisted
  // favorites can't mismatch the SSR markup. useSyncExternalStore does this
  // without a setState-in-effect (which the lint rules forbid).
  const favorites = useFavoriteMarketsStore((s) => s.favorites);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const favItems = useMemo(() => {
    const set = new Set(favorites);
    return items.filter((i) => set.has(i.key));
  }, [items, favorites]);

  // Display mode — percentage and/or price shown in front of each pair.
  // Multi-select: both can be on, but at least one always stays on.
  const [display, setDisplay] = useState<string[]>(["percentage"]);
  const showPct = display.includes("percentage");
  const showCurrency = display.includes("currency");

  const checkScrollBoundaries = () => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const hasOverflow = scrollWidth > clientWidth;
    const tolerance = 1; // floating-point slack
    setCanScrollLeft(hasOverflow && scrollLeft > tolerance);
    setCanScrollRight(
      hasOverflow && scrollLeft < scrollWidth - clientWidth - tolerance,
    );
  };

  useEffect(() => {
    queueMicrotask(() => checkScrollBoundaries());
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScrollBoundaries);
    window.addEventListener("resize", checkScrollBoundaries);
    return () => {
      el.removeEventListener("scroll", checkScrollBoundaries);
      window.removeEventListener("resize", checkScrollBoundaries);
    };
  }, [favItems, mounted]);

  const scrollByItem = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    const first = el.firstElementChild as HTMLElement | null;
    const step = first ? first.offsetWidth + 8 /* gap-2 */ : 160;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  if (pools.length === 0) return null;

  return (
    <div className="relative h-10 border-b border-border flex items-center">
      <div className=" z-10 gap-2 flex items-center justify-center w-8 mx-2">
        <Star className="w-4 h-4 text-[#EF8D17] fill-[#EF8D17]" />
      </div>
      {favItems.length > 0 && (
        <ToggleGroup
          type="multiple"
          value={display}
          // at least one stays on — ignore the change that would clear both
          onValueChange={(val) => {
            if (val.length > 0) setDisplay(val);
          }}
          size="sm"
          spacing={1}
          className="bg-muted p-0.5 gap-px h-fit rounded-md"
        >
          <ToggleGroupItem
            value="percentage"
            aria-label="Show 24h change"
            className="text-white data-[state=on]:bg-primary aria-pressed:bg-primary data-[state=on]:text-primary-foreground"
          >
            %
          </ToggleGroupItem>
          <ToggleGroupItem
            value="currency"
            aria-label="Show price"
            className="text-white data-[state=on]:bg-primary aria-pressed:bg-primary data-[state=on]:text-primary-foreground"
          >
            $
          </ToggleGroupItem>
        </ToggleGroup>
      )}

      <div className="relative flex-1 h-full min-w-0">
        <div
          ref={scrollRef}
          className="flex items-center h-full px-3 overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] scrollbar-none"
        >
          {!mounted ? null : favItems.length === 0 ? (
            <span className="px-1 text-xs text-nav-inactive whitespace-nowrap">
              Star markets in the pair list to pin them here
            </span>
          ) : (
            favItems.map((item) => (
              <Button
                variant={"ghost"}
                key={item.key}
                onClick={() => onSelectPool(item.key)}
                className={cn(
                  "shrink-0 rounded-xs",
                  item.key === activePoolKey && "bg-primary/10",
                )}
              >
                <span className="text-white tabular-nums text-xs font-normal">
                  {item.name}
                </span>
                {showPct && (
                  <AnimatedValue
                    value={item.change}
                    showColorFlash={false}
                    className={cn(
                      "tabular-nums",
                      item.changeUp ? "text-primary" : "text-[#FF4D4F]",
                    )}
                  />
                )}
                {showCurrency && (
                  <AnimatedValue
                    value={item.price}
                    showColorFlash
                    className="text-white tabular-nums"
                  />
                )}
              </Button>
            ))
          )}
        </div>
        {canScrollLeft && (
          <Button
            onClick={() => scrollByItem(-1)}
            className="absolute left-0 inset-y-0 my-auto z-10 flex items-center justify-center w-8 bg-linear-to-r from-[#121417] to-transparent cursor-pointer bg-transparent hover:bg-transparent"
            aria-label="Scroll left"
            size={"icon-lg"}
          >
            <ChevronLeft className="w-4 h-4 text-white" />
          </Button>
        )}

        {canScrollRight && (
          <Button
            onClick={() => scrollByItem(1)}
            className="absolute right-0 inset-y-0 my-auto z-10 flex items-center justify-center w-8 bg-linear-to-l from-[#121417] to-transparent cursor-pointer bg-transparent hover:bg-transparent"
            aria-label="Scroll right"
            size={"icon-lg"}
          >
            <ChevronRight className="w-4 h-4 text-white" />
          </Button>
        )}
      </div>
    </div>
  );
}
