"use client";

/**
 * Margin position card — oracle-priced risk ratio with liquidation gauge,
 * equity/debt/leverage, and the collateral & loan management form
 * (deposit / withdraw / borrow / repay).
 */
import { useState } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { Button } from "@/components/ui/button";
import { formatAmount } from "@/lib/sui/deepbookSpot";
import {
  effectiveLeverage,
  getMarginPoolMeta,
  liquidationPrice,
  maxAdditionalBorrowQuote,
  maxLeverage,
  type MarginPosition,
} from "@/lib/sui/deepbookMargin";
import { useWalletBalances } from "@/hooks/useDeepBookSpot";
import {
  useMarginActions,
  useMarginManager,
  useMarginPoolStats,
  useMarginSnapshot,
  useRiskParams,
  type MarginSide,
} from "@/hooks/useDeepBookMargin";

const SUI_GAS_RESERVE = 0.3;

type ActionKind = "deposit" | "withdraw" | "borrow" | "repay";

export default function MarginPositionCard({
  poolKey,
  midPrice,
}: {
  poolKey: string;
  midPrice: number | null;
}) {
  const pool = getMarginPoolMeta(poolKey);
  const address = useCurrentAccount()?.address;
  const { managerId } = useMarginManager(poolKey);
  const { data: snap, isLoading } = useMarginSnapshot(poolKey);
  const { data: risk } = useRiskParams(poolKey);
  const { data: poolStats } = useMarginPoolStats(poolKey);
  const { data: walletBal } = useWalletBalances();
  const actions = useMarginActions(poolKey);

  const [kind, setKind] = useState<ActionKind>("deposit");
  const [side, setSide] = useState<MarginSide>("quote");
  const [amount, setAmount] = useState("");

  if (!address || !managerId) {
    return null; // the ticket handles connect/create CTAs
  }

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

  const borrowHeadroomQuote = risk
    ? maxAdditionalBorrowQuote(pos, price, risk.minBorrow)
    : 0;

  const amountNum = parseFloat(amount) || 0;
  const coinOf = (s: MarginSide) => (s === "base" ? pool.base : pool.quote);

  const maxFor = (k: ActionKind, s: MarginSide): number => {
    const bal = s === "base" ? snap?.balances.base ?? 0 : snap?.balances.quote ?? 0;
    const debt = s === "base" ? pos.baseDebt : pos.quoteDebt;
    switch (k) {
      case "deposit": {
        const w = walletBal?.[coinOf(s)] ?? 0;
        return coinOf(s) === "SUI" ? Math.max(0, w - SUI_GAS_RESERVE) : w;
      }
      case "withdraw":
        return bal; // risk gate enforced on-chain (min withdraw ratio)
      case "borrow": {
        const headroom =
          s === "quote" ? borrowHeadroomQuote : price > 0 ? borrowHeadroomQuote / price : 0;
        const liquidity =
          s === "base" ? poolStats?.base.available ?? 0 : poolStats?.quote.available ?? 0;
        return Math.max(0, Math.min(headroom, liquidity));
      }
      case "repay":
        return Math.min(debt, bal);
    }
  };

  const disabledReason = (() => {
    if (kind === "repay") {
      const debt = side === "base" ? pos.baseDebt : pos.quoteDebt;
      if (debt <= 1e-9) return `No ${coinOf(side)} debt to repay`;
    }
    if (kind === "borrow" && hasDebt) {
      const otherDebt = side === "base" ? pos.quoteDebt : pos.baseDebt;
      if (otherDebt > 1e-9)
        return `Repay your ${coinOf(side === "base" ? "quote" : "base")} loan first (one side at a time)`;
    }
    if (amountNum <= 0) return "Enter an amount";
    if (amountNum > maxFor(kind, side) + 1e-9)
      return `Max ${formatAmount(maxFor(kind, side), 6)} ${coinOf(side)}`;
    return null;
  })();

  const run = async () => {
    if (disabledReason && !(kind === "repay" && amountNum === 0)) return;
    const max = maxFor(kind, side);
    if (kind === "deposit") await actions.depositCollateral(side, amountNum);
    else if (kind === "withdraw") await actions.withdrawCollateral(side, amountNum);
    else if (kind === "borrow") await actions.borrow(side, amountNum);
    else
      await actions.repay(side, amountNum >= max - 1e-9 ? undefined : amountNum);
    setAmount("");
  };

  const riskTone =
    rr == null
      ? "text-muted-foreground"
      : risk && rr <= risk.liquidation * 1.05
        ? "text-rose-400"
        : risk && rr < risk.minBorrow
          ? "text-amber-400"
          : "text-emerald-400";

  // gauge: liquidation .. 2.5+ mapped to 0..100
  const gaugePct =
    rr == null || !risk
      ? 100
      : Math.max(2, Math.min(100, ((rr - risk.liquidation) / (2.5 - risk.liquidation)) * 100));

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h3 className="text-sm font-semibold text-foreground">
          Margin position · {pool.label}
        </h3>
        <span className="text-[11px] text-muted-foreground">
          max {risk ? formatAmount(maxLeverage(risk.minBorrow), 1) : "—"}x ·{" "}
          borrow APR {pool.base} {formatAmount(poolStats?.base.borrowAprPct, 1)}% /{" "}
          {pool.quote} {formatAmount(poolStats?.quote.borrowAprPct, 1)}%
        </span>
      </div>

      {isLoading && !snap ? (
        <div className="p-4 text-sm text-muted-foreground">Loading position…</div>
      ) : (
        <>
          {/* stats */}
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label={`Equity (${pool.quote})`} value={formatAmount(equity, 4)} />
            <Stat label={`Debt (${pool.quote})`} value={formatAmount(debts, 4)} />
            <Stat
              label="Risk ratio"
              value={rr == null ? "∞ (no debt)" : formatAmount(rr, 3)}
              tone={riskTone}
            />
            <Stat
              label="Leverage"
              value={Number.isFinite(lev) ? `${formatAmount(lev, 2)}x` : "—"}
            />
            <Stat
              label="Est. liq. price"
              value={liqPx != null ? formatAmount(liqPx, 6) : "—"}
            />
            <Stat
              label={`Borrowable (${pool.quote})`}
              value={formatAmount(borrowHeadroomQuote, 2)}
            />
          </div>

          {/* risk gauge */}
          {hasDebt && risk && (
            <div className="px-4 pb-3">
              <div className="relative h-2 overflow-hidden rounded bg-muted/40">
                <div
                  className={`absolute inset-y-0 left-0 ${
                    rr != null && rr <= risk.liquidation * 1.05
                      ? "bg-rose-500"
                      : rr != null && rr < risk.minBorrow
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                  }`}
                  style={{ width: `${gaugePct}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                <span>liquidation {risk.liquidation}</span>
                <span>borrow min {risk.minBorrow}</span>
                <span>withdraw min {risk.minWithdraw}</span>
              </div>
            </div>
          )}

          {/* account funds */}
          <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
            Free in account: {formatAmount(snap?.balances.base, 4)} {pool.base} ·{" "}
            {formatAmount(snap?.balances.quote, 4)} {pool.quote}
            {(snap?.balances.deep ?? 0) > 0 && <> · {formatAmount(snap?.balances.deep, 2)} DEEP</>}
            {pos.baseDebt > 0 && (
              <span className="text-rose-400"> · owes {formatAmount(pos.baseDebt, 4)} {pool.base}</span>
            )}
            {pos.quoteDebt > 0 && (
              <span className="text-rose-400"> · owes {formatAmount(pos.quoteDebt, 4)} {pool.quote}</span>
            )}
          </div>

          {/* manage form */}
          <div className="flex flex-wrap items-center gap-2 border-t border-border p-4">
            <div className="flex gap-1">
              {(["deposit", "withdraw", "borrow", "repay"] as const).map(k => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={`rounded-md border px-2.5 py-1.5 text-xs capitalize transition-colors ${
                    kind === k
                      ? "border-emerald-600 bg-emerald-600/10 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {(["base", "quote"] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setSide(s)}
                  className={`rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                    side === s
                      ? "border-border bg-muted/40 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {coinOf(s)}
                </button>
              ))}
            </div>
            <div className="flex min-w-[180px] flex-1 items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5">
              <input
                inputMode="decimal"
                placeholder={
                  kind === "repay" ? "amount (empty = repay all)" : "0.0"
                }
                value={amount}
                onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                className="w-full bg-transparent text-sm text-foreground outline-none"
              />
              <button
                className="text-[10px] text-muted-foreground hover:text-foreground"
                onClick={() => setAmount(String(maxFor(kind, side)))}
              >
                MAX
              </button>
            </div>
            <Button
              type="button"
              size="sm"
              disabled={
                actions.isPending ||
                (kind === "repay"
                  ? (side === "base" ? pos.baseDebt : pos.quoteDebt) <= 1e-9
                  : !!disabledReason)
              }
              onClick={run}
            >
              {actions.isPending
                ? actions.status ?? "Working…"
                : kind === "repay" && amountNum === 0
                  ? "Repay all"
                  : kind[0].toUpperCase() + kind.slice(1)}
            </Button>
            {disabledReason && amountNum > 0 && (
              <span className="text-xs text-amber-400">{disabledReason}</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-sm font-semibold ${tone ?? "text-foreground"}`}>
        {value}
      </div>
    </div>
  );
}
