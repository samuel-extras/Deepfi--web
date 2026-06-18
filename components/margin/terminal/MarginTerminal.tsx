"use client";

/**
 * DeepBook margin terminal — the dex perp layout over DeepBook margin:
 * desktop: [header+chart | order book | long/short ticket] band with the
 * position/orders strip below; mobile: Market / Trade / Account bottom nav.
 */
import { useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, ArrowRightLeft, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useIsMobile";
import { formatAmount } from "@/lib/sui/deepbookSpot";
import {
  DEFAULT_MARGIN_POOL_KEY,
  MARGIN_POOL_CANDIDATES,
  maxLeverage,
} from "@/lib/sui/deepbookMargin";
import {
  useMarginEnabledPools,
  useMarginPoolStats,
  useRiskParams,
} from "@/hooks/useDeepBookMargin";
import MarketHeader from "@/components/spot/MarketHeader";
import BookPanel from "@/components/spot/OrderBook";
import type { TerminalPrefill } from "@/components/spot/Ticket/types";
import type { BookView } from "@/components/spot/OrderBook/types";
import MarginTicket from "./MarginTicket";
import MarginAccountTables from "./MarginAccountTables";
import MarginAccountSummary from "./MarginAccountSummary";

const TVChart = dynamic(() => import("@/components/spot/Chart/TVChart"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[#16191C]" />,
});

type MobileTab = "market" | "trade" | "account";

export default function MarginTerminal() {
  const isMobile = useIsMobile();
  const { data: enabledPools } = useMarginEnabledPools();
  const pools = enabledPools ?? MARGIN_POOL_CANDIDATES;
  const [poolKey, setPoolKey] = useState(DEFAULT_MARGIN_POOL_KEY);
  const [prefill, setPrefill] = useState<TerminalPrefill>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>("market");
  const [bookView, setBookView] = useState<BookView>("tab");

  const book = useQuery({
    queryKey: ["deepbook", "book", poolKey],
    refetchInterval: 3000,
    queryFn: async () =>
      (await fetch(`/api/deepbook/orderbook?pool=${poolKey}&ticks=100`, {
        cache: "no-store",
      }).then(r => r.json())) as { mid: number | null },
  });
  const midPrice = book.data?.mid ?? null;
  const large = bookView === "large";

  const clickLevel = (px: number) => {
    setPrefill(prev => ({ price: px, nonce: (prev?.nonce ?? 0) + 1 }));
    setMobileTab("trade");
  };

  return (
    <div className="flex flex-col overflow-hidden bg-[#121417]">
      {/* desktop */}
      {!isMobile && (
        <div className="hidden lg:flex flex-col">
          <div className="grid grid-cols-5 h-[82vh] overflow-hidden">
            <div
              className={cn(
                "flex overflow-hidden",
                large ? "col-span-2" : "col-span-3"
              )}
            >
              <div className="flex flex-1 flex-col overflow-hidden">
                <div className="shrink-0">
                  <MarketHeader
                    poolKey={poolKey}
                    onSelectPool={setPoolKey}
                    pools={pools}
                    extraStats={<MarginHeaderStats poolKey={poolKey} />}
                  />
                </div>
                <div className="min-h-0 flex-1">
                  <TVChart symbol={poolKey} />
                </div>
              </div>
            </div>

            <div
              className={cn(
                "overflow-hidden bg-[#121417]",
                large ? "col-span-2" : "col-span-1"
              )}
            >
              <BookPanel
                poolKey={poolKey}
                onPriceClick={clickLevel}
                view={bookView}
                onViewChange={setBookView}
              />
            </div>

            <div className="col-span-1 overflow-hidden">
              <MarginTicket poolKey={poolKey} midPrice={midPrice} prefill={prefill} />
            </div>
          </div>
          <div className="grid grid-cols-5 shrink-0 overflow-hidden">
            <MarginAccountTables poolKey={poolKey} midPrice={midPrice} />
            <MarginAccountSummary
              poolKey={poolKey}
              midPrice={midPrice}
              className="col-span-1"
            />
          </div>
        </div>
      )}

      {/* mobile */}
      {isMobile && (
        <div className="pb-20 lg:hidden">
          {mobileTab === "market" && (
            <div>
              <MarketHeader poolKey={poolKey} onSelectPool={setPoolKey} pools={pools} />
              <div className="h-[42vh]">
                <TVChart symbol={poolKey} />
              </div>
              <div className="h-[52vh] border-t border-border">
                <BookPanel poolKey={poolKey} onPriceClick={clickLevel} />
              </div>
            </div>
          )}
          {mobileTab === "trade" && (
            <div>
              <MarketHeader poolKey={poolKey} onSelectPool={setPoolKey} pools={pools} />
              <div className="min-h-[70vh]">
                <MarginTicket poolKey={poolKey} midPrice={midPrice} prefill={prefill} />
              </div>
            </div>
          )}
          {mobileTab === "account" && (
            <div className="min-h-[80vh]">
              <MarginAccountSummary poolKey={poolKey} midPrice={midPrice} />
              <MarginAccountTables poolKey={poolKey} midPrice={midPrice} />
            </div>
          )}
        </div>
      )}

      {isMobile && <MobileNav activeTab={mobileTab} onTabChange={setMobileTab} />}
    </div>
  );
}

/** Leverage + borrow APR cells appended to the desktop header stats. */
function MarginHeaderStats({ poolKey }: { poolKey: string }) {
  const { data: risk } = useRiskParams(poolKey);
  const { data: stats } = useMarginPoolStats(poolKey);
  return (
    <>
      <HeaderCell
        label="Max Leverage"
        value={risk ? `${formatAmount(maxLeverage(risk.minBorrow), 1)}x` : "—"}
        accent
      />
      <HeaderCell
        label="Borrow APR (base/quote)"
        value={
          stats
            ? `${formatAmount(stats.base.borrowAprPct, 1)}% / ${formatAmount(stats.quote.borrowAprPct, 1)}%`
            : "—"
        }
      />
    </>
  );
}

function HeaderCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 shrink-0">
      <span className="text-[11px] text-nav-inactive whitespace-nowrap">{label}</span>
      <span className={cn("text-xs font-medium tabular-nums", accent ? "text-primary" : "text-white")}>
        {value}
      </span>
    </div>
  );
}

const NAV_ITEMS: { id: MobileTab; label: string; icon: typeof BarChart3 }[] = [
  { id: "market", label: "Market", icon: BarChart3 },
  { id: "trade", label: "Trade", icon: ArrowRightLeft },
  { id: "account", label: "Account", icon: Wallet },
];

function MobileNav({
  activeTab,
  onTabChange,
}: {
  activeTab: MobileTab;
  onTabChange: (t: MobileTab) => void;
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around gap-x-4 border-t border-border bg-[#121417] px-4 py-2 lg:hidden">
      {NAV_ITEMS.map(item => {
        const active = activeTab === item.id;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={cn(
              "flex items-center justify-center gap-x-2 rounded-full px-4 py-2 transition-all",
              active ? "bg-primary/10" : "bg-transparent"
            )}
          >
            <Icon className={cn("h-5 w-5", active ? "text-primary" : "text-white")} />
            <span className={cn("text-sm", active ? "text-primary" : "text-nav-inactive")}>
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
