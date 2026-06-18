// DeepBook Predict market — list/table row. Mirrors the grid card: live "above"
// price (SVI fair value), real IV, full UTC expiry + countdown, and the
// Current / Settling / Settled lifecycle. Built from shadcn Table/Button/Badge.
import React from "react";
import Link from "next/link";
import { ChevronDown, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { PredictEvent, expiryLabel } from "@/lib/events";

interface EventTableRowProps {
  event: PredictEvent;
  isExpanded: boolean;
  isCurrent?: boolean;
  isFavorite: boolean;
  onToggleExpand: () => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
  formatCurrency: (val?: number) => string;
  formatDate: (dateStr?: string) => string;
}

const usd0 = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

/** Remaining time, ms > 0: "in 11m" · "in 2h 5m" · "in 3d". */
function countdown(ms: number): string {
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `in ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `in ${h}h ${m % 60}m`;
  return `in ${Math.floor(h / 24)}d`;
}

export function EventTableRow({
  event,
  isExpanded,
  isCurrent,
  isFavorite,
  onToggleExpand,
  onToggleFavorite,
  formatCurrency,
}: EventTableRowProps) {
  const p = event.predict;
  const now = Date.now();
  const isActive = p.status === "active";
  const isLive = isActive && p.expiry > now;
  const isSettling = isActive && !isLive;
  const current = !!isCurrent && isLive;

  const abovePct = p.aboveProb != null ? Math.round(p.aboveProb * 100) : null;
  const belowPct = abovePct != null ? 100 - abovePct : null;

  const badge = current
    ? { label: "Current", variant: "default" as const }
    : isSettling
      ? { label: "Settling", variant: "outline" as const }
      : !isActive
        ? { label: "Settled", variant: "secondary" as const }
        : null;

  return (
    <React.Fragment>
      <TableRow className="group cursor-pointer" onClick={onToggleExpand}>
        <TableCell>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Toggle favourite"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(e);
              }}
            >
              <Star
                className={cn(
                  isFavorite
                    ? "fill-[#FFD700] text-[#FFD700]"
                    : "text-muted-foreground",
                )}
              />
            </Button>
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[#F7931A]/15 text-[10px] font-bold text-[#F7931A]">
              {p.asset}
            </div>
            <span className="line-clamp-1 font-medium transition-colors group-hover:text-primary">
              {event.title}
            </span>
            {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
            <ChevronDown
              className={cn(
                "ml-auto size-4 shrink-0 text-muted-foreground transition-transform",
                isExpanded && "rotate-180",
              )}
            />
          </div>
        </TableCell>
        <TableCell className="text-right">
          {isLive && abovePct != null ? (
            <span className="font-medium text-primary">~{abovePct}¢</span>
          ) : !isActive && p.settlementPrice != null ? (
            <span>{usd0(p.settlementPrice)}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell className="text-right font-medium">
          {formatCurrency(event.volume)}
        </TableCell>
        <TableCell className="text-right text-muted-foreground">
          {p.atmIv != null && p.atmIv < 1000 ? `${p.atmIv.toFixed(0)}%` : "—"}
        </TableCell>
        <TableCell className="text-right">
          <div>{expiryLabel(p.expiry)}</div>
          <div className="text-xs text-muted-foreground">
            {isLive
              ? countdown(p.expiry - now)
              : isSettling
                ? "awaiting settlement"
                : "settled"}
          </div>
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell className="pl-14" colSpan={5}>
            {isLive ? (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                {p.atmStrike != null && (
                  <span className="text-muted-foreground">
                    strike {usd0(p.atmStrike)}
                  </span>
                )}
                <div className="flex gap-2">
                  <Button variant="success" size="sm">
                    Above {abovePct != null && `~${abovePct}¢`}
                  </Button>
                  <Button variant="destructive" size="sm">
                    Below {belowPct != null && `~${belowPct}¢`}
                  </Button>
                </div>
                <span className="text-xs text-muted-foreground">
                  ≈ SVI fair value · final price set at trade
                </span>
                <Button
                  variant="link"
                  size="sm"
                  className="ml-auto h-auto p-0"
                  asChild
                >
                  <Link href={`/prediction/${p.oracleId}`}>Open market →</Link>
                </Button>
              </div>
            ) : isSettling ? (
              <span className="text-muted-foreground">
                Past expiry · awaiting settlement price
              </span>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  Settled at{" "}
                  <span className="text-foreground">
                    {p.settlementPrice != null ? usd0(p.settlementPrice) : "—"}
                  </span>
                </span>
                <Button variant="link" size="sm" className="h-auto p-0" asChild>
                  <Link href={`/prediction/${p.oracleId}`}>Redeem →</Link>
                </Button>
              </div>
            )}
          </TableCell>
        </TableRow>
      )}
    </React.Fragment>
  );
}
