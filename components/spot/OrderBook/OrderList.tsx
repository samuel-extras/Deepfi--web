"use client";

/** One side of the book — depth-shaded, click-to-fill price rows. */
import { cn } from "@/lib/utils";
import { formatAmount } from "@/lib/deepbook/core";
import { toDepthRows, type Level } from "@/lib/deepbook/domain/orderbook";

export default function OrderList({
  orders,
  type,
  maxAmount,
  sizeIn,
  priceDp,
  onPriceClick,
}: {
  orders: Level[];
  type: "bid" | "ask";
  maxAmount: number;
  sizeIn: "base" | "quote";
  priceDp: number;
  onPriceClick: (px: number) => void;
}) {
  const rows = toDepthRows(orders, sizeIn);
  const isAsk = type === "ask";

  return (
    <div className="space-y-[1px]">
      {(isAsk ? [...rows].reverse() : rows).map((o, i) => (
        <button
          key={`${type}-${i}`}
          onClick={() => onPriceClick(o.px)}
          className="relative block w-full px-4 py-[3px] text-left"
          title="Use this price"
        >
          <div
            className={cn(
              "absolute right-0 top-0 bottom-0 transition-all duration-300",
              isAsk ? "bg-[#FF4D4F20]" : "bg-primary/15"
            )}
            style={{ width: `${Math.min(100, (o.amount / maxAmount) * 100)}%` }}
          />
          <div className="relative grid grid-cols-3 text-xs">
            <span
              className={cn("tabular-nums", isAsk ? "text-[#FF4D4F]" : "text-primary")}
            >
              {formatAmount(o.px, priceDp)}
            </span>
            <span className="text-right text-white tabular-nums">
              {formatAmount(o.amount, 4)}
            </span>
            <span className="text-right text-nav-inactive tabular-nums">
              {formatAmount(o.total, 2)}
            </span>
          </div>
        </button>
      ))}
      {rows.length === 0 && (
        <div className="px-4 py-2 text-[11px] text-nav-inactive">
          No {type === "ask" ? "asks" : "bids"}
        </div>
      )}
    </div>
  );
}
