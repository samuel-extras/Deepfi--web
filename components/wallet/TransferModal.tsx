"use client";

/**
 * Transfer modal (web) — REAL wallet-as-hub transfers between a venue and the
 * wallet. On testnet the venues don't share a coin, so each move is a
 * coin-correct deposit/withdraw in that venue's native asset:
 *   Predictions ⇄ wallet (dUSDC) · Spot ⇄ wallet (DBUSDC) · Margin ⇄ wallet (SUI).
 *
 * The on-chain work lives in useVenueTransfer (which composes the app's hardened
 * Spot/Margin deposit-withdraw actions + the Predict deposit/withdraw PTBs).
 *
 * The heavy balance reads live in <TransferBody>, rendered only while the dialog
 * is open (the modal itself is always mounted in the navbar), so nothing polls
 * the chain in the background.
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
import {
  RefreshCw,
  TrendingUp,
  Dices,
  Wallet,
  ArrowDown,
  X,
  type LucideIcon,
} from "lucide-react";
import { useSuiClientQuery } from "@mysten/dapp-kit";
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { COIN_TYPES } from "@/lib/deepbook";
import { getSpotPool, DEFAULT_POOL_KEY } from "@/lib/deepbook/core";
import {
  useSpotBalances,
  usePredictionsTradingBalance,
} from "@/stores/useBalanceStore";
import { useStickyMarginSnapshot } from "@/hooks/useDeepBookMargin";
import { DEFAULT_MARGIN_POOL_KEY } from "@/lib/sui/deepbookMargin";
import {
  useVenueTransfer,
  VENUE_COIN,
  type Venue,
  type TransferDirection,
} from "@/hooks/useVenueTransfer";

const VENUES: { key: Venue; label: string; icon: LucideIcon }[] = [
  { key: "spot", label: "Spot", icon: RefreshCw },
  { key: "margin", label: "Margin", icon: TrendingUp },
  { key: "predictions", label: "Predictions", icon: Dices },
];

const fmt = (n: number, dp = 6) =>
  n.toLocaleString("en-US", { maximumFractionDigits: dp });

export function TransferModal({
  open,
  onOpenChange,
  defaultVenue = "predictions",
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  defaultVenue?: Venue;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="gap-0 rounded-3xl border-white/5 bg-[#15171A] p-5 sm:max-w-[34rem]"
      >
        <TransferBody
          defaultVenue={defaultVenue}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function TransferBody({
  defaultVenue,
  onClose,
}: {
  defaultVenue: Venue;
  onClose: () => void;
}) {
  const account = useActiveAccount();
  const owner = account?.address;
  const { transfer, isPending, status } = useVenueTransfer();

  const [venue, setVenue] = React.useState<Venue>(defaultVenue);
  const [direction, setDirection] = React.useState<TransferDirection>("deposit");
  const [amount, setAmount] = React.useState("");

  const coin = VENUE_COIN[venue]; // "dUSDC" | "DBUSDC" | "SUI"
  const dbusdcScalar = getSpotPool(DEFAULT_POOL_KEY).quoteScalar;

  // ── Wallet balances (coin-correct) ───────────────────────────────────
  const dusdcQ = useSuiClientQuery(
    "getBalance",
    { owner: owner ?? "", coinType: COIN_TYPES.dusdc },
    { enabled: !!owner },
  );
  const dbusdcQ = useSuiClientQuery(
    "getBalance",
    { owner: owner ?? "", coinType: COIN_TYPES.dbusdc },
    { enabled: !!owner },
  );
  const suiQ = useSuiClientQuery(
    "getBalance",
    { owner: owner ?? "", coinType: COIN_TYPES.sui },
    { enabled: !!owner },
  );
  const walletDusdc = Number(dusdcQ.data?.totalBalance ?? 0) / 1e6;
  const walletDbusdc = Number(dbusdcQ.data?.totalBalance ?? 0) / dbusdcScalar;
  const walletSui = Number(suiQ.data?.totalBalance ?? 0) / 1e9;
  const walletBalance =
    coin === "dUSDC" ? walletDusdc : coin === "DBUSDC" ? walletDbusdc : walletSui;

  // ── Venue balances (coin-correct) ────────────────────────────────────
  const predictBal = Number(usePredictionsTradingBalance() || "0"); // dUSDC
  const spotBalances = useSpotBalances();
  const spotDbusdc = Number(
    spotBalances.find((b) => /dbusdc/i.test(b.coin))?.total ?? 0,
  );
  const marginSnap = useStickyMarginSnapshot(DEFAULT_MARGIN_POOL_KEY).data;
  const marginSui = marginSnap?.balances.base ?? 0; // free SUI collateral

  const venueBalance =
    venue === "predictions" ? predictBal : venue === "spot" ? spotDbusdc : marginSui;

  // For a wallet→venue SUI deposit, leave a little SUI for gas.
  const sourceBalance =
    direction === "deposit"
      ? coin === "SUI"
        ? Math.max(0, walletBalance - 0.1)
        : walletBalance
      : venueBalance;

  const amountNum = Number(amount);
  const overBalance = amountNum > sourceBalance + 1e-9;
  const valid = amountNum > 0 && !overBalance && !!owner && !isPending;

  const venueLabel = VENUES.find((v) => v.key === venue)!.label;
  const VenueIcon = VENUES.find((v) => v.key === venue)!.icon;

  const walletTile = {
    label: "Wallet",
    icon: Wallet as LucideIcon,
    value: walletBalance,
  };
  const venueTile = { label: venueLabel, icon: VenueIcon, value: venueBalance };
  const [source, dest] =
    direction === "deposit" ? [walletTile, venueTile] : [venueTile, walletTile];

  const submit = async () => {
    await transfer({ venue, direction, amount: amountNum });
    setAmount("");
  };

  return (
    <>
      <DialogHeader className="relative mb-4 flex-row items-center justify-center">
        <DialogTitle className="text-lg font-bold text-white">
          Transfer funds
        </DialogTitle>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-0 grid size-8 place-items-center rounded-full border border-white/10 text-[#6B7280] transition-colors hover:bg-white/5 hover:text-white"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
      </DialogHeader>

      {/* venue selector */}
      <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-white/5">
        {VENUES.map((v, i) => {
          const active = v.key === venue;
          return (
            <button
              key={v.key}
              type="button"
              onClick={() => {
                setVenue(v.key);
                setAmount("");
              }}
              className={`flex items-center justify-center gap-1.5 px-3 py-3 text-sm font-medium transition-colors ${
                i > 0 ? "border-l border-white/5" : ""
              } ${
                active
                  ? "bg-[#23262A] text-white"
                  : "bg-transparent text-[#6B7280] hover:bg-white/[0.03]"
              }`}
            >
              {v.label}
              <v.icon className="size-3.5" />
            </button>
          );
        })}
      </div>

      {/* From → To */}
      <div className="mt-3 flex items-stretch gap-2">
        <DirectionTile tile={source} coin={coin} caption="From" />
        <button
          type="button"
          onClick={() =>
            setDirection((d) => (d === "deposit" ? "withdraw" : "deposit"))
          }
          aria-label="Swap direction"
          className="grid w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-[#1A1C1F] text-[#6B7280] transition-colors hover:bg-white/5 hover:text-white"
        >
          <ArrowDown className="size-4 -rotate-90" />
        </button>
        <DirectionTile tile={dest} coin={coin} caption="To" />
      </div>

      {/* amount */}
      <div className="mt-3">
        <div className="flex items-center justify-between">
          <label className="text-sm text-[#6B7280]">Amount</label>
          <span className="text-xs tabular-nums text-[#6B7280]">
            Available {fmt(sourceBalance)} {coin}
          </span>
        </div>
        <div
          className={`mt-1.5 flex items-center rounded-xl border bg-[#1A1C1F] px-4 ${
            overBalance ? "border-red-500/60" : "border-white/5"
          }`}
        >
          <TokenIcon symbol={coin === "SUI" ? "SUI" : "USDC"} size={20} />
          <Input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="0"
            className="h-12 border-0 bg-transparent px-2 text-base text-white shadow-none focus-visible:ring-0"
          />
          <span className="text-sm font-medium text-[#6B7280]">{coin}</span>
          <button
            type="button"
            onClick={() => setAmount(String(sourceBalance))}
            className="ml-3 text-sm font-bold text-[#02DA8B]"
          >
            MAX
          </button>
        </div>
        {overBalance ? (
          <p className="mt-1.5 text-xs text-red-400">
            Amount exceeds your {source.label} {coin} balance.
          </p>
        ) : null}
      </div>

      <Button
        type="button"
        disabled={!valid}
        onClick={submit}
        className="mx-auto mt-6 h-12 w-[70%] rounded-full bg-[#02DA8B] text-base font-bold text-black hover:bg-[#02DA8B]/90 disabled:bg-[#02DA8B]/25 disabled:text-black/40"
      >
        {isPending
          ? (status ?? "Working…")
          : direction === "deposit"
            ? `Deposit to ${venueLabel}`
            : "Withdraw to Wallet"}
      </Button>

      <div className="mt-5 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 text-center text-sm leading-relaxed text-[#6B7280]">
        Each venue settles in its own asset on Sui ({coin} for {venueLabel}), so
        transfers move {coin} between your wallet and {venueLabel}. Funds never
        leave your account.
      </div>
    </>
  );
}

function DirectionTile({
  tile,
  coin,
  caption,
}: {
  tile: { label: string; icon: LucideIcon; value: number };
  coin: string;
  caption: string;
}) {
  return (
    <div className="flex-1 rounded-xl border border-white/5 bg-[#1A1C1F] px-4 py-3">
      <div className="mb-1 text-[10px] uppercase tracking-wider text-[#6B7280]">
        {caption}
      </div>
      <div className="flex items-center gap-1.5 text-sm font-semibold text-white">
        <tile.icon className="size-3.5 text-[#6B7280]" />
        {tile.label}
      </div>
      <div className="mt-0.5 text-xs tabular-nums text-[#6B7280]">
        {fmt(tile.value)} {coin}
      </div>
    </div>
  );
}
