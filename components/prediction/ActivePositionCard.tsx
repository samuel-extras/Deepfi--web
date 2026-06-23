/*eslint-disable*/
import React from "react";
import { Button } from "@/components/ui/button";
import { Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface ActivePositionCardProps {
  pos: any;
  formatCurrency: (val?: number) => string;
  onSell: (pos: any) => void;
  onShare: (pos: any) => void;
}

export const ActivePositionCard: React.FC<ActivePositionCardProps> = ({
  pos,
  formatCurrency,
  onSell,
  onShare,
}) => {
  const cost =
    pos.initialValue || (pos.avgPrice || 0) * (parseFloat(pos.size) || 0);
  const pnl = pos.cashPnl ?? pos.currentValue - cost;
  const pnlPercent = pos.percentPnl ?? (cost !== 0 ? (pnl / cost) * 100 : 0);

  // Constants to prevent sign collision (e.g., +-$0.00)
  const isPositive = pnl > 0.004; // 0.005 would round to $0.01
  const isNeutral = Math.abs(pnl) < 0.005;

  // Predict positions link straight to their single-market page; fall back to
  // the legacy events route only when no explicit href is supplied.
  const slugOrId = pos.eventSlug || pos.slug;
  const href = pos.href || `/prediction/events/${slugOrId}`;

  return (
    <div className="bg-[#1E2024]/40 border border-white/5 rounded-2xl p-3 backdrop-blur-md group hover:border-[#02DA8B]/20 transition-all shadow-md">
      <div className="space-y-6">
        {/* Linkable Content Area */}
        <Link href={href} className="block space-y-6 group/link">
          {/* Event Header */}
          <div className="flex gap-4 items-start">
            {pos.image || pos.icon ? (
              <img
                src={pos.image || pos.icon}
                className="h-11 w-11 rounded-xl object-cover"
                alt=""
              />
            ) : (
              <div className="h-11 w-11 bg-white/5 rounded-xl flex items-center justify-center shrink-0">
                <Briefcase className="h-5 w-5 text-[#6B7280]" />
              </div>
            )}
            <div className="min-w-0 pr-2">
              <div className="text-[9px] text-[#6B7280] font-bold uppercase tracking-widest truncate opacity-60 mb-0.5 group-hover/link:text-[#02DA8B] transition-colors">
                {pos.eventTitle ||
                  (pos.eventSlug || "POLITICS")
                    .replace(/-/g, " ")
                    .replace(/\b\w/g, (c: string) => c.toUpperCase())}
              </div>
              <div className="text-[13px] font-bold text-white/90 leading-snug line-clamp-2 group-hover/link:text-white transition-colors">
                {pos.title}
              </div>
            </div>
          </div>

          {/* Info Bar */}
          <div className="flex justify-between items-start">
            <div className="space-y-1 text-left">
              <div className="text-xl font-bold text-white uppercase tracking-tight">
                {pos.outcome || (pos.outcomeIndex === 0 ? "Yes" : "No")}
              </div>
              <div className="text-[11px] text-[#6B7280] font-medium">
                {parseFloat(pos.size || "0").toFixed(2)} shares @{" "}
                {((pos.avgPrice || 0) * 100).toFixed(1)}¢
              </div>
            </div>
            <div className="text-right space-y-1">
              <div className="text-xl font-bold text-white tabular-nums">
                {formatCurrency(pos.currentValue)}
              </div>
              <div className="text-[10px] text-[#6B7280] font-medium">
                Cost: {formatCurrency(cost)}
              </div>
            </div>
          </div>
        </Link>

        {/* Return Section */}
        <div className="flex justify-between items-end pt-2">
          <div className="space-y-1.5 text-left">
            <div className="text-[10px] text-[#6B7280] font-bold uppercase tracking-wider opacity-60">
              Gain / Loss
            </div>
            <div
              className={cn(
                "text-sm font-bold flex items-center gap-1.5",
                isNeutral
                  ? "text-[#6B7280]"
                  : isPositive
                    ? "text-[#02DA8B]"
                    : "text-[#FF5C5C]"
              )}
            >
              <span>
                {isPositive ? "+" : ""}
                {formatCurrency(pnl)}
              </span>
              <span className="opacity-60 text-[11px]">
                ({isPositive ? "+" : ""}
                {pnlPercent.toFixed(2)}%)
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => onShare(pos)}
              className="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-6 h-9 rounded-xl font-bold text-xs transition-all active:scale-95"
            >
              Share
            </Button>
            <Button
              onClick={() => onSell(pos)}
              className="bg-[#FF5C5C] hover:bg-transparent hover:text-[#FF5C5C] lg:hover:bg-transparent lg:hover:text-[#FF5C5C] border border-[#FF5C5C] text-white px-8 h-9 rounded-xl font-bold text-xs transition-all active:scale-95 shadow-lg shadow-[#FF5C5C]/10"
            >
              Sell
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
