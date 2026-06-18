"use client";

/**
 * DeepBook Predict — live testnet markets.
 *
 * Supports two position types:
 *   - Range:  bounded [lower, upper] interval, priced by SVI
 *   - Binary: single strike Up/Down directional position
 *
 * Real on-chain data from predict-server.testnet.mystenlabs.com,
 * proxied through /api/oracles + /api/svi.
 */
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { usePredictMint } from "@/hooks/usePredictMint";
import { usePredictBinaryMint } from "@/hooks/usePredictBinaryMint";
import { DUSDC_FAUCET_URL } from "@/lib/deepbook";
import { probInRange } from "@/lib/svi";
import FundingBar from "@/components/wallet/FundingBar";
import SviSmileChart from "@/components/prediction/SviSmileChart";
import RangeLadderPanel from "@/components/prediction/RangeLadderPanel";

// ─── types ────────────────────────────────────────────────────────────────────
type OracleDTO = {
  oracleId: string;
  asset: string;
  expiry: number;
  status: string;
  minStrike: number;
  tickSize: number;
  settlementPrice: number | null;
};
type OraclesResponse = { ok: boolean; oracles: OracleDTO[]; active: OracleDTO[] };

type SviResponse = {
  ok: boolean;
  oracleId?: string;
  asset?: string;
  expiry?: number;
  forward?: number;
  atmIv?: number;
  points?: { strike: number; iv: number }[];
  params?: { a: number; b: number; rho: number; m: number; sigma: number };
};

type PositionType = "range" | "binary";

export type MirrorParams = {
  size: number | null;
  low: number | null;
  high: number | null;
};

// ─── helpers ──────────────────────────────────────────────────────────────────
const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function countdown(expiryMs: number): string {
  const d = expiryMs - Date.now();
  if (d <= 0) return "expired";
  const m = Math.floor(d / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

function snapToTick(price: number, minStrike: number, tick: number): number {
  if (!(tick > 0)) return Math.round(price);
  return minStrike + Math.round((price - minStrike) / tick) * tick;
}

async function fetchJSON<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
  return (await r.json()) as T;
}

// ─── status chip ──────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-400",
  live: "bg-emerald-500/15 text-emerald-400",
  settled: "bg-blue-500/15 text-blue-400",
  pending: "bg-amber-500/15 text-amber-400",
  inactive: "bg-muted/20 text-muted-foreground",
};

function StatusChip({ status }: { status: string }) {
  const s = status.toLowerCase();
  const label =
    s === "pending" ? "pending settlement" : s;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${STATUS_STYLES[s] ?? "bg-muted/20 text-muted-foreground"}`}>
      {label}
    </span>
  );
}

// ─── main component ───────────────────────────────────────────────────────────
export default function PredictMarkets({ mirrorParams }: { mirrorParams?: MirrorParams }) {
  const [posType, setPosType] = useState<PositionType>("range");
  const [showLadder, setShowLadder] = useState(false);
  const [mirrorBanner, setMirrorBanner] = useState(true);

  // Auto-apply mirror params on first render
  useEffect(() => {
    if (!mirrorParams?.size) return;
    // If low === high it was a binary trade, otherwise range
    if (
      mirrorParams.low != null &&
      mirrorParams.high != null &&
      mirrorParams.low === mirrorParams.high
    ) {
      setPosType("binary");
    } else {
      setPosType("range");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const oraclesQ = useQuery({
    queryKey: ["predict", "oracles"],
    queryFn: () => fetchJSON<OraclesResponse>("/api/oracles"),
    refetchInterval: 10_000,
  });

  const sviQ = useQuery({
    queryKey: ["predict", "svi", "soonest"],
    queryFn: () => fetchJSON<SviResponse>("/api/svi"),
    refetchInterval: 10_000,
  });

  const active = oraclesQ.data?.active ?? [];
  const forward = sviQ.data?.forward;
  const atmIv = sviQ.data?.atmIv;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      {/* header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">DeepBook Predict</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vol-surface-priced BTC range &amp; binary markets on Sui testnet.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={`inline-block h-2 w-2 rounded-full ${oraclesQ.isSuccess && oraclesQ.data?.ok ? "bg-emerald-500" : "bg-amber-500"}`} />
          predict-server.testnet · {active.length} active market{active.length === 1 ? "" : "s"}
        </div>
      </div>

      {/* funding */}
      <FundingBar />

      {/* Mirror banner — shown when landing from a PredictFeed Mirror click */}
      {mirrorParams?.size && mirrorBanner ? (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-emerald-600/30 bg-emerald-500/5 px-4 py-2.5 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400">↻</span>
            <span className="text-foreground font-medium">Mirroring trade</span>
            <span className="text-muted-foreground">
              {mirrorParams.low != null && mirrorParams.high != null && mirrorParams.low !== mirrorParams.high
                ? `${usd(mirrorParams.low)} – ${usd(mirrorParams.high)}`
                : mirrorParams.low != null
                ? `@ ${usd(mirrorParams.low)}`
                : ""}
              {" · "}
              <span className="text-emerald-400">{mirrorParams.size} dUSDC</span>
            </span>
          </div>
          <button
            onClick={() => setMirrorBanner(false)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>
      ) : null}

      {/* headline stats */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="BTC forward" value={forward ? usd(forward) : "—"} />
        <Stat label="ATM implied vol" value={atmIv != null ? `${(atmIv * 100).toFixed(1)}%` : "—"} />
        <Stat label="Active oracles" value={String(active.length)} />
        <Stat label="Quote asset" value="dUSDC" hint="DeepBook Predict testnet" />
      </div>

      {/* SVI smile for soonest oracle */}
      {sviQ.data?.points?.length ? (
        <div className="mb-5 rounded-lg border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Volatility Smile</span>
            <span>
              {sviQ.data.asset} · expiry in {sviQ.data.expiry ? countdown(sviQ.data.expiry) : "—"}
            </span>
          </div>
          <SviSmileChart points={sviQ.data.points} forward={sviQ.data.forward} height={100} />
          <p className="mt-1 text-[10px] text-muted-foreground">
            SVI: on-chain stochastic volatility surface. Each market's price is derived from these parameters — strikes with higher IV cost more to buy.
          </p>
        </div>
      ) : null}

      {/* position type selector */}
      <div className="mb-5 flex gap-1 rounded-lg border border-border bg-card/60 p-1 w-fit">
        {(["range", "binary"] as PositionType[]).map(t => (
          <button
            key={t}
            onClick={() => setPosType(t)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              posType === t
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "range" ? "Range" : "Binary"}
          </button>
        ))}
        <span className="ml-2 flex items-center text-[10px] text-muted-foreground pr-2">
          {posType === "range"
            ? "Pay to win if price lands in [low, high]"
            : "Pay to win if price is above/below a single strike"}
        </span>
      </div>

      {/* oracle grid */}
      {oraclesQ.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading live markets…</div>
      ) : active.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No active oracles right now. New rolling expiries open every cycle — check back shortly.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((o, idx) => (
            <OracleCard
              key={o.oracleId}
              o={o}
              forward={forward}
              posType={posType}
              initialAmount={idx === 0 && mirrorParams?.size ? String(mirrorParams.size) : undefined}
            />
          ))}
        </div>
      )}

      {/* Range Ladder (advanced) */}
      {active.length > 0 ? (
        <div className="mt-6">
          <button
            onClick={() => setShowLadder(v => !v)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="text-base">{showLadder ? "▾" : "▸"}</span>
            Advanced: Range Ladder Strategy
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-400 font-medium">
              Multi-leg PTB
            </span>
          </button>
          {showLadder && active[0] ? (
            <div className="mt-3">
              <RangeLadderPanel oracle={active[0]} forward={forward} />
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Not financial advice. Testnet only. · Prices derived from on-chain SVI volatility surface.
      </p>
    </div>
  );
}

// ─── per-oracle card ──────────────────────────────────────────────────────────
function OracleCard({
  o,
  forward,
  posType,
  initialAmount,
}: {
  o: OracleDTO;
  forward?: number;
  posType: PositionType;
  initialAmount?: string;
}) {
  return posType === "range" ? (
    <RangeCard o={o} forward={forward} initialAmount={initialAmount} />
  ) : (
    <BinaryCard o={o} forward={forward} initialAmount={initialAmount} />
  );
}

// ─── RANGE card ───────────────────────────────────────────────────────────────
function RangeCard({
  o,
  forward,
  initialAmount,
}: {
  o: OracleDTO;
  forward?: number;
  initialAmount?: string;
}) {
  const { mint, isMinting, status, isConnected } = usePredictMint();
  const [amount, setAmount] = useState(initialAmount ?? "5");
  const [ticks, setTicks] = useState(4); // half-width in ticks

  const tick = Math.max(o.tickSize, 1);
  const atm = forward ? snapToTick(forward, o.minStrike, tick) : null;
  const band = tick * ticks;

  const doMint = (dir: "up" | "down") => {
    if (atm == null) return;
    const lowerUsd = dir === "up" ? atm : atm - band;
    const higherUsd = dir === "up" ? atm + band : atm;
    void mint({ oracleId: o.oracleId, expiryMs: o.expiry, lowerUsd, higherUsd, amountDusdc: Number(amount) });
  };

  const upLow = atm ?? 0;
  const upHigh = atm != null ? atm + band : 0;
  const dnLow = atm != null ? atm - band : 0;
  const dnHigh = atm ?? 0;

  const disabled = isMinting || atm == null || !(Number(amount) > 0);

  return (
    <div className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-emerald-600/40">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AssetBadge asset={o.asset} />
          <span className="text-sm font-medium text-foreground">{o.asset} · Range</span>
        </div>
        <StatusChip status={o.status} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-y-3 text-sm">
        <Field label="Expires in" value={countdown(o.expiry)} />
        <Field label="Forward" value={forward ? usd(forward) : "—"} align="right" />
        <Field label="Down range" value={atm != null ? `${usd(dnLow)} – ${usd(dnHigh)}` : "—"} />
        <Field label="Up range" value={atm != null ? `${usd(upLow)} – ${usd(upHigh)}` : "—"} align="right" />
      </div>

      {/* width slider */}
      <div className="mt-3">
        <label className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>Range width</span>
          <span className="text-foreground">{ticks} ticks · {usd(band)} wide</span>
        </label>
        <input
          type="range" min={1} max={12} step={1} value={ticks}
          onChange={e => setTicks(Number(e.target.value))}
          className="w-full accent-emerald-500"
        />
      </div>

      {/* amount input */}
      <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
        <input
          type="number" min="0" step="1" value={amount}
          onChange={e => setAmount(e.target.value)}
          className="w-full bg-transparent text-sm text-foreground outline-none"
          placeholder="Amount"
        />
        <span className="text-xs text-muted-foreground">dUSDC</span>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => doMint("up")}
          disabled={!isConnected || disabled}
          className="flex-1 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          title={!isConnected ? "Connect wallet" : `Win if BTC settles ${usd(upLow)} – ${usd(upHigh)}`}
        >
          {isMinting ? "…" : "↑ Up range"}
        </button>
        <button
          onClick={() => doMint("down")}
          disabled={!isConnected || disabled}
          className="flex-1 rounded-md bg-rose-600/90 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
          title={!isConnected ? "Connect wallet" : `Win if BTC settles ${usd(dnLow)} – ${usd(dnHigh)}`}
        >
          {isMinting ? "…" : "↓ Down range"}
        </button>
      </div>

      <OracleMeta oracleId={o.oracleId} isConnected={isConnected} status={status} />
    </div>
  );
}

// ─── BINARY card ──────────────────────────────────────────────────────────────
function BinaryCard({
  o,
  forward,
  initialAmount,
}: {
  o: OracleDTO;
  forward?: number;
  initialAmount?: string;
}) {
  const { mint, isMinting, status, isConnected } = usePredictBinaryMint();
  const [amount, setAmount] = useState(initialAmount ?? "5");
  const [strikeTicks, setStrikeTicks] = useState(0); // offset from ATM in ticks

  const tick = Math.max(o.tickSize, 1);
  const atm = forward ? snapToTick(forward, o.minStrike, tick) : null;
  const strike = atm != null ? atm + strikeTicks * tick : null;

  const tYears = Math.max(1e-9, (o.expiry - Date.now()) / (365 * 24 * 60 * 60 * 1000));
  // risk-neutral probability from log-normal (60% annualized ~ typical BTC testnet)
  const atmIvEst = 60; // ivPct units
  // P(S_T ≥ strike) = probInRange(forward, strike, Infinity)
  const pUp =
    strike != null && forward != null
      ? probInRange(forward, strike, Infinity, atmIvEst, tYears)
      : null;
  const pDown = pUp != null ? 1 - pUp : null;

  const doMint = (isUp: boolean) => {
    if (strike == null) return;
    void mint({ oracleId: o.oracleId, expiryMs: o.expiry, strikeUsd: strike, isUp, amountDusdc: Number(amount) });
  };

  const disabled = isMinting || strike == null || !(Number(amount) > 0);

  return (
    <div className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-blue-600/40">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AssetBadge asset={o.asset} />
          <span className="text-sm font-medium text-foreground">{o.asset} · Binary</span>
        </div>
        <StatusChip status={o.status} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-y-3 text-sm">
        <Field label="Expires in" value={countdown(o.expiry)} />
        <Field label="Forward" value={forward ? usd(forward) : "—"} align="right" />
        <Field label="Strike" value={strike != null ? usd(strike) : "—"} />
        <Field label="Offset" value={`${strikeTicks > 0 ? "+" : ""}${strikeTicks} ticks`} align="right" />
      </div>

      {/* strike offset slider */}
      <div className="mt-3">
        <label className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>Strike offset from ATM</span>
          <span className="text-foreground">
            {strikeTicks === 0 ? "ATM" : `${strikeTicks > 0 ? "+" : ""}${strikeTicks} × ${usd(tick)}`}
          </span>
        </label>
        <input
          type="range" min={-8} max={8} step={1} value={strikeTicks}
          onChange={e => setStrikeTicks(Number(e.target.value))}
          className="w-full accent-blue-500"
        />
      </div>

      {/* probability display */}
      {pUp != null && pDown != null ? (
        <div className="mt-2 grid grid-cols-2 gap-2 text-center text-xs">
          <div className="rounded-md bg-emerald-500/10 px-2 py-1.5">
            <div className="text-muted-foreground">P(Up)</div>
            <div className="font-semibold text-emerald-400">{(pUp * 100).toFixed(1)}%</div>
          </div>
          <div className="rounded-md bg-rose-500/10 px-2 py-1.5">
            <div className="text-muted-foreground">P(Down)</div>
            <div className="font-semibold text-rose-400">{(pDown * 100).toFixed(1)}%</div>
          </div>
        </div>
      ) : null}

      {/* amount input */}
      <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
        <input
          type="number" min="0" step="1" value={amount}
          onChange={e => setAmount(e.target.value)}
          className="w-full bg-transparent text-sm text-foreground outline-none"
          placeholder="Amount"
        />
        <span className="text-xs text-muted-foreground">dUSDC</span>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => doMint(true)}
          disabled={!isConnected || disabled}
          className="flex-1 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          title={`Pays $1 per contract if BTC settles above ${strike != null ? usd(strike) : "—"}`}
        >
          {isMinting ? "…" : "↑ Up"}
        </button>
        <button
          onClick={() => doMint(false)}
          disabled={!isConnected || disabled}
          className="flex-1 rounded-md bg-rose-600/90 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
          title={`Pays $1 per contract if BTC settles below ${strike != null ? usd(strike) : "—"}`}
        >
          {isMinting ? "…" : "↓ Down"}
        </button>
      </div>

      <OracleMeta oracleId={o.oracleId} isConnected={isConnected} status={status} />
    </div>
  );
}

// ─── sub-components ───────────────────────────────────────────────────────────
function AssetBadge({ asset }: { asset: string }) {
  return (
    <span className="rounded-md bg-orange-500/15 px-2 py-0.5 text-xs font-semibold text-orange-400">
      {asset}
    </span>
  );
}

function OracleMeta({
  oracleId,
  isConnected,
  status,
}: {
  oracleId: string;
  isConnected: boolean;
  status: string | null;
}) {
  return (
    <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
      <span className="truncate font-mono">
        {oracleId.slice(0, 8)}…{oracleId.slice(-4)}
      </span>
      {!isConnected ? (
        <span className="text-amber-400">connect to mint</span>
      ) : status ? (
        <span className="text-emerald-400">{status}</span>
      ) : (
        <a href={DUSDC_FAUCET_URL} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">
          Get dUSDC
        </a>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold text-foreground">{value}</div>
      {hint ? <div className="mt-0.5 text-[10px] text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

function Field({ label, value, align = "left" }: { label: string; value: string; align?: "left" | "right" }) {
  return (
    <div className={align === "right" ? "text-right" : ""}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium text-foreground">{value}</div>
    </div>
  );
}
