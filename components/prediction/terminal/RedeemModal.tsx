"use client";

/**
 * Redeem / Claim modal for a single Predict position.
 *  - Unsettled (live): the user picks how many contracts to redeem (partial
 *    allowed, up to the amount held); redeems them back to the vault at mark.
 *  - Settled: claims the full payout (no quantity choice).
 *
 * Runs via usePredictRedeem (predict::redeem / redeem_range). The parent keys
 * this by position identity so the input re-seeds per position but survives the
 * 10s portfolio refetch.
 */
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePredictRedeem } from "@/hooks/usePredictRedeem";
import { cn } from "@/lib/utils";
import { CONTRACT_SCALE, usd0 } from "./types";

export type RedeemPosition = {
  oracleId: string;
  expiry: number;
  kind: "binary" | "range";
  isUp?: boolean;
  strike?: number;
  lowerStrike?: number;
  higherStrike?: number;
  openQty: number;
  cost: number;
  markValue: number;
  unrealizedPnl: number;
  status: string;
};

const usd = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });

export function RedeemModal({
  position,
  managerId,
  onOpenChange,
  onRedeemed,
}: {
  position: RedeemPosition | null;
  managerId: string | null;
  onOpenChange: (open: boolean) => void;
  onRedeemed: () => void;
}) {
  const { redeem, isRedeeming, status } = usePredictRedeem();
  const settled = position?.status === "settled";
  const verb = settled ? "Claim" : "Redeem";
  // Human contracts (raw open_quantity ÷ CONTRACT_SCALE). On-chain redeem sends raw.
  const maxQty = (position?.openQty ?? 0) / CONTRACT_SCALE;

  // Default to the full size (floored to 2dp for a clean value); MAX re-sets the
  // exact full. Survives refetch because the parent keys this by position id.
  const [qty, setQty] = useState(() =>
    position ? String(Math.floor(maxQty * 100) / 100) : "",
  );

  const qtyNum = settled ? maxQty : Number(qty) || 0;
  const over = qtyNum > maxQty + 1e-9;
  const valid = qtyNum > 0 && !over && managerId != null;
  const frac = maxQty > 0 ? Math.min(1, qtyNum / maxQty) : 0;
  const estValue = (position?.markValue ?? 0) * frac;
  // Raw u64 for the redeem: exact held amount when at MAX, else scaled up.
  const rawQty =
    position && qtyNum >= maxQty - 1e-9
      ? position.openQty
      : Math.round(qtyNum * CONTRACT_SCALE);

  const label = (p: RedeemPosition) =>
    p.kind === "binary"
      ? `${p.isUp ? "Above" : "Below"} ${usd0(p.strike ?? 0)}`
      : `${usd0(p.lowerStrike ?? 0)} – ${usd0(p.higherStrike ?? 0)}`;

  const confirm = async () => {
    if (!position || !managerId || !valid) return;
    const digest =
      position.kind === "range"
        ? await redeem({
            kind: "range",
            managerId,
            oracleId: position.oracleId,
            expiryMs: position.expiry,
            lowerUsd: position.lowerStrike ?? 0,
            higherUsd: position.higherStrike ?? 0,
            quantity: rawQty,
          })
        : await redeem({
            kind: "binary",
            managerId,
            oracleId: position.oracleId,
            expiryMs: position.expiry,
            strikeUsd: position.strike ?? 0,
            isUp: !!position.isUp,
            quantity: rawQty,
          });
    if (digest) {
      onRedeemed();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={position != null} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 rounded-3xl border-white/5 bg-[#15171A] p-5 sm:max-w-md">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-lg font-bold text-white">
            {verb} position
          </DialogTitle>
        </DialogHeader>

        {position ? (
          <>
            <div className="space-y-2.5 rounded-2xl border border-white/5 bg-[#1A1C1F] p-4">
              <Row label="Position" value={label(position)} strong />
              <Row label="Contracts held" value={maxQty.toFixed(2)} />
              <Row label="Current value" value={usd(position.markValue)} accent />
              <Row
                label="Unrealized PnL"
                value={`${position.unrealizedPnl >= 0 ? "+" : ""}${usd(
                  position.unrealizedPnl,
                )}`}
                tone={
                  position.unrealizedPnl >= 0
                    ? "text-primary"
                    : "text-[#FF4D4F]"
                }
              />
            </div>

            {!settled ? (
              <div className="mt-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-[#6B7280]">
                    Contracts to redeem
                  </label>
                  <span className="text-xs tabular-nums text-[#6B7280]">
                    of {maxQty.toFixed(2)} held
                  </span>
                </div>
                <div
                  className={cn(
                    "mt-1.5 flex items-center rounded-xl border bg-[#1A1C1F] px-4",
                    over ? "border-red-500/60" : "border-white/5",
                  )}
                >
                  <Input
                    inputMode="decimal"
                    value={qty}
                    onChange={(e) =>
                      setQty(e.target.value.replace(/[^0-9.]/g, ""))
                    }
                    placeholder="0"
                    className="h-12 border-0 bg-transparent px-0 text-base text-white shadow-none focus-visible:ring-0"
                  />
                  <button
                    type="button"
                    onClick={() => setQty(String(maxQty))}
                    className="ml-3 text-sm font-bold text-[#02DA8B]"
                  >
                    MAX
                  </button>
                </div>
                {over ? (
                  <p className="mt-1.5 text-xs text-red-400">
                    You only hold {maxQty.toFixed(2)} contracts.
                  </p>
                ) : null}
              </div>
            ) : null}

            <p className="mt-3 text-xs leading-relaxed text-[#6B7280]">
              {settled
                ? "This market has settled — claim the payout into your Predictions balance."
                : "Redeeming sells the chosen contracts back to the vault at the current mark and credits your Predictions balance. Predict is vault-priced, so it fills immediately."}
            </p>

            <Button
              type="button"
              disabled={!valid || isRedeeming}
              onClick={confirm}
              className="mt-5 h-11 w-full rounded-full bg-primary text-sm font-bold text-[#121417] hover:bg-primary/90 disabled:opacity-70"
            >
              {isRedeeming
                ? (status ?? "Working…")
                : `${verb} · ${usd(estValue)}`}
            </Button>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Row({
  label,
  value,
  strong,
  accent,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  accent?: boolean;
  tone?: string;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-[#6B7280]">{label}</span>
      <span
        className={cn(
          "tabular-nums text-white",
          strong && "font-semibold",
          accent && "text-primary",
          tone,
        )}
      >
        {value}
      </span>
    </div>
  );
}
