"use client";

/**
 * Mobile spot layout — one section at a time (Market / Trade / Account),
 * switched by the bottom nav. Each section mounts only when active.
 */
import MarketHeader from "@/components/spot/MarketHeader";
import BookPanel from "@/components/spot/OrderBook";
import SpotTicket from "@/components/spot/Ticket";
import AccountTables from "@/components/spot/Account";
import SpotChart from "@/components/spot/Chart";
import type { TerminalPrefill } from "@/components/spot/Ticket/types";
import type { MobileTab } from "./SpotMobileNav";

export default function SpotMobileLayout({
  mobileTab,
  poolKey,
  onSelectPool,
  midPrice,
  bestBid,
  bestAsk,
  prefill,
  onPriceClick,
}: {
  mobileTab: MobileTab;
  poolKey: string;
  onSelectPool: (key: string) => void;
  midPrice: number | null;
  bestBid: number | null;
  bestAsk: number | null;
  prefill: TerminalPrefill;
  onPriceClick: (px: number) => void;
}) {
  return (
    <div className="pb-20 lg:hidden">
      {mobileTab === "market" && (
        <div>
          <MarketHeader poolKey={poolKey} onSelectPool={onSelectPool} />
          <div className="h-[42vh]">
            <SpotChart symbol={poolKey} />
          </div>
          <div className="h-[52vh] border-t border-border">
            <BookPanel poolKey={poolKey} onPriceClick={onPriceClick} />
          </div>
        </div>
      )}
      {mobileTab === "trade" && (
        <div>
          <MarketHeader poolKey={poolKey} onSelectPool={onSelectPool} />
          <div className="min-h-[70vh]">
            <SpotTicket
              poolKey={poolKey}
              midPrice={midPrice}
              bestBid={bestBid}
              bestAsk={bestAsk}
              prefill={prefill}
            />
          </div>
        </div>
      )}
      {mobileTab === "account" && (
        <div className="min-h-[80vh]">
          <AccountTables poolKey={poolKey} />
        </div>
      )}
    </div>
  );
}
