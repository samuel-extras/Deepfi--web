"use client";

/**
 * Margin account strip — perp-terminal style tabs:
 * Position (risk gauge + collateral/loan management) · Open Orders ·
 * TP / SL · Order History · Earn.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { ConnectModal, useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTabIndicator } from "@/hooks/useTabIndicator";
import { formatAmount } from "@/lib/sui/deepbookSpot";
import {
  effectiveLeverage,
  getMarginPoolMeta,
  liquidationPrice,
  maxAdditionalBorrowQuote,
  maxLeverage,
  type MarginPosition,
} from "@/lib/sui/deepbookMargin";
import { useWalletBalances } from "@/hooks/useDeepBookSpot";
import {
  useMarginActions,
  useMarginManager,
  useMarginPoolStats,
  useMarginSnapshot,
  useRiskParams,
  type MarginSide,
} from "@/hooks/useDeepBookMargin";
import TpslPanel from "@/components/margin/TpslPanel";
import EarnPanel from "@/components/margin/EarnPanel";
import { DataTable, SortHeader } from "@/components/spot/Account/DataTable";

const SUI_GAS_RESERVE = 0.3;
const GTC_CUTOFF_MS = 4_102_444_800_000;

type TabId = "position" | "openOrders" | "tpsl" | "orderHistory" | "earn";

const TABS: { id: TabId; label: string }[] = [
  { id: "position", label: "Position" },
  { id: "openOrders", label: "Open Orders" },
  { id: "tpsl", label: "TP / SL" },
  { id: "orderHistory", label: "Order History" },
  { id: "earn", label: "Earn" },
];

export default function MarginAccountTables({
  poolKey,
  midPrice,
}: {
  poolKey: string;
  midPrice: number | null;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("position");
  const tabTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onTabTriggerRef = useCallback(
    (id: string, el: HTMLButtonElement | null) => {
      tabTriggerRefs.current[id] = el;
    },
    []
  );
  const { listRef, indicator } = useTabIndicator(activeTab, tabTriggerRefs);
  const { data: snap } = useMarginSnapshot(poolKey);

  return (
    <div className="border-t border-border bg-[#121417] col-span-4">
      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as TabId)} className="gap-0">
        <div className="flex h-[44px] items-center border-b border-border overflow-x-auto">
          <div className="relative h-full" ref={listRef as React.RefObject<HTMLDivElement>}>
            <TabsList className="h-full bg-transparent p-0 gap-0">
              {TABS.map(t => (
                <TabsTrigger
                  key={t.id}
                  value={t.id}
                  ref={el => onTabTriggerRef(t.id, el)}
                  className="h-full rounded-none px-4 text-xs data-[state=active]:bg-transparent"
                >
                  {t.label}
                  {t.id === "openOrders" && (snap?.orders.length ?? 0) > 0
                    ? ` (${snap!.orders.length})`
                    : ""}
                  {t.id === "tpsl" && (snap?.conditionalOrderIds.length ?? 0) > 0
                    ? ` (${snap!.conditionalOrderIds.length})`
                    : ""}
                </TabsTrigger>
              ))}
              <div
                className="absolute bottom-0 h-[2px] rounded-full bg-primary transition-all duration-300"
                style={{ left: indicator.left, width: indicator.width }}
              />
            </TabsList>
          </div>
        </div>

        <div className="min-h-[240px] max-h-[360px] overflow-y-auto">
          <TabsContent value="position" className="mt-0">
            <PositionTab poolKey={poolKey} midPrice={midPrice} />
          </TabsContent>
          <TabsContent value="openOrders" className="mt-0">
            <MarginOpenOrdersTab poolKey={poolKey} />
          </TabsContent>
          <TabsContent value="tpsl" className="mt-0">
            <div className="p-3">
              {/* TpslPanel self-hides without an account; CTA covers that case */}
              <TpslPanel poolKey={poolKey} midPrice={midPrice} />
              <NeedsAccount
                label="Connect and create a margin account to arm TP/SL orders."
                poolKey={poolKey}
              />
            </div>
          </TabsContent>
          <TabsContent value="orderHistory" className="mt-0">
            <MarginOrderHistoryTab poolKey={poolKey} />
          </TabsContent>
          <TabsContent value="earn" className="mt-0">
            <div className="p-3">
              <EarnPanel />
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

/* ------------------------------- shared -------------------------------- */

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-8 text-center text-xs text-nav-inactive">{children}</div>;
}

function NeedsAccount({ label, poolKey }: { label: string; poolKey?: string }) {
  const address = useCurrentAccount()?.address;
  // poolKey-less usage only renders the CTA when fully disconnected
  const manager = useMarginManager(poolKey ?? "SUI_DBUSDC");
  if (address && (poolKey ? manager.managerId : true)) return null;
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-8">
      <p className="text-xs text-nav-inactive">{label}</p>
      {!address ? (
        <ConnectModal
          trigger={
            <Button type="button" size="sm" className="rounded-full bg-primary text-[#121417] font-semibold">
              Connect wallet
            </Button>
          }
        />
      ) : poolKey ? (
        <Button
          type="button"
          size="sm"
          disabled={manager.isCreating}
          onClick={() => manager.create()}
          className="rounded-full bg-primary text-[#121417] font-semibold"
        >
          {manager.isCreating ? "Creating…" : "Create margin account"}
        </Button>
      ) : null}
    </div>
  );
}

/* ------------------------------ position ------------------------------- */

type ActionKind = "deposit" | "withdraw" | "borrow" | "repay";

function PositionTab({ poolKey, midPrice }: { poolKey: string; midPrice: number | null }) {
  const pool = getMarginPoolMeta(poolKey);
  const address = useCurrentAccount()?.address;
  const { managerId } = useMarginManager(poolKey);
  const { data: snap, isLoading } = useMarginSnapshot(poolKey);
  const { data: risk } = useRiskParams(poolKey);
  const { data: poolStats } = useMarginPoolStats(poolKey);
  const { data: walletBal } = useWalletBalances();
  const actions = useMarginActions(poolKey);

  const [kind, setKind] = useState<ActionKind>("deposit");
  const [side, setSide] = useState<MarginSide>("quote");
  const [amount, setAmount] = useState("");
  const amountNum = parseFloat(amount) || 0;

  if (!address || !managerId)
    return <NeedsAccount label="Connect and create a margin account to manage your position." poolKey={poolKey} />;

  if (isLoading && !snap) return <EmptyState>Loading position…</EmptyState>;

  const pos: MarginPosition = {
    baseAsset: snap?.baseAsset ?? 0,
    quoteAsset: snap?.quoteAsset ?? 0,
    baseDebt: snap?.baseDebt ?? 0,
    quoteDebt: snap?.quoteDebt ?? 0,
  };
  const price = snap?.currentPrice ?? midPrice ?? 0;
  const assets = pos.baseAsset * price + pos.quoteAsset;
  const debts = pos.baseDebt * price + pos.quoteDebt;
  const equity = assets - debts;
  const hasDebt = debts > 1e-9;
  const lev = effectiveLeverage(pos, price);
  const liqPx = risk ? liquidationPrice(pos, risk.liquidation) : null;
  const rr = snap?.riskRatio ?? null;
  const borrowHeadroom = risk ? maxAdditionalBorrowQuote(pos, price, risk.minBorrow) : 0;

  const coinOf = (s: MarginSide) => (s === "base" ? pool.base : pool.quote);
  const maxFor = (k: ActionKind, s: MarginSide): number => {
    const bal = s === "base" ? snap?.balances.base ?? 0 : snap?.balances.quote ?? 0;
    const debt = s === "base" ? pos.baseDebt : pos.quoteDebt;
    switch (k) {
      case "deposit": {
        const w = walletBal?.[coinOf(s)] ?? 0;
        return coinOf(s) === "SUI" ? Math.max(0, w - SUI_GAS_RESERVE) : w;
      }
      case "withdraw":
        return bal;
      case "borrow": {
        const headroom = s === "quote" ? borrowHeadroom : price > 0 ? borrowHeadroom / price : 0;
        const liquidity = s === "base" ? poolStats?.base.available ?? 0 : poolStats?.quote.available ?? 0;
        return Math.max(0, Math.min(headroom, liquidity));
      }
      case "repay":
        return Math.min(debt, bal);
    }
  };

  const riskTone =
    rr == null
      ? "text-nav-inactive"
      : risk && rr <= risk.liquidation * 1.05
        ? "text-[#FF4D4F]"
        : risk && rr < risk.minBorrow
          ? "text-[#FFB84D]"
          : "text-primary";

  const gaugePct =
    rr == null || !risk
      ? 100
      : Math.max(2, Math.min(100, ((rr - risk.liquidation) / (2.5 - risk.liquidation)) * 100));

  const run = async () => {
    if (amountNum <= 0 && kind !== "repay") return;
    const max = maxFor(kind, side);
    if (kind === "deposit") await actions.depositCollateral(side, amountNum);
    else if (kind === "withdraw") await actions.withdrawCollateral(side, amountNum);
    else if (kind === "borrow") await actions.borrow(side, amountNum);
    else await actions.repay(side, amountNum >= max - 1e-9 || amountNum === 0 ? undefined : amountNum);
    setAmount("");
  };

  return (
    <div>
      {/* stats row */}
      <div className="grid grid-cols-2 gap-4 px-4 py-3 sm:grid-cols-3 lg:grid-cols-7">
        <Cell label={`Equity (${pool.quote})`} value={formatAmount(equity, 4)} />
        <Cell label={`Debt (${pool.quote})`} value={formatAmount(debts, 4)} tone={hasDebt ? "text-[#FF4D4F]" : undefined} />
        <Cell label="Risk Ratio" value={rr == null ? "∞" : formatAmount(rr, 3)} tone={riskTone} />
        <Cell label="Leverage" value={Number.isFinite(lev) ? `${formatAmount(lev, 2)}x` : "—"} />
        <Cell label="Est. Liq. Price" value={liqPx != null ? formatAmount(liqPx, 6) : "—"} />
        <Cell label={`Borrowable (${pool.quote})`} value={formatAmount(borrowHeadroom, 2)} tone="text-primary" />
        <Cell
          label="Borrow APR"
          value={`${formatAmount(poolStats?.base.borrowAprPct, 1)}% / ${formatAmount(poolStats?.quote.borrowAprPct, 1)}%`}
        />
      </div>

      {/* risk gauge */}
      {hasDebt && risk && (
        <div className="px-4 pb-2">
          <div className="relative h-1.5 overflow-hidden rounded bg-[#1A1D1F]">
            <div
              className={cn(
                "absolute inset-y-0 left-0 rounded",
                rr != null && rr <= risk.liquidation * 1.05
                  ? "bg-[#FF4D4F]"
                  : rr != null && rr < risk.minBorrow
                    ? "bg-[#FFB84D]"
                    : "bg-primary"
              )}
              style={{ width: `${gaugePct}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-nav-inactive">
            <span>liq {risk.liquidation}</span>
            <span>borrow min {risk.minBorrow}</span>
            <span>withdraw min {risk.minWithdraw}</span>
            <span>max {formatAmount(maxLeverage(risk.minBorrow), 1)}x</span>
          </div>
        </div>
      )}

      {/* free funds */}
      <div className="border-t border-border/60 px-4 py-2 text-[11px] text-nav-inactive">
        Free in account: <span className="text-white">{formatAmount(snap?.balances.base, 4)} {pool.base}</span> ·{" "}
        <span className="text-white">{formatAmount(snap?.balances.quote, 4)} {pool.quote}</span>
        {pos.baseDebt > 0 && <span className="text-[#FF4D4F]"> · owes {formatAmount(pos.baseDebt, 4)} {pool.base}</span>}
        {pos.quoteDebt > 0 && <span className="text-[#FF4D4F]"> · owes {formatAmount(pos.quoteDebt, 4)} {pool.quote}</span>}
      </div>

      {/* manage row */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border/60 px-4 py-3">
        <div className="flex gap-1">
          {(["deposit", "withdraw", "borrow", "repay"] as const).map(k => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[11px] capitalize transition-colors",
                kind === k
                  ? "border-primary bg-primary/10 text-white"
                  : "border-[#2D3134] text-nav-inactive hover:text-white"
              )}
            >
              {k}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {(["base", "quote"] as const).map(s => (
            <button
              key={s}
              onClick={() => setSide(s)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[11px] transition-colors",
                side === s
                  ? "border-[#3A3E42] bg-[#1A1D1F] text-white"
                  : "border-[#2D3134] text-nav-inactive hover:text-white"
              )}
            >
              {coinOf(s)}
            </button>
          ))}
        </div>
        <div className="flex min-w-[170px] flex-1 items-center gap-2 rounded-full border border-[#2D3134] px-3 py-1.5 sm:flex-none sm:w-60">
          <input
            inputMode="decimal"
            placeholder={kind === "repay" ? "amount (empty = repay all)" : "0.0"}
            value={amount}
            onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            className="w-full bg-transparent text-xs text-white outline-none placeholder:text-nav-inactive/70"
          />
          <button
            className="text-[10px] text-nav-inactive hover:text-white"
            onClick={() => setAmount(String(maxFor(kind, side)))}
          >
            MAX
          </button>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={
            actions.isPending ||
            (kind === "repay"
              ? (side === "base" ? pos.baseDebt : pos.quoteDebt) <= 1e-9
              : amountNum <= 0 || amountNum > maxFor(kind, side) + 1e-9)
          }
          onClick={run}
          className="h-7 rounded-full bg-primary text-[#121417] text-xs font-semibold"
        >
          {actions.isPending
            ? (actions.status ?? "Working…")
            : kind === "repay" && amountNum === 0
              ? "Repay all"
              : kind[0].toUpperCase() + kind.slice(1)}
        </Button>
      </div>
    </div>
  );
}

function Cell({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-nav-inactive whitespace-nowrap">{label}</span>
      <span className={cn("text-xs font-medium tabular-nums text-white", tone)}>{value}</span>
    </div>
  );
}

/* ----------------------------- open orders ------------------------------ */

function MarginOpenOrdersTab({ poolKey }: { poolKey: string }) {
  const pool = getMarginPoolMeta(poolKey);
  const address = useCurrentAccount()?.address;
  const { managerId } = useMarginManager(poolKey);
  const { data: snap, isLoading } = useMarginSnapshot(poolKey);
  const { cancelOrder, cancelAllOrders, claimSettled, modifyOrder, isPending } =
    useMarginActions(poolKey);
  const [editing, setEditing] = useState<{ orderId: string; qty: string } | null>(null);

  type OrderRow = NonNullable<typeof snap>["orders"][number];
  const columns = useMemo<ColumnDef<OrderRow>[]>(
    () => [
      {
        id: "market",
        header: "Market",
        cell: () => (
          <span className="text-white">
            {pool.base}/{pool.quote}
          </span>
        ),
      },
      {
        accessorKey: "isBid",
        header: "Side",
        cell: ({ row }) => (
          <span className={cn("font-medium", row.original.isBid ? "text-primary" : "text-[#FF4D4F]")}>
            {row.original.isBid ? "Long" : "Short"}
          </span>
        ),
      },
      {
        accessorKey: "price",
        header: ({ column }) => (
          <SortHeader column={column} title={`Price (${pool.quote})`} align="right" />
        ),
        cell: ({ row }) => (
          <div className="text-right text-white tabular-nums">{formatAmount(row.original.price, 6)}</div>
        ),
      },
      {
        accessorKey: "quantity",
        header: ({ column }) => (
          <SortHeader column={column} title={`Size (${pool.base})`} align="right" />
        ),
        cell: ({ row }) =>
          editing?.orderId === row.original.orderId ? (
            <div className="text-right">
              <input
                autoFocus
                inputMode="decimal"
                value={editing.qty}
                onChange={e =>
                  setEditing({ orderId: row.original.orderId, qty: e.target.value.replace(/[^0-9.]/g, "") })
                }
                className="w-20 rounded border border-[#2D3134] bg-transparent px-2 py-0.5 text-right text-xs text-white outline-none"
              />
            </div>
          ) : (
            <div className="text-right text-white tabular-nums">{formatAmount(row.original.quantity, 6)}</div>
          ),
      },
      {
        accessorKey: "filled",
        header: ({ column }) => <SortHeader column={column} title="Filled" align="right" />,
        cell: ({ row }) => (
          <div className="text-right text-nav-inactive tabular-nums">
            {row.original.filled > 0
              ? `${formatAmount((row.original.filled / row.original.quantity) * 100, 1)}%`
              : "—"}
          </div>
        ),
      },
      {
        accessorKey: "expireTimestamp",
        header: () => <div className="text-right">Expires</div>,
        cell: ({ row }) => (
          <div className="text-right text-nav-inactive">
            {row.original.expireTimestamp > GTC_CUTOFF_MS
              ? "GTC"
              : new Date(row.original.expireTimestamp).toLocaleString()}
          </div>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const o = row.original;
          return editing?.orderId === o.orderId ? (
            <div className="text-right whitespace-nowrap">
              <button
                disabled={
                  isPending ||
                  !(parseFloat(editing.qty) > o.filled && parseFloat(editing.qty) < o.quantity)
                }
                onClick={async () => {
                  await modifyOrder(o.orderId, parseFloat(editing.qty));
                  setEditing(null);
                }}
                className="mr-3 text-primary hover:opacity-80 disabled:opacity-40"
                title="New size must be below the current size and above the filled amount"
              >
                Save
              </button>
              <button onClick={() => setEditing(null)} className="text-nav-inactive hover:text-white">
                Back
              </button>
            </div>
          ) : (
            <div className="text-right whitespace-nowrap">
              <button
                disabled={isPending}
                onClick={() => setEditing({ orderId: o.orderId, qty: String(o.quantity) })}
                className="mr-3 text-nav-inactive hover:text-white disabled:opacity-50"
                title="Reduce order size (protocol allows shrinking only)"
              >
                Edit
              </button>
              <button
                disabled={isPending}
                onClick={() => cancelOrder(o.orderId)}
                className="text-nav-inactive hover:text-[#FF4D4F] disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          );
        },
      },
    ],
    [editing, isPending, pool.base, pool.quote, modifyOrder, cancelOrder]
  );

  if (!address || !managerId)
    return <NeedsAccount label="Connect and create a margin account to see open orders." poolKey={poolKey} />;
  if (isLoading && !snap) return <EmptyState>Loading orders…</EmptyState>;

  const orders = snap?.orders ?? [];
  const settled = snap?.settled;
  const hasSettled =
    !!settled && (settled.base > 1e-9 || settled.quote > 1e-9 || settled.deep > 1e-9);

  return (
    <div>
      {(hasSettled || orders.length > 1) && (
        <div className="flex items-center justify-end gap-2 border-b border-border/60 px-4 py-2">
          {hasSettled && (
            <Button
              variant="outline"
              size="sm"
              type="button"
              disabled={isPending}
              onClick={() => claimSettled()}
              className="h-6 rounded-full text-[11px]"
            >
              Claim settled ({formatAmount(settled!.base)} {pool.base} / {formatAmount(settled!.quote)} {pool.quote})
            </Button>
          )}
          {orders.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              type="button"
              disabled={isPending}
              onClick={() => cancelAllOrders()}
              className="h-6 rounded-full text-[11px]"
            >
              Cancel all
            </Button>
          )}
        </div>
      )}
      <DataTable
        columns={columns}
        data={orders}
        empty={<EmptyState>No open margin orders on {pool.label}.</EmptyState>}
      />
    </div>
  );
}

/* ---------------------------- order history ----------------------------- */

type HistoryRow = {
  order_id: string;
  type: "buy" | "sell";
  current_status: string;
  price: number;
  placed_at: number;
  original_quantity: number;
  filled_quantity: number;
};

/** The margin manager's WRAPPED BalanceManager id (orders attribute to it). */
function useMarginBmId(poolKey: string) {
  const suiClient = useSuiClient();
  const { managerId } = useMarginManager(poolKey);
  return useQuery({
    queryKey: ["deepbook", "marginBmId", managerId],
    enabled: !!managerId,
    staleTime: Infinity,
    queryFn: async (): Promise<string | null> => {
      const res = await suiClient.getObject({
        id: managerId!,
        options: { showContent: true },
      });
      const content = res.data?.content;
      const fields =
        content && "fields" in content
          ? (content.fields as { balance_manager?: { fields?: { id?: { id?: string } } } })
          : null;
      return fields?.balance_manager?.fields?.id?.id ?? null;
    },
  });
}

const historyStatusColor = (s: string) =>
  s === "Filled"
    ? "text-primary"
    : s === "Canceled" || s === "Expired"
      ? "text-nav-inactive"
      : "text-white";

function MarginOrderHistoryTab({ poolKey }: { poolKey: string }) {
  const pool = getMarginPoolMeta(poolKey);
  const address = useCurrentAccount()?.address;
  const { managerId } = useMarginManager(poolKey);
  const { data: bmId } = useMarginBmId(poolKey);

  const history = useQuery({
    queryKey: ["deepbook", "marginOrderHistory", poolKey, bmId],
    enabled: !!bmId,
    refetchInterval: 10_000,
    queryFn: async () =>
      (await fetch(`/api/deepbook/orders?pool=${poolKey}&bm=${bmId}&limit=50`, {
        cache: "no-store",
      }).then(r => r.json())) as { orders: HistoryRow[] },
  });

  const columns = useMemo<ColumnDef<HistoryRow>[]>(
    () => [
      {
        accessorKey: "placed_at",
        header: ({ column }) => <SortHeader column={column} title="Time" />,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-nav-inactive">
            {new Date(row.original.placed_at).toLocaleString()}
          </span>
        ),
      },
      {
        accessorKey: "type",
        header: "Side",
        cell: ({ row }) => (
          <span className={cn("font-medium", row.original.type === "buy" ? "text-primary" : "text-[#FF4D4F]")}>
            {row.original.type === "buy" ? "Long" : "Short"}
          </span>
        ),
      },
      {
        accessorKey: "price",
        header: ({ column }) => (
          <SortHeader column={column} title={`Price (${pool.quote})`} align="right" />
        ),
        cell: ({ row }) => (
          <div className="text-right text-white tabular-nums">{formatAmount(row.original.price, 6)}</div>
        ),
      },
      {
        accessorKey: "original_quantity",
        header: ({ column }) => (
          <SortHeader column={column} title={`Size (${pool.base})`} align="right" />
        ),
        cell: ({ row }) => (
          <div className="text-right text-white tabular-nums">
            {formatAmount(row.original.original_quantity, 4)}
          </div>
        ),
      },
      {
        accessorKey: "filled_quantity",
        header: ({ column }) => <SortHeader column={column} title="Filled" align="right" />,
        cell: ({ row }) => (
          <div className="text-right text-nav-inactive tabular-nums">
            {row.original.filled_quantity > 0 ? formatAmount(row.original.filled_quantity, 4) : "—"}
          </div>
        ),
      },
      {
        accessorKey: "current_status",
        header: () => <div className="text-right">Status</div>,
        cell: ({ row }) => (
          <div className={cn("text-right", historyStatusColor(row.original.current_status))}>
            {row.original.current_status}
          </div>
        ),
      },
    ],
    [pool.base, pool.quote]
  );

  if (!address || !managerId)
    return <NeedsAccount label="Connect and create a margin account to see order history." poolKey={poolKey} />;
  if (history.isLoading) return <EmptyState>Loading history…</EmptyState>;

  const rows = history.data?.orders ?? [];

  return (
    <DataTable
      columns={columns}
      data={rows}
      empty={<EmptyState>No margin orders yet on {pool.label}.</EmptyState>}
    />
  );
}
