"use client";

/**
 * Withdraw modal (web) — Sui-native rework of the old mobile "Withdraw USDC"
 * sheet. deepfi settles entirely on Sui in dUSDC, so there's no asset/network
 * picker: pick a source venue (Spot / Margin / Predictions), an amount (with
 * MAX), and a Sui destination address. Controlled via open/onOpenChange.
 *
 * Bucket balances are real (same selectors as the navbar). ponytail: the
 * withdraw action is presentational — wire `onWithdraw` to a Sui PTB
 * (margin::withdraw / predict withdraw / spot balance-manager withdraw) once the
 * per-venue withdraw path is defined.
 */
import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TokenIcon } from "@/components/ui/token-icon";
import { RefreshCw, TrendingUp, Dices, X, type LucideIcon } from "lucide-react";
import { useSuiClientQuery } from "@mysten/dapp-kit";
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { COIN_TYPES, SUI_NETWORK } from "@/lib/deepbook";
import { useSpotBalances, useMarginOverview } from "@/stores/useBalanceStore";
import { toast } from "sonner";

const ASSET = "dUSDC";
const NETWORK_LABEL = `Sui ${SUI_NETWORK[0].toUpperCase()}${SUI_NETWORK.slice(1)}`;

// Normalized Sui addresses are 0x + 32 bytes (64 hex chars).
const SUI_ADDRESS_RE = /^0x[0-9a-fA-F]{64}$/;

const usd = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Bucket = { key: string; label: string; icon: LucideIcon; value: number };

export function WithdrawModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const account = useActiveAccount();
  const owner = account?.address;

  // Real venue balances — same sources as the navbar dropdown (react-query
  // dedupes the dUSDC read by key, so reading it here is free).
  const dusdcQ = useSuiClientQuery(
    "getBalance",
    { owner: owner ?? "", coinType: COIN_TYPES.dusdc },
    { enabled: !!owner && open },
  );
  const predictUsd = Number(dusdcQ.data?.totalBalance ?? 0) / 1e6;
  const spotUsd = useSpotBalances().reduce((s, b) => s + Number(b.entryNtl || 0), 0);
  const marginUsd = Number(useMarginOverview()?.accountValue ?? 0);

  const buckets: Bucket[] = [
    { key: "spot", label: "Spot", icon: RefreshCw, value: spotUsd },
    { key: "margin", label: "Margin", icon: TrendingUp, value: marginUsd },
    { key: "predictions", label: "Predictions", icon: Dices, value: predictUsd },
  ];

  const [bucketKey, setBucketKey] = React.useState("predictions");
  const [amount, setAmount] = React.useState("");
  const [address, setAddress] = React.useState("");

  const bucket = buckets.find((b) => b.key === bucketKey) ?? buckets[0];

  const amountNum = Number(amount);
  const overBalance = amountNum > bucket.value;
  const valid =
    amountNum > 0 && !overBalance && SUI_ADDRESS_RE.test(address.trim());

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setAddress(text.trim());
    } catch {
      toast.error("Clipboard unavailable");
    }
  };

  const onWithdraw = () => {
    // ponytail: no Sui withdraw PTB wired yet — surface intent, don't fake a tx.
    toast.info(
      `Withdraw ${amount} ${ASSET} from ${bucket.label} → ${address.slice(0, 10)}… (not yet wired)`,
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="gap-0 rounded-3xl border-white/5 bg-[#15171A] p-5 sm:max-w-[34rem]"
      >
        <DialogHeader className="relative mb-4 flex-row items-center justify-center">
          <DialogTitle className="text-lg font-bold text-white">
            Withdraw {ASSET}
          </DialogTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute right-0 grid size-8 place-items-center rounded-full border border-white/10 text-[#6B7280] transition-colors hover:bg-white/5 hover:text-white"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </DialogHeader>

        {/* source venues */}
        <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-white/5">
          {buckets.map((b, i) => {
            const active = b.key === bucketKey;
            return (
              <button
                key={b.key}
                type="button"
                onClick={() => setBucketKey(b.key)}
                className={`flex flex-col gap-1 px-4 py-3 text-left transition-colors ${
                  i > 0 ? "border-l border-white/5" : ""
                } ${active ? "bg-[#23262A]" : "bg-transparent hover:bg-white/[0.03]"}`}
              >
                <span
                  className={`flex items-center gap-1.5 text-sm font-medium ${
                    active ? "text-white" : "text-[#6B7280]"
                  }`}
                >
                  {b.label}
                  <b.icon className="size-3.5" />
                </span>
                <span
                  className={`text-sm tabular-nums ${active ? "text-white" : "text-[#6B7280]"}`}
                >
                  {usd(b.value)} {ASSET}
                </span>
              </button>
            );
          })}
        </div>

        {/* asset + network — fixed on Sui, shown for clarity */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <InfoTile label="Asset">
            <div className="flex w-full items-center gap-2">
              <TokenIcon symbol="USDC" size={22} />
              <span className="text-base font-semibold text-white">{ASSET}</span>
            </div>
          </InfoTile>

          <InfoTile label="Network">
            <div className="flex w-full items-center gap-2">
              <TokenIcon symbol="SUI" size={22} />
              <span className="text-base font-semibold text-white">
                {NETWORK_LABEL}
              </span>
            </div>
          </InfoTile>
        </div>

        {/* amount */}
        <div className="mt-3">
          <div className="flex items-center justify-between">
            <label className="text-sm text-[#6B7280]">Amount</label>
            <span className="text-xs tabular-nums text-[#6B7280]">
              Available {usd(bucket.value)} {ASSET}
            </span>
          </div>
          <div
            className={`mt-1.5 flex items-center rounded-xl border bg-[#1A1C1F] px-4 ${
              overBalance ? "border-red-500/60" : "border-white/5"
            }`}
          >
            <Input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0"
              className="h-12 border-0 bg-transparent px-0 text-base text-white shadow-none focus-visible:ring-0"
            />
            <span className="text-sm font-medium text-[#6B7280]">{ASSET}</span>
            <button
              type="button"
              onClick={() => setAmount(String(bucket.value))}
              className="ml-3 text-sm font-bold text-[#02DA8B]"
            >
              MAX
            </button>
          </div>
          {overBalance ? (
            <p className="mt-1.5 text-xs text-red-400">
              Amount exceeds your {bucket.label} balance.
            </p>
          ) : null}
        </div>

        {/* destination */}
        <div className="mt-3">
          <label className="text-sm text-[#6B7280]">Destination Address</label>
          <div className="mt-1.5 flex items-center rounded-xl border border-white/5 bg-[#1A1C1F] px-4">
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="0x… (Sui address)"
              className="h-12 border-0 bg-transparent px-0 text-base text-white shadow-none focus-visible:ring-0"
            />
            {owner ? (
              <button
                type="button"
                onClick={() => setAddress(owner)}
                className="ml-2 shrink-0 rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-white/5"
              >
                My address
              </button>
            ) : null}
            <button
              type="button"
              onClick={paste}
              className="ml-2 shrink-0 rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-white/5"
            >
              Paste
            </button>
          </div>
        </div>

        <Button
          type="button"
          disabled={!valid}
          onClick={onWithdraw}
          className="mx-auto mt-6 h-12 w-[60%] rounded-full bg-[#02DA8B] text-base font-bold text-black hover:bg-[#02DA8B]/90 disabled:bg-[#02DA8B]/25 disabled:text-black/40"
        >
          Withdraw {ASSET}
        </Button>

        <div className="mt-5 rounded-xl border border-[#B5893C]/40 bg-[#B5893C]/10 px-4 py-3 text-center text-sm leading-relaxed text-[#E0B25C]">
          Withdrawals are sent on {NETWORK_LABEL} as {ASSET} to the address above.
          Sui transfers are irreversible — double-check the destination before
          confirming.
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoTile({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-[#1A1C1F] px-4 py-2.5">
      <div className="mb-1 text-sm text-[#6B7280]">{label}</div>
      {children}
    </div>
  );
}
