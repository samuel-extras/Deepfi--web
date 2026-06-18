"use client";

/**
 * PLP + Crash Hedge (#2, Level 1) — supply PLP and buy an OTM down-binary as
 * left-tail insurance in ONE atomic PTB. The hedge strike + fair price come from
 * the live on-chain SVI surface. PLP yield with a capped crash.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ivFromRawSvi,
  probInRange,
  type RawSviParams,
} from "@/lib/svi";
import { usePredictHedgedSupply } from "@/hooks/usePredictHedgedSupply";

type SviResp = {
  ok: boolean;
  oracleId: string;
  asset: string;
  expiry: number;
  forward: number;
  atmIv: number;
  params: RawSviParams;
};
type RiskResp = {
  ok: boolean;
  summary?: { utilization: number };
  points?: { t: number; sharePrice: number }[];
};

const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;
const usd = (n: number, d = 2) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: d });
const PROTECTION = [1, 2, 3, 5]; // % below spot

export default function HedgedPlp() {
  const sviQ = useQuery({
    queryKey: ["predict", "svi", "hedge"],
    queryFn: () => fetch("/api/svi").then((r) => r.json() as Promise<SviResp>),
    refetchInterval: 15_000,
  });
  const riskQ = useQuery({
    queryKey: ["predict", "vault-risk", "hedge"],
    queryFn: () => fetch("/api/vault/risk").then((r) => r.json() as Promise<RiskResp>),
    refetchInterval: 30_000,
  });
  const { execute, isPending, status, isConnected } = usePredictHedgedSupply();

  const [supply, setSupply] = useState("100");
  const [protectPct, setProtectPct] = useState(2);
  const [hedgeRatio, setHedgeRatio] = useState(8); // % of supply

  const svi = sviQ.data;
  const grossApy = useMemo(() => {
    const pts = riskQ.data?.points ?? [];
    if (pts.length < 2) return null;
    const years = (pts[pts.length - 1].t - pts[0].t) / MS_PER_YEAR;
    if (years <= 0 || pts[0].sharePrice <= 0) return null;
    return Math.pow(pts[pts.length - 1].sharePrice / pts[0].sharePrice, 1 / years) - 1;
  }, [riskQ.data]);

  const calc = useMemo(() => {
    if (!svi?.ok || !svi.forward) return null;
    const now = Date.now();
    const spot = svi.forward;
    const tYears = Math.max(1e-6, (svi.expiry - now) / MS_PER_YEAR);
    const minutes = Math.max(1, Math.round((svi.expiry - now) / 60_000));
    const strike = Math.round(spot * (1 - protectPct / 100));
    const iv = ivFromRawSvi(strike, spot, svi.params, tYears);
    const priceBelow = Math.max(
      0.001,
      probInRange(spot, 0, strike, iv, tYears),
    ); // fair down-binary price per $1
    const sigmaFrac = (svi.atmIv / 100) * Math.sqrt(tYears);
    const inSigma = sigmaFrac > 0 ? protectPct / 100 / sigmaFrac : 0;
    const supplyN = Math.max(0, Number(supply) || 0);
    const hedgeN = supplyN * (hedgeRatio / 100);
    const payout = hedgeN / priceBelow; // max payout if BTC < strike
    const coverPct = supplyN > 0 ? (payout / supplyN) * 100 : 0;
    return {
      spot,
      strike,
      minutes,
      iv,
      priceBelow,
      inSigma,
      supplyN,
      hedgeN,
      payout,
      coverPct,
      total: supplyN + hedgeN,
    };
  }, [svi, protectPct, supply, hedgeRatio]);

  const onSubmit = () => {
    if (!svi?.ok || !calc) return;
    void execute({
      oracleId: svi.oracleId,
      expiryMs: svi.expiry,
      supplyDusdc: calc.supplyN,
      hedgeDusdc: hedgeRatio > 0 ? calc.hedgeN : 0,
      hedgeStrikeUsd: calc.strike,
    });
  };

  return (
    <Card className="mt-6">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">PLP + Crash Hedge</CardTitle>
          <CardDescription className="text-xs">
            Supply to PLP and buy downside crash insurance in one transaction —
            vault yield with a capped left tail.
          </CardDescription>
        </div>
        <Badge variant="success">1 PTB</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {sviQ.isLoading || !svi?.ok || !calc ? (
          <Skeleton className="h-44 w-full rounded-lg" />
        ) : (
          <>
            {/* inputs */}
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Supply to PLP (dUSDC)
                </label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={supply}
                  onChange={(e) => setSupply(e.target.value)}
                  className="font-mono"
                />
                <div className="mt-1.5 flex gap-1">
                  {["50", "100", "250", "500"].map((v) => (
                    <Button
                      key={v}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => setSupply(v)}
                    >
                      {v}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Crash protection (strike below spot)
                </label>
                <ToggleGroup
                  type="single"
                  value={String(protectPct)}
                  onValueChange={(v) => v && setProtectPct(Number(v))}
                  className="justify-start"
                >
                  {PROTECTION.map((p) => (
                    <ToggleGroupItem key={p} value={String(p)} className="px-3 text-xs">
                      −{p}%
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Hedge size</span>
                  <span className="font-mono text-foreground">
                    {hedgeRatio}% of supply
                  </span>
                </div>
                <Slider
                  value={[hedgeRatio]}
                  onValueChange={([v]) => setHedgeRatio(v)}
                  min={0}
                  max={25}
                  step={1}
                />
              </div>
            </div>

            {/* summary */}
            <div className="flex flex-col gap-2 rounded-lg bg-white/[0.03] p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">PLP supply</span>
                <span className="font-mono text-foreground">
                  {usd(calc.supplyN, 0)}
                  {grossApy != null ? (
                    <span className="ml-1 text-primary">· {(grossApy * 100).toFixed(1)}% APY</span>
                  ) : null}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  Crash hedge ↓ below {usd(calc.strike, 0)}
                </span>
                <span className="font-mono text-foreground">
                  {hedgeRatio > 0 ? usd(calc.hedgeN) : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>
                  −{protectPct}% (≈{calc.inSigma.toFixed(1)}σ) · expires {calc.minutes}m
                </span>
                {hedgeRatio > 0 ? (
                  <span>
                    pays up to{" "}
                    <span className="text-foreground">{usd(calc.payout, 0)}</span> (
                    {calc.coverPct.toFixed(0)}% of supply)
                  </span>
                ) : (
                  <span>no hedge — supply only</span>
                )}
              </div>
              <div className="mt-1 flex items-center justify-between border-t border-white/5 pt-2">
                <span className="font-medium text-foreground">Total dUSDC</span>
                <span className="font-mono text-sm font-semibold text-foreground">
                  {usd(calc.total)}
                </span>
              </div>
            </div>

            {hedgeRatio > 0 ? (
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                Insurance covers this ~{calc.minutes}m cycle. Continuous hedging
                every cycle is costly — best used tactically during high-risk
                windows. Sell/roll the hedge from Portfolio before expiry.
              </p>
            ) : null}

            {/* action */}
            {!isConnected ? (
              <Button disabled className="w-full">
                Connect wallet to supply
              </Button>
            ) : (
              <Button
                className="w-full"
                disabled={isPending || calc.supplyN <= 0}
                onClick={onSubmit}
              >
                {isPending
                  ? (status ?? "Working…")
                  : hedgeRatio > 0
                    ? "Supply + Hedge"
                    : "Supply PLP"}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
