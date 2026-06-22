/*eslint-disable*/
import React from "react";
import { Button } from "@/components/ui/button";
import { Briefcase, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface OpenOrderCardProps {
  order: any;
  index: number;
  formatCurrency: (val?: number) => string;
  onCancel: (order: any) => void;
}

export const OpenOrderCard: React.FC<OpenOrderCardProps> = ({
  order,
  index,
  formatCurrency,
  onCancel,
}) => {
  const displayTitle = order.title || "Unknown Market";
  const displayFullTitle = order.outcome
    ? `${order.title} (${order.outcome})`
    : order.title;

  return (
    <div className="bg-[#1E2024]/40 border border-white/5 rounded-2xl p-4 backdrop-blur-md group hover:border-[#02DA8B]/20 transition-all shadow-xl flex flex-col justify-between min-h-[220px]">
      <div className="space-y-6">
        {/* Event Header */}
        <div className="flex gap-4 items-start">
          {order.image ? (
            <img
              src={order.image}
              className="h-11 w-11 rounded-xl object-cover"
              alt=""
            />
          ) : (
            <div className="h-11 w-11 bg-white/5 rounded-xl flex items-center justify-center shrink-0">
              <Briefcase className="h-5 w-5 text-[#6B7280]" />
            </div>
          )}
          <div className="min-w-0 pr-2">
            <div className="flex items-center gap-2 mb-0.5">
              <div className="text-[9px] text-[#6B7280] font-bold uppercase tracking-widest truncate opacity-60">
                {order.eventTitle ||
                  (order.eventSlug || "PENDING")
                    .replace(/-/g, " ")
                    .replace(/\b\w/g, (c: string) => c.toUpperCase())}
              </div>
              <div className="flex items-center gap-1.5 bg-[#02DA8B]/10 px-1.5 py-0.5 rounded">
                <span className="h-1 w-1 rounded-full bg-[#02DA8B] animate-pulse" />
                <span className="text-[8px] text-[#02DA8B] font-black uppercase tracking-tighter">
                  Open Order
                </span>
              </div>
            </div>
            <div className="text-[13px] font-bold text-white/90 leading-snug line-clamp-2">
              {displayTitle}
            </div>
          </div>
        </div>

        {/* Info Bar */}
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "text-xl font-bold uppercase tracking-tight",
                  order.side === "BUY" ? "text-[#02DA8B]" : "text-[#FF5C5C]"
                )}
              >
                {order.side}
              </div>
              <div className="text-xl font-bold text-white opacity-40">
                {order.outcome || "Yes"}
              </div>
            </div>
            <div className="text-[11px] text-[#6B7280] font-medium">
              {order.size} shares @ {(order.price * 100).toFixed(1)}¢
            </div>
          </div>
          <div className="text-right space-y-1">
            <div className="text-xl font-bold text-white tabular-nums">
              {formatCurrency(order.size * order.price)}
            </div>
            <div className="text-[10px] text-[#6B7280] font-bold uppercase tracking-wider opacity-60">
              Total Value
            </div>
          </div>
        </div>

        {/* Action Section */}
        <div className="flex justify-between items-end pt-2">
          <div className="space-y-1.5">
            <div className="text-[10px] text-[#6B7280] font-bold uppercase tracking-wider opacity-60">
              Status
            </div>
            <div className="text-sm font-bold text-white flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-[#6B7280]" />
              <span className="opacity-80">
                {order.filledSize > 0
                  ? `Partial (${((order.filledSize / order.size) * 100).toFixed(1)}%)`
                  : "Awaiting Fill"}
              </span>
            </div>
          </div>

          <Button
            onClick={() => onCancel({ ...order, fullTitle: displayFullTitle })}
            className="bg-[#FF5C5C] hover:bg-transparent hover:text-[#FF5C5C] lg:hover:bg-transparent lg:hover:text-[#FF5C5C] border border-[#FF5C5C] text-white px-8 h-9 rounded-xl font-bold text-xs transition-all active:scale-95 shadow-lg shadow-[#FF5C5C]/10"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};
