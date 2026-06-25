"use client";

/**
 * DeepBook Predict — "pro" terminal view. Mirrors the margin terminal layout
 * over Predict's vol-surface markets:
 *   desktop: [market header + BTC chart | strike ladder (book) | order ticket]
 *   with the positions table + account summary strip below;
 *   mobile: Market / Trade / Account bottom nav.
 *
 * The classic markets-list view stays the default — this is opt-in via the
 * navbar "Pro prediction terminal" setting.
 */
import { useState } from "react";
import dynamic from "next/dynamic";
import { BarChart3, Wallet, Bitcoin, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useIsMobile";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PredictActivityTape from "./PredictActivityTape";
import { usePredictMarket } from "./usePredictMarket";
import ExpiryRail from "./ExpiryRail";
import MarketHeader from "./MarketHeader";
import PriceChart from "./PriceChart";
import StrikeLadder from "./StrikeLadder";
import PredictTicket from "./PredictTicket";
import OraclePositions from "./OraclePositions";
import PredictAccountSummary from "./PredictAccountSummary";
import SviSmileChart from "@/components/prediction/SviSmileChart";
import { PREDICT_CADENCES } from "./types";

type ChartSource = "oracle" | "btc" | "vol";
type MobileTab = "market" | "trade" | "account";

// Real BTC price (TradingView) — opt-in alternative to the oracle chart. The
// synthetic "BTC" symbol is fed by a CORS-enabled exchange in the browser.
const BTC_SYMBOL = "BTCUSD";

const TVChart = dynamic(() => import("@/components/spot/Chart/TVChart"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[#16191C]" />,
});

export default function PredictProTerminal() {
  const isMobile = useIsMobile();
  const [mobileTab, setMobileTab] = useState<MobileTab>("trade");
  const [chartSource, setChartSource] = useState<ChartSource>("oracle");
  const [btcConfirmOpen, setBtcConfirmOpen] = useState(false);
  const m = usePredictMarket();

  // Switching to the real-BTC chart asks for confirmation first — the bet
  // settles on the oracle price, not this exchange feed.
  const handleChartSource = (src: ChartSource) => {
    if (src === chartSource) return;
    // Only the real-BTC feed needs the "settles on oracle, not this" warning.
    if (src === "btc") setBtcConfirmOpen(true);
    else setChartSource(src);
  };

  const railRow = m.oracle ? (
    <div className="shrink-0 border-b border-border bg-[#121417] md:flex items-center md:h-13.25">
      <div className="flex items-center gap-3 border-b border-border px-3 py-2 flex-1 ">
        <div className="min-w-0 flex-1">
          <ExpiryRail
            oracles={m.railOracles}
            pastOracles={m.settledOracles}
            selectedId={m.oracle.oracleId}
            onSelect={(o) => m.setSelectedId(o.oracleId)}
          />
        </div>

        <IntervalSelect
          value={m.interval}
          available={m.intervals}
          onChange={m.chooseInterval}
        />
      </div>
      <ChartSourceToggle value={chartSource} onSelect={handleChartSource} />
    </div>
  ) : null;

  const header = m.oracle ? (
    <div className="shrink-0 px-3 py-2 border-b">
      <MarketHeader
        oracle={m.oracle}
        points={m.points}
        sel={m.sel}
        atmIv={m.svi?.atmIv}
      />
    </div>
  ) : null;

  // Default: the live ORACLE price (what the bet settles on) — same series as
  // the header spot, with strikes + win zone. Opt-in: the real BTC/USD price via
  // TradingView (a reference feed, NOT what the market settles against).
  const chart = m.oracle ? (
    chartSource === "btc" ? (
      <TVChart symbol={BTC_SYMBOL} />
    ) : chartSource === "vol" ? (
      m.svi?.points?.length ? (
        <SviSmileChart
          points={m.svi.points}
          forward={m.svi.forward}
          lowerStrike={
            m.sel.posType === "range"
              ? (m.sel.lowerUsd ?? undefined)
              : (m.sel.strikeUsd ?? undefined)
          }
          higherStrike={
            m.sel.posType === "range"
              ? (m.sel.higherUsd ?? undefined)
              : undefined
          }
          height="100%"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Loading the vol surface…
        </div>
      )
    ) : (
      <PriceChart
        points={m.points}
        expiry={m.oracle.expiry}
        sel={m.sel}
        height="100%"
      />
    )
  ) : null;

  const bookPanel = m.oracle ? (
    <Tabs defaultValue="ladder" className="flex h-full flex-col gap-0">
      <TabsList
        variant="line"
        className="w-full shrink-0 justify-start gap-0 rounded-none border-b border-border bg-transparent p-0 min-h-13.25"
      >
        <TabsTrigger
          value="ladder"
          className="h-auto flex-1 rounded-none px-3 py-2 text-xs font-bold"
        >
          Ladder
        </TabsTrigger>
        <TabsTrigger
          value="activity"
          className="h-auto flex-1 rounded-none px-3 py-2 text-xs font-bold"
        >
          Activity
        </TabsTrigger>
      </TabsList>

      <TabsContent value="ladder" className="min-h-0 flex-1 overflow-y-auto">
        <StrikeLadder
          oracle={m.oracle}
          spot={m.spot}
          svi={m.svi}
          sel={m.sel}
          step={m.step}
          bare
          compact
          onSelectBinary={(strikeUsd, direction) =>
            m.patchSel({ posType: "binary", strikeUsd, direction })
          }
          onSelectRange={(lowerUsd, higherUsd) =>
            m.patchSel({ posType: "range", lowerUsd, higherUsd })
          }
        />
      </TabsContent>

      <TabsContent
        value="activity"
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <PredictActivityTape />
      </TabsContent>
    </Tabs>
  ) : null;

  const ticket = m.oracle ? (
    <PredictTicket
      oracle={m.oracle}
      svi={m.svi}
      sel={m.sel}
      step={m.step}
      onSelChange={m.patchSel}
    />
  ) : null;

  const positions = m.oracle ? <OraclePositions oracle={m.oracle} /> : null;

  // ── loading / empty ───────────────────────────────────────────────────────
  if (m.oraclesLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-6">
        <div className="h-9 w-72 animate-pulse rounded-lg bg-white/[0.04]" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px_320px]">
          <div className="h-[60vh] animate-pulse rounded-xl bg-white/[0.03]" />
          <div className="h-[60vh] animate-pulse rounded-xl bg-white/[0.03]" />
          <div className="h-[60vh] animate-pulse rounded-xl bg-white/[0.03]" />
        </div>
      </div>
    );
  }

  if (!m.oracle) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-6">
        <div className="mt-6 rounded-xl border border-white/5 bg-[#16181D] p-12 text-center">
          <div className="text-3xl">🌙</div>
          <h2 className="mt-3 text-base font-bold text-white">
            Between expiries
          </h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-[#6B7280]">
            No oracle is live right now. Rolling sub-hour BTC markets reopen
            every cycle — this page refreshes automatically.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden bg-[#121417]">
      {/* desktop */}
      {!isMobile && (
        <div className="hidden lg:flex flex-col">
          <div className="grid grid-cols-5 h-[82vh] overflow-hidden">
            {/* market header + BTC chart */}
            <div className="col-span-3 flex overflow-hidden">
              <div className="flex flex-1 flex-col overflow-hidden">
                {railRow}
                {header}
                {m.staleTape ? (
                  <div className="mx-3 mb-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-300">
                    ⚠ Price feed looks inactive — last update {m.staleAgo}.
                  </div>
                ) : null}
                <div className="min-h-0 flex-1 p-0">{chart}</div>
              </div>
            </div>

            {/* strike ladder (book) + activity, tabbed */}
            <div className="col-span-1 overflow-hidden border-l border-border bg-[#121417]">
              {bookPanel}
            </div>

            {/* order ticket */}
            <div className="col-span-1 overflow-y-auto border-l border-border">
              {ticket}
            </div>
          </div>

          {/* positions table + account summary */}
          <div className="grid grid-cols-5 shrink-0 overflow-hidden">
            <div className="col-span-4 overflow-x-auto border-t">
              {positions}
            </div>
            <PredictAccountSummary className="col-span-1" />
          </div>
        </div>
      )}

      {/* mobile */}
      {isMobile && (
        <div className="pb-20 lg:hidden">
          {mobileTab === "market" && (
            <div>
              {railRow}
              {header}
              <div className="h-[42vh] px-3 pb-2">{chart}</div>
              <div className="h-[52vh] border-t border-border">{bookPanel}</div>
            </div>
          )}
          {mobileTab === "trade" && (
            <div>
              {railRow}
              <div className="min-h-[70vh]">{ticket}</div>
            </div>
          )}
          {mobileTab === "account" && (
            <div className="min-h-[80vh]">
              <PredictAccountSummary />
              {positions}
            </div>
          )}
        </div>
      )}

      {isMobile && (
        <MobileNav activeTab={mobileTab} onTabChange={setMobileTab} />
      )}

      <AlertDialog open={btcConfirmOpen} onOpenChange={setBtcConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch to the real BTC chart?</AlertDialogTitle>
            <AlertDialogDescription>
              This shows the live BTC/USD price from a public exchange
              (TradingView) — for reference only. Your predictions settle
              against the DeepBook Predict <strong>oracle</strong> price, not
              this feed, so the two can differ on testnet. Place trades off what
              the oracle chart shows.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay on oracle</AlertDialogCancel>
            <AlertDialogAction onClick={() => setChartSource("btc")}>
              Show real BTC
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Chart data source — oracle (settlement price, default) or real BTC reference. */
function ChartSourceToggle({
  value,
  onSelect,
}: {
  value: ChartSource;
  onSelect: (v: ChartSource) => void;
}) {
  const opts: [ChartSource, string][] = [
    ["oracle", "Oracle"],
    ["btc", "BTC"],
    ["vol", "Vol"],
  ];
  return (
    <div className="flex h-8 shrink-0 items-center rounded-full bg-[#1A1D1F] p-0.5 max-w-fit mr-4">
      {opts.map(([v, label]) => {
        const active = value === v;
        return (
          <button
            key={v}
            onClick={() => onSelect(v)}
            className={cn(
              "h-full cursor-pointer rounded-full px-3 text-xs transition-all",
              active
                ? "bg-foreground font-semibold text-[#121417]"
                : "bg-transparent font-medium text-nav-inactive hover:text-white",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** Compact market-interval (cadence) selector — "All" plus each live cadence. */
// Every interval the protocol offers (shortest → longest); "24h" reads better
// than "1d" for these sub-day markets.
const INTERVAL_LABELS: Record<string, string> = { all: "All", "1d": "24h" };
const labelOf = (iv: string) => INTERVAL_LABELS[iv] ?? iv;

function IntervalSelect({
  value,
  available,
  onChange,
}: {
  value: string;
  /** Cadences that currently have live markets — the rest are shown disabled. */
  available: string[];
  onChange: (iv: string) => void;
}) {
  const opts = ["all", ...PREDICT_CADENCES.map((c) => c.label)];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-8 shrink-0 items-center gap-1 rounded-full bg-[#1A1D1F] px-3 text-xs font-medium text-white outline-none transition-colors hover:bg-white/5">
        {labelOf(value)}
        <ChevronDown className="size-3.5 text-nav-inactive" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-32">
        {opts.map((iv) => {
          const live = iv === "all" || available.includes(iv);
          return (
            <DropdownMenuItem
              key={iv}
              disabled={!live}
              onClick={() => live && onChange(iv)}
              className={cn(
                "flex cursor-pointer items-center justify-between text-xs",
                value === iv && "text-primary",
              )}
            >
              {labelOf(iv)}
              {!live ? (
                <span className="text-[10px] text-nav-inactive">none live</span>
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const NAV_ITEMS: { id: MobileTab; label: string; icon: typeof BarChart3 }[] = [
  { id: "market", label: "Market", icon: BarChart3 },
  { id: "trade", label: "Predict", icon: Bitcoin },
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
      {NAV_ITEMS.map((item) => {
        const active = activeTab === item.id;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={cn(
              "flex items-center justify-center gap-x-2 rounded-full px-4 py-2 transition-all",
              active ? "bg-white/30" : "bg-transparent",
            )}
          >
            <Icon
              className={cn(
                "h-5 w-5",
                active ? "text-foreground" : "text-white",
              )}
            />
            <span
              className={cn(
                "text-sm",
                active ? "text-foreground" : "text-nav-inactive",
              )}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
