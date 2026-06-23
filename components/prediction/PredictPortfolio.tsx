/*eslint-disable*/
"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { ChevronRight, Copy, ExternalLink, Inbox } from "lucide-react";
import { SearchToolbar } from "@/components/prediction/SearchToolbar";
import { ActivePositionCard } from "@/components/prediction/ActivePositionCard";
import { ClosedPositionCard } from "@/components/prediction/ClosedPositionCard";
import { ActivityCard } from "@/components/prediction/ActivityCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
} from "@/components/ui/responsive-modal";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  usePredictionsBalance,
  usePredictionsTradingBalance,
} from "@/stores/useBalanceStore";
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { useReferralCode } from "@/stores/useUserProfileStore";
import { getAvatarEmoji, getAvatarGradient } from "@/lib/avatar";
import { usePredictRedeem } from "@/hooks/usePredictRedeem";
import { usePredictWithdraw } from "@/hooks/usePredictWithdraw";
import {
  toCardPosition,
  isSettledStatus,
  CONTRACT_SCALE,
  type ApiPosition,
  type CardPosition,
} from "@/lib/predict/positionView";

type PortfolioTimeframe = "24H" | "7D" | "30D" | "ALL";

const TIMEFRAME_MS: Record<PortfolioTimeframe, number> = {
  "24H": 24 * 60 * 60 * 1000,
  "7D": 7 * 24 * 60 * 60 * 1000,
  "30D": 30 * 24 * 60 * 60 * 1000,
  ALL: Infinity,
};

const formatCurrency = (val?: number) => {
  if (val === undefined || val === null || Number.isNaN(val)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(val);
};

interface PortfolioResponse {
  ok: boolean;
  managerId: string | null;
  summary?: {
    tradingBalance: number;
    openExposure: number;
    redeemableValue: number;
    realizedPnl: number;
    unrealizedPnl: number;
    accountValue: number;
    openPositions: number;
    awaitingSettlement: number;
  };
  positions?: ApiPosition[];
}

interface ActivityResponse {
  ok: boolean;
  activity: any[];
  pnlHistory: { ts: number; time: string; value: number }[];
}

export default function PredictionPortfolioClient() {
  const [activeTab, setActiveTab] = useState<"Positions" | "Activity">(
    "Positions"
  );
  const [positionFilter, setPositionFilter] = useState<"Active" | "Closed">(
    "Active"
  );
  const [timeframe, setTimeframe] = useState<PortfolioTimeframe>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [redeemTarget, setRedeemTarget] = useState<CardPosition | null>(null);
  const [redeemQty, setRedeemQty] = useState("");

  const account = useActiveAccount();
  const owner = account?.address ?? "";
  const portfolioAddress = owner;

  const queryClient = useQueryClient();
  const { redeem, isRedeeming } = usePredictRedeem();
  const { withdraw, isWithdrawing } = usePredictWithdraw();

  const portfolioQuery = useQuery<PortfolioResponse>({
    queryKey: ["predict", "portfolio", owner],
    queryFn: () =>
      fetch(`/api/portfolio?owner=${owner}`, { cache: "no-store" }).then(r =>
        r.json()
      ),
    enabled: !!owner,
    refetchInterval: 12_000,
  });

  const activityQuery = useQuery<ActivityResponse>({
    queryKey: ["predict", "activity", owner],
    queryFn: () =>
      fetch(`/api/portfolio/activity?owner=${owner}`, {
        cache: "no-store",
      }).then(r => r.json()),
    enabled: !!owner,
    refetchInterval: 15_000,
  });

  const managerId = portfolioQuery.data?.managerId ?? "";
  const summary = portfolioQuery.data?.summary;

  // Map raw PredictManager positions into the Polymarket-style card shape, then
  // split live vs settled. Settled-but-still-listed positions carry un-redeemed
  // payout, so they land in "Closed" with a Redeem action.
  const allCards: CardPosition[] = useMemo(() => {
    const raw = portfolioQuery.data?.positions ?? [];
    if (!managerId) return [];
    return raw.map(p => toCardPosition(p, managerId));
  }, [portfolioQuery.data?.positions, managerId]);

  const positions = useMemo(
    () =>
      allCards.filter(c => !isSettledStatus(c.status) && c.quantityRaw > 0),
    [allCards]
  );
  const closedPositions = useMemo(
    () => allCards.filter(c => isSettledStatus(c.status)),
    [allCards]
  );

  const activity = activityQuery.data?.activity ?? [];

  const plHistory = useMemo(() => {
    const all = activityQuery.data?.pnlHistory ?? [];
    if (timeframe === "ALL") return all;
    const cutoff = Date.now() - TIMEFRAME_MS[timeframe];
    return all.filter(p => p.ts >= cutoff);
  }, [activityQuery.data?.pnlHistory, timeframe]);

  const tradedCount = activity.length;
  const isLoading =
    !!owner && portfolioQuery.isLoading && !portfolioQuery.data;

  // Total Predict account value + spendable cash. Prefer the live summary; fall
  // back to the balance store (kept warm by useDeepBookPortfolioSync).
  const predictionsBalance = usePredictionsBalance();
  const predictionsTradingBalance = usePredictionsTradingBalance();
  const totalValue = summary?.accountValue ?? (Number(predictionsBalance) || 0);
  const cashBalance =
    summary?.tradingBalance ?? (Number(predictionsTradingBalance) || 0);
  const totalPnl =
    (summary?.realizedPnl ?? 0) + (summary?.unrealizedPnl ?? 0);

  const referralCode = useReferralCode();
  const displayName = referralCode || "Buddy";
  const avatarEmoji = useMemo(() => getAvatarEmoji(displayName), [displayName]);
  const avatarGradient = useMemo(
    () => getAvatarGradient(displayName),
    [displayName]
  );

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["predict", "portfolio", owner] });
    queryClient.invalidateQueries({ queryKey: ["predict", "activity", owner] });
  };

  const handleCopyAddress = () => {
    if (!portfolioAddress) return;
    navigator.clipboard.writeText(portfolioAddress);
    toast.success("Address copied to clipboard!");
  };

  // Redeem a position back to the vault — works for both an early exit on a live
  // market ("Sell") and collecting a settled payout ("Redeem"). `quantityRaw`
  // defaults to the whole position; pass a smaller raw u64 for a partial redeem.
  const doRedeem = async (
    pos: CardPosition,
    quantityRaw: number = pos.quantityRaw
  ) => {
    if (!pos.managerId) {
      toast.error("No Predict account found");
      return;
    }
    const digest =
      pos.kind === "range"
        ? await redeem({
            kind: "range",
            managerId: pos.managerId,
            oracleId: pos.oracleId,
            expiryMs: pos.expiry,
            lowerUsd: pos.lowerStrike ?? 0,
            higherUsd: pos.higherStrike ?? 0,
            quantity: quantityRaw,
          })
        : await redeem({
            kind: "binary",
            managerId: pos.managerId,
            oracleId: pos.oracleId,
            expiryMs: pos.expiry,
            strikeUsd: pos.strike ?? 0,
            isUp: !!pos.isUp,
            quantity: quantityRaw,
          });
    if (digest) refreshAll();
    return digest;
  };

  // Active (unsettled) positions open a modal to choose how many contracts to
  // redeem; settled positions in "Closed" redeem the full amount directly.
  const openRedeemModal = (pos: CardPosition) => {
    setRedeemTarget(pos);
    setRedeemQty(pos.size); // default to the full position
  };

  const handleSubmitRedeem = async () => {
    if (!redeemTarget) return;
    const contracts = Number(redeemQty);
    const maxContracts = Number(redeemTarget.size);
    if (!(contracts > 0)) {
      toast.error("Enter a quantity greater than 0");
      return;
    }
    if (contracts > maxContracts + 1e-9) {
      toast.error("Quantity exceeds your position");
      return;
    }
    // Convert human contracts → raw u64; clamp to the exact open quantity so a
    // "max" redeem always matches the position rather than rounding above it.
    let raw = Math.round(contracts * CONTRACT_SCALE);
    if (raw > redeemTarget.quantityRaw) raw = redeemTarget.quantityRaw;
    const digest = await doRedeem(redeemTarget, raw);
    if (digest) {
      setRedeemTarget(null);
      setRedeemQty("");
    }
  };

  const handleSharePosition = (pos: CardPosition) => {
    const text = `${pos.title} · ${pos.outcome} · ${formatCurrency(pos.cashPnl)}`;
    navigator.clipboard.writeText(text);
    toast.success("Position copied — paste it anywhere to share");
  };

  const handleSubmitWithdraw = async () => {
    const amt = Number(withdrawAmount);
    if (!(amt > 0)) {
      toast.error("Enter an amount greater than 0");
      return;
    }
    if (amt > cashBalance + 1e-9) {
      toast.error("Amount exceeds available cash");
      return;
    }
    const digest = await withdraw({ managerId, amountDusdc: amt });
    if (digest) {
      setWithdrawOpen(false);
      setWithdrawAmount("");
      refreshAll();
    }
  };

  const filteredData = useMemo(() => {
    let list: any[] = [];
    if (activeTab === "Positions") {
      list = positionFilter === "Active" ? positions : closedPositions;
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
    activity,
    positionFilter,
    searchQuery,
  ]);

  const stats = useMemo(() => {
    const totalPosValue = positions.reduce(
      (sum, p) => sum + (p.currentValue || 0),
      0
    );
    const wins = closedPositions
      .map(p => p.cashPnl || 0)
      .concat(
        activity
          .filter((a: any) => a.side === "SELL")
          .map((a: any) => a.usdcSize || 0)
      );
    const biggestWin = wins.length ? Math.max(...wins, 0) : 0;

    return {
      totalPosValue,
      biggestWin: biggestWin > 0 ? formatCurrency(biggestWin) : "—",
      trades: tradedCount || positions.length + closedPositions.length,
    };
  }, [positions, closedPositions, activity, tradedCount]);

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
              href="/prediction"
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
            onClick={() => {
              if (!owner) return toast.error("Connect your wallet first");
              if (!managerId)
                return toast.error("No Predict account to withdraw from yet");
              setWithdrawAmount("");
              setWithdrawOpen(true);
            }}
            className="w-full bg-[#02DA8B] hover:bg-[#02DA8B]/90 text-black border-none font-bold h-10 text-xs transition-all active:scale-[0.98]"
          >
            Withdraw to Wallet
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
                      : "Not connected"}
                  </span>
                  <div className="flex items-center gap-1.5 ml-1.5 border-l border-white/10 pl-1.5">
                    <button
                      className="hover:text-white cursor-pointer transition-colors p-0.5"
                      title="Copy Address"
                      onClick={handleCopyAddress}
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
                      totalPnl > 0.004
                        ? "text-[#02DA8B]"
                        : totalPnl < -0.004
                          ? "text-red-500"
                          : "text-[#6B7280]"
                    )}
                  >
                    {totalPnl > 0.004 ? "+" : ""}
                    {formatCurrency(totalPnl)}
                  </div>
                  <div className="text-[10px] font-bold text-[#6B7280] uppercase tracking-widest">
                    Realized + Unrealized
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
              {plHistory.length === 0 ? (
                <div className="h-full w-full flex items-center justify-center text-[#6B7280] text-xs font-medium">
                  No realized cashflow in this window yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={plHistory}>
                    <defs>
                      <linearGradient id="colorPl" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor="#02DA8B"
                          stopOpacity={0.2}
                        />
                        <stop
                          offset="95%"
                          stopColor="#02DA8B"
                          stopOpacity={0}
                        />
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
              )}
            </div>
          </div>
        </div>

        {/* Bottom Section: Tabs & List */}
        <div className="mt-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/5 mb-6">
            <div className="flex gap-8">
              {(["Positions", "Activity"] as const).map(tab => (
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

          {filteredData.length === 0 ? (
            <div className=" border border-white/5 rounded-2xl p-12 md:p-20 flex flex-col items-center justify-center text-center backdrop-blur-[1px]">
              <div className="h-16 w-16 bg-[#02DA8B]/5 rounded-full flex items-center justify-center mb-6 border border-[#02DA8B]/10">
                <Inbox className="h-8 w-8 text-[#02DA8B] opacity-20" />
              </div>
              <div className="space-y-3 mb-8">
                <h3 className="text-lg font-bold text-white tracking-tight">
                  {owner
                    ? `No ${activeTab.toLowerCase()} found`
                    : "Wallet not connected"}
                </h3>
                <p className="text-[#6B7280] font-medium text-xs max-w-xs mx-auto leading-relaxed">
                  {!owner
                    ? "Connect your wallet to see your positions, activity and P&L."
                    : searchQuery
                      ? "No results found matching your search."
                      : `You don't have any ${activeTab.toLowerCase()} yet.`}
                </p>
              </div>
              <Link href="/prediction" className="w-full sm:w-auto">
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
                      key={pos.oracleId + i}
                      pos={pos}
                      formatCurrency={formatCurrency}
                      onSell={openRedeemModal}
                      onShare={handleSharePosition}
                    />
                  ) : (
                    <ClosedPositionCard
                      key={pos.oracleId + i}
                      pos={pos}
                      formatCurrency={formatCurrency}
                      onShare={handleSharePosition}
                      onRedeem={doRedeem}
                      isRedeeming={isRedeeming}
                    />
                  )
                )}

              {activeTab === "Activity" &&
                filteredData.map((act: any, i: number) => (
                  <ActivityCard
                    key={act.key || i}
                    act={act}
                    formatCurrency={formatCurrency}
                  />
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Withdraw / cash-out modal */}
      <ResponsiveModal open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <ResponsiveModalContent className="bg-[#16181C] border-white/10 text-white">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>Withdraw to Wallet</ResponsiveModalTitle>
            <ResponsiveModalDescription className="text-[#6B7280]">
              Move dUSDC from your Predict account back to your connected wallet.
            </ResponsiveModalDescription>
          </ResponsiveModalHeader>

          <div className="px-4 md:px-0 space-y-4 py-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#6B7280] font-medium">Available cash</span>
              <span className="text-white font-bold tabular-nums">
                {formatCurrency(cashBalance)}
              </span>
            </div>
            <div className="relative">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={withdrawAmount}
                onChange={e => setWithdrawAmount(e.target.value)}
                className="bg-white/5 border-white/10 h-12 pr-16 text-lg font-bold tabular-nums"
              />
              <button
                onClick={() => setWithdrawAmount(String(cashBalance))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase text-[#02DA8B] hover:text-[#02DA8B]/80"
              >
                Max
              </button>
            </div>
          </div>

          <ResponsiveModalFooter>
            <Button
              onClick={handleSubmitWithdraw}
              disabled={isWithdrawing || !(Number(withdrawAmount) > 0)}
              className="w-full bg-[#02DA8B] hover:bg-[#02DA8B]/90 text-black border-none font-bold h-11 text-sm transition-all active:scale-[0.98] disabled:opacity-60"
            >
              {isWithdrawing ? "Withdrawing…" : "Confirm Withdrawal"}
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>

      {/* Partial-redeem modal for unsettled (live) positions */}
      <ResponsiveModal
        open={!!redeemTarget}
        onOpenChange={open => {
          if (!open) {
            setRedeemTarget(null);
            setRedeemQty("");
          }
        }}
      >
        <ResponsiveModalContent className="bg-[#16181C] border-white/10 text-white">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>Redeem Contracts</ResponsiveModalTitle>
            <ResponsiveModalDescription className="text-[#6B7280]">
              {redeemTarget
                ? `Sell ${redeemTarget.outcome} contracts of "${redeemTarget.title}" back to the vault.`
                : ""}
            </ResponsiveModalDescription>
          </ResponsiveModalHeader>

          {redeemTarget && (
            <div className="px-4 md:px-0 space-y-4 py-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#6B7280] font-medium">
                  Your position
                </span>
                <span className="text-white font-bold tabular-nums">
                  {Number(redeemTarget.size).toFixed(2)} contracts
                </span>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={redeemQty}
                  onChange={e => setRedeemQty(e.target.value)}
                  className="bg-white/5 border-white/10 h-12 pr-16 text-lg font-bold tabular-nums"
                />
                <button
                  onClick={() => setRedeemQty(redeemTarget.size)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase text-[#02DA8B] hover:text-[#02DA8B]/80"
                >
                  Max
                </button>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#6B7280] font-medium">
                  Est. proceeds
                </span>
                <span className="text-white font-bold tabular-nums">
                  {formatCurrency(
                    Math.max(0, Number(redeemQty) || 0) *
                      (redeemTarget.curPrice || 0)
                  )}
                </span>
              </div>
              <p className="text-[10px] text-[#6B7280] leading-relaxed">
                Live markets fill at the current vault bid, so the final amount
                may differ slightly from the estimate.
              </p>
            </div>
          )}

          <ResponsiveModalFooter>
            <Button
              onClick={handleSubmitRedeem}
              disabled={isRedeeming || !(Number(redeemQty) > 0)}
              className="w-full bg-[#02DA8B] hover:bg-[#02DA8B]/90 text-black border-none font-bold h-11 text-sm transition-all active:scale-[0.98] disabled:opacity-60"
            >
              {isRedeeming ? "Redeeming…" : "Confirm Redeem"}
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </div>
  );
}
