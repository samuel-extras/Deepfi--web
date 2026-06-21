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
import { useRouter } from "next/navigation";
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
import { useSuiClientQuery } from "@mysten/dapp-kit";
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { COIN_TYPES } from "@/lib/deepbook";
import { useDeepBookPortfolioSync } from "@/hooks/useDeepBookPortfolioSync";
import { useSpotBalances, useMarginOverview } from "@/stores/useBalanceStore";
import { WithdrawModal } from "@/components/wallet/WithdrawModal";

const usd = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function WalletBalanceMenu() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [withdrawOpen, setWithdrawOpen] = React.useState(false);

  const account = useActiveAccount();
  const owner = account?.address;

  // Keep the balance store fresh wherever the navbar is shown (signed in).
  useDeepBookPortfolioSync(owner ?? "");

  // dUSDC is the Predict quote asset (and only used there) — the wallet dUSDC
  // balance IS the prediction balance. ponytail: add PredictManager-committed
  // value (usePredictionsBalance) if "deposited" should count too.
  const dusdcQ = useSuiClientQuery(
    "getBalance",
    { owner: owner ?? "", coinType: COIN_TYPES.dusdc },
    { enabled: !!owner, refetchInterval: 15_000 },
  );
  const predictUsd = Number(dusdcQ.data?.totalBalance ?? 0) / 1e6;

  // USD value of assets held per venue (manager object).
  const spotUsd = useSpotBalances().reduce(
    (s, b) => s + Number(b.entryNtl || 0),
    0,
  );
  const marginUsd = Number(useMarginOverview()?.accountValue ?? 0);

  const total = spotUsd + marginUsd + predictUsd;

  const rows: { icon: LucideIcon; label: string; hint?: string; value: number }[] =
    [
      { icon: RefreshCw, label: "Spot", value: spotUsd },
      { icon: TrendingUp, label: "Margin", value: marginUsd },
      { icon: Dices, label: "Predictions", hint: "dUSDC", value: predictUsd },
    ];

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

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
        className="w-[17rem] rounded-2xl border-white/5 bg-[#1E2024] p-2 shadow-xl"
      >
        {/* total */}
        <div className="px-2 pt-1 pb-2">
          <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#6B7280]">
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
            onClick={() => go("/portfolio")}
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
            onClick={() => go("/portfolio")}
            className="h-9 gap-1.5 rounded-xl border-white/10 bg-transparent text-xs font-semibold text-white hover:bg-white/5"
          >
            <ArrowLeftRight className="size-3.5" />
            Transfer
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
    <WithdrawModal open={withdrawOpen} onOpenChange={setWithdrawOpen} />
    </>
  );
}
