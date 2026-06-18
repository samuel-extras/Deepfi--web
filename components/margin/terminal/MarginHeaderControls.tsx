"use client";

/**
 * Margin ticket header — three pill controls that each open a shadcn Dialog:
 *   [ Margin Mode ]  [ Leverage ]  [ Order Type ]
 * Each dialog edits a local draft and commits on Confirm (cancel / close / Esc
 * discards). DeepBook margin is cross-only and supports Limit / Market, so the
 * Hyperliquid-only options (Isolated, Stop Limit, Stop Market, TWAP) are shown
 * for design parity but disabled.
 */
import { useState } from "react";
import { Check, ChevronDown, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { OrderType } from "@/lib/deepbook/domain/orderMath";

export type TradingMode = "borrowOnly" | "borrow" | "normal";

const ORDER_TYPES: {
  value: OrderType;
  label: string;
  desc: string;
}[] = [
  { value: "limit", label: "Limit", desc: "Buy or Sell at a specific price or better" },
  { value: "market", label: "Market", desc: "Buy or Sell at the best available market price" },
];

const SOON_ORDER_TYPES: { label: string; desc: string }[] = [
  { label: "Stop Limit", desc: "Triggers a Limit order when Stop price is reached" },
  { label: "Stop Market", desc: "Triggers a Market order when Stop price is reached" },
  { label: "TWAP", desc: "Place orders at custom intervals" },
];

const ORDER_LABELS: Record<OrderType, string> = { limit: "Limit", market: "Market" };

const TRADING_MODES: {
  value: TradingMode;
  label: string;
  desc: string;
}[] = [
  {
    value: "borrowOnly",
    label: "Borrow-only",
    desc: "Borrows up to your leverage first — wallet covers only the minimum collateral (perp-style).",
  },
  {
    value: "borrow",
    label: "Borrow",
    desc: "Uses your manager + wallet funds first, borrows only what's missing.",
  },
  {
    value: "normal",
    label: "Normal",
    desc: "Only manager + wallet funds (auto-deposit) — never borrows.",
  },
];

const CONFIRM = "h-9 w-full rounded-full bg-primary px-10 font-semibold text-[#121417] hover:bg-primary/90 sm:w-auto";

export default function MarginHeaderControls({
  tradingMode,
  onTradingModeChange,
  leverage,
  onLeverageChange,
  maxLev,
  orderType,
  onOrderTypeChange,
  baseLabel,
}: {
  tradingMode: TradingMode;
  onTradingModeChange: (m: TradingMode) => void;
  leverage: number;
  onLeverageChange: (n: number) => void;
  maxLev: number;
  orderType: OrderType;
  onOrderTypeChange: (t: OrderType) => void;
  baseLabel: string;
}) {
  return (
    <div className="flex items-center gap-2 px-4 pt-4">
      <TradingModeDialog value={tradingMode} onChange={onTradingModeChange} />
      <LeverageDialog
        value={leverage}
        onChange={onLeverageChange}
        maxLev={maxLev}
        baseLabel={baseLabel}
      />
      <OrderTypeDialog value={orderType} onChange={onOrderTypeChange} />
    </div>
  );
}

function PillTrigger({ label }: { label: string }) {
  return (
    <DialogTrigger className="flex h-8 flex-1 items-center justify-between gap-1 rounded-full border border-[#2D3134] px-3 text-xs text-white outline-none hover:bg-[#2D313440]">
      <span className="truncate">{label}</span>
      <ChevronDown className="size-3.5 shrink-0 text-nav-inactive" />
    </DialogTrigger>
  );
}

function ChoiceCard({
  label,
  desc,
  selected,
  disabled,
  onSelect,
}: {
  label: string;
  desc: string;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition-colors",
        selected ? "border-primary" : "border-[#2D3134] hover:border-[#3A3E42]",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      <div className="min-w-0">
        <div className="text-sm font-semibold text-white">{label}</div>
        <div className="mt-1 text-xs leading-snug text-nav-inactive">{desc}</div>
      </div>
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border",
          selected ? "border-primary bg-primary text-[#121417]" : "border-[#3A3E42]"
        )}
      >
        {selected && <Check className="size-3.5" />}
      </span>
    </button>
  );
}

function OrderTypeDialog({
  value,
  onChange,
}: {
  value: OrderType;
  onChange: (t: OrderType) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<OrderType>(value);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setDraft(value);
      }}
    >
      <PillTrigger label={ORDER_LABELS[value]} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center">
          <DialogTitle className="text-lg">Order Type</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {ORDER_TYPES.map((o) => (
            <ChoiceCard
              key={o.value}
              label={o.label}
              desc={o.desc}
              selected={draft === o.value}
              onSelect={() => setDraft(o.value)}
            />
          ))}
          {SOON_ORDER_TYPES.map((o) => (
            <ChoiceCard key={o.label} label={o.label} desc={o.desc} disabled />
          ))}
        </div>
        <div className="flex justify-center pt-1">
          <Button
            className={CONFIRM}
            onClick={() => {
              onChange(draft);
              setOpen(false);
            }}
          >
            Confirm
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TradingModeDialog({
  value,
  onChange,
}: {
  value: TradingMode;
  onChange: (m: TradingMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<TradingMode>(value);
  const current = TRADING_MODES.find((m) => m.value === value);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setDraft(value);
      }}
    >
      <PillTrigger label={current?.label ?? value} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center">
          <DialogTitle className="text-lg">Trading Mode</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {TRADING_MODES.map((m) => (
            <ChoiceCard
              key={m.value}
              label={m.label}
              desc={m.desc}
              selected={draft === m.value}
              onSelect={() => setDraft(m.value)}
            />
          ))}
        </div>
        <div className="flex justify-center pt-1">
          <Button
            className={CONFIRM}
            onClick={() => {
              onChange(draft);
              setOpen(false);
            }}
          >
            Confirm
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LeverageDialog({
  value,
  onChange,
  maxLev,
  baseLabel,
}: {
  value: number;
  onChange: (n: number) => void;
  maxLev: number;
  baseLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const clamp = (n: number) => Math.max(1, Math.min(maxLev, Math.round(n)));
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setDraft(value);
      }}
    >
      <PillTrigger label={`${value}x`} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center gap-1">
          <DialogTitle className="text-lg">Leverage</DialogTitle>
          <p className="text-xs text-nav-inactive">
            Max leverage for {baseLabel} is {maxLev}x
          </p>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-2xl border border-[#2D3134] px-2 py-1.5">
          <Button
            variant="ghost"
            size="icon"
            type="button"
            disabled={draft <= 1}
            onClick={() => setDraft((d) => clamp(d - 1))}
            aria-label="Decrease leverage"
          >
            <Minus />
          </Button>
          <span className="text-base font-semibold tabular-nums text-white">
            {draft}
          </span>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            disabled={draft >= maxLev}
            onClick={() => setDraft((d) => clamp(d + 1))}
            aria-label="Increase leverage"
          >
            <Plus />
          </Button>
        </div>

        <div className="px-1 py-2">
          <Slider
            value={[draft]}
            min={1}
            max={maxLev}
            step={1}
            marks={Array.from({ length: maxLev }, (_, i) => i + 1)}
            onValueChange={(vals) => setDraft(clamp(vals[0] ?? 1))}
          />
        </div>

        <ul className="list-disc space-y-1.5 pl-4 text-xs leading-snug text-nav-inactive">
          <li>Leverage changes also apply to open positions and open orders.</li>
          <li>
            Higher leverage (e.g. {draft}x) increases your liquidation risk —
            always manage your risk levels.
          </li>
        </ul>

        <div className="flex justify-center pt-1">
          <Button
            className={CONFIRM}
            onClick={() => {
              onChange(draft);
              setOpen(false);
            }}
          >
            Confirm
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
