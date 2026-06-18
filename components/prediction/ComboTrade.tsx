"use client";

/**
 * ComboTrade — three-protocol composable PTB demo screen.
 *
 * Lets the user configure and execute one atomic transaction that spans:
 *   1. DeepBook Margin  — open a new MarginManager, deposit SUI collateral
 *   2. DeepBook Predict — mint a range position funded by dUSDC
 *   3. PLP Vault        — optional: supply dUSDC to earn PLP yield
 *
 * This is the hackathon qualification feature: demonstrating on-chain
 * composability across three DeepBook protocols in a single PTB.
 *
 * NOTE: this file is presentation-only. The PTB construction, simulation and
 * signing all live in useComboPTB — do not move logic in here.
 */

import { useEffect, useState, type ReactNode } from "react";
import { useCurrentAccount, ConnectButton } from "@mysten/dapp-kit";
import { DUSDC_FAUCET_URL } from "@/lib/deepbook";
import { useComboPTB, type ComboTradeArgs } from "@/hooks/useComboPTB";
import Link from "next/link";

// ── Types ────────────────────────────────────────────────────────────────────

interface OracleOption {
  oracleId: string;
  asset: string;
  expiry: number;
  expiry_label: string;
  minStrike?: number; // USD, for range pre-fill
}

interface OraclesApiResponse {
  ok: boolean;
  active: {
    oracleId: string;
    asset: string;
    expiry: number;
    status: string;
    minStrike: number;
  }[];
}

type AccentKey = "blue" | "emerald" | "violet";

/**
 * Full, *static* class strings per accent so Tailwind's scanner picks every
 * color up (never build class names by interpolation — they won't be emitted).
 */
const ACCENTS: Record<
  AccentKey,
  {
    icon: string;
    nodeOn: string;
    card: string;
    focus: string;
    chipOn: string;
    dot: string;
    line: string;
    step: string;
    glow: string;
  }
> = {
  blue: {
    icon: "text-blue-400",
    nodeOn: "bg-blue-500/15 text-blue-300 ring-blue-500/50",
    card: "border-blue-500/20 bg-blue-500/[0.04]",
    focus: "focus-within:border-blue-500/60 focus-within:ring-blue-500/15",
    chipOn: "border-blue-500 bg-blue-500/15 text-blue-200",
    dot: "bg-blue-400",
    line: "from-blue-500/50",
    step: "bg-blue-500/15 text-blue-300 ring-blue-500/30",
    glow: "shadow-[0_8px_30px_-12px_rgba(59,130,246,0.45)]",
  },
  emerald: {
    icon: "text-emerald-400",
    nodeOn: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/50",
    card: "border-emerald-500/20 bg-emerald-500/[0.04]",
    focus:
      "focus-within:border-emerald-500/60 focus-within:ring-emerald-500/15",
    chipOn: "border-emerald-500 bg-emerald-500/15 text-emerald-200",
    dot: "bg-emerald-400",
    line: "from-emerald-500/50",
    step: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    glow: "shadow-[0_8px_30px_-12px_rgba(16,185,129,0.45)]",
  },
  violet: {
    icon: "text-violet-400",
    nodeOn: "bg-violet-500/15 text-violet-300 ring-violet-500/50",
    card: "border-violet-500/20 bg-violet-500/[0.04]",
    focus: "focus-within:border-violet-500/60 focus-within:ring-violet-500/15",
    chipOn: "border-violet-500 bg-violet-500/15 text-violet-200",
    dot: "bg-violet-400",
    line: "from-violet-500/50",
    step: "bg-violet-500/15 text-violet-300 ring-violet-500/30",
    glow: "shadow-[0_8px_30px_-12px_rgba(139,92,246,0.45)]",
  },
};

// ── Icons (inline, currentColor) ──────────────────────────────────────────────

function MarginIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      width="20"
      height="20"
    >
      <path
        d="M12 3 4 6v5c0 4.4 3.1 7.6 8 9 4.9-1.4 8-4.6 8-9V6l-8-3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="m9 12 2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PredictIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      width="20"
      height="20"
    >
      <circle cx="12" cy="12" r="8.2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3.4" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 1.8v3M12 19.2v3M1.8 12h3M19.2 12h3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function VaultIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      width="20"
      height="20"
    >
      <path
        d="M12 3 3 7.5l9 4.5 9-4.5L12 3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="m3 12 9 4.5 9-4.5M3 16.5 12 21l9-4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BoltIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      width="13"
      height="13"
    >
      <path d="M13 2 4.5 13.2c-.4.5 0 1.3.7 1.3H11l-1.5 7.4c-.1.7.8 1.1 1.3.5L19.5 11c.4-.5 0-1.3-.7-1.3H13l1.4-7.2c.1-.7-.8-1.1-1.4-.5Z" />
    </svg>
  );
}

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      width="11"
      height="11"
    >
      <path
        d="m5 12.5 4.5 4.5L19 6.5"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`animate-spin ${className}`}
      width="16"
      height="16"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2.5"
        className="opacity-25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── Pipeline rail ─────────────────────────────────────────────────────────────

function RailNode({
  icon,
  label,
  accent,
  active,
}: {
  icon: ReactNode;
  label: string;
  accent: AccentKey;
  active: boolean;
}) {
  const a = ACCENTS[accent];
  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5">
      <div
        className={`relative flex h-12 w-12 items-center justify-center rounded-2xl ring-1 transition-all duration-300 ${
          active
            ? `${a.nodeOn} ${a.glow}`
            : "bg-card/70 text-muted-foreground/60 ring-border"
        }`}
      >
        {icon}
        {active && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-background ring-1 ring-border">
            <CheckIcon className={a.icon} />
          </span>
        )}
      </div>
      <span
        className={`text-[11px] font-semibold ${active ? "text-foreground" : "text-muted-foreground/70"}`}
      >
        {label}
      </span>
    </div>
  );
}

function RailLink({ accent, active }: { accent: AccentKey; active: boolean }) {
  const a = ACCENTS[accent];
  return (
    <div className="relative mx-1 mt-[-18px] h-px flex-1 overflow-hidden rounded-full bg-border/70">
      <div
        className={`absolute inset-0 bg-gradient-to-r to-transparent transition-opacity duration-300 ${a.line} ${
          active ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}

// ── Inputs ────────────────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  placeholder,
  suffix,
  hint,
  accent,
  quick,
  size = "md",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  suffix?: string;
  hint?: string;
  accent: AccentKey;
  quick?: { label: string; value: string }[];
  size?: "md" | "sm";
}) {
  const a = ACCENTS[accent];
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-muted-foreground">
          {label}
        </label>
        {quick && quick.length > 0 && (
          <div className="flex gap-1">
            {quick.map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => onChange(q.value)}
                className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${
                  value === q.value
                    ? a.chipOn
                    : "border-border/70 bg-background/40 text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div
        className={`flex items-center gap-2 rounded-xl border border-border bg-background/60 px-3.5 transition-all focus-within:ring-2 ${a.focus} ${
          size === "md" ? "py-2.5" : "py-2"
        }`}
      >
        <input
          type="number"
          step="any"
          min="0"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "0"}
          className={`w-full bg-transparent font-semibold tabular-nums text-foreground placeholder:font-normal placeholder:text-muted-foreground/40 outline-none ${
            size === "md" ? "text-base" : "text-sm"
          }`}
        />
        {suffix && (
          <span className="shrink-0 text-xs font-medium text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      {hint && (
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground/70">
          {hint}
        </p>
      )}
    </div>
  );
}

function LegCard({
  step,
  title,
  accent,
  tag,
  toggle,
  children,
}: {
  step: number;
  title: string;
  accent: AccentKey;
  tag?: ReactNode;
  toggle?: ReactNode;
  children: ReactNode;
}) {
  const a = ACCENTS[accent];
  return (
    <section className={`rounded-2xl border p-4 transition-colors ${a.card}`}>
      <div className="mb-3.5 flex items-center gap-2.5">
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-bold ring-1 ${a.step}`}
        >
          {step}
        </span>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {tag ? <span className="ml-auto">{tag}</span> : null}
        {toggle ? (
          <span className={tag ? "ml-2" : "ml-auto"}>{toggle}</span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ComboTrade() {
  const account = useCurrentAccount();
  const { execute, isExecuting, status } = useComboPTB();

  // Oracle selection
  const [oracles, setOracles] = useState<OracleOption[]>([]);
  const [selectedOracle, setSelectedOracle] = useState<OracleOption | null>(
    null,
  );
  const [oraclesLoading, setOraclesLoading] = useState(true);

  // Leg 1 — Margin
  const [suiCollateral, setSuiCollateral] = useState("0.5");

  // Leg 2 — Predict
  const [lowerUsd, setLowerUsd] = useState("");
  const [higherUsd, setHigherUsd] = useState("");
  const [predictDusdc, setPredictDusdc] = useState("10");

  // Leg 3 — PLP
  const [enablePlp, setEnablePlp] = useState(false);
  const [plpDusdc, setPlpDusdc] = useState("5");

  // Result
  const [lastDigest, setLastDigest] = useState<string | null>(null);
  const [lastMarginId, setLastMarginId] = useState<string | null>(null);

  // ── Load live oracles ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setOraclesLoading(true);
    fetch("/api/oracles")
      .then((r) => r.json() as Promise<OraclesApiResponse>)
      .then((data) => {
        if (cancelled) return;
        const opts: OracleOption[] = data.active
          .filter((o) => o.expiry > Date.now())
          .map((o) => {
            const mins = Math.round((o.expiry - Date.now()) / 60_000);
            return {
              oracleId: o.oracleId,
              asset: o.asset ?? "BTC",
              expiry: o.expiry,
              expiry_label:
                mins < 60 ? `${mins}m` : `${Math.round(mins / 60)}h`,
              minStrike: o.minStrike,
            };
          });
        setOracles(opts);
        const preferred =
          opts.find((o) => {
            const mins = (o.expiry - Date.now()) / 60_000;
            return mins > 10 && mins < 25; // ~15m window
          }) ?? opts[0];
        setSelectedOracle(preferred ?? null);
      })
      .catch(() => {
        /* fail silently — user can enter manually */
      })
      .finally(() => {
        if (!cancelled) setOraclesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-fetch SVI forward price to pre-fill range when oracle changes
  const [rangeAutoFilled, setRangeAutoFilled] = useState(false);
  useEffect(() => {
    if (!selectedOracle || rangeAutoFilled) return;
    let cancelled = false;
    fetch(`/api/svi?oracleId=${selectedOracle.oracleId}`)
      .then((r) => r.json())
      .then((svi: { forward?: number }) => {
        if (cancelled || !svi.forward) return;
        const sp = svi.forward;
        const band = sp * 0.01; // ±1% band
        setLowerUsd(Math.round(sp - band).toString());
        setHigherUsd(Math.round(sp + band).toString());
        setRangeAutoFilled(true);
      })
      .catch(() => {
        // Fall back to minStrike if SVI unavailable
        if (cancelled || !selectedOracle.minStrike) return;
        const sp = selectedOracle.minStrike * 1.01; // minStrike is the lowest, approx ATM
        const band = sp * 0.01;
        setLowerUsd(Math.round(sp - band).toString());
        setHigherUsd(Math.round(sp + band).toString());
        setRangeAutoFilled(true);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedOracle, rangeAutoFilled]);

  // ── Derived validation ─────────────────────────────────────────────────────
  const suiOk = Number(suiCollateral) > 0;
  const dusdOk = Number(predictDusdc) > 0;
  const rangeOk =
    Number(lowerUsd) > 0 &&
    Number(higherUsd) > 0 &&
    Number(higherUsd) > Number(lowerUsd);
  const oracleOk = Boolean(selectedOracle);
  const predictOk = dusdOk && rangeOk && oracleOk;
  const plpOk = enablePlp && Number(plpDusdc) > 0;

  const canExecute =
    account && suiOk && dusdOk && rangeOk && oracleOk && !isExecuting;

  const totalDusdc = Number(predictDusdc) + (enablePlp ? Number(plpDusdc) : 0);
  const protocolCount = enablePlp ? 3 : 2;

  // Range preview (real values — width + midpoint of the selected band)
  const rangeMid = rangeOk ? (Number(lowerUsd) + Number(higherUsd)) / 2 : 0;
  const rangeWidth = rangeOk ? Number(higherUsd) - Number(lowerUsd) : 0;
  const rangeWidthPct =
    rangeOk && rangeMid > 0 ? (rangeWidth / rangeMid) * 100 : 0;

  // ── Execute handler ────────────────────────────────────────────────────────
  async function handleExecute() {
    if (!canExecute || !selectedOracle) return;
    const result = await execute({
      suiCollateralSui: Number(suiCollateral),
      oracleId: selectedOracle.oracleId,
      expiryMs: selectedOracle.expiry,
      lowerUsd: Number(lowerUsd),
      higherUsd: Number(higherUsd),
      predictDusdc: Number(predictDusdc),
      plpDusdc: enablePlp ? Number(plpDusdc) : 0,
    } satisfies ComboTradeArgs);
    if (result) {
      setLastDigest(result.digest);
      setLastMarginId(result.marginManagerId ?? null);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6 sm:py-8">
      {/* Header */}
      <header className="mb-6">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
          <BoltIcon className="text-emerald-400" />
          Atomic · {protocolCount}-Protocol PTB
        </span>
        <h1 className="mt-3 bg-gradient-to-br from-white to-white/55 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
          Combo Trade
        </h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          One signature, three DeepBook protocols. Margin collateral, a Predict
          range and an optional PLP supply settle in a single transaction — if
          any leg fails, the whole thing reverts.
        </p>
      </header>

      {/* Pipeline rail */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-border bg-card/40 p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Execution flow
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            1 transaction
          </span>
        </div>
        <div className="flex items-start justify-between px-1">
          <RailNode
            icon={<MarginIcon className="text-current" />}
            label="Margin"
            accent="blue"
            active={suiOk}
          />
          <RailLink accent="blue" active={suiOk} />
          <RailNode
            icon={<PredictIcon className="text-current" />}
            label="Predict"
            accent="emerald"
            active={predictOk}
          />
          {enablePlp && (
            <>
              <RailLink accent="emerald" active={predictOk} />
              <RailNode
                icon={<VaultIcon className="text-current" />}
                label="PLP"
                accent="violet"
                active={plpOk}
              />
            </>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {/* ── Leg 1: Margin ── */}
        <LegCard
          step={1}
          title="DeepBook Margin"
          accent="blue"
          tag={
            <span className="text-[11px] text-muted-foreground">
              SUI / DBUSDC pool
            </span>
          }
        >
          <Field
            label="SUI collateral"
            value={suiCollateral}
            onChange={setSuiCollateral}
            placeholder="0.5"
            suffix="SUI"
            accent="blue"
            quick={[
              { label: "0.25", value: "0.25" },
              { label: "0.5", value: "0.5" },
              { label: "1", value: "1" },
              { label: "2", value: "2" },
            ]}
            hint="Deposited as collateral into a fresh MarginManager (no borrow) — proves atomic cross-protocol composability. Pyth prices auto-refreshed in the same PTB."
          />
        </LegCard>

        {/* ── Leg 2: Predict ── */}
        <LegCard step={2} title="DeepBook Predict" accent="emerald">
          {/* Oracle picker */}
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Oracle / expiry
            </label>
            {oraclesLoading ? (
              <div className="flex gap-1.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-7 w-14 animate-pulse rounded-lg bg-border/40"
                  />
                ))}
              </div>
            ) : oracles.length === 0 ? (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-400">
                No active oracles — enter a range manually below.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {oracles.slice(0, 8).map((o) => {
                  const on =
                    selectedOracle?.oracleId === o.oracleId &&
                    selectedOracle?.expiry === o.expiry;
                  return (
                    <button
                      key={`${o.oracleId}-${o.expiry}`}
                      type="button"
                      onClick={() => {
                        setSelectedOracle(o);
                        setRangeAutoFilled(false);
                      }}
                      className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all ${
                        on
                          ? "border-emerald-500 bg-emerald-500/15 text-emerald-200"
                          : "border-border bg-background/50 text-muted-foreground hover:border-emerald-500/40 hover:text-foreground"
                      }`}
                    >
                      <span className="opacity-60">{o.asset}</span>{" "}
                      {o.expiry_label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Range band preview */}
          {rangeOk && (
            <div className="mb-3 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] p-3">
              <div className="flex items-end justify-between text-xs">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Lower
                  </div>
                  <div className="font-semibold tabular-nums text-foreground">
                    ${Number(lowerUsd).toLocaleString()}
                  </div>
                </div>
                <div className="pb-0.5 text-center text-[10px] text-emerald-400/80">
                  width ${rangeWidth.toLocaleString()}{" "}
                  <span className="text-muted-foreground">
                    ({rangeWidthPct.toFixed(1)}%)
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Higher
                  </div>
                  <div className="font-semibold tabular-nums text-foreground">
                    ${Number(higherUsd).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="relative mt-2 h-1.5 rounded-full bg-background">
                <div className="absolute inset-y-0 left-[18%] right-[18%] rounded-full bg-gradient-to-r from-emerald-500/40 via-emerald-400/70 to-emerald-500/40" />
                <div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400 ring-2 ring-background" />
              </div>
              <div className="mt-1.5 text-center text-[10px] text-muted-foreground">
                ATM ≈ $
                {rangeMid.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}{" "}
                · pays $1/contract if BTC settles inside the band
              </div>
            </div>
          )}

          {/* Range inputs */}
          <div className="grid grid-cols-2 gap-2.5">
            <Field
              label="Lower strike"
              value={lowerUsd}
              onChange={(v) => {
                setLowerUsd(v);
                setRangeAutoFilled(true);
              }}
              placeholder="69000"
              suffix="$"
              accent="emerald"
              size="sm"
            />
            <Field
              label="Higher strike"
              value={higherUsd}
              onChange={(v) => {
                setHigherUsd(v);
                setRangeAutoFilled(true);
              }}
              placeholder="71000"
              suffix="$"
              accent="emerald"
              size="sm"
            />
          </div>

          <div className="mt-3">
            <Field
              label="dUSDC to spend"
              value={predictDusdc}
              onChange={setPredictDusdc}
              placeholder="10"
              suffix="dUSDC"
              accent="emerald"
              quick={[
                { label: "10", value: "10" },
                { label: "25", value: "25" },
                { label: "50", value: "50" },
                { label: "100", value: "100" },
              ]}
              hint="Range minted atomically in the same tx as the margin deposit."
            />
          </div>
        </LegCard>

        {/* ── Leg 3: PLP ── */}
        <LegCard
          step={3}
          title="PLP Vault"
          accent="violet"
          tag={
            <span className="text-[11px] text-muted-foreground">optional</span>
          }
          toggle={
            <button
              type="button"
              role="switch"
              aria-checked={enablePlp}
              onClick={() => setEnablePlp((v) => !v)}
              className={`relative h-5 w-9 rounded-full transition-colors ${
                enablePlp ? "bg-violet-500" : "bg-border"
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${
                  enablePlp ? "left-4" : "left-0.5"
                }`}
              />
            </button>
          }
        >
          {enablePlp ? (
            <Field
              label="dUSDC to supply for PLP"
              value={plpDusdc}
              onChange={setPlpDusdc}
              placeholder="5"
              suffix="dUSDC"
              accent="violet"
              quick={[
                { label: "5", value: "5" },
                { label: "10", value: "10" },
                { label: "25", value: "25" },
              ]}
              hint="Earns PLP yield; the LP tokens are transferred to your wallet in the same PTB."
            />
          ) : (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Enable to also supply dUSDC to the PLP vault in the same
              transaction — simultaneously taking a position and earning vault
              yield.
            </p>
          )}
        </LegCard>
      </div>

      {/* Receipt */}
      <div className="mt-6 rounded-2xl border border-border bg-card/50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Transaction preview
          </span>
          <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
            {protocolCount} protocols · 1 tx
          </span>
        </div>
        <dl className="space-y-2 text-sm">
          <Row
            label="Margin collateral"
            value={`${suiCollateral || "—"} SUI`}
            accent="blue"
          />
          <Row
            label="Predict range"
            value={
              rangeOk
                ? `$${Number(lowerUsd).toLocaleString()}–$${Number(higherUsd).toLocaleString()}`
                : "—"
            }
            accent="emerald"
          />
          <Row
            label="dUSDC on Predict"
            value={`${(Number(predictDusdc) || 0).toFixed(2)} dUSDC`}
            accent="emerald"
          />
          {enablePlp && (
            <Row
              label="PLP supply"
              value={`${(Number(plpDusdc) || 0).toFixed(2)} dUSDC`}
              accent="violet"
            />
          )}
          <div className="my-1 border-t border-dashed border-border" />
          <div className="flex items-center justify-between">
            <dt className="font-medium text-foreground">Total dUSDC</dt>
            <dd className="text-base font-bold tabular-nums text-foreground">
              {totalDusdc.toFixed(2)}
            </dd>
          </div>
        </dl>
      </div>

      {/* Action / status */}
      {!account ? (
        <div className="mt-5 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/30 py-8">
          <p className="text-sm text-muted-foreground">
            Connect your wallet to execute the Combo PTB
          </p>
          <ConnectButton />
        </div>
      ) : (
        <div className="mt-5 space-y-2.5">
          {status && (
            <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3.5 py-2.5 text-xs font-medium text-emerald-300">
              <Spinner className="text-emerald-400" />
              {status}
            </div>
          )}

          <button
            type="button"
            onClick={handleExecute}
            disabled={!canExecute}
            className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all hover:from-emerald-400 hover:to-emerald-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:from-muted disabled:to-muted disabled:text-muted-foreground disabled:shadow-none"
          >
            <span className="flex items-center justify-center gap-2">
              {isExecuting ? (
                <>
                  <Spinner /> Executing…
                </>
              ) : (
                <>
                  Execute Combo PTB
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    width="16"
                    height="16"
                    className="transition-transform group-hover:translate-x-0.5"
                  >
                    <path
                      d="M5 12h14M13 6l6 6-6 6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </>
              )}
            </span>
          </button>

          <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
            Simulated before signing. All legs execute in one atomic PTB —
            first-time use may add a quick setup signature (PredictManager /
            coin merge).
          </p>
        </div>
      )}

      {/* Last result */}
      {lastDigest && (
        <div
          className={`mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4 ${ACCENTS.emerald.glow}`}
        >
          <div className="mb-2.5 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20">
              <CheckIcon className="text-emerald-300" />
            </span>
            <span className="text-sm font-semibold text-emerald-300">
              Combo PTB executed
            </span>
          </div>
          <div className="space-y-1.5 font-mono text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground/60">digest</span>
              <a
                href={`https://suiscan.xyz/testnet/tx/${lastDigest}`}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-emerald-400 hover:underline"
              >
                {lastDigest.slice(0, 22)}…
              </a>
            </div>
            {lastMarginId && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground/60">margin</span>
                <a
                  href={`https://suiscan.xyz/testnet/object/${lastMarginId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-blue-400 hover:underline"
                >
                  {lastMarginId.slice(0, 22)}…
                </a>
              </div>
            )}
          </div>
          <Link
            href="/prediction/portfolio"
            className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 hover:underline"
          >
            View position in Portfolio →
          </Link>
        </div>
      )}

      {/* Faucet notice */}
      <p className="mt-6 text-center text-[11px] text-muted-foreground">
        Need dUSDC?{" "}
        <a
          href={DUSDC_FAUCET_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-400 hover:underline"
        >
          Claim from faucet →
        </a>{" "}
        · Not financial advice. Testnet only.
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: AccentKey;
}) {
  const a = ACCENTS[accent];
  return (
    <div className="flex items-center justify-between">
      <dt className="flex items-center gap-2 text-muted-foreground">
        <span className={`h-1.5 w-1.5 rounded-full ${a.dot}`} />
        {label}
      </dt>
      <dd className="font-medium tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
