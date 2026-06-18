"use client";

/** Trades section with its own title header, for the stacked and large layouts. */
import { cn } from "@/lib/utils";
import TradesTab from "./TradesTab";
import { BookView } from "./types";
import BookViewMenu from "./BookViewMenu";

export default function TradesSection({
  poolKey,
  className,
  view,
  onViewChange,
}: {
  poolKey: string;
  className?: string;
  view?: BookView;
  onViewChange?: (v: BookView) => void;
}) {
  return (
    <div className={cn("flex flex-col min-h-0 overflow-hidden", className)}>
      <div className="flex items-center justify-between h-10 shrink-0 border-b border-border px-4">
        <span className="text-xs font-medium text-white">Trades</span>
        {view && onViewChange && (
          <BookViewMenu view={view} onViewChange={onViewChange} />
        )}
      </div>
      <TradesTab poolKey={poolKey} />
    </div>
  );
}
