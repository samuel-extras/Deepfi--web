"use client";

/** Order-book section with its own title header + (optional) view menu, for the
 *  stacked and large layouts where there are no Order Book / Trades tabs. */
import { cn } from "@/lib/utils";
import OrderBookTab from "./OrderBookTab";
import BookViewMenu from "./BookViewMenu";
import type { BookView } from "./types";

export default function OrderBookSection({
  poolKey,
  onPriceClick,
  view,
  onViewChange,
  className,
}: {
  poolKey: string;
  onPriceClick: (px: number) => void;
  view?: BookView;
  onViewChange?: (v: BookView) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col min-h-0 overflow-hidden", className)}>
      <div className="flex items-center justify-between h-10 shrink-0 border-b border-border pl-4 pr-1">
        <span className="text-xs font-medium text-white">Order Book</span>
        {view && onViewChange && (
          <BookViewMenu view={view} onViewChange={onViewChange} />
        )}
      </div>
      <OrderBookTab poolKey={poolKey} onPriceClick={onPriceClick} />
    </div>
  );
}
