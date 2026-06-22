/*eslint-disable*/
"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import {
  ChevronRight,
  Search,
  Copy,
  ExternalLink,
  Inbox,
  History,
  ShoppingCart,
  Briefcase,
  ArrowUpRight,
  ArrowDownRight,
  X,
  CreditCard,
  Clock,
} from "lucide-react";
import { SearchToolbar } from "@/components/prediction/SearchToolbar";
import { ActivePositionCard } from "@/components/prediction/ActivePositionCard";
import { ClosedPositionCard } from "@/components/prediction/ClosedPositionCard";
import { OpenOrderCard } from "@/components/prediction/OpenOrderCard";
import { ActivityCard } from "@/components/prediction/ActivityCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  usePredictionsBalance,
  usePredictionsTradingBalance,
} from "@/stores/useBalanceStore";
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { useReferralCode } from "@/stores/useUserProfileStore";
import { getAvatarEmoji, getAvatarGradient } from "@/lib/avatar";

type PortfolioTimeframe = "24H" | "7D" | "30D" | "ALL";

const formatCurrency = (val?: number) => {
  if (val === undefined || val === null) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(val);
};

export default function PredictionPortfolioClient() {
  const [activeTab, setActiveTab] = useState<
    "Positions" | "Open Orders" | "Activity"
  >("Positions");
  const [positionFilter, setPositionFilter] = useState<"Active" | "Closed">(
    "Active"
  );
  const [timeframe, setTimeframe] = useState<PortfolioTimeframe>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // Portfolio position/order/activity feeds are not yet wired to DeepBook +
  // Predict on-chain state — render the empty-state scaffold until they land.
  const account = useActiveAccount();
  const positions: any[] = [];
  const closedPositions: any[] = [];
  const orders: any[] = [];
  const activity: any[] = [];
  const tradedCount = 0;
  const plHistory: { time: string; value: number }[] = [];
  const isLoading = false;
  const portfolioAddress = account?.address ?? "";

  // Total Predict account value (matches the main portfolio's "Predictions
  // Balance"); Available Cash is the spendable trading balance within it.
  const predictionsBalance = usePredictionsBalance();
  const predictionsTradingBalance = usePredictionsTradingBalance();
  const totalValue = Number(predictionsBalance) || 0;
  const cashBalance = Number(predictionsTradingBalance) || 0;

  const referralCode = useReferralCode();
  const displayName = referralCode || "Buddy";
  const avatarEmoji = useMemo(() => getAvatarEmoji(displayName), [displayName]);
  const avatarGradient = useMemo(
    () => getAvatarGradient(displayName),
    [displayName]
  );

  const handleCopyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    toast.success("Address copied to clipboard!");
  };

  const handleCancelOrder = (order: any) => {
    openModal("cancelPredictionOrder", { order });
  };

  const openModal = (_id: string, _props?: any) =>
    toast("Portfolio actions wiring coming soon");

  const handleSellPosition = (pos: any) => {
    openModal("closePredictionPosition", {
      position: pos,
      eventQuestion: pos.title,
      currentPrice: pos.curPrice ? pos.curPrice * 100 : 50,
    });
  };

  const handleSharePosition = (pos: any) => {
    openModal("sharePredictionPosition", {
      position: pos,
    });
  };

  const handleTransferClick = () => {
    openModal("transfer", { fromAccount: "predictions" });
  };

  const filteredData = useMemo(() => {
    let list: any[] = [];
    if (activeTab === "Positions") {
      list = positionFilter === "Active" ? positions : closedPositions;
    } else if (activeTab === "Open Orders") {
      list = orders;
    } else if (activeTab === "Activity") {
      list = activity;
    }

    if (!searchQuery) return list;
    const query = searchQuery.toLowerCase();
    return list.filter((item: any) =>
      (item.title || item.eventSlug || item.asset || "")
        .toLowerCase()
        .includes(query)
    );
  }, [
    activeTab,
    positions,
    closedPositions,
    orders,
    activity,
    positionFilter,
    searchQuery,
  ]);

  const stats = useMemo(() => {
    const totalPosValue = positions.reduce(
      (sum, p) => sum + (p.currentValue || 0),
      0
    );
    const biggestWin =
      closedPositions.length > 0
        ? Math.max(...closedPositions.map(p => p.realizedPnl || 0))
        : 0;

    return {
      totalPosValue,
      biggestWin: biggestWin > 0 ? formatCurrency(biggestWin) : "—",
      trades: tradedCount || positions.length + closedPositions.length,
    };
  }, [positions, closedPositions, tradedCount]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#121417] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-[#02DA8B] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#6B7280] text-sm animate-pulse">
            Syncing Portfolio...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121417] text-white selection:bg-[#02DA8B]/30 font-sans">
      {/* Top Navigation / Breadcrumbs */}
      <div className="container mx-auto px-4 md:px-6 pt-4 md:pt-6 flex flex-col lg:flex-row justify-between items-start gap-6">
        <div className="space-y-3 w-full lg:w-auto">
          <div className="flex items-center gap-2 text-[10px] text-[#A9A9A9] font-bold uppercase tracking-[0.2em]">
            <Link
              href="/prediction/events"
              className="hover:text-[#02DA8B] transition-colors"
            >
              Prediction Markets
            </Link>
            <ChevronRight className="h-3 w-3 opacity-30" />
            <span className="text-white opacity-40">Portfolio</span>
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              Portfolio
            </h1>
            <p className="text-[#6B7280] text-xs md:text-sm font-medium">
              View your portfolio performance and open positions
            </p>
          </div>
        </div>

        {/* Top Right Card */}
        <div className="w-full lg:w-auto bg-[#1E2024]/40 border border-white/5 rounded-xl p-5 md:p-6 min-w-full lg:min-w-[340px] backdrop-blur-xl">
          <div className="flex justify-between items-center mb-6">
            <div className="space-y-1">
              <div className="text-[9px] text-[#6B7280] font-bold uppercase tracking-[0.15em]">
                Total Portfolio
              </div>
              <div className="text-2xl font-bold text-[#02DA8B] tabular-nums tracking-tighter">
                {formatCurrency(totalValue)}
              </div>
            </div>
            <div className="text-right space-y-1">
              <div className="text-[9px] text-[#6B7280] font-bold uppercase tracking-[0.15em]">
                Available Cash
              </div>
              <div className="text-2xl font-bold text-white tabular-nums tracking-tighter">
                {formatCurrency(cashBalance)}
              </div>
            </div>
          </div>
          <Button
            onClick={handleTransferClick}
            className="w-full bg-[#02DA8B] hover:bg-[#02DA8B]/90 text-black border-none font-bold h-10 text-xs transition-all active:scale-[0.98]"
          >
            Transfer Funds
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-6 mt-8 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          {/* Left Section: User Profile & Quick Stats */}
          <div className="lg:col-span-4 space-y-8">
            <div className="flex items-center gap-4 group">
              <div
                className="h-14 w-14 rounded-xl flex items-center justify-center text-2xl shadow-lg transition-transform group-hover:scale-105"
                style={{
                  background: `linear-gradient(135deg, ${avatarGradient[0]}, ${avatarGradient[1]})`,
                  boxShadow: `0 4px 14px ${avatarGradient[0]}25`,
                }}
              >
                {avatarEmoji}
              </div>
              <div className="space-y-1">
                <div className="text-xl font-bold text-white tracking-tight">
                  {displayName}
                </div>
                <div className="flex items-center gap-2 text-[#6B7280] text-[10px] font-mono bg-white/5 px-2 py-1 rounded-md border border-white/5">
                  <span className="opacity-80">
                    {portfolioAddress
                      ? `${portfolioAddress.slice(0, 6)}...${portfolioAddress.slice(-4)}`
                      : "0x2D66...469d"}
                  </span>
                  <div className="flex items-center gap-1.5 ml-1.5 border-l border-white/10 pl-1.5">
                    <button
                      className="hover:text-white cursor-pointer transition-colors p-0.5"
                      title="Copy Address"
                      onClick={() =>
                        navigator.clipboard.writeText(portfolioAddress || "")
                      }
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                    <a
                      href={`https://testnet.suivision.xyz/account/${portfolioAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-white transition-colors p-0.5"
                      title="View on Explorer"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 border-y border-white/5 py-6">
              <div className="space-y-0.5">
                <div className="text-[9px] text-[#6B7280] font-bold uppercase tracking-widest opacity-60">
                  Value
                </div>
                <div className="text-xl font-bold text-white tabular-nums">
                  {formatCurrency(stats.totalPosValue)}
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-[9px] text-[#6B7280] font-bold uppercase tracking-widest opacity-60">
                  Biggest Win
                </div>
                <div className="text-xl font-bold text-white tabular-nums">
                  {stats.biggestWin}
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-[9px] text-[#6B7280] font-bold uppercase tracking-widest opacity-60">
                  Trades
                </div>
                <div className="text-xl font-bold text-white tabular-nums">
                  {stats.trades}
                </div>
              </div>
            </div>
          </div>

          {/* Right Section: P&L Chart */}
          <div className="lg:col-span-8 bg-[#1E2024]/20 border border-white/5 rounded-2xl p-5 md:p-6 backdrop-blur-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-6">
              <div className="space-y-0.5">
                <div className="text-[9px] text-[#6B7280] font-bold uppercase tracking-widest">
                  Profit / Loss
                </div>
                <div className="flex items-baseline gap-2">
                  <div
                    className={cn(
                      "text-3xl font-bold tracking-tighter",
                      (plHistory[plHistory.length - 1]?.value || 0) > 0.004
                        ? "text-[#02DA8B]"
                        : (plHistory[plHistory.length - 1]?.value || 0) < -0.004
                          ? "text-red-500"
                          : "text-[#6B7280]"
                    )}
                  >
                    {(plHistory[plHistory.length - 1]?.value || 0) > 0.004
                      ? "+"
                      : ""}
                    {formatCurrency(
                      plHistory[plHistory.length - 1]?.value || 0
                    )}
                  </div>
                  <div className="text-[10px] font-bold text-[#6B7280] uppercase tracking-widest">
                    Past 24H
                  </div>
                </div>
              </div>
              <div className="flex bg-white/5 p-1 rounded-lg border border-white/5 shrink-0">
                {(["24H", "7D", "30D", "ALL"] as PortfolioTimeframe[]).map(
                  tf => (
                    <button
                      key={tf}
                      onClick={() => setTimeframe(tf as PortfolioTimeframe)}
                      className={cn(
                        "px-3 py-1.5 text-[10px] font-semibold rounded-md transition-all",
                        timeframe === tf
                          ? "bg-[#2D3134] text-white shadow-sm"
                          : "text-[#6B7280] hover:text-white"
                      )}
                    >
                      {tf}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="h-[160px] w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={plHistory}>
                  <defs>
                    <linearGradient id="colorPl" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#02DA8B" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#02DA8B" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    cursor={{ stroke: "#FFFFFF10", strokeWidth: 1 }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-[#121417]/95 border border-white/10 p-2 rounded-lg shadow-xl backdrop-blur-md">
                            <div
                              className={cn(
                                "text-xs font-bold tabular-nums",
                                Number(payload[0].value) >= 0
                                  ? "text-[#02DA8B]"
                                  : "text-red-500"
                              )}
                            >
                              {formatCurrency(Number(payload[0].value))}
                            </div>
                            <div className="text-[9px] text-[#6B7280] font-bold mt-0.5">
                              {payload[0].payload.time}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#02DA8B"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorPl)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Bottom Section: Tabs & List */}
        <div className="mt-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/5 mb-6">
            <div className="flex gap-8">
              {(["Positions", "Open Orders", "Activity"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={cn(
                    "pb-3 text-sm font-medium transition-all relative",
                    activeTab === tab
                      ? "text-[#02DA8B]"
                      : "text-[#6B7280] hover:text-white"
                  )}
                >
                  {tab}
                  {activeTab === tab && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#02DA8B]" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {activeTab !== "Open Orders" && (
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              {activeTab === "Positions" ? (
                <div className="flex bg-[#1E2024]/50 p-1 rounded-lg border border-white/5 w-fit">
                  {(["Active", "Closed"] as const).map(filter => (
                    <button
                      key={filter}
                      onClick={() => setPositionFilter(filter as any)}
                      className={cn(
                        "px-6 py-1.5 text-[9px] font-bold rounded-md transition-all",
                        positionFilter === filter
                          ? "bg-[#02DA8B] text-[#081a12]"
                          : "text-[#6B7280] hover:text-white"
                      )}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              ) : (
                <div /> // Spacer to keep search on the right
              )}

              <SearchToolbar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onClearSearch={() => setSearchQuery("")}
                showFilter={false}
                showViewMode={false}
                placeholder={`Search ${activeTab.toLowerCase()}...`}
              />
            </div>
          )}

          {filteredData.length === 0 ? (
            <div className=" border border-white/5 rounded-2xl p-12 md:p-20 flex flex-col items-center justify-center text-center backdrop-blur-[1px]">
              <div className="h-16 w-16 bg-[#02DA8B]/5 rounded-full flex items-center justify-center mb-6 border border-[#02DA8B]/10">
                <Inbox className="h-8 w-8 text-[#02DA8B] opacity-20" />
              </div>
              <div className="space-y-3 mb-8">
                <h3 className="text-lg font-bold text-white tracking-tight">
                  No {activeTab.toLowerCase()} found
                </h3>
                <p className="text-[#6B7280] font-medium text-xs max-w-xs mx-auto leading-relaxed">
                  {searchQuery
                    ? "No results found matching your search."
                    : `You don't have any ${activeTab.toLowerCase()} yet.`}
                </p>
              </div>
              <Link href="/prediction/events" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto bg-[#02DA8B] hover:bg-[#02DA8B]/90 text-black border-none px-8 h-10 text-xs font-bold transition-all active:scale-[0.98]">
                  Browse Markets
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {activeTab === "Positions" &&
                filteredData.map((pos: any, i: number) =>
                  positionFilter === "Active" ? (
                    <ActivePositionCard
                      key={i}
                      pos={pos}
                      formatCurrency={formatCurrency}
                      onSell={handleSellPosition}
                      onShare={handleSharePosition}
                    />
                  ) : (
                    <ClosedPositionCard
                      key={i}
                      pos={pos}
                      formatCurrency={formatCurrency}
                      onShare={handleSharePosition}
                    />
                  )
                )}

              {activeTab === "Open Orders" &&
                filteredData.map((order: any, i: number) => (
                  <OpenOrderCard
                    key={i}
                    order={order}
                    index={i}
                    formatCurrency={formatCurrency}
                    onCancel={handleCancelOrder}
                  />
                ))}

              {activeTab === "Activity" &&
                filteredData.map((act: any, i: number) => (
                  <ActivityCard
                    key={i}
                    act={act}
                    formatCurrency={formatCurrency}
                  />
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
