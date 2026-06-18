"use client";

/** Footer summary — order value, slippage (market orders), fees, setup hint. */
import { formatAmount } from "@/lib/deepbook/core";
import { InfoRow } from "./InfoRow";
import MaxSlippageControl from "./MaxSlippageControl";

export default function TicketSummary({
  orderValue,
  quoteLabel,
  whitelisted,
  takerFeePct,
  needCoin,
  showSetupNote,
  slippage,
  onSlippageChange,
  showSlippage,
}: {
  orderValue: number;
  quoteLabel: string;
  whitelisted: boolean;
  takerFeePct: number;
  needCoin: string;
  showSetupNote: boolean;
  slippage: number;
  onSlippageChange: (pct: number) => void;
  showSlippage: boolean;
}) {
  return (
    <div className="space-y-1.5 border-t border-border pt-3">
      <InfoRow
        label="Order Value"
        hint={`Notional value of this order, in ${quoteLabel}.`}
        value={
          orderValue > 0
            ? `${formatAmount(orderValue, 2)} ${quoteLabel}`
            : "—"
        }
      />
      {showSlippage && (
        <MaxSlippageControl slippage={slippage} onChange={onSlippageChange} />
      )}
      <InfoRow
        label="Fees"
        hint="Taker fee on the filled amount; resting limit (maker) orders pay less."
        value={
          whitelisted
            ? "0% (whitelisted pool)"
            : `~${takerFeePct}% taker · paid in ${needCoin}`
        }
      />
      {showSetupNote && (
        <p className="pt-1 text-[11px] leading-snug text-nav-inactive">
          One-time setup: a DeepBook BalanceManager (shared object) holds your
          trading funds across all pools.
        </p>
      )}
    </div>
  );
}
