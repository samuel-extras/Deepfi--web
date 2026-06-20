"use client";

/**
 * Open orders for the margin account (cancels route through pool_proxy).
 */

import { useActiveAccount } from "@/hooks/useActiveAccount";
import { Button } from "@/components/ui/button";
import { formatAmount } from "@/lib/sui/deepbookSpot";
import { getMarginPoolMeta } from "@/lib/sui/deepbookMargin";
import {
  useMarginActions,
  useMarginManager,
  useMarginSnapshot,
} from "@/hooks/useDeepBookMargin";

const GTC_CUTOFF_MS = 4_102_444_800_000;

export default function MarginOpenOrders({ poolKey }: { poolKey: string }) {
  const pool = getMarginPoolMeta(poolKey);
  const address = useActiveAccount()?.address;
  const { managerId } = useMarginManager(poolKey);
  const { data: snap, isLoading } = useMarginSnapshot(poolKey);
  const { cancelOrder, cancelAllOrders, claimSettled, isPending } =
    useMarginActions(poolKey);

  if (!address || !managerId) return null;

  const orders = snap?.orders ?? [];
  const settled = snap?.settled;
  const hasSettled =
    !!settled && (settled.base > 1e-9 || settled.quote > 1e-9 || settled.deep > 1e-9);

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h3 className="text-sm font-semibold text-foreground">
          Margin orders{orders.length ? ` (${orders.length})` : ""}
        </h3>
        <div className="flex items-center gap-2">
          {hasSettled && (
            <Button
              variant="outline"
              size="sm"
              type="button"
              disabled={isPending}
              onClick={() => claimSettled()}
              className="h-7 text-xs"
            >
              Claim settled ({formatAmount(settled!.base)} {pool.base} /{" "}
              {formatAmount(settled!.quote)} {pool.quote})
            </Button>
          )}
          {orders.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              type="button"
              disabled={isPending}
              onClick={() => cancelAllOrders()}
              className="h-7 text-xs"
            >
              Cancel all
            </Button>
          )}
        </div>
      </div>

      {isLoading && !snap ? (
        <div className="p-4 text-sm text-muted-foreground">Loading orders…</div>
      ) : orders.length === 0 ? (
        <div className="p-4 text-sm text-muted-foreground">
          No open margin orders on {pool.label}.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-normal">Side</th>
                <th className="px-4 py-2 text-right font-normal">Price ({pool.quote})</th>
                <th className="px-4 py-2 text-right font-normal">Size ({pool.base})</th>
                <th className="px-4 py-2 text-right font-normal">Filled</th>
                <th className="px-4 py-2 text-right font-normal">Expires</th>
                <th className="px-4 py-2 text-right font-normal" />
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.orderId} className="border-b border-border/50 last:border-0">
                  <td
                    className={`px-4 py-2 font-medium ${
                      o.isBid ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {o.isBid ? "Long" : "Short"}
                  </td>
                  <td className="px-4 py-2 text-right text-foreground">
                    {formatAmount(o.price, 6)}
                  </td>
                  <td className="px-4 py-2 text-right text-foreground">
                    {formatAmount(o.quantity, 6)}
                  </td>
                  <td className="px-4 py-2 text-right text-muted-foreground">
                    {o.filled > 0
                      ? `${formatAmount((o.filled / o.quantity) * 100, 1)}%`
                      : "—"}
                  </td>
                  <td className="px-4 py-2 text-right text-muted-foreground">
                    {o.expireTimestamp > GTC_CUTOFF_MS
                      ? "GTC"
                      : new Date(o.expireTimestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      disabled={isPending}
                      onClick={() => cancelOrder(o.orderId)}
                      className="text-xs text-muted-foreground hover:text-rose-400 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
