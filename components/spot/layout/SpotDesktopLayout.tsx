"use client";

/**
 * Desktop spot layout — chart | order book | ticket grid (5 cols) with the
 * account tables below. The order-book `view` controls the split:
 *  - tab / stacked → chart col-span-3, book col-span-1, ticket col-span-1
 *  - large         → chart col-span-2, book col-span-2 (OB beside Trades),
 *                    ticket col-span-1
 * Conditionally RENDERED (not CSS-hidden) so the TradingView widget mounts once.
 */
import { cn } from "@/lib/utils";
import MarketHeader from "@/components/spot/MarketHeader";
import BookPanel from "@/components/spot/OrderBook";
import SpotTicket from "@/components/spot/Ticket";
import AccountTables from "@/components/spot/Account";
import AccountSummary from "@/components/spot/Account/AccountSummary";
import SpotChart from "@/components/spot/Chart";
import type { TerminalPrefill } from "@/components/spot/Ticket/types";
import type { BookView } from "@/components/spot/OrderBook/types";

export default function SpotDesktopLayout({
  poolKey,
  onSelectPool,
  midPrice,
  bestBid,
  bestAsk,
  prefill,
  onPriceClick,
  view,
  onViewChange,
}: {
  poolKey: string;
  onSelectPool: (key: string) => void;
  midPrice: number | null;
  bestBid: number | null;
  bestAsk: number | null;
  prefill: TerminalPrefill;
  onPriceClick: (px: number) => void;
  view: BookView;
  onViewChange: (v: BookView) => void;
}) {
  const large = view === "large";

  return (
    <div className="hidden lg:flex flex-col bg-[#121417]">
      <div className="grid grid-cols-5 h-[86vh] overflow-hidden">
        <div
          className={cn(
            "flex overflow-hidden",
            large ? "col-span-2" : "col-span-3",
          )}
        >
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="shrink-0">
              <MarketHeader poolKey={poolKey} onSelectPool={onSelectPool} />
            </div>
            <SpotChart symbol={poolKey} />
          </div>
        </div>

        <div
          className={cn(
            "overflow-hidden bg-[#121417]",
            large ? "col-span-2" : "col-span-1",
          )}
        >
          <BookPanel
            poolKey={poolKey}
            onPriceClick={onPriceClick}
            view={view}
            onViewChange={onViewChange}
          />
        </div>

        <div className="col-span-1 overflow-hidden">
          <SpotTicket
            poolKey={poolKey}
            midPrice={midPrice}
            bestBid={bestBid}
            bestAsk={bestAsk}
            prefill={prefill}
          />
        </div>
      </div>

      <div className="grid grid-cols-5 overflow-hidden">
        <AccountTables poolKey={poolKey} />
        <AccountSummary poolKey={poolKey} className="col-span-1" />
      </div>
    </div>
  );
}
