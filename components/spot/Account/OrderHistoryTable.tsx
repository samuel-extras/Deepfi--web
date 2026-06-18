"use client";

/** Order-history tab — recent orders for the pool, streamed from the indexer. */
import { cn } from "@/lib/utils";
import { formatAmount, getSpotPool } from "@/lib/deepbook/core";
import { useBalanceManager, useDeepBookAddress } from "@/lib/deepbook/hooks/account";
import { useOrderHistory } from "@/lib/deepbook/api/queries";
import { Th, EmptyState } from "./parts";
import NeedsAccount from "./NeedsAccount";

export default function OrderHistoryTable({ poolKey }: { poolKey: string }) {
  const pool = getSpotPool(poolKey);
  const address = useDeepBookAddress();
  const { managerId } = useBalanceManager();
  const history = useOrderHistory(poolKey, managerId, 50);

  if (!address || !managerId)
    return <NeedsAccount label="Connect and create a trading account to see order history." />;

  const rows = history.data ?? [];
  if (history.isLoading) return <EmptyState>Loading history…</EmptyState>;
  if (rows.length === 0) return <EmptyState>No orders yet on {pool.label}.</EmptyState>;

  const statusColor = (s: string) =>
    s === "Filled"
      ? "text-primary"
      : s === "Canceled" || s === "Expired"
        ? "text-nav-inactive"
        : "text-white";

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-border/60">
          <Th>Time</Th>
          <Th>Side</Th>
          <Th right>Price ({pool.quote})</Th>
          <Th right>Size ({pool.base})</Th>
          <Th right>Filled</Th>
          <Th right>Status</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map(o => (
          <tr key={o.order_id} className="border-b border-border/40 last:border-0 hover:bg-[#1A1D1F]/50">
            <td className="px-4 py-2 text-nav-inactive whitespace-nowrap">
              {new Date(o.placed_at).toLocaleString()}
            </td>
            <td className={cn("px-4 py-2 font-medium", o.type === "buy" ? "text-primary" : "text-[#FF4D4F]")}>
              {o.type === "buy" ? "Buy" : "Sell"}
            </td>
            <td className="px-4 py-2 text-right text-white tabular-nums">{formatAmount(o.price, 6)}</td>
            <td className="px-4 py-2 text-right text-white tabular-nums">
              {formatAmount(o.original_quantity, 4)}
            </td>
            <td className="px-4 py-2 text-right text-nav-inactive tabular-nums">
              {o.filled_quantity > 0 ? formatAmount(o.filled_quantity, 4) : "—"}
            </td>
            <td className={cn("px-4 py-2 text-right", statusColor(o.current_status))}>
              {o.current_status}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
