"use client";

/**
 * Top holders for the current oracle — largest premium paid per trader,
 * aggregated from binary + range mints (see /api/oracles/:id/holders).
 */
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

type Side = "up" | "down" | "range" | "mixed";
type Holder = {
  address: string;
  sizeDusdc: number;
  trades: number;
  side: Side;
};

const usd = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n < 100 ? 2 : 0,
  });

const shortAddr = (a: string) =>
  a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—";

const SIDE: Record<
  Side,
  { label: string; variant: "success" | "destructive" | "secondary" | "outline" }
> = {
  up: { label: "Up", variant: "success" },
  down: { label: "Down", variant: "destructive" },
  range: { label: "Range", variant: "secondary" },
  mixed: { label: "Mixed", variant: "outline" },
};

export default function OracleTopHolders({ oracleId }: { oracleId: string }) {
  const q = useQuery({
    queryKey: ["predict", "holders", oracleId],
    queryFn: () =>
      fetch(`/api/oracles/${oracleId}/holders`).then((r) => r.json()),
    refetchInterval: 15_000,
  });
  const holders: Holder[] = q.data?.holders ?? [];

  if (q.isLoading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-7 rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-2.5 w-16" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (!holders.length) {
    return (
      <Empty className="border-0 py-10">
        <EmptyHeader>
          <EmptyTitle>No holders yet</EmptyTitle>
          <EmptyDescription>
            No positions in this market yet — be the first to take a side.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="divide-y divide-border">
      {holders.map((h, i) => {
        const s = SIDE[h.side];
        return (
          <div key={h.address} className="flex items-center gap-3 px-4 py-2.5">
            <span className="w-4 text-center text-xs font-bold tabular-nums text-muted-foreground">
              {i + 1}
            </span>
            <Avatar size="sm">
              <AvatarFallback>
                {h.address.slice(2, 4).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate font-mono text-xs text-foreground">
                {shortAddr(h.address)}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {h.trades} trade{h.trades === 1 ? "" : "s"}
              </div>
            </div>
            <Badge variant={s.variant}>{s.label}</Badge>
            <span className="w-20 text-right font-mono text-sm font-semibold tabular-nums text-foreground">
              {usd(h.sizeDusdc)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
