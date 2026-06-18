"use client";

/**
 * Account summary panel — sits in the spare grid column beside the account
 * tables. Shows account equity (wallet + trading account valued in DBUSDC via
 * live pool prices) and a small overview. Per-coin deposit/withdraw lives in the
 * Balances table; the Deposit button here onboards testnet funds.
 */
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ACCOUNT_COINS, formatAmount, getSpotPool } from "@/lib/deepbook/core";
import { useMarketSummary } from "@/lib/deepbook/api/queries";
import {
  useManagerBalances,
  useOpenOrders,
  useWalletBalances,
} from "@/lib/deepbook/hooks/reads";

const usd = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function AccountSummary({
  poolKey,
  className,
}: {
  poolKey: string;
  className?: string;
}) {
  const pool = getSpotPool(poolKey);
  const { data: summary } = useMarketSummary();
  const { data: walletBal } = useWalletBalances();
  const { data: managerBal } = useManagerBalances();
  const { data: openOrders } = useOpenOrders(poolKey);

  // Value a coin in DBUSDC: stablecoins ≈ 1, others via their <COIN>_DBUSDC pool.
  const priceOf = (coin: string) =>
    coin === "DBUSDC" || coin === "DBUSDT"
      ? 1
      : summary?.[`${coin}_DBUSDC`]?.last_price ?? 0;
  const valueOf = (bal: Record<string, number> | undefined) =>
    ACCOUNT_COINS.reduce((sum, c) => sum + (bal?.[c] ?? 0) * priceOf(c), 0);

  const walletValue = valueOf(walletBal);
  const tradingValue = valueOf(managerBal);
  const total = walletValue + tradingValue;

  const openCount = openOrders?.orders.length ?? 0;
  const settled = openOrders?.settled;
  const claimable = settled
    ? settled.base * priceOf(pool.base) +
      settled.quote * priceOf(pool.quote) +
      settled.deep * priceOf("DEEP")
    : 0;

  return (
    <div
      className={cn(
        "flex flex-col gap-4 border-l border-t border-border bg-[#121417] p-4",
        className
      )}
    >
      <Button
        asChild
        className="w-full rounded-full bg-primary text-[#121417] font-semibold hover:bg-primary/90"
      >
        <a href="https://faucet.sui.io" target="_blank" rel="noreferrer">
          Deposit
        </a>
      </Button>

      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold text-white">Account Equity</h3>
        <SummaryRow label="Wallet" value={usd(walletValue)} />
        <SummaryRow label="Trading Account" value={usd(tradingValue)} />
        <Separator className="my-1 bg-border" />
        <SummaryRow label="Total" value={usd(total)} strong />
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold text-white">Overview</h3>
        <SummaryRow label="Open Orders" value={String(openCount)} />
        <SummaryRow label={`Claimable (${pool.label})`} value={usd(claimable)} />
        <SummaryRow label="Markets" value="DeepBook · Spot" />
      </div>

      <p className="mt-auto text-[10px] leading-snug text-nav-inactive">
        Equity is valued in DBUSDC from live pool prices. Deposit and withdraw
        per coin from the Balances table.
      </p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-nav-inactive">{label}</span>
      <span
        className={cn(
          "tabular-nums text-white",
          strong && "font-semibold"
        )}
      >
        {value}
      </span>
    </div>
  );
}
