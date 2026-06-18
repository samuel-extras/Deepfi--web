"use client";

/** Inline deposit/withdraw amount form for a single coin. Owns its amount
 *  field; the parent supplies the max and runs the on-chain action. */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatAmount } from "@/lib/deepbook/core";

export default function TransferForm({
  kind,
  coin,
  max,
  isPending,
  status,
  onSubmit,
  onCancel,
}: {
  kind: "deposit" | "withdraw";
  coin: string;
  max: number;
  isPending: boolean;
  status: string | null;
  onSubmit: (amount: number) => void;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState("");
  const amountNum = parseFloat(amount) || 0;

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
      <span className="text-xs text-nav-inactive">
        {kind === "deposit" ? "Deposit" : "Withdraw"} {coin} — max{" "}
        {formatAmount(max, 6)}
      </span>
      <div className="flex min-w-[160px] flex-1 items-center gap-2 rounded-full border border-border bg-transparent px-3 py-1.5 sm:flex-none sm:w-56">
        <input
          inputMode="decimal"
          autoFocus
          placeholder="0.0"
          value={amount}
          onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          className="w-full bg-transparent text-xs text-white outline-none"
        />
        <button
          className="text-[10px] text-nav-inactive hover:text-white"
          onClick={() => setAmount(String(max))}
        >
          MAX
        </button>
      </div>
      <Button
        type="button"
        size="sm"
        disabled={isPending || amountNum <= 0 || amountNum > max + 1e-9}
        onClick={() => onSubmit(amountNum)}
        className="h-7 rounded-full bg-primary text-[#121417] text-xs font-semibold"
      >
        {isPending ? (status ?? "Working…") : kind === "deposit" ? "Deposit" : "Withdraw"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 rounded-full text-xs"
        onClick={onCancel}
      >
        Cancel
      </Button>
    </div>
  );
}
