"use client";

/**
 * Predict account summary — the spare grid column beside the account tables in
 * the pro terminal (mirrors MarginAccountSummary). Surfaces the PredictManager
 * account at a glance: account value, spendable cash, realized/unrealized PnL,
 * open + awaiting-settlement positions. Deposit routes to the faucet; Transfer
 * opens the wallet-as-hub transfer modal (Predictions venue).
 */
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { DUSDC_FAUCET_URL } from "@/lib/deepbook";
import { TransferModal } from "@/components/wallet/TransferModal";

type Summary = {
  tradingBalance: number;
  redeemableValue: number;
  realizedPnl: number;
  unrealizedPnl: number;
  accountValue: number;
  openPositions: number;
  awaitingSettlement: number;
};

const usd = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const signed = (n: number) => `${n >= 0 ? "+" : ""}${usd(n)}`;

export default function PredictAccountSummary({
  className,
}: {
  className?: string;
}) {
  const address = useActiveAccount()?.address;
  const [transferOpen, setTransferOpen] = useState(false);

  const q = useQuery({
    queryKey: ["predict", "accountSummary", address],
    enabled: !!address,
    refetchInterval: 15_000,
    queryFn: async (): Promise<Summary | null> => {
      const r = await fetch(`/api/portfolio?owner=${address}`, {
        cache: "no-store",
      }).then((res) => res.json());
      return r?.summary ?? null;
    },
  });

  const s = q.data;
  const connected = !!address;
  const pnlTone = (n: number | undefined) =>
    n == null || Math.abs(n) < 1e-9
      ? undefined
      : n > 0
        ? "text-primary"
        : "text-[#FF4D4F]";

  return (
    <div
      className={cn(
        "flex flex-col gap-4 border-l border-t border-border bg-[#121417] p-4",
        className,
      )}
    >
      <div className="flex gap-2">
        <Button
          asChild
          className="flex-1 rounded-full bg-black/40 text-foreground font-medium text-xs hover:bg-[#1A1A1A] min-h-9"
        >
          <Link href={DUSDC_FAUCET_URL} target="_blank" rel="noreferrer">
            Deposit
          </Link>
        </Button>
        <Button
          onClick={() => setTransferOpen(true)}
          className="flex-1 rounded-full bg-black/40 text-foreground font-medium text-xs hover:bg-[#1A1A1A] min-h-9"
        >
          Transfer
        </Button>
      </div>
      <Button
        className="flex-1 rounded-full bg-black/40 text-foreground font-medium text-xs hover:bg-[#1A1A1A] min-h-9"
        asChild
      >
        <Link href="/prediction/portfolio">Portfolio</Link>
      </Button>

      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold text-white">Account</h3>
        <SummaryRow
          label="Account Value"
          value={connected && s ? usd(s.accountValue) : "—"}
          strong
        />
        <SummaryRow
          label="Available Cash"
          value={connected && s ? usd(s.tradingBalance) : "—"}
        />
        <SummaryRow
          label="Redeemable"
          value={connected && s ? usd(s.redeemableValue) : "—"}
        />
        <Separator className="my-1 bg-border" />
        <SummaryRow
          label="Unrealized PnL"
          value={connected && s ? signed(s.unrealizedPnl) : "—"}
          tone={connected ? pnlTone(s?.unrealizedPnl) : undefined}
        />
        <SummaryRow
          label="Realized PnL"
          value={connected && s ? signed(s.realizedPnl) : "—"}
          tone={connected ? pnlTone(s?.realizedPnl) : undefined}
        />
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold text-white">Positions</h3>
        <SummaryRow
          label="Open"
          value={connected && s ? String(s.openPositions) : "—"}
        />
        <SummaryRow
          label="Awaiting Settlement"
          value={connected && s ? String(s.awaitingSettlement) : "—"}
        />
      </div>

      <p className="mt-auto text-[10px] leading-snug text-nav-inactive">
        {connected
          ? "Account value = spendable cash + open position value, settled in dUSDC on-chain."
          : "Connect your wallet to see your Predict account."}
      </p>

      <TransferModal
        open={transferOpen}
        onOpenChange={setTransferOpen}
        defaultVenue="predictions"
      />
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
      <span className="text-white/70">{label}</span>
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
