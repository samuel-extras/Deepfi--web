"use client";

/**
 * DeepBook spot terminal — pro trading layout. Thin composition root: owns the
 * selected pool, the click-to-fill prefill, and the mobile tab; fetches the
 * book once (for the ticket's mid / best bid / ask); then hands off to the
 * desktop or mobile layout.
 *
 * desktop: [header + chart | order book | ticket] band with account tables below;
 * mobile:  Market / Trade / Account bottom navigation.
 */
import { useState } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { DEFAULT_POOL_KEY } from "@/lib/deepbook/core";
import { useOrderbook } from "@/lib/deepbook/api/queries";
import type { TerminalPrefill } from "./Ticket/types";
import type { BookView } from "./OrderBook/types";
import SpotDesktopLayout from "./layout/SpotDesktopLayout";
import SpotMobileLayout from "./layout/SpotMobileLayout";
import SpotMobileNav, { type MobileTab } from "./layout/SpotMobileNav";

export default function SpotTerminal() {
  const isMobile = useIsMobile();
  const [poolKey, setPoolKey] = useState(DEFAULT_POOL_KEY);
  const [prefill, setPrefill] = useState<TerminalPrefill>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>("market");
  const [bookView, setBookView] = useState<BookView>("tab");

  // mid for the ticket (book is fetched inside the order book with the same key)
  const book = useOrderbook(poolKey, 100);
  const midPrice = book.data?.mid ?? null;
  const bestBid = book.data?.bestBid ?? null;
  const bestAsk = book.data?.bestAsk ?? null;

  const clickLevel = (px: number) => {
    setPrefill(prev => ({ price: px, nonce: (prev?.nonce ?? 0) + 1 }));
    // jump to the ticket when picking a price from the book on mobile
    setMobileTab("trade");
  };

  return (
    <div className="flex flex-col overflow-hidden ">
      {!isMobile && (
        <SpotDesktopLayout
          poolKey={poolKey}
          onSelectPool={setPoolKey}
          midPrice={midPrice}
          bestBid={bestBid}
          bestAsk={bestAsk}
          prefill={prefill}
          onPriceClick={clickLevel}
          view={bookView}
          onViewChange={setBookView}
        />
      )}

      {isMobile && (
        <>
          <SpotMobileLayout
            mobileTab={mobileTab}
            poolKey={poolKey}
            onSelectPool={setPoolKey}
            midPrice={midPrice}
            bestBid={bestBid}
            bestAsk={bestAsk}
            prefill={prefill}
            onPriceClick={clickLevel}
          />
          <SpotMobileNav activeTab={mobileTab} onTabChange={setMobileTab} />
        </>
      )}
    </div>
  );
}
