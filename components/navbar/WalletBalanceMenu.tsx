"use client";

/**
 * Navbar wallet/portfolio dropdown — total balance on the trigger, broken down
 * per venue (the manager objects) in the menu: spendable Wallet dUSDC, Spot
 * (BalanceManager), Margin (MarginManager), Predictions (PredictManager).
 *
 * Mounts `useDeepBookPortfolioSync` so the balance store stays fresh app-wide
 * (it otherwise only runs on /portfolio). Reads dUSDC via getBalance.
 */
import * as React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Wallet,
  RefreshCw,
  TrendingUp,
  Dices,
  ChevronDown,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  type LucideIcon,
} from "lucide-react";
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { DUSDC_FAUCET_URL } from "@/lib/deepbook";
import { useDeepBookPortfolioSync } from "@/hooks/useDeepBookPortfolioSync";
import { useWalletUsd } from "@/hooks/useWalletUsd";
import {
  useSpotBalances,
  useMarginOverview,
  usePredictionsBalance,
} from "@/stores/useBalanceStore";
import { WithdrawModal } from "@/components/wallet/WithdrawModal";
import { TransferModal } from "@/components/wallet/TransferModal";

const usd = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function WalletBalanceMenu() {
  const [open, setOpen] = React.useState(false);
  const [withdrawOpen, setWithdrawOpen] = React.useState(false);
  const [transferOpen, setTransferOpen] = React.useState(false);

  const account = useActiveAccount();
  const owner = account?.address;

  // Keep the balance store fresh wherever the navbar is shown (signed in).
  useDeepBookPortfolioSync(owner ?? "");

  // USD value of every place the user holds assets. Wallet = loose coins in the
  // address; Spot/Margin/Predictions = the manager accounts. Predictions uses
  // the PredictManager account value (cash + open positions). All disjoint, so
  // the sum is the user's true total — same definition as /portfolio.
  const { walletUsd } = useWalletUsd();
  const spotUsd = useSpotBalances().reduce(
    (s, b) => s + Number(b.entryNtl || 0),
    0,
  );
  const marginUsd = Number(useMarginOverview()?.accountValue ?? 0);
  const predictUsd = Number(usePredictionsBalance() || 0);

  const total = walletUsd + spotUsd + marginUsd + predictUsd;

  const rows: {
    icon: LucideIcon;
    label: string;
    hint?: string;
    value: number;
  }[] = [
    { icon: Wallet, label: "Wallet", value: walletUsd },
    { icon: RefreshCw, label: "Spot", value: spotUsd },
    { icon: TrendingUp, label: "Margin", value: marginUsd },
    { icon: Dices, label: "Predictions", value: predictUsd },
  ];

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            className="hidden md:inline-flex items-center gap-2 rounded-[25px] border border-[#2D3134] bg-transparent px-3 text-xs font-semibold text-white hover:bg-white/5 lg:hover:bg-white/5"
          >
            <Wallet className="size-3.5 text-muted-foreground" />
            <span className="tabular-nums">{usd(total)}</span>
            <ChevronDown
              className={`size-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="w-64 rounded-2xl border-white/5  p-2 shadow-xl"
        >
          {/* total */}
          <div className="px-2 pt-1 pb-2">
            <div className="text-[9px] font-bold uppercase tracking-[0.15em] ">
              Total portfolio
            </div>
            <div className="text-2xl font-bold tracking-tight text-[#02DA8B] tabular-nums">
              {usd(total)}
            </div>
          </div>

          {/* per-venue (manager) breakdown */}
          <div className="space-y-0.5">
            {rows.map((r) => (
              <div
                key={r.label}
                className="flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-white/5"
              >
                <div className="flex items-center gap-2.5">
                  <r.icon className="size-4 text-[#6B7280]" />
                  <span className="text-sm font-medium text-white/90">
                    {r.label}
                  </span>
                  {r.hint ? (
                    <span className="text-[10px] text-[#6B7280]">{r.hint}</span>
                  ) : null}
                </div>
                <span className="text-sm font-semibold tabular-nums text-white">
                  {usd(r.value)}
                </span>
              </div>
            ))}
          </div>

          <DropdownMenuSeparator className="my-2 bg-white/5" />

          {/* actions */}
          <div className="grid grid-cols-3 gap-2">
            <Button
              onClick={() => {
                setOpen(false);
                window.open(DUSDC_FAUCET_URL, "_blank", "noopener,noreferrer");
              }}
              className="h-9 gap-1.5 rounded-xl bg-[#02DA8B] text-xs font-bold text-black hover:bg-[#02DA8B]/90"
            >
              <ArrowDownToLine className="size-3.5" />
              Deposit
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
                setWithdrawOpen(true);
              }}
              className="h-9 gap-1.5 rounded-xl border-white/10 bg-transparent text-xs font-semibold text-white hover:bg-white/5"
            >
              <ArrowUpFromLine className="size-3.5" />
              Withdraw
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
                setTransferOpen(true);
              }}
              className="h-9 gap-1.5 rounded-xl border-white/10 bg-transparent text-xs font-semibold text-white hover:bg-white/5"
            >
              <ArrowLeftRight className="size-3.5" />
              Transfer
            </Button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
      <WithdrawModal open={withdrawOpen} onOpenChange={setWithdrawOpen} />
      <TransferModal
        open={transferOpen}
        onOpenChange={setTransferOpen}
        defaultVenue="predictions"
      />
    </>
  );
}
