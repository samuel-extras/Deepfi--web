"use client";

/**
 * Order ticket — open a binary (Up/Down a strike), a range band, or a range
 * ladder (a strip of adjacent ranges minted in one atomic PTB).
 *
 * Price shown per $1-payout contract, so the ¢ price *is* the implied
 * probability. Quotes stream from `usePredictQuote`. Minting reuses the
 * usePredictMint / usePredictBinaryMint / usePredictLadderMint PTB hooks.
 */
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Minus, Plus } from "lucide-react";
import { useSuiClientQuery } from "@mysten/dapp-kit";
import { usePredictMint } from "@/hooks/usePredictMint";
import { usePredictBinaryMint } from "@/hooks/usePredictBinaryMint";
import { usePredictLadderMint } from "@/hooks/usePredictLadderMint";
import { COIN_TYPES, DUSDC_FAUCET_URL } from "@/lib/deepbook";
import { cn } from "@/lib/utils";
import { usePredictQuote } from "./usePredictQuote";
import type { OracleDTO, Selection, SviResponse } from "./types";
import { clockTime, snapToTick, usd0 } from "./types";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import Link from "next/link";

type Mode = "binary" | "range" | "ladder";

/** Pill stepper — −/+ on the left, read-only value centre, optional end slot. */
function PillStepper({
  value,
  onChange,
  step,
  min,
  format,
  end,
}: {
  value: number;
  onChange: (v: number) => void;
  step: number;
  min: number;
  format: (v: number) => string;
  end?: React.ReactNode;
}) {
  return (
    <InputGroup className="h-10 border-background bg-background [--radius:9999px] dark:bg-background">
      <InputGroupAddon align="inline-start">
        <InputGroupButton
          size="icon-sm"
          aria-label="decrease"
          onClick={() => onChange(Math.max(min, value - step))}
        >
          <Minus />
        </InputGroupButton>
      </InputGroupAddon>
      <InputGroupAddon align="inline-start">
        <InputGroupButton
          size="icon-sm"
          aria-label="increase"
          onClick={() => onChange(value + step)}
        >
          <Plus />
        </InputGroupButton>
      </InputGroupAddon>
      <InputGroupInput
        className="text-center font-mono"
        readOnly
        value={format(value)}
      />
      {end ? <InputGroupAddon align="inline-end">{end}</InputGroupAddon> : null}
    </InputGroup>
  );
}

export default function TradeTicket({
  oracle,
  svi,
  sel,
  step,
  onSelChange,
  initialAmount,
}: {
  oracle: OracleDTO | null;
  svi?: SviResponse;
  sel: Selection;
  /** vol-scaled increment for strike/range steppers (multiple of tick) */
  step: number;
  onSelChange: (patch: Partial<Selection>) => void;
  initialAmount?: string;
}) {
  const account = useActiveAccount();
  const [amount, setAmount] = useState(initialAmount ?? "5");

  // Ladder is a ticket-local mode (it has no single `sel`); binary/range drive
  // the shared selection so the chart + strike ladder stay in sync.
  const [ladderMode, setLadderMode] = useState(false);
  const [rungs, setRungs] = useState(4);
  const [center, setCenter] = useState<"down" | "atm" | "up">("atm");
  const mode: Mode = ladderMode ? "ladder" : sel.posType;

  const rangeMint = usePredictMint();
  const binaryMint = usePredictBinaryMint();
  const ladderMint = usePredictLadderMint();
  const isMinting =
    rangeMint.isMinting || binaryMint.isMinting || ladderMint.isMinting;
  const mintStatus = rangeMint.status ?? binaryMint.status ?? ladderMint.status;

  const balQ = useSuiClientQuery(
    "getBalance",
    { owner: account?.address ?? "", coinType: COIN_TYPES.dusdc },
    { enabled: !!account?.address, refetchInterval: 12_000 },
  );
  const balance = balQ.data ? Number(balQ.data.totalBalance) / 1e6 : null;

  const quote = usePredictQuote(oracle, sel, svi);

  const tick = Math.max(oracle?.tickSize ?? 1, 1);
  const minStrike = oracle?.minStrike ?? 0;
  const atm =
    svi?.forward != null && oracle
      ? snapToTick(svi.forward, minStrike, tick)
      : null;

  // ladder legs — a strip of `step`-wide adjacent ranges around ATM, shifted by
  // the center toggle. (Same model as the standalone Range Ladder panel.)
  const ladderLegs = useMemo(() => {
    if (atm == null) return [] as { lowerUsd: number; higherUsd: number }[];
    const centerOffset =
      center === "up"
        ? Math.floor(rungs / 2)
        : center === "down"
          ? -Math.ceil(rungs / 2)
          : 0;
    return Array.from({ length: rungs }, (_, i) => {
      const idx = i - Math.floor(rungs / 2) + centerOffset;
      const lower = atm + idx * step;
      return { lowerUsd: lower, higherUsd: lower + step };
    });
  }, [atm, rungs, center, step]);

  useEffect(() => {
    if (initialAmount) setAmount(initialAmount);
  }, [initialAmount]);

  const amt = Number(amount) || 0;
  const price = quote.price;
  const contracts = price && price > 0 ? amt / price : null;
  const toWin = contracts; // $1 per contract
  const profit = toWin != null ? toWin - amt : null;
  const multiple = price && price > 0 ? 1 / price : null;
  const overBalance = balance != null && amt > balance;
  const expired =
    !oracle || oracle.expiry <= Date.now() || oracle.status !== "active";

  const questionSentence = useMemo(() => {
    if (!oracle) return "";
    const at = `at ${clockTime(oracle.expiry)}`;
    if (sel.posType === "binary" && sel.strikeUsd != null) {
      return `BTC settles ${
        sel.direction === "up" ? "above" : "below"
      } ${usd0(sel.strikeUsd)} ${at}?`;
    }
    if (
      sel.posType === "range" &&
      sel.lowerUsd != null &&
      sel.higherUsd != null
    ) {
      return `BTC settles between ${usd0(sel.lowerUsd)} and ${usd0(
        sel.higherUsd,
      )} ${at}?`;
    }
    return "";
  }, [oracle, sel]);

  const submit = () => {
    if (!oracle || expired || !(amt > 0)) return;
    if (mode === "ladder") {
      if (!ladderLegs.length) return;
      void ladderMint.mint({
        oracleId: oracle.oracleId,
        expiryMs: oracle.expiry,
        legs: ladderLegs,
        amountDusdc: amt,
      });
      return;
    }
    if (sel.posType === "binary" && sel.strikeUsd != null) {
      void binaryMint.mint({
        oracleId: oracle.oracleId,
        expiryMs: oracle.expiry,
        strikeUsd: sel.strikeUsd,
        isUp: sel.direction === "up",
        amountDusdc: amt,
      });
    } else if (
      sel.posType === "range" &&
      sel.lowerUsd != null &&
      sel.higherUsd != null
    ) {
      void rangeMint.mint({
        oracleId: oracle.oracleId,
        expiryMs: oracle.expiry,
        lowerUsd: sel.lowerUsd,
        higherUsd: sel.higherUsd,
        amountDusdc: amt,
      });
    }
  };

  const ctaDisabled =
    !account?.address ||
    expired ||
    isMinting ||
    !(amt > 0) ||
    overBalance ||
    (mode === "ladder" && (atm == null || ladderLegs.length === 0));
  const placeLabel = !account?.address
    ? "Connect wallet"
    : expired
      ? "Market closed"
      : isMinting
        ? mode === "ladder"
          ? "Deploying…"
          : "Minting…"
        : overBalance
          ? "Insufficient dUSDC"
          : !(amt > 0)
            ? "Enter an amount"
            : mode === "ladder"
              ? atm == null
                ? "Waiting for forward…"
                : `Deploy ${rungs}-rung Ladder`
              : "Place Buy";

  const cents = (p: number, live: boolean) =>
    `${live ? "" : "~"}${Math.round(p * 100)}¢`;

  if (!oracle) {
    return (
      <div className="h-[480px] animate-pulse rounded-xl border border-white/5 bg-white/[0.02]" />
    );
  }

  const upSidePrice =
    sel.posType !== "binary"
      ? null
      : sel.direction === "up"
        ? price
        : quote.estProb != null
          ? 1 - quote.estProb
          : null;
  const downSidePrice =
    sel.posType !== "binary"
      ? null
      : sel.direction === "down"
        ? price
        : quote.estProb != null
          ? 1 - quote.estProb
          : null;

  const ladderBand =
    ladderLegs.length > 0
      ? {
          lo: ladderLegs[0].lowerUsd,
          hi: ladderLegs[ladderLegs.length - 1].higherUsd,
        }
      : null;

  const setMode = (m: Mode) => {
    if (m === "ladder") {
      setLadderMode(true);
    } else {
      setLadderMode(false);
      onSelChange({ posType: m });
    }
  };

  return (
    <Card className="overflow-hidden rounded-xl">
      {/* header: balance + binary / range / ladder mode */}
      <CardHeader className="flex flex-row items-center gap-1 border-b-2 border-background pb-3">
        <div className="flex flex-col px-2">
          <span className="text-[10px] text-muted-foreground">Balance</span>
          <span className="text-sm font-medium">
            ${balance != null ? balance.toFixed(2) : "0.00"}
          </span>
        </div>
        {(["binary", "range", "ladder"] as const).map((m, i) => (
          <Button
            key={m}
            variant="ghost"
            size="lg"
            onClick={() => setMode(m)}
            className={cn(
              "h-10 w-fit rounded-full px-5",
              i === 0 && "ms-auto",
              mode === m
                ? "bg-background text-foreground"
                : "text-muted-foreground",
            )}
          >
            {m === "binary" ? "Binary" : m === "range" ? "Range" : "Ladder"}
          </Button>
        ))}
      </CardHeader>

      <CardContent className="space-y-4">
        {mode === "ladder" ? (
          /* ── ladder controls ── */
          <>
            <div className="flex gap-2">
              {(["down", "atm", "up"] as const).map((c) => (
                <Button
                  key={c}
                  size="lg"
                  variant="outline"
                  onClick={() => setCenter(c)}
                  className={cn(
                    "flex-1 rounded-full",
                    center === c && "border-[#02da8b]! text-[#02da8b]",
                  )}
                >
                  {c === "atm" ? "ATM" : c === "up" ? "↑ Up" : "↓ Down"}
                </Button>
              ))}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-medium">Rungs</span>
                <span className="font-mono text-foreground">{rungs}</span>
              </div>
              <Slider
                min={2}
                max={8}
                step={1}
                value={[rungs]}
                onValueChange={(v) => setRungs(v[0] ?? rungs)}
              />
            </div>

            {ladderLegs.length > 0 ? (
              <div className="rounded-xl bg-background p-3">
                <div className="mb-2 text-[11px] text-muted-foreground">
                  Legs · {rungs} × {usd0(amt / rungs || 0)} per rung
                </div>
                <div className="flex flex-wrap gap-1">
                  {ladderLegs.map((l, i) => (
                    <span
                      key={i}
                      className="rounded-full border px-2 py-0.5 font-mono text-[10px]"
                    >
                      {usd0(l.lowerUsd)}–{usd0(l.higherUsd)}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Waiting for the live forward to place the ladder…
              </p>
            )}
          </>
        ) : (
          /* ── single position (binary / range) ── */
          <>
            {sel.posType === "binary" ? (
              <div className="flex gap-2">
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => onSelChange({ direction: "up" })}
                  className={cn(
                    "flex-1 rounded-full",
                    sel.direction === "up" &&
                      "border-[#02da8b]! text-[#02da8b]",
                  )}
                >
                  Up
                  {upSidePrice != null
                    ? ` ${cents(upSidePrice, quote.isLive && sel.direction === "up")}`
                    : ""}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => onSelChange({ direction: "down" })}
                  className={cn(
                    "flex-1 rounded-full",
                    sel.direction === "down" &&
                      "border-destructive! text-destructive",
                  )}
                >
                  Down
                  {downSidePrice != null
                    ? ` ${cents(downSidePrice, quote.isLive && sel.direction === "down")}`
                    : ""}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="flex-1 rounded-full"
                  title="DeepBook Predict is vault-priced — market orders only"
                >
                  Market
                  <ChevronDown />
                </Button>
              </div>
            ) : null}

            <div className="flex items-center gap-3">
              <div className="flex-1">
                <h3 className="text-xs font-bold">{questionSentence}</h3>
                <p className="text-[11px] font-medium text-muted-foreground">
                  $1/contract · fair odds{" "}
                  <span className="font-bold text-foreground">
                    {quote.estProb != null
                      ? `${(quote.estProb * 100).toFixed(1)}%`
                      : "—"}
                  </span>
                </p>
              </div>
              <Button
                size="lg"
                className="rounded-full border-0 bg-primary px-3"
              >
                Yes {price != null ? cents(price, quote.isLive) : "—"}
              </Button>
            </div>

            {sel.posType === "binary" ? (
              <PillStepper
                value={sel.strikeUsd ?? atm ?? minStrike}
                onChange={(v) => onSelChange({ strikeUsd: v })}
                step={step}
                min={minStrike}
                format={usd0}
                end={
                  atm != null && sel.strikeUsd !== atm ? (
                    <InputGroupButton
                      className="text-xs"
                      size="sm"
                      onClick={() => onSelChange({ strikeUsd: atm })}
                    >
                      Reset to ATM
                    </InputGroupButton>
                  ) : (
                    <InputGroupText className="pr-3 text-xs text-muted-foreground">
                      ATM
                    </InputGroupText>
                  )
                }
              />
            ) : (
              <div className="space-y-2">
                <PillStepper
                  value={sel.lowerUsd ?? (atm != null ? atm - step : minStrike)}
                  onChange={(v) =>
                    onSelChange({
                      lowerUsd: Math.min(v, (sel.higherUsd ?? v + tick) - tick),
                    })
                  }
                  step={step}
                  min={minStrike}
                  format={usd0}
                  end={
                    <InputGroupText className="pr-3 text-xs text-muted-foreground">
                      Lower
                    </InputGroupText>
                  }
                />
                <PillStepper
                  value={
                    sel.higherUsd ??
                    (atm != null ? atm + step : minStrike + tick)
                  }
                  onChange={(v) =>
                    onSelChange({
                      higherUsd: Math.max(v, (sel.lowerUsd ?? v - tick) + tick),
                    })
                  }
                  step={step}
                  min={minStrike + tick}
                  format={usd0}
                  end={
                    <InputGroupText className="pr-3 text-xs text-muted-foreground">
                      Higher
                    </InputGroupText>
                  }
                />
              </div>
            )}
          </>
        )}

        {/* amount — shared across all modes */}
        <div>
          <InputGroup className="h-10 border-background bg-background [--radius:9999px] dark:bg-background">
            <InputGroupAddon align="inline-start">
              <InputGroupText className="font-medium">$</InputGroupText>
            </InputGroupAddon>
            <InputGroupInput
              className="text-end font-mono"
              type="number"
              min="0"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                className="text-xs"
                size="sm"
                disabled={balance == null}
                onClick={() => balance != null && setAmount(balance.toFixed(2))}
              >
                MAX
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          <div className="mt-1 flex items-center">
            <div className="flex items-center">
              <Button
                size="xs"
                variant="ghost"
                onClick={() =>
                  setAmount(String(Math.max(0, (Number(amount) || 0) - 1)))
                }
              >
                -$1
              </Button>
              <Button
                size="xs"
                variant="ghost"
                onClick={() =>
                  setAmount(String(Math.max(0, (Number(amount) || 0) - 5)))
                }
              >
                -$5
              </Button>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => setAmount(String((Number(amount) || 0) + 1))}
              >
                +$1
              </Button>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => setAmount(String((Number(amount) || 0) + 5))}
              >
                +$5
              </Button>
            </div>
            <div className="ms-auto flex items-center gap-2">
              {!account?.address ? (
                <p className="text-xs text-muted-foreground">connect wallet</p>
              ) : balance != null && balance <= 0 ? (
                <a
                  href={DUSDC_FAUCET_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-amber-400 hover:underline"
                >
                  get dUSDC ↗
                </a>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">Balance</p>
                  <p className="text-xs font-medium">
                    {balance != null ? balance.toFixed(2) : "—"} dUSDC
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex-col space-y-3 border-t-0 bg-transparent">
        <div className="w-full space-y-2 rounded-xl bg-background p-3">
          {mode === "ladder" ? (
            /* ── ladder summary ── */
            <>
              <dl className="flex items-center justify-between">
                <dt className="text-[11px] text-muted-foreground">Rungs</dt>
                <dd className="text-xs font-semibold text-foreground">
                  {rungs}
                </dd>
              </dl>
              <dl className="flex items-center justify-between">
                <dt className="text-[11px] text-muted-foreground">Per rung</dt>
                <dd className="text-xs font-semibold text-foreground">
                  ${(amt / rungs || 0).toFixed(2)}
                </dd>
              </dl>
              <dl className="flex items-center justify-between">
                <dt className="text-[11px] text-muted-foreground">Band</dt>
                <dd className="text-xs font-semibold text-foreground">
                  {ladderBand
                    ? `${usd0(ladderBand.lo)} – ${usd0(ladderBand.hi)}`
                    : "—"}
                </dd>
              </dl>
              <hr className="my-3 border-t border-dashed" />
              <dl className="flex items-center justify-between">
                <dt className="text-[11px] text-muted-foreground">
                  Total stake
                </dt>
                <dd className="text-sm font-bold text-primary">
                  ${amt.toFixed(2)}
                </dd>
              </dl>
              <dl className="flex items-center justify-between">
                <dt className="invisible">note</dt>
                <dd className="text-[11px] text-muted-foreground">
                  one atomic PTB · one signature
                </dd>
              </dl>
            </>
          ) : (
            /* ── single-position summary ── */
            <>
              <dl className="flex items-center justify-between">
                <dt className="text-[11px] text-muted-foreground">Contracts</dt>
                <dd className="text-xs font-semibold text-foreground">
                  {contracts != null ? contracts.toFixed(2) : "—"}
                </dd>
              </dl>
              <dl className="flex items-center justify-between">
                <dt className="text-[11px] text-muted-foreground">
                  Price per contract
                </dt>
                <dd className="text-xs font-semibold text-foreground">
                  {price != null ? (
                    <>
                      <span className="font-normal text-muted-foreground">
                        {quote.isLive ? "live " : "est "}
                      </span>
                      {(price * 100).toFixed(1)}¢
                    </>
                  ) : (
                    "—"
                  )}
                </dd>
              </dl>
              <dl className="flex items-center justify-between">
                <dt className="text-[11px] text-muted-foreground">To win</dt>
                <dd className="text-xs font-semibold text-foreground">
                  {multiple != null ? `${multiple.toFixed(2)}×` : "—"}
                </dd>
              </dl>
              <hr className="my-3 border-t border-dashed" />
              <dl className="flex items-center justify-between">
                <dt className="text-[11px] text-muted-foreground">
                  Potential Payout
                </dt>
                <dd className="text-sm font-bold text-primary">
                  ${toWin != null ? toWin.toFixed(2) : "—"}
                </dd>
              </dl>
              <dl className="flex items-center justify-between">
                <dt className="invisible">profit</dt>
                <dd className="text-[11px] text-muted-foreground">
                  {profit != null && amt > 0
                    ? `+$${profit.toFixed(2)} profit (${((profit / amt) * 100).toFixed(0)}%)`
                    : "payout if you're right"}
                </dd>
              </dl>
            </>
          )}
          <Button
            size="lg"
            className="w-full rounded-full"
            onClick={submit}
            disabled={ctaDisabled}
          >
            {placeLabel}
          </Button>
        </div>

        {mintStatus ? (
          <p className="animate-pulse text-center text-[11px] text-muted-foreground">
            {mintStatus}
          </p>
        ) : null}
        <div className="flex w-full items-center justify-between text-[10px] text-muted-foreground">
          <span className="truncate font-mono">
            {oracle.oracleId.slice(0, 10)}…{oracle.oracleId.slice(-4)}
          </span>
          <Link
            href="/prediction/portfolio"
            className="shrink-0 hover:text-primary"
          >
            Sell / redeem in Portfolio →
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
