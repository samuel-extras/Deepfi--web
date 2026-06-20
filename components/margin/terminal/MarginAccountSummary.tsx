"use client";

/**
 * Margin account summary — sits in the spare grid column beside the margin
 * account tables (mirrors the spot AccountSummary). Surfaces the per-pool margin
 * account's health at a glance: equity, debt, risk ratio, est. liquidation
 * price, effective leverage, and borrow capacity. Per-side deposit / borrow /
 * repay lives in the Position tab.
 */
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import { formatAmount } from "@/lib/sui/deepbookSpot";
import {
  effectiveLeverage,
  getMarginPoolMeta,
  liquidationPrice,
  maxAdditionalBorrowQuote,
  maxLeverage,
  type MarginPosition,
} from "@/lib/sui/deepbookMargin";
import {
  useMarginManager,
  useMarginPoolStats,
  useMarginSnapshot,
  useRiskParams,
} from "@/hooks/useDeepBookMargin";
import Link from "next/link";

export default function MarginAccountSummary({
  poolKey,
  midPrice,
  className,
}: {
  poolKey: string;
  midPrice?: number | null;
  className?: string;
}) {
  const pool = getMarginPoolMeta(poolKey);
  const address = useActiveAccount()?.address;
  const { managerId } = useMarginManager(poolKey);
  const { data: snap } = useMarginSnapshot(poolKey);
  const { data: risk } = useRiskParams(poolKey);
  const { data: stats } = useMarginPoolStats(poolKey);

  const pos: MarginPosition = {
    baseAsset: snap?.baseAsset ?? 0,
    quoteAsset: snap?.quoteAsset ?? 0,
    baseDebt: snap?.baseDebt ?? 0,
    quoteDebt: snap?.quoteDebt ?? 0,
  };
  const price = snap?.currentPrice ?? midPrice ?? 0;
  const assets = pos.baseAsset * price + pos.quoteAsset;
  const debts = pos.baseDebt * price + pos.quoteDebt;
  const equity = assets - debts;
  const hasDebt = debts > 1e-9;
  const lev = effectiveLeverage(pos, price);
  const liqPx = risk ? liquidationPrice(pos, risk.liquidation) : null;
  const rr = snap?.riskRatio ?? null;
  const borrowable = risk
    ? maxAdditionalBorrowQuote(pos, price, risk.minBorrow)
    : 0;
  const openCount = snap?.orders.length ?? 0;
  const connected = !!address && !!managerId;

  const riskTone =
    rr == null
      ? "text-white"
      : risk && rr <= risk.liquidation * 1.05
        ? "text-[#FF4D4F]"
        : risk && rr < risk.minBorrow
          ? "text-[#FFB84D]"
          : "text-primary";

  return (
    <div
      className={cn(
        "flex flex-col gap-4 border-l border-t border-border bg-[#121417] p-4",
        className,
      )}
    >
      <Button
        asChild
        className="w-full rounded-full bg-primary text-[#121417] font-semibold hover:bg-primary/90"
      >
        <Link href="https://faucet.sui.io" target="_blank" rel="noreferrer">
          Deposit
        </Link>
      </Button>

      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold text-white">Account Health</h3>
        <SummaryRow
          label={`Equity (${pool.quote})`}
          value={connected ? formatAmount(equity, 4) : "—"}
          strong
        />
        <SummaryRow
          label={`Debt (${pool.quote})`}
          value={connected ? formatAmount(debts, 4) : "—"}
          tone={hasDebt ? "text-[#FF4D4F]" : undefined}
        />
        <SummaryRow
          label="Risk Ratio"
          value={connected ? (rr == null ? "∞" : formatAmount(rr, 3)) : "—"}
          tone={connected ? riskTone : undefined}
        />
        <Separator className="my-1 bg-border" />
        <SummaryRow
          label="Est. Liq. Price"
          value={connected && liqPx != null ? formatAmount(liqPx, 6) : "—"}
        />
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold text-white">Overview</h3>
        <SummaryRow
          label="Leverage"
          value={
            connected && Number.isFinite(lev) ? `${formatAmount(lev, 2)}x` : "—"
          }
        />
        <SummaryRow
          label={`Borrowable (${pool.quote})`}
          value={connected ? formatAmount(borrowable, 2) : "—"}
          tone={connected ? "text-primary" : undefined}
        />
        <SummaryRow
          label="Open Orders"
          value={connected ? String(openCount) : "—"}
        />
        <SummaryRow
          label="Max Leverage"
          value={
            risk ? `${formatAmount(maxLeverage(risk.minBorrow), 1)}x` : "—"
          }
        />
        <SummaryRow
          label="Borrow APR (base/quote)"
          value={
            stats
              ? `${formatAmount(stats.base.borrowAprPct, 1)}% / ${formatAmount(stats.quote.borrowAprPct, 1)}%`
              : "—"
          }
        />
      </div>

      <p className="mt-auto text-[10px] leading-snug text-nav-inactive">
        {connected
          ? "Equity & debt valued in quote at the oracle price. Deposit, borrow, and repay per side from the Position tab."
          : "Connect and create a margin account to see your account health."}
      </p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: string;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-nav-inactive">{label}</span>
      <span
        className={cn(
          "tabular-nums text-white",
          strong && "font-semibold",
          tone,
        )}
      >
        {value}
      </span>
    </div>
  );
}
