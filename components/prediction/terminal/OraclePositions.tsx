"use client";

/**
 * The connected wallet's open positions in the current oracle. Pulls the live
 * PredictManager portfolio (/api/portfolio) and filters to this market.
 */
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import type { OracleDTO } from "./types";
import { usd0 } from "./types";
import Link from "next/link";

type Position = {
  oracleId: string;
  kind: "binary" | "range";
  isUp?: boolean;
  strike?: number;
  lowerStrike?: number;
  higherStrike?: number;
  openQty: number;
  cost: number;
  markValue: number;
  unrealizedPnl: number;
  realizedPnl: number;
  status: string;
};

const usd = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });

export default function OraclePositions({ oracle }: { oracle: OracleDTO }) {
  const account = useActiveAccount();
  const owner = account?.address;

  const q = useQuery({
    queryKey: ["predict", "portfolio", owner],
    queryFn: () => fetch(`/api/portfolio?owner=${owner}`).then((r) => r.json()),
    enabled: !!owner,
    refetchInterval: 10_000,
  });

  if (!owner) {
    return (
      <Empty className="border-0 py-10">
        <EmptyHeader>
          <EmptyTitle>Wallet not connected</EmptyTitle>
          <EmptyDescription>
            Connect your wallet to see your positions in this market.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (q.isLoading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-2.5 w-28" />
            </div>
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </div>
    );
  }

  const all: Position[] = q.data?.positions ?? [];
  const mine = all.filter((p) => p.oracleId === oracle.oracleId);

  if (!mine.length) {
    return (
      <Empty className="border-0 py-10">
        <EmptyHeader>
          <EmptyTitle>No open positions</EmptyTitle>
          <EmptyDescription>
            You have no positions in this market.{" "}
            <Link href="/portfolio">View full portfolio →</Link>
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="divide-y divide-border">
      {mine.map((p, i) => {
        const up = p.unrealizedPnl >= 0;
        return (
          <div
            key={i}
            className="flex items-center justify-between gap-3 px-4 py-3"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    p.kind === "range"
                      ? "secondary"
                      : p.isUp
                        ? "success"
                        : "destructive"
                  }
                >
                  {p.kind === "range" ? "Range" : p.isUp ? "Up" : "Down"}
                </Badge>
                <span className="truncate text-xs font-bold text-foreground">
                  {p.kind === "binary"
                    ? `${p.isUp ? "Above" : "Below"} ${usd0(p.strike ?? 0)}`
                    : `${usd0(p.lowerStrike ?? 0)} – ${usd0(p.higherStrike ?? 0)}`}
                </span>
              </div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                {p.openQty.toFixed(2)} contracts · cost {usd(p.cost)} ·{" "}
                {p.status}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-mono text-sm font-semibold tabular-nums text-foreground">
                {usd(p.markValue)}
              </div>
              <div
                className={cn(
                  "font-mono text-[10px] font-bold tabular-nums",
                  up ? "text-primary" : "text-destructive",
                )}
              >
                {up ? "+" : ""}
                {usd(p.unrealizedPnl)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
