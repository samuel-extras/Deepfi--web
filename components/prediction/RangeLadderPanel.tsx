"use client";

/**
 * Range Ladder panel — mint a strip of adjacent ranges across the ATM strike in
 * one atomic PTB (the "Range Ladder Vault" strategy). UI-only: the PTB flow
 * lives in `usePredictLadderMint`, shared with the trade ticket's Ladder tab.
 */
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { useState } from "react";

import { usePredictLadderMint } from "@/hooks/usePredictLadderMint";
import { Button } from "@/components/ui/button";

interface OracleDTO {
  oracleId: string;
  asset: string;
  expiry: number;
  status: string;
  minStrike: number;
  tickSize: number;
}

function snapToTick(price: number, minStrike: number, tick: number): number {
  if (!(tick > 0)) return Math.round(price);
  return minStrike + Math.round((price - minStrike) / tick) * tick;
}

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

interface RangeLadderPanelProps {
  oracle: OracleDTO;
  forward?: number;
}

export default function RangeLadderPanel({ oracle, forward }: RangeLadderPanelProps) {
  const account = useActiveAccount();
  const { mint, isMinting, status } = usePredictLadderMint();

  const [rungs, setRungs] = useState(4);
  const [totalAmount, setTotalAmount] = useState("20");
  const [center, setCenter] = useState<"atm" | "up" | "down">("atm");

  const tick = Math.max(oracle.tickSize, 1);
  const atm = forward ? snapToTick(forward, oracle.minStrike, tick) : null;

  const legs = (() => {
    if (atm == null) return [] as { lower: number; upper: number; label: string }[];
    const centerOffset =
      center === "up" ? Math.floor(rungs / 2) : center === "down" ? -Math.ceil(rungs / 2) : 0;
    return Array.from({ length: rungs }, (_, i) => {
      const idx = i - Math.floor(rungs / 2) + centerOffset;
      const lower = atm + idx * tick;
      const upper = lower + tick;
      return { lower, upper, label: `${usd(lower)}–${usd(upper)}` };
    });
  })();

  const execute = () =>
    void mint({
      oracleId: oracle.oracleId,
      expiryMs: oracle.expiry,
      legs: legs.map(l => ({ lowerUsd: l.lower, higherUsd: l.upper })),
      amountDusdc: Number(totalAmount),
    });

  return (
    <div className="rounded-lg border border-emerald-600/25 bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">Range Ladder</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Mint a strip of adjacent ranges in one atomic PTB — spreads exposure across strikes.
          </p>
        </div>
        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400 uppercase">
          Multi-leg PTB
        </span>
      </div>

      {/* controls */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            Rungs <span className="text-foreground">{rungs}</span>
          </label>
          <input
            type="range" min={2} max={8} step={1} value={rungs}
            onChange={e => setRungs(Number(e.target.value))}
            className="w-full accent-emerald-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Center</label>
          <div className="flex gap-1">
            {(["down", "atm", "up"] as const).map(c => (
              <button
                key={c}
                onClick={() => setCenter(c)}
                className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                  center === c ? "bg-emerald-600 text-white" : "border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {c === "atm" ? "ATM" : c === "up" ? "↑ Up" : "↓ Down"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* leg preview */}
      {legs.length > 0 && atm != null ? (
        <div className="mb-4 rounded-md bg-muted/10 p-3">
          <div className="mb-2 text-xs font-medium text-muted-foreground">Legs preview</div>
          <div className="flex flex-wrap gap-1">
            {legs.map((l, i) => (
              <span
                key={i}
                className="rounded-full border border-border px-2 py-0.5 text-[10px] text-foreground font-mono"
              >
                {l.label}
              </span>
            ))}
          </div>
          <div className="mt-2 text-[10px] text-muted-foreground">
            {rungs} × {usd(Number(totalAmount) / rungs)} dUSDC per rung · one atomic PTB
          </div>
        </div>
      ) : null}

      {/* amount */}
      <div className="mb-3 flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
        <input
          type="number" min="0" step="5" value={totalAmount}
          onChange={e => setTotalAmount(e.target.value)}
          className="w-full bg-transparent text-sm text-foreground outline-none"
          placeholder="Total dUSDC"
        />
        <span className="text-xs text-muted-foreground">dUSDC total</span>
      </div>

      <Button
        size="lg"
        onClick={execute}
        disabled={isMinting || !account?.address || atm == null}
        className="w-full rounded-full"
      >
        {!account?.address
          ? "Connect wallet"
          : isMinting
            ? (status ?? "Building…")
            : `Deploy ${rungs}-rung Ladder`}
      </Button>
    </div>
  );
}
