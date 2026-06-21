/*eslint-disable*/
import React, { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ActivityCardProps {
  act: any;
  formatCurrency: (val?: number) => string;
}

export const ActivityCard: React.FC<ActivityCardProps> = ({
  act,
  formatCurrency,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div
      className={cn(
        "transition-all duration-300 border border-white/5",
        isExpanded
          ? "bg-white/4 rounded-2xl p-4 shadow-md border-white/10"
          : "bg-[#1E2024]/40 rounded-2xl p-4 hover:bg-white/2"
      )}
    >
      <div
        className="flex gap-4 items-start cursor-pointer transition-all active:scale-[0.99]"
        // onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Thumbnail - Event Image prioritization */}
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#1E2024]">
          {act.image || act.icon ? (
            <img
              src={act.image || act.icon}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className={cn(
                "h-full w-full flex items-center justify-center bg-gradient-to-br",
                act.side === "BUY"
                  ? "from-[#02DA8B]/20 to-[#02DA8B]/5"
                  : "from-[#FF5C5C]/20 to-[#FF5C5C]/5"
              )}
            >
              {act.side === "BUY" ? (
                <ArrowUpRight className="h-5 w-5 text-[#02DA8B]" />
              ) : (
                <ArrowDownRight className="h-5 w-5 text-[#FF5C5C]" />
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-white/90 leading-snug line-clamp-1 mb-1">
            {act.title || "Market Activity"}
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <span
              className={cn(
                "font-black uppercase tracking-tight",
                act.side === "BUY" ? "text-[#02DA8B]" : "text-[#FF5C5C]"
              )}
            >
              {act.side}
            </span>
            <span className="text-white font-medium uppercase">
              {act.outcome || "Yes"}
            </span>
            {!isExpanded && (
              <span className="text-[#6B7280] flex items-center gap-1.5 opacity-80">
                • {act.size} shares @{" "}
                {act.price ? (act.price * 100).toFixed(1) : "0"}¢ •{" "}
                {new Date(act.timestamp * 1000).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        {/* Price / Toggle Container */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <div className="text-sm font-black text-white tabular-nums tracking-tight">
            {formatCurrency(act.usdcSize)}
          </div>
          {/* <div className="flex items-center gap-1 opacity-40">
            {isExpanded ? (
              <ChevronUp className="h-3 w-3 text-white" />
            ) : (
              <ChevronDown className="h-3 w-3 text-white" />
            )}
          </div> */}
        </div>
      </div>

      {/* Expanded Details Section */}
      {isExpanded && (
        <div className="mt-5 pt-5 border-t border-white/5 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="space-y-1.5">
              <div className="text-[10px] text-[#6B7280] font-bold uppercase tracking-wider opacity-60">
                Type
              </div>
              <div className="inline-flex bg-white/5 text-white text-[9px] font-black px-2.5 py-1 rounded-md uppercase tracking-tighter">
                {act.type || "TRADE"}
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="text-[10px] text-[#6B7280] font-bold uppercase tracking-wider opacity-60">
                Network
              </div>
              <div className="flex items-center gap-1.5 text-xs text-white font-medium">
                <div className="h-1.5 w-1.5 rounded-full bg-[#02DA8B] shadow-[0_0_8px_#02DA8B]" />
                Polygon
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="text-[10px] text-[#6B7280] font-bold uppercase tracking-wider opacity-60">
                Quantity
              </div>
              <div className="text-white text-sm font-mono font-bold tracking-tight">
                {act.size} Shares
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="text-[10px] text-[#6B7280] font-bold uppercase tracking-wider opacity-60">
                Avg. Price
              </div>
              <div className="text-white text-sm font-mono font-bold tracking-tight">
                {act.price ? (act.price * 100).toFixed(1) : "0"}¢
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between bg-white/[0.02] p-3 rounded-xl border border-white/5">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-white/5 flex items-center justify-center">
                <Clock className="h-3.5 w-3.5 text-[#6B7280]" />
              </div>
              <div className="flex flex-col">
                <div className="text-[10px] text-[#6B7280] font-medium leading-none mb-1">
                  Execution Time
                </div>
                <div className="text-[11px] text-white font-bold leading-none">
                  {new Date(act.timestamp * 1000).toLocaleString()}
                </div>
              </div>
            </div>
            <a
              href={`https://polygonscan.com/tx/${act.transactionHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-[#02DA8B]/10 hover:bg-[#02DA8B]/20 py-2 px-4 rounded-lg text-[#02DA8B] text-[10px] font-black uppercase transition-all active:scale-95"
            >
              Explorer
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
