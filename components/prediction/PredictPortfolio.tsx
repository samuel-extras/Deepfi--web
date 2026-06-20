"use client";

/**
 * DeepBook Predict — per-user portfolio.
 *
 * Shows both binary (strike + up/down) and range (lower–higher) positions.
 * Dispatches the correct redeem PTB for each type.
 * Also surfaces a "Withdraw to Wallet" button so users can extract their
 * manager balance back to their Sui wallet after redemptions.
 */
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSuiClient } from "@mysten/dapp-kit";
import { useSignAndExecuteTransaction } from "@/lib/zklogin/useSponsoredExecute";
import { toast } from "sonner";
import { usePredictRedeem } from "@/hooks/usePredictRedeem";
import type { RedeemArgs } from "@/hooks/usePredictRedeem";
import { buildWithdrawFromManagerTx } from "@/lib/ptb/predict";
import FundingBar from "@/components/wallet/FundingBar";
import Link from "next/link";

// ─── types ────────────────────────────────────────────────────────────────────
interface PortfolioSummary {
  tradingBalance: number;
  openExposure: number;
  redeemableValue: number;
  realizedPnl: number;
  unrealizedPnl: number;
  accountValue: number;
  openPositions: number;
  awaitingSettlement: number;
}

type BinaryPosition = {
  oracleId: string;
  asset: string;
  expiry: number;
  kind: "binary";
  strike: number;
  isUp: boolean;
  openQty: number;
  cost: number;
  markValue: number;
  unrealizedPnl: number;
  realizedPnl: number;
  status: string;
};

type RangePosition = {
  oracleId: string;
  asset: string;
  expiry: number;
  kind: "range";
  lowerStrike: number;
  higherStrike: number;
  openQty: number;
  cost: number;
  markValue: number;
  unrealizedPnl: number;
  realizedPnl: number;
  status: string;
};

type Position = BinaryPosition | RangePosition;

interface PortfolioResponse {
  ok: boolean;
  managerId: string | null;
  summary?: PortfolioSummary;
  positions?: Position[];
  error?: string;
}

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmt$ = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });

const fmtPnl = (n: number) => {
  const s = fmt$(n);
  return n >= 0 ? `+${s}` : s;
};

function countdown(expiryMs: number): string {
  const d = expiryMs - Date.now();
  if (d <= 0) return "expired";
  const m = Math.floor(d / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

const STATUS_STYLES: Record<string, string> = {
  live: "bg-emerald-500/15 text-emerald-400",
  open: "bg-emerald-500/15 text-emerald-400",
  settled: "bg-blue-500/15 text-blue-400",
  redeemable: "bg-amber-500/15 text-amber-400",
  closed: "bg-muted/20 text-muted-foreground",
};

// ─── component ────────────────────────────────────────────────────────────────
export default function PredictPortfolio() {
  const account = useActiveAccount();
  const owner = account?.address;
  const client = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const { redeem, isRedeeming } = usePredictRedeem();

  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);

  const q = useQuery<PortfolioResponse>({
    queryKey: ["predict", "portfolio", owner],
    queryFn: () => fetch(`/api/portfolio?owner=${owner}`).then((r) => r.json()),
    enabled: !!owner,
    refetchInterval: 15_000,
  });

  const handleWithdraw = async (managerId: string) => {
    const amt = Number(withdrawAmt);
    if (!owner || !(amt > 0)) return;
    setIsWithdrawing(true);
    try {
      const tx = buildWithdrawFromManagerTx({
        managerId,
        amountDusdc: amt,
        recipient: owner,
      });
      const res = await signAndExecute({ transaction: tx });
      await client.waitForTransaction({ digest: res.digest });
      toast.success(
        `Withdrew ${amt} dUSDC to wallet · ${res.digest.slice(0, 8)}…`,
      );
      setWithdrawAmt("");
      setShowWithdraw(false);
      void q.refetch();
    } catch (e) {
      toast.error(
        `Withdraw failed: ${e instanceof Error ? e.message.slice(0, 120) : String(e)}`,
      );
    } finally {
      setIsWithdrawing(false);
    }
  };

  if (!owner) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-6">
        <h1 className="mb-4 text-2xl font-semibold">My Predict Portfolio</h1>
        <FundingBar />
        <div className="rounded-lg border border-border bg-card p-10 text-center text-muted-foreground">
          Connect your wallet to view your positions.
        </div>
      </div>
    );
  }

  const data = q.data;
  const summary = data?.summary;
  const positions = data?.positions ?? [];
  const managerId = data?.managerId;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">My Predict Portfolio</h1>
          {managerId ? (
            <p className="mt-1 text-xs text-muted-foreground font-mono">
              Manager {managerId.slice(0, 10)}…{managerId.slice(-6)}
            </p>
          ) : null}
        </div>
        {q.isFetching && (
          <span className="text-xs text-muted-foreground animate-pulse">
            Refreshing…
          </span>
        )}
      </div>

      <FundingBar />

      {/* account stats */}
      {summary ? (
        <>
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Account value"
              value={fmt$(summary.accountValue)}
            />
            <StatCard
              label="Trading balance"
              value={fmt$(summary.tradingBalance)}
              hint="withdrawable"
            />
            <StatCard
              label="Unrealized PnL"
              value={fmtPnl(summary.unrealizedPnl)}
              color={summary.unrealizedPnl >= 0 ? "emerald" : "rose"}
            />
            <StatCard
              label="Realized PnL"
              value={fmtPnl(summary.realizedPnl)}
              color={summary.realizedPnl >= 0 ? "emerald" : "rose"}
            />
            <StatCard
              label="Open exposure"
              value={fmt$(summary.openExposure)}
            />
            <StatCard
              label="Redeemable"
              value={fmt$(summary.redeemableValue)}
              color="amber"
            />
            <StatCard
              label="Open positions"
              value={String(summary.openPositions)}
            />
            <StatCard
              label="Awaiting settlement"
              value={String(summary.awaitingSettlement)}
            />
          </div>

          {/* Withdraw to wallet — only shown when there's a balance to pull out */}
          {managerId && summary.tradingBalance > 0 ? (
            <div className="mb-5">
              {showWithdraw ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-600/30 bg-emerald-500/5 p-3">
                  <span className="text-xs font-medium text-foreground">
                    Withdraw dUSDC to wallet
                  </span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={withdrawAmt}
                    onChange={(e) => setWithdrawAmt(e.target.value)}
                    placeholder={`max ${summary.tradingBalance.toFixed(2)}`}
                    className="w-28 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={() => void handleWithdraw(managerId)}
                    disabled={isWithdrawing || !(Number(withdrawAmt) > 0)}
                    className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {isWithdrawing ? "…" : "Confirm"}
                  </button>
                  <button
                    onClick={() => setShowWithdraw(false)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setWithdrawAmt(summary.tradingBalance.toFixed(2));
                    setShowWithdraw(true);
                  }}
                  className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-emerald-600/50 hover:text-emerald-400"
                >
                  ↑ Withdraw {fmt$(summary.tradingBalance)} to wallet
                </button>
              )}
            </div>
          ) : (
            <div className="mb-5" />
          )}
        </>
      ) : q.isLoading ? (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-lg border border-border bg-muted/10"
            />
          ))}
        </div>
      ) : data?.managerId === null ? (
        <div className="mb-6 rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          No PredictManager found. Mint a position to create one automatically.
        </div>
      ) : null}

      {/* position list */}
      {positions.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/5 text-left text-xs text-muted-foreground">
                <th className="px-4 py-3">Asset / Type</th>
                <th className="px-4 py-3">Strike / Range</th>
                <th className="px-4 py-3">Expiry</th>
                <th className="px-4 py-3">Cost</th>
                <th className="px-4 py-3">Mark</th>
                <th className="px-4 py-3">PnL</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {positions.map((p, i) => (
                <PositionRow
                  key={i}
                  position={p}
                  managerId={managerId}
                  isRedeeming={isRedeeming}
                  onRedeem={redeem}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : summary && positions.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No open positions. Head to{" "}
          <Link href="/prediction" className="text-emerald-400 hover:underline">
            Markets
          </Link>{" "}
          to mint one.
        </div>
      ) : null}

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Positions update every ~15 s. Not financial advice. Testnet only.
      </p>
    </div>
  );
}

// ─── position row ─────────────────────────────────────────────────────────────
function PositionRow({
  position: p,
  managerId,
  isRedeeming,
  onRedeem,
}: {
  position: Position;
  managerId: string | null | undefined;
  isRedeeming: boolean;
  onRedeem: (args: RedeemArgs) => void;
}) {
  const canRedeem =
    managerId && (p.status === "settled" || p.status === "redeemable");

  const strikeCell =
    p.kind === "range" ? (
      <span className="font-mono text-xs">
        ${p.lowerStrike.toLocaleString()} – ${p.higherStrike.toLocaleString()}
      </span>
    ) : (
      <span className="font-mono text-xs">${p.strike.toLocaleString()}</span>
    );

  const typeLabel =
    p.kind === "range" ? "Range" : p.isUp ? "↑ Up binary" : "↓ Down binary";

  const typeColor =
    p.kind === "range"
      ? "text-muted-foreground"
      : p.isUp
        ? "text-emerald-400"
        : "text-rose-400";

  const handleRedeem = () => {
    if (!managerId) return;
    if (p.kind === "range") {
      onRedeem({
        kind: "range",
        managerId,
        oracleId: p.oracleId,
        expiryMs: p.expiry,
        lowerUsd: p.lowerStrike,
        higherUsd: p.higherStrike,
        quantity: p.openQty,
      });
    } else {
      onRedeem({
        kind: "binary",
        managerId,
        oracleId: p.oracleId,
        expiryMs: p.expiry,
        strikeUsd: p.strike,
        isUp: p.isUp,
        quantity: p.openQty,
      });
    }
  };

  return (
    <tr className="text-sm transition-colors hover:bg-muted/5">
      <td className="px-4 py-3">
        <div className="font-medium">{p.asset}</div>
        <div className={`text-[11px] ${typeColor}`}>{typeLabel}</div>
      </td>
      <td className="px-4 py-3">{strikeCell}</td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {countdown(p.expiry)}
      </td>
      <td className="px-4 py-3 text-xs">{fmt$(p.cost)}</td>
      <td className="px-4 py-3 text-xs">{fmt$(p.markValue)}</td>
      <td
        className={`px-4 py-3 text-xs font-medium ${
          p.unrealizedPnl >= 0 ? "text-emerald-400" : "text-rose-400"
        }`}
      >
        {fmtPnl(p.unrealizedPnl)}
      </td>
      <td className="px-4 py-3">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
            STATUS_STYLES[p.status] ?? "bg-muted/20 text-muted-foreground"
          }`}
        >
          {p.status}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        {canRedeem ? (
          <button
            disabled={isRedeeming}
            onClick={handleRedeem}
            className="rounded-md bg-emerald-600/80 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Redeem
          </button>
        ) : null}
      </td>
    </tr>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  hint,
  color,
}: {
  label: string;
  value: string;
  hint?: string;
  color?: "emerald" | "rose" | "amber";
}) {
  const colorClass =
    color === "emerald"
      ? "text-emerald-400"
      : color === "rose"
        ? "text-rose-400"
        : color === "amber"
          ? "text-amber-400"
          : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-base font-semibold ${colorClass}`}>
        {value}
      </div>
      {hint ? (
        <div className="mt-0.5 text-[10px] text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  );
}
