"use client";

/**
 * Market data panel — Order Book + Trades, in one of three layouts (`view`):
 *  - tab     → OB / Trades tabs (default)
 *  - stacked → OB above Trades
 *  - large   → OB beside Trades (the desktop layout widens this column to match)
 *
 * Shared trading UI: spot passes `view` + `onViewChange`; margin omits them and
 * gets the default tab layout (no view menu).
 */
import { useCallback, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTabIndicator } from "@/hooks/useTabIndicator";
import OrderBookTab from "./OrderBookTab";
import TradesTab from "./TradesTab";
import OrderBookSection from "./OrderBookSection";
import TradesSection from "./TradesSection";
import BookViewMenu from "./BookViewMenu";
import type { BookView } from "./types";

const SHELL = "h-full border-x border-x-border overflow-hidden w-full";

export default function BookPanel({
  poolKey,
  onPriceClick,
  view = "tab",
  onViewChange,
}: {
  poolKey: string;
  onPriceClick: (px: number) => void;
  view?: BookView;
  onViewChange?: (v: BookView) => void;
}) {
  if (view === "stacked") {
    return (
      <div className={`${SHELL} flex flex-col`}>
        <OrderBookSection
          poolKey={poolKey}
          onPriceClick={onPriceClick}
          view={view}
          onViewChange={onViewChange}
          className="flex-1 border-b border-border"
        />
        <TradesSection poolKey={poolKey} className="flex-1" />
      </div>
    );
  }

  if (view === "large") {
    return (
      <div className={`${SHELL} flex`}>
        <OrderBookSection
          poolKey={poolKey}
          onPriceClick={onPriceClick}
          className="flex-1"
        />
        <TradesSection
          view={view}
          onViewChange={onViewChange}
          poolKey={poolKey}
          className="flex-1"
        />
      </div>
    );
  }

  return (
    <BookTabs
      poolKey={poolKey}
      onPriceClick={onPriceClick}
      view={view}
      onViewChange={onViewChange}
    />
  );
}

function BookTabs({
  poolKey,
  onPriceClick,
  view,
  onViewChange,
}: {
  poolKey: string;
  onPriceClick: (px: number) => void;
  view: BookView;
  onViewChange?: (v: BookView) => void;
}) {
  const [activeTab, setActiveTab] = useState<"orderbook" | "trades">(
    "orderbook",
  );
  const tabTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onTabTriggerRef = useCallback(
    (id: string, el: HTMLButtonElement | null) => {
      tabTriggerRefs.current[id] = el;
    },
    [],
  );
  const { listRef, indicator } = useTabIndicator(activeTab, tabTriggerRefs);

  return (
    <div className={`${SHELL} flex flex-col`}>
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "orderbook" | "trades")}
        className="flex flex-col h-full overflow-hidden gap-0"
      >
        <div className="flex items-center h-10  border-b border-border shrink-0">
          <div
            className="relative h-10 w-full"
            ref={listRef as React.RefObject<HTMLDivElement>}
          >
            <TabsList className="min-h-10 w-full grid grid-cols-2 relative bg-transparent p-0 ">
              <TabsTrigger
                value="orderbook"
                className="justify-center data-[state=active]:bg-transparent rounded-none text-xs h-full min-h-full"
                ref={(el) => onTabTriggerRef("orderbook", el)}
              >
                Order Book
              </TabsTrigger>
              <TabsTrigger
                value="trades"
                className="justify-center data-[state=active]:bg-transparent rounded-none text-xs h-full min-h-full"
                ref={(el) => onTabTriggerRef("trades", el)}
              >
                Trades
              </TabsTrigger>
              <div
                className="absolute bottom-0 h-0.5 bg-foreground rounded-full transition-all duration-300"
                style={{ left: indicator.left, width: indicator.width }}
              />
            </TabsList>
          </div>
          {onViewChange && (
            <BookViewMenu view={view} onViewChange={onViewChange} />
          )}
        </div>

        <TabsContent
          value="orderbook"
          className="flex-1 flex flex-col min-h-0 mt-0"
        >
          <OrderBookTab poolKey={poolKey} onPriceClick={onPriceClick} />
        </TabsContent>
        <TabsContent
          value="trades"
          className="flex-1 flex flex-col min-h-0 mt-0"
        >
          <TradesTab poolKey={poolKey} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
