/*eslint-disable*/
import React from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Briefcase, Share2, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClosedPositionCardProps {
  pos: any;
  formatCurrency: (val?: number) => string;
  onShare: (pos: any) => void;
  onRedeem?: (pos: any) => void;
  isRedeeming?: boolean;
}

export const ClosedPositionCard: React.FC<ClosedPositionCardProps> = ({
  pos,
  formatCurrency,
  onShare,
  onRedeem,
  isRedeeming,
}) => {
  const closedDate = pos.timestamp ? new Date(pos.timestamp * 1000) : null;
  // For settled-but-unredeemed positions the headline P&L is the payout still
  // on the table (cashPnl); otherwise use the booked realizedPnl.
  const headlinePnl = pos.redeemable ? (pos.cashPnl ?? 0) : (pos.realizedPnl ?? 0);
  const isWon = headlinePnl > 0;
  const canRedeem = pos.redeemable && typeof onRedeem === "function";

  return (
    <div className="bg-[#1E2024]/40 border border-white/5 rounded-md p-3  group hover:border-white/10 transition-all shadow-xl">
      <div className="space-y-6">
        {/* Event Header */}
        <div className="flex gap-4 items-start">
          {pos.image || pos.icon ? (
            <img
              src={pos.image || pos.icon}
              className="h-11 w-11 rounded-xl  object-cover"
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
                {pos.eventTitle ||
                  (pos.eventSlug || "POLITICS")
                    .replace(/-/g, " ")
                    .replace(/\b\w/g, (c: string) => c.toUpperCase())}
              </div>
              <span
                className={cn(
                  "text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-tighter",
                  isWon
                    ? "bg-[#02DA8B]/10 text-[#02DA8B]"
                    : "bg-[#FF5C5C]/10 text-[#FF5C5C]"
                )}
              >
                {isWon ? "Won" : "Lost"}
              </span>
            </div>
            <div className="text-[13px] font-bold text-white leading-snug line-clamp-2">
              {pos.title}
            </div>
          </div>
        </div>

        {/* Info Bar */}
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <div className="text-xl font-bold text-white uppercase tracking-tight">
              {pos.outcome || (pos.outcomeIndex === 0 ? "Yes" : "No")}
            </div>
            <div className="text-[11px] text-[#6B7280] font-medium">
              {pos.redeemable ? "Payout to Redeem" : "Realized P&L"}
            </div>
          </div>
          <div className="text-right space-y-1">
            <div
              className={cn(
                "text-xl font-bold tabular-nums",
                headlinePnl >= 0 ? "text-[#02DA8B]" : "text-[#FF5C5C]"
              )}
            >
              {headlinePnl >= 0 ? "+" : ""}
              {formatCurrency(headlinePnl)}
            </div>
            <div className="text-[10px] text-[#6B7280] font-medium">
              Return: {(pos.percentPnl || 0).toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Footer Section */}
        <div className="flex justify-between items-center pt-2 border-t border-white/5">
          <div className="flex items-center gap-1.5 text-[10px] text-[#6B7280] font-medium opacity-60">
            <Calendar className="h-3 w-3" />
            {closedDate
              ? format(closedDate, "MMM d, yyyy 'at' h:mm a")
              : "Finished"}
          </div>
          <div className="flex items-center gap-2">
            {canRedeem && (
              <Button
                onClick={() => onRedeem!(pos)}
                disabled={isRedeeming}
                className="bg-[#02DA8B] hover:bg-[#02DA8B]/90 text-black border-none px-6 h-8 rounded-full font-bold text-xs transition-all active:scale-95 disabled:opacity-60"
              >
                {isRedeeming ? "Redeeming…" : "Redeem"}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onShare(pos)}
              className="h-8 w-8 rounded-full bg-white/5 hover:bg-white/10 text-white transition-all active:scale-90"
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
