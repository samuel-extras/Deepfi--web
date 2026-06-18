"use client";

/** Small presentational primitives shared by the account tables. */
import { cn } from "@/lib/utils";

export function Th({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: boolean;
}) {
  return (
    <th
      className={cn(
        "px-4 py-2 text-[11px] font-normal text-nav-inactive whitespace-nowrap",
        right ? "text-right" : "text-left"
      )}
    >
      {children}
    </th>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-8 text-center text-xs text-nav-inactive">
      {children}
    </div>
  );
}
