// Merged rolling-series card — one card for a run of same-cadence oracles (e.g.
// the 15-min BTC up/down series) instead of N near-identical cards. The gauge +
// Up/Down act on the soonest-to-settle ("current") member, which rolls forward.
// Live buys stream in as "+$X" floats: green rising on Up, red on Down.
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { PredictEvent, MintActivity } from "@/lib/events";
import { BitcoinIcon } from "@/components/icons/token-icons";

interface SeriesCardProps {
  asset: string;
  intervalLabel: string;
  count: number;
  current: PredictEvent;
  oracleIds: string[];
  recentMints: MintActivity[];
  isFavorite?: boolean;
  onToggleFavorite?: (id: string, e: React.MouseEvent) => void;
}

const ASSET_NAME: Record<string, string> = { BTC: "Bitcoin", ETH: "Ethereum" };

const fmtCost = (c: number) =>
  c >= 1 ? `$${Math.round(c)}` : `$${c.toFixed(2)}`;

type Float = {
  id: string;
  side: "up" | "down";
  amount: number;
  jitter: number;
};

export function SeriesCard({
  asset,
  intervalLabel,
  count,
  current,
  oracleIds,
  recentMints,
  isFavorite,
  onToggleFavorite,
}: SeriesCardProps) {
  const p = current.predict;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const upPct = p.aboveProb != null ? Math.round(p.aboveProb * 100) : null;
  const secs = Math.max(0, Math.floor((p.expiry - now) / 1000));
  const mmss = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

  const R = 26;
  const C = 2 * Math.PI * R;
  const frac = (upPct ?? 50) / 100;

  // ── Live buy feed: spawn a rising "+$X" float per new mint on this series ──
  const memberSet = useMemo(() => new Set(oracleIds), [oracleIds]);
  const seen = useRef<Set<string>>(new Set());
  const ready = useRef(false);
  const seq = useRef(0);
  const [floats, setFloats] = useState<Float[]>([]);

  useEffect(() => {
    const mine = recentMints.filter((m) => memberSet.has(m.oracleId));
    if (!mine.length) return;

    let toShow: MintActivity[];
    if (!ready.current) {
      ready.current = true;
      toShow = mine.slice(0, 3);
      mine.forEach((m) => seen.current.add(m.key));
    } else {
      toShow = mine.filter((m) => !seen.current.has(m.key));
      toShow.forEach((m) => seen.current.add(m.key));
    }
    if (!toShow.length) return;

    const created: Float[] = toShow.slice(0, 6).map((m) => ({
      id: `f${seq.current++}`,
      side: m.isUp ? "up" : "down",
      amount: m.cost,
      jitter: Math.floor(Math.random() * 34),
    }));
    setFloats((prev) => [...prev, ...created]);
    const t = setTimeout(() => {
      setFloats((prev) =>
        prev.filter((f) => !created.some((c) => c.id === f.id)),
      );
    }, 2400);
    return () => clearTimeout(t);
  }, [recentMints, memberSet]);

  return (
    <Card className="gap-0 ring-primary/30 transition-all hover:ring-primary/60 bg-linear-to-tr from-[#0a0a0a] to-transparent">
      <style>{`@keyframes dbFloat{0%{opacity:0;transform:translateY(8px)}15%{opacity:1}100%{opacity:0;transform:translateY(-30px)}}`}</style>

      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl  text-lg font-bold text-white">
            {/* {asset === "BTC" ? "₿" : asset[0]} */}
            <BitcoinIcon size={40} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm leading-tight font-bold">
              {asset} Up or Down {intervalLabel}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              next settles in {mmss} · {count} rolling
            </p>
          </div>
          <div className="relative size-12 shrink-0">
            <svg viewBox="0 0 64 64" className="size-11 -rotate-90">
              <circle
                cx="32"
                cy="32"
                r={R}
                fill="none"
                strokeWidth="4"
                style={{ stroke: "var(--muted)" }}
              />
              <circle
                cx="32"
                cy="32"
                r={R}
                fill="none"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - frac)}
                style={{ stroke: "var(--primary)" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] leading-none font-semibold">
                {upPct != null ? `${upPct}%` : "—"}
              </span>
              <span className="text-[10px] text-muted-foreground">Up</span>
            </div>
          </div>
        </div>

        {/* Up / Down with the live buy floats rising just above them */}
        <div className="relative">
          <div className="pointer-events-none absolute inset-x-2 bottom-full mb-1 h-9">
            {floats.map((f) => (
              <span
                key={f.id}
                className={cn(
                  "absolute bottom-0 text-xs font-bold tabular-nums",
                  f.side === "up" ? "text-primary" : "text-destructive",
                )}
                style={{
                  [f.side === "up" ? "left" : "right"]: `${6 + f.jitter}%`,
                  animation: "dbFloat 2.2s ease-out forwards",
                }}
              >
                +{fmtCost(f.amount)}
              </span>
            ))}
          </div>
          <div className="flex flex-col gap-3">
            <Button
              variant="success"
              className="h-12  text-base rounded-full"
              asChild
            >
              <Link href={`/prediction/${p.oracleId}`}>Up</Link>
            </Button>
            <Button
              variant="destructive"
              className="h-12  text-base rounded-full"
              asChild
            >
              <Link href={`/prediction/${p.oracleId}`}>Down</Link>
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="destructive" className="gap-1.5 text-xs">
              <span className="size-1.5 animate-pulse rounded-full bg-destructive" />
              LIVE
            </Badge>
            <span className="text-muted-foreground">
              {ASSET_NAME[asset] ?? asset}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Toggle favourite"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleFavorite?.(current.id, e);
            }}
          >
            <Bookmark
              className={cn(
                isFavorite
                  ? "fill-[#FFD700] text-[#FFD700]"
                  : "text-muted-foreground",
              )}
            />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
