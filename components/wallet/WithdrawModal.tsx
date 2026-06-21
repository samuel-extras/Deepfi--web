"use client";

/**
 * Withdraw modal (web) — faithful port of the mobile "Withdraw USDC" sheet.
 * Pick a source bucket (DeFi / Exchange / Predictions), an asset + network, an
 * amount (with MAX), and a destination address. Controlled via open/onOpenChange.
 *
 * ponytail: the asset/network lists + the withdraw action are presentational —
 * deepfi is Sui-native, so cross-chain routing isn't wired. Bucket balances are
 * real (same selectors as the navbar). Wire `onWithdraw` to a PTB when the
 * withdraw path is defined.
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TokenIcon } from "@/components/ui/token-icon";
import { ChevronDown, Box, ArrowLeftRight, Dices, X } from "lucide-react";
import { useSuiClientQuery } from "@mysten/dapp-kit";
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { COIN_TYPES } from "@/lib/deepbook";
import { useSpotBalances, useMarginOverview } from "@/stores/useBalanceStore";
import { toast } from "sonner";

const ASSETS = [
  "USDC",
  "BTC",
  "ETH",
  "SOL",
  "FARTCOIN",
  "kBONK",
  "USDC.e",
  "pUSD",
] as const;

const NETWORKS = ["Arbitrum", "Ethereum", "Base"] as const;

const usd = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Bucket = { key: string; label: string; icon: typeof Box; unit: string; value: number };

export function WithdrawModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const account = useActiveAccount();
  const owner = account?.address;

  // Real bucket balances — same sources as the navbar dropdown (react-query
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
    { key: "defi", label: "DeFi", icon: Box, unit: "USDC", value: 0 },
    { key: "exchange", label: "Exchange", icon: ArrowLeftRight, unit: "USDC", value: spotUsd + marginUsd },
    { key: "predictions", label: "Predictions", icon: Dices, unit: "pUSD", value: predictUsd },
  ];

  const [bucketKey, setBucketKey] = React.useState("exchange");
  const [asset, setAsset] = React.useState<string>("USDC");
  const [network, setNetwork] = React.useState<string>("Arbitrum");
  const [amount, setAmount] = React.useState("");
  const [address, setAddress] = React.useState("");

  const bucket = buckets.find((b) => b.key === bucketKey) ?? buckets[1];

  const valid =
    Number(amount) > 0 &&
    Number(amount) <= bucket.value &&
    /^0x[0-9a-fA-F]{2,}/.test(address.trim());

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setAddress(text.trim());
    } catch {
      toast.error("Clipboard unavailable");
    }
  };

  const onWithdraw = () => {
    // ponytail: no Sui withdraw path defined yet — surface intent, don't fake a tx.
    toast.info(`Withdraw ${amount} ${asset} → ${address.slice(0, 10)}… (not yet wired)`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="gap-0 rounded-3xl border-white/5 bg-[#15171A] p-5 sm:max-w-[34rem]"
      >
        <DialogHeader className="relative mb-4 flex-row items-center justify-center">
          <DialogTitle className="text-lg font-bold text-white">
            Withdraw {asset}
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

        {/* source buckets */}
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
                  {usd(b.value)} {b.unit}
                </span>
              </button>
            );
          })}
        </div>

        {/* asset + network */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Selector label="Asset">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="flex w-full items-center gap-2">
                  <TokenIcon symbol={asset} size={22} />
                  <span className="text-base font-semibold text-white">{asset}</span>
                  <ChevronDown className="ml-auto size-4 text-[#6B7280]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] rounded-xl border-white/5 bg-[#1E2024] p-1">
                {ASSETS.map((a) => (
                  <DropdownMenuItem
                    key={a}
                    onClick={() => setAsset(a)}
                    className="gap-2.5 rounded-lg py-2 text-white focus:bg-white/5"
                  >
                    <TokenIcon symbol={a} size={22} />
                    <span className="text-base font-medium">{a}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </Selector>

          <Selector label="Network">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="flex w-full items-center gap-2">
                  <TokenIcon symbol={network.slice(0, 3).toUpperCase()} size={22} />
                  <span className="text-base font-semibold text-white">{network}</span>
                  <ChevronDown className="ml-auto size-4 text-[#6B7280]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] rounded-xl border-white/5 bg-[#1E2024] p-1">
                {NETWORKS.map((n) => (
                  <DropdownMenuItem
                    key={n}
                    onClick={() => setNetwork(n)}
                    className="rounded-lg py-2 text-base font-medium text-white focus:bg-white/5"
                  >
                    {n}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </Selector>
        </div>

        {/* amount */}
        <div className="mt-3">
          <label className="text-sm text-[#6B7280]">Amount</label>
          <div className="mt-1.5 flex items-center rounded-xl border border-white/5 bg-[#1A1C1F] px-4">
            <Input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0"
              className="h-12 border-0 bg-transparent px-0 text-base text-white shadow-none focus-visible:ring-0"
            />
            <span className="text-sm font-medium text-[#6B7280]">{asset}</span>
            <button
              type="button"
              onClick={() => setAmount(String(bucket.value))}
              className="ml-3 text-sm font-bold text-[#02DA8B]"
            >
              MAX
            </button>
          </div>
        </div>

        {/* destination */}
        <div className="mt-3">
          <label className="text-sm text-[#6B7280]">Destination Address</label>
          <div className="mt-1.5 flex items-center rounded-xl border border-white/5 bg-[#1A1C1F] px-4">
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="0x..."
              className="h-12 border-0 bg-transparent px-0 text-base text-white shadow-none focus-visible:ring-0"
            />
            <button
              type="button"
              onClick={paste}
              className="ml-3 rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-white/5"
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
          Withdraw {asset}
        </Button>

        <div className="mt-5 rounded-xl border border-[#B5893C]/40 bg-[#B5893C]/10 px-4 py-3 text-center text-sm leading-relaxed text-[#E0B25C]">
          If you have USDC in your Spot Balances, transfer to Perps to make it
          available to withdraw. Withdrawals should arrive within 5 minutes.
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Selector({
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
