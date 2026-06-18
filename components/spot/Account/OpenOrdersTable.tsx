"use client";

/** Open-orders tab — resting orders for the pool with cancel + claim-settled. */
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { formatAmount, getSpotPool } from "@/lib/deepbook/core";
import { GTC_CUTOFF_MS } from "@/lib/deepbook/domain/constants";
import { useBalanceManager, useDeepBookAddress } from "@/lib/deepbook/hooks/account";
import { useOpenOrders } from "@/lib/deepbook/hooks/reads";
import { useSpotActions } from "@/lib/deepbook/hooks/useSpotActions";
import { Th, EmptyState } from "./parts";
import NeedsAccount from "./NeedsAccount";

export default function OpenOrdersTable({ poolKey }: { poolKey: string }) {
  const pool = getSpotPool(poolKey);
  const address = useDeepBookAddress();
  const { managerId } = useBalanceManager();
  const { data, isLoading } = useOpenOrders(poolKey);
  const { cancelOrder, cancelAllOrders, claimSettled, isPending } = useSpotActions(poolKey);

  if (!address || !managerId)
    return <NeedsAccount label="Connect and create a trading account to see open orders." />;

  const orders = data?.orders ?? [];
  const settled = data?.settled;
  const hasSettled =
    !!settled && (settled.base > 1e-9 || settled.quote > 1e-9 || settled.deep > 1e-9);

  return (
    <div>
      {(hasSettled || orders.length > 1) && (
        <div className="flex items-center justify-end gap-2 border-b border-border/60 px-4 py-2">
          {hasSettled && (
            <Button
              variant="outline"
              size="sm"
              type="button"
              disabled={isPending}
              onClick={() => claimSettled()}
              className="h-6 rounded-full text-[11px]"
            >
              Claim settled ({formatAmount(settled!.base)} {pool.base} / {formatAmount(settled!.quote)} {pool.quote})
            </Button>
          )}
          {orders.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              type="button"
              disabled={isPending}
              onClick={() => cancelAllOrders()}
              className="h-6 rounded-full text-[11px]"
            >
              Cancel all
            </Button>
          )}
        </div>
      )}
      {isLoading ? (
        <EmptyState>Loading orders…</EmptyState>
      ) : orders.length === 0 ? (
        <EmptyState>No open orders on {pool.label}.</EmptyState>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/60">
              <Th>Market</Th>
              <Th>Side</Th>
              <Th right>Price ({pool.quote})</Th>
              <Th right>Size ({pool.base})</Th>
              <Th right>Filled</Th>
              <Th right>Expires</Th>
              <Th right>&nbsp;</Th>
            </tr>
          </thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.orderId} className="border-b border-border/40 last:border-0 hover:bg-[#1A1D1F]/50">
                <td className="px-4 py-2 text-white">{pool.base}/{pool.quote}</td>
                <td className={cn("px-4 py-2 font-medium", o.isBid ? "text-primary" : "text-[#FF4D4F]")}>
                  {o.isBid ? "Buy" : "Sell"}
                </td>
                <td className="px-4 py-2 text-right text-white tabular-nums">{formatAmount(o.price, 6)}</td>
                <td className="px-4 py-2 text-right text-white tabular-nums">{formatAmount(o.quantity, 6)}</td>
                <td className="px-4 py-2 text-right text-nav-inactive tabular-nums">
                  {o.filled > 0 ? `${formatAmount((o.filled / o.quantity) * 100, 1)}%` : "—"}
                </td>
                <td className="px-4 py-2 text-right text-nav-inactive">
                  {o.expireTimestamp > GTC_CUTOFF_MS ? "GTC" : new Date(o.expireTimestamp).toLocaleString()}
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    disabled={isPending}
                    onClick={() => cancelOrder(o.orderId)}
                    className="text-nav-inactive hover:text-[#FF4D4F] disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
