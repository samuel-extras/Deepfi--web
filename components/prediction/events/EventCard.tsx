// DeepBook Predict market card — one oracle (asset + expiry) framed as a binary
// "above or below the ATM strike" question. Built from shadcn Card/Button/Badge.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Star, Info, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@/components/ui/button-group";
import type { PredictEvent } from "@/lib/events";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { BitcoinIcon } from "@/components/icons/token-icons";
import { useBetStore } from "@/stores/useBetStore";
import type {
  Direction,
  OracleDTO,
} from "@/components/prediction/terminal/types";

interface EventCardProps {
  event: PredictEvent;
  /** The soonest-to-settle live market — pinned first and badged "Current". */
  isCurrent?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string, e: React.MouseEvent) => void;
}

const usd0 = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

const formatVolume = (vol: number) => {
  if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(1)}m`;
  if (vol >= 1_000) return `$${(vol / 1_000).toFixed(1)}k`;
  return `$${vol.toFixed(0)}`;
};

/** Remaining time, ms > 0: "in 11m" · "in 2h 5m" · "in 3d". */
function countdown(ms: number): string {
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `in ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `in ${h}h ${m % 60}m`;
  return `in ${Math.floor(h / 24)}d`;
}

export function EventCard({
  event,
  isCurrent,
  isFavorite,
  onToggleFavorite,
}: EventCardProps) {
  const p = event.predict;
  const isActive = p.status === "active";
  // Stable action — selecting only `open` means the card never re-renders when
  // the modal opens/closes. Pass the full oracle so the modal renders instantly.
  const openBet = useBetStore((s) => s.open);
  const betOracle: OracleDTO = {
    oracleId: p.oracleId,
    asset: p.asset,
    expiry: p.expiry,
    status: p.status,
    minStrike: p.minStrike,
    tickSize: p.tickSize,
    settlementPrice: p.settlementPrice,
  };

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isActive) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [isActive]);

  // An "active" oracle past its expiry is awaiting on-chain settlement — not
  // tradeable. Mirror the terminal's live check (status active && expiry > now).
  const isLive = isActive && p.expiry > now;
  const isSettling = isActive && !isLive;

  const abovePct = p.aboveProb != null ? Math.round(p.aboveProb * 100) : null;
  const belowPct = abovePct != null ? 100 - abovePct : null;

  const rows = [
    { label: "Above", pct: abovePct, bar: "from-primary/15" },
    { label: "Below", pct: belowPct, bar: "from-destructive/15" },
  ];

  return (
    <Card className={cn("gap-0 transition-all bg-transparent")}>
      <CardContent className="flex flex-1 flex-col gap-3">
        {/* Header: asset chip · status · favourite */}
        <div className="flex items-center gap-2">
          <div className="flex size-10 shrink-0 items-center justify-center  font-bold text-[#F7931A]">
            <BitcoinIcon size={40} />
          </div>
          <div className="min-w-0 flex-1">
            {/* <Badge variant={badge.variant}>{badge.label}</Badge> */}
            <Link
              href={`/prediction/${p.oracleId}`}
              className="block text-sm leading-snug font-semibold transition-colors opacity-90 hover:opacity-100"
            >
              {event.title}
            </Link>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Toggle favourite"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleFavorite?.(event.id, e);
            }}
          >
            <Star
              className={cn(
                "transition-all",
                isFavorite ? "fill-white text-white " : "text-muted-foreground",
              )}
            />
          </Button>
        </div>

        {/* Question + meta */}
        <div>
          <p className=" text-xs text-muted-foreground">
            {isLive ? (
              <>Expires {countdown(p.expiry - now)}</>
            ) : isSettling ? (
              <>past expiry · awaiting settlement</>
            ) : (
              <>settled</>
            )}
          </p>
        </div>

        {/* Choices (live) · pending (settling) · resolution (settled) */}
        {isLive ? (
          <div className="flex flex-col gap-2">
            {rows.map((row) => {
              // "Above Yes" = bet BTC settles up; "Below Yes" = down. "No" flips.
              const yesDir: Direction = row.label === "Above" ? "up" : "down";
              const noDir: Direction = yesDir === "up" ? "down" : "up";
              return (
                <div
                  key={row.label}
                  className="relative flex items-center justify-between gap-3 overflow-hidden rounded-full bg-muted/30 px-3 py-2"
                >
                  <div className="relative z-10 flex flex-1 justify-between items-baseline gap-2">
                    <span className="text-sm font-medium">{row.label}</span>
                    {row.pct != null && (
                      <span className="text-xs text-muted-foreground">
                        ~{row.pct}¢
                      </span>
                    )}
                  </div>
                  <ButtonGroup className="gap-0!">
                    <Button
                      variant="success"
                      size="sm"
                      className="rounded-l-full! "
                      onClick={() => openBet(betOracle, yesDir)}
                    >
                      Yes
                    </Button>
                    {/* <ButtonGroupSeparator /> */}
                    <Button
                      variant="destructive"
                      size="sm"
                      className="-ml-px px-3"
                      onClick={() => openBet(betOracle, noDir)}
                    >
                      No
                    </Button>
                  </ButtonGroup>
                </div>
              );
            })}
          </div>
        ) : isSettling ? (
          <div className="flex items-center justify-center rounded-full border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground mt-auto">
            Awaiting settlement price
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-full border bg-muted/30 px-3 py-2.5 mt-auto">
            <span className="text-xs text-muted-foreground">Settlement</span>
            <span className="text-base font-bold">
              {p.settlementPrice != null ? usd0(p.settlementPrice) : "—"}
            </span>
          </div>
        )}
      </CardContent>

      {/* Footer: volume · detail link */}
      <CardFooter className="gap-1 bg-transparent border-t-0">
        {isLive ? (
          <span className="size-1.5 animate-pulse rounded-full bg-green-400" />
        ) : isSettling ? (
          <span className="size-1.5 animate-pulse rounded-full bg-yellow-400" />
        ) : (
          <span className="size-1.5 rounded-full bg-red-400" />
        )}
        {p.atmIv != null && p.atmIv < 1000 && (
          <span className="text-xs text-muted-foreground hover:text-foreground">
            {" "}
            {p.atmIv.toFixed(0)}% IV ·
          </span>
        )}
        {event.volume && event?.volume >= 1 ? (
          <span className="text-xs text-muted-foreground hover:text-foreground">
            {formatVolume(event.volume || 0)} Vol. &nbsp; {" · "}
          </span>
        ) : null}

        <HoverCard openDelay={10} closeDelay={100}>
          <HoverCardTrigger asChild>
            <Button variant="ghost" size="icon-sm">
              <Info />
            </Button>
          </HoverCardTrigger>
          <HoverCardContent className="flex w-64 flex-col gap-0.5">
            <p className="text-sm text-muted-foreground">
              ≈ SVI fair value · final price set at trade
            </p>
          </HoverCardContent>
        </HoverCard>

        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 ms-auto text-foreground opacity-90 hover:opacity-100 text-xs"
          asChild
        >
          <Link href={`/prediction/${p.oracleId}`}>
            {isLive ? "Other options" : isSettling ? "View" : "Redeem "}
            <ChevronRight className="size-3.5" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
