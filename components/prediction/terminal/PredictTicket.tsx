"use client";

/**
 * Predict order ticket — pro-terminal variant. Uses the margin ticket's vertical
 * column layout (segmented mode/side pills, body, sticky CTA + info rows) so it
 * fits the narrow terminal ticket column, while keeping the main prediction
 * ticket's input fields (the −/+ PillStepper strike/range steppers and the
 * $ + MAX InputGroup amount field) and binary/range/ladder mint logic.
 */
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { useSuiClientQuery } from "@mysten/dapp-kit";
import { usePredictMint } from "@/hooks/usePredictMint";
import { usePredictBinaryMint } from "@/hooks/usePredictBinaryMint";
import { usePredictLadderMint } from "@/hooks/usePredictLadderMint";
import { COIN_TYPES, DUSDC_FAUCET_URL } from "@/lib/deepbook";
import { cn } from "@/lib/utils";
import { usePredictQuote } from "./usePredictQuote";
import { useCountdown } from "./useCountdown";
import type { OracleDTO, Selection, SviResponse } from "./types";
import { clockTime, snapToTick, usd0 } from "./types";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ConnectWalletDialog } from "@/components/wallet/ConnectWalletDialog";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import Link from "next/link";

type Mode = "binary" | "range" | "ladder";

/** Pill stepper — −/+ on the left, read-only value centre, optional end slot.
 *  (Same input design as the main prediction ticket.) */
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
    <InputGroup className="h-10 border-[#1A1D1F] bg-[#1A1D1F] [--radius:9999px] dark:bg-[#1A1D1F]">
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

export default function PredictTicket({
  oracle,
  svi,
  sel,
  step,
  onSelChange,
}: {
  oracle: OracleDTO | null;
  svi?: SviResponse;
  sel: Selection;
  step: number;
  onSelChange: (patch: Partial<Selection>) => void;
}) {
  const account = useActiveAccount();
  const [amount, setAmount] = useState("5");

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
  const countdown = useCountdown(oracle?.expiry);

  const tick = Math.max(oracle?.tickSize ?? 1, 1);
  const minStrike = oracle?.minStrike ?? 0;
  const atm =
    svi?.forward != null && oracle
      ? snapToTick(svi.forward, minStrike, tick)
      : null;

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

  const amt = Number(amount) || 0;
  const price = quote.price;
  const contracts = price && price > 0 ? amt / price : null;
  const toWin = contracts; // $1 per contract
  const profit = toWin != null ? toWin - amt : null;
  const multiple = price && price > 0 ? 1 / price : null;
  const overBalance = balance != null && amt > balance;
  const expired =
    !oracle || countdown.urgency === "expired" || oracle.status !== "active";

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
  const placeLabel = expired
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

  const upSidePrice =
    sel.posType !== "binary"
      ? null
      : sel.direction === "up"
        ? price
        : quote.estProb != null
          ? quote.estProb
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
    if (m === "ladder") setLadderMode(true);
    else {
      setLadderMode(false);
      onSelChange({ posType: m });
    }
  };

  if (!oracle) {
    return <div className="h-full animate-pulse bg-white/[0.02]" />;
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#121417] text-foreground">
      {/* mode segmented (Binary / Range / Ladder) */}
      <div className="px-4 pt-4">
        <div className="flex h-9 items-center rounded-full bg-[#1A1D1F] p-1">
          {(["binary", "range", "ladder"] as const).map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "h-full flex-1 cursor-pointer rounded-full text-xs capitalize transition-all",
                  active
                    ? "bg-foreground font-semibold text-[#121417]"
                    : "bg-transparent font-medium text-nav-inactive",
                )}
              >
                {m}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4 px-4 pt-4">
        {/* balance */}
        <InfoRow
          label="Balance"
          value={`${balance != null ? balance.toFixed(2) : "0.00"} dUSDC`}
        />

        {mode === "ladder" ? (
          <>
            {/* center toggle */}
            <div className="flex h-9 items-center rounded-full bg-[#1A1D1F] p-1">
              {(["down", "atm", "up"] as const).map((c) => {
                const active = center === c;
                return (
                  <button
                    key={c}
                    onClick={() => setCenter(c)}
                    className={cn(
                      "h-full flex-1 cursor-pointer rounded-full text-xs transition-all",
                      active
                        ? "bg-primary font-semibold text-[#121417]"
                        : "bg-transparent font-medium text-nav-inactive",
                    )}
                  >
                    {c === "atm" ? "ATM" : c === "up" ? "↑ Up" : "↓ Down"}
                  </button>
                );
              })}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-medium text-nav-inactive">Rungs</span>
                <span className="font-mono text-white">{rungs}</span>
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
                <div className="mb-2 text-[11px] text-nav-inactive">
                  {rungs} × {usd0(amt / rungs || 0)} per rung
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
              <p className="text-xs text-nav-inactive">
                Waiting for the live forward to place the ladder…
              </p>
            )}
          </>
        ) : (
          <>
            {/* binary: Up / Down segmented with ¢ prices */}
            {sel.posType === "binary" ? (
              <div className="flex h-9 items-center rounded-full bg-[#1A1D1F] p-1">
                {(["up", "down"] as const).map((d) => {
                  const active = sel.direction === d;
                  const sidePrice = d === "up" ? upSidePrice : downSidePrice;
                  return (
                    <button
                      key={d}
                      onClick={() => onSelChange({ direction: d })}
                      className={cn(
                        "h-full flex-1 cursor-pointer rounded-full text-xs transition-all",
                        active
                          ? d === "up"
                            ? "bg-primary font-semibold text-[#121417]"
                            : "bg-[#FF4D4F] font-semibold text-white"
                          : "bg-transparent font-medium text-nav-inactive",
                      )}
                    >
                      {d === "up" ? "Up" : "Down"}
                      {sidePrice != null
                        ? ` ${cents(sidePrice, quote.isLive && active)}`
                        : ""}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {/* strike / range steppers (prediction input fields) */}
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
                      ATM
                    </InputGroupButton>
                  ) : (
                    <InputGroupText className="pr-3 text-xs text-nav-inactive">
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
                    <InputGroupText className="pr-3 text-xs text-nav-inactive">
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
                    <InputGroupText className="pr-3 text-xs text-nav-inactive">
                      Higher
                    </InputGroupText>
                  }
                />
              </div>
            )}

            {/* question + fair odds */}
            {questionSentence ? (
              <p className="text-[11px] leading-snug text-nav-inactive">
                {questionSentence}{" "}
                <span className="font-semibold text-white">
                  {quote.estProb != null
                    ? `${(quote.estProb * 100).toFixed(1)}% fair`
                    : ""}
                </span>
              </p>
            ) : null}
          </>
        )}

        {/* amount field (prediction input design: $ + MAX + quick steps) */}
        <div>
          <InputGroup className="h-10 border-[#1A1D1F] bg-[#1A1D1F] [--radius:9999px] dark:bg-[#1A1D1F]">
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
            {balance != null && balance <= 0 && account?.address ? (
              <a
                href={DUSDC_FAUCET_URL}
                target="_blank"
                rel="noreferrer"
                className="ms-auto text-xs font-semibold text-amber-400 hover:underline"
              >
                get dUSDC ↗
              </a>
            ) : null}
          </div>
        </div>
      </div>

      {/* sticky CTA + summary (margin-ticket footer pattern) */}
      <div className="mt-auto space-y-3 px-4 pb-4 pt-6">
        {!account?.address ? (
          <ConnectWalletDialog
            trigger={
              <Button
                type="button"
                className="h-9 w-full rounded-full bg-primary font-semibold text-[#121417] hover:bg-primary/90"
              >
                Connect wallet
              </Button>
            }
          />
        ) : (
          <Button
            type="button"
            disabled={ctaDisabled}
            onClick={submit}
            className="h-9 w-full rounded-full bg-primary font-semibold text-[#121417] hover:bg-primary/90 disabled:opacity-70"
          >
            {placeLabel}
          </Button>
        )}

        {mintStatus ? (
          <p className="animate-pulse text-center text-[11px] text-nav-inactive">
            {mintStatus}
          </p>
        ) : null}

        <div className="space-y-1.5 border-t border-border pt-3">
          {mode === "ladder" ? (
            <>
              <InfoRow label="Rungs" value={String(rungs)} />
              <InfoRow
                label="Per rung"
                value={`$${(amt / rungs || 0).toFixed(2)}`}
              />
              <InfoRow
                label="Band"
                value={
                  ladderBand
                    ? `${usd0(ladderBand.lo)} – ${usd0(ladderBand.hi)}`
                    : "—"
                }
              />
              <InfoRow
                label="Total stake"
                value={`$${amt.toFixed(2)}`}
                accent
              />
              <p className="text-[10px] text-nav-inactive">
                One atomic PTB · one signature
              </p>
            </>
          ) : (
            <>
              <InfoRow
                label="Contracts"
                value={contracts != null ? contracts.toFixed(2) : "—"}
              />
              <InfoRow
                label="Price / contract"
                value={
                  price != null
                    ? `${quote.isLive ? "" : "~"}${(price * 100).toFixed(1)}¢`
                    : "—"
                }
              />
              <InfoRow
                label="To win"
                value={multiple != null ? `${multiple.toFixed(2)}×` : "—"}
              />
              <InfoRow
                label="Potential Payout"
                value={`$${toWin != null ? toWin.toFixed(2) : "—"}`}
                accent
              />
              <p className="text-[10px] text-nav-inactive">
                {profit != null && amt > 0
                  ? `+$${profit.toFixed(2)} profit (${((profit / amt) * 100).toFixed(0)}%) if you're right`
                  : "payout if you're right"}
              </p>
            </>
          )}

          <div className="flex items-center justify-between pt-1 text-[10px] text-nav-inactive">
            <span className="truncate font-mono">
              {oracle.oracleId.slice(0, 8)}…{oracle.oracleId.slice(-4)}
            </span>
            <Link
              href="/prediction/portfolio"
              className="shrink-0 hover:text-primary"
            >
              Sell / redeem →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-nav-inactive">{label}</span>
      <span
        className={cn("tabular-nums", accent ? "text-primary" : "text-white")}
      >
        {value}
      </span>
    </div>
  );
}
