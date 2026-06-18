"use client";

/**
 * Max-slippage control shown as a ticket-summary row: "Est: x% / Max: y%".
 * Hovering the estimate hints "Click to adjust"; clicking opens an
 * "Adjust Max Slippage" dialog (shadcn Dialog) to edit the cap. Slippage only
 * applies to market orders, so the row is rendered only in that mode.
 *
 * Shared by the spot and margin tickets — pass `description` so each surface can
 * explain its own slippage rules.
 */
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const DEFAULT_DESCRIPTION =
  "Max slippage only affects market orders placed from the order form — the order is sent as an IOC limit bounded at the live price ± this percentage.";

export default function MaxSlippageControl({
  slippage,
  onChange,
  estPct = 0,
  description = DEFAULT_DESCRIPTION,
}: {
  slippage: number;
  onChange: (pct: number) => void;
  estPct?: number;
  description?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(String(slippage));

  const commit = () => {
    const n = parseFloat(draft);
    if (!Number.isNaN(n)) onChange(Math.max(0.01, Math.min(50, n)));
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setDraft(String(slippage));
      }}
    >
      <div className="flex justify-between text-xs">
        <span className="text-nav-inactive underline decoration-dotted decoration-nav-inactive/40 underline-offset-4">
          Slippage
        </span>
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="cursor-pointer tabular-nums text-primary hover:opacity-80"
              >
                Est: {estPct}% / Max: {slippage.toFixed(2)}%
              </button>
            </TooltipTrigger>
            <TooltipContent>Click to adjust</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center text-center">
          <DialogTitle className="text-lg">Adjust Max Slippage</DialogTitle>
          <DialogDescription className="text-center">{description}</DialogDescription>
        </DialogHeader>

        <div className="flex h-11 items-center gap-2 rounded-lg border border-input bg-[#1A1D1F] px-4">
          <input
            inputMode="decimal"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/[^0-9.]/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && commit()}
            className="flex-1 bg-transparent text-sm text-white outline-none"
          />
          <span className="text-sm text-nav-inactive">%</span>
        </div>

        <Button
          className="h-11 w-full rounded-full bg-primary font-semibold text-[#121417] hover:bg-primary/90"
          onClick={commit}
        >
          Confirm
        </Button>
      </DialogContent>
    </Dialog>
  );
}
