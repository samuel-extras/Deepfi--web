"use client";

/**
 * Account positions strip for the pro terminal — spot-style: a tab bar
 * (This Market / All Positions) over a sortable data table, with a per-row
 * Redeem action (sells/claims the position back to the vault via predict::redeem
 * / redeem_range). Data is the live PredictManager portfolio (/api/portfolio).
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConnectWalletDialog } from "@/components/wallet/ConnectWalletDialog";
import { DataTable, SortHeader } from "@/components/spot/Account/DataTable";
import { cn } from "@/lib/utils";
import { RedeemModal } from "./RedeemModal";
import type { OracleDTO } from "./types";
import { CONTRACT_SCALE, clockTime, usd0 } from "./types";

type Position = {
  oracleId: string;
  asset: string;
  expiry: number;
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

type PortfolioResp = {
  ok: boolean;
  managerId: string | null;
  positions?: Position[];
};

type TabId = "market" | "all";

const usd = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });

function PositionCell({ p, showMarket }: { p: Position; showMarket: boolean }) {
  return (
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
      {showMarket ? (
        <div className="mt-0.5 text-[10px] text-nav-inactive">
          {p.asset} · settles {clockTime(p.expiry)}
        </div>
      ) : null}
    </div>
  );
}

function makeColumns(
  showMarket: boolean,
  onRedeem: (p: Position) => void,
): ColumnDef<Position>[] {
  const right = "block text-right tabular-nums";
  return [
    {
      id: "position",
      header: "Position",
      cell: ({ row }) => <PositionCell p={row.original} showMarket={showMarket} />,
    },
    {
      accessorKey: "openQty",
      header: ({ column }) => (
        <SortHeader column={column} title="Contracts" align="right" />
      ),
      cell: ({ row }) => (
        <span className={right}>
          {(row.original.openQty / CONTRACT_SCALE).toFixed(2)}
        </span>
      ),
    },
    {
      accessorKey: "cost",
      header: ({ column }) => (
        <SortHeader column={column} title="Cost" align="right" />
      ),
      cell: ({ row }) => <span className={right}>{usd(row.original.cost)}</span>,
    },
    {
      accessorKey: "markValue",
      header: ({ column }) => (
        <SortHeader column={column} title="Value" align="right" />
      ),
      cell: ({ row }) => (
        <span className={right}>{usd(row.original.markValue)}</span>
      ),
    },
    {
      accessorKey: "unrealizedPnl",
      header: ({ column }) => (
        <SortHeader column={column} title="PnL" align="right" />
      ),
      cell: ({ row }) => {
        const v = row.original.unrealizedPnl;
        return (
          <span
            className={cn(
              right,
              "font-semibold",
              v >= 0 ? "text-primary" : "text-destructive",
            )}
          >
            {v >= 0 ? "+" : ""}
            {usd(v)}
          </span>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <span className="capitalize text-nav-inactive">
          {row.original.status}
        </span>
      ),
    },
    {
      id: "action",
      header: () => <div className="text-right">Action</div>,
      cell: ({ row }) => {
        const p = row.original;
        // Fully redeemed (< 0.005 contracts) → nothing left to act on.
        if (p.openQty / CONTRACT_SCALE < 0.005)
          return (
            <div className="text-right text-[10px] text-nav-inactive">
              Redeemed
            </div>
          );
        return (
          <div className="text-right">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onRedeem(p)}
              className="h-7 rounded-full px-3 text-xs"
            >
              {p.status === "settled" ? "Claim" : "Redeem"}
            </Button>
          </div>
        );
      },
    },
  ];
}

export default function OraclePositions({ oracle }: { oracle: OracleDTO }) {
  const owner = useActiveAccount()?.address;
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabId>("market");
  const [redeemTarget, setRedeemTarget] = useState<Position | null>(null);

  const q = useQuery<PortfolioResp>({
    queryKey: ["predict", "portfolio", owner],
    queryFn: () => fetch(`/api/portfolio?owner=${owner}`).then((r) => r.json()),
    enabled: !!owner,
    refetchInterval: 10_000,
  });

  const managerId = q.data?.managerId ?? null;
  const all = useMemo(() => q.data?.positions ?? [], [q.data]);
  const mine = useMemo(
    () => all.filter((p) => p.oracleId === oracle.oracleId),
    [all, oracle.oracleId],
  );

  const rows = tab === "market" ? mine : all;
  const columns = useMemo(
    () => makeColumns(tab === "all", setRedeemTarget),
    [tab],
  );

  const TABS: { id: TabId; label: string; count: number }[] = [
    { id: "market", label: "This Market", count: mine.length },
    { id: "all", label: "All Positions", count: all.length },
  ];

  return (
    <div className="flex h-full flex-col bg-[#121417]">
      {/* tab bar */}
      <div className="flex h-10 shrink-0 items-center border-b border-border">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "relative h-full px-4 text-xs transition-colors",
                active ? "text-white" : "text-nav-inactive hover:text-white",
              )}
            >
              {t.label}
              {t.count > 0 ? ` (${t.count})` : ""}
              {active ? (
                <div className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-foreground" />
              ) : null}
            </button>
          );
        })}
      </div>

      {/* body */}
      <div className="min-h-0 flex-1 overflow-auto">
        {!owner ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-nav-inactive">
              Connect your wallet to see your positions.
            </p>
            <ConnectWalletDialog
              trigger={
                <Button className="h-8 rounded-full bg-primary px-5 text-xs font-semibold text-[#121417] hover:bg-primary/90">
                  Connect wallet
                </Button>
              }
            />
          </div>
        ) : q.isLoading ? (
          <div className="p-4 text-xs text-nav-inactive">Loading positions…</div>
        ) : (
          <DataTable
            columns={columns}
            data={rows}
            empty={
              tab === "market"
                ? "No positions in this market."
                : "No open positions yet."
            }
          />
        )}
      </div>

      <RedeemModal
        key={
          redeemTarget
            ? `${redeemTarget.oracleId}:${redeemTarget.kind}:${redeemTarget.strike ?? ""}:${redeemTarget.lowerStrike ?? ""}:${redeemTarget.higherStrike ?? ""}`
            : "none"
        }
        position={redeemTarget}
        managerId={managerId}
        onOpenChange={(o) => {
          if (!o) setRedeemTarget(null);
        }}
        onRedeemed={() =>
          queryClient.invalidateQueries({
            queryKey: ["predict", "portfolio", owner],
          })
        }
      />
    </div>
  );
}
