"use client";

/**
 * DeepBook Margin trading (Sui testnet) — end to end.
 *
 * Long/short with leverage on margin-enabled DeepBook pools: create a
 * per-pool margin account, deposit collateral, borrow from the lending pools,
 * trade through pool_proxy, monitor the oracle-priced risk ratio, repay.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatAmount } from "@/lib/sui/deepbookSpot";
import {
  DEFAULT_MARGIN_POOL_KEY,
  MARGIN_POOL_CANDIDATES,
} from "@/lib/sui/deepbookMargin";
import { useMarginEnabledPools } from "@/hooks/useDeepBookMargin";
import OrderBookCard, { type BookData } from "@/components/spot/OrderBookCard";
import type { TicketPrefill } from "@/components/spot/TradeTicket";
import MarginTicket from "./MarginTicket";
import MarginPositionCard from "./MarginPositionCard";
import MarginOpenOrders from "./MarginOpenOrders";
import TpslPanel from "./TpslPanel";
import EarnPanel from "./EarnPanel";

export default function MarginTrade() {
  const { data: enabledPools } = useMarginEnabledPools();
  const pools = enabledPools ?? MARGIN_POOL_CANDIDATES;
  const [poolKey, setPoolKey] = useState(DEFAULT_MARGIN_POOL_KEY);
  const [prefill, setPrefill] = useState<TicketPrefill>(null);
  const pool = useMemo(
    () => pools.find(p => p.key === poolKey) ?? pools[0],
    [pools, poolKey]
  );

  const book = useQuery({
    queryKey: ["deepbook", "book", poolKey],
    queryFn: async () =>
      (await fetch(`/api/deepbook/orderbook?pool=${poolKey}&ticks=24`, {
        cache: "no-store",
      }).then(r => r.json())) as BookData,
    refetchInterval: 4000,
  });
  const data = book.data;

  const clickLevel = (px: number) =>
    setPrefill(prev => ({ price: px, nonce: (prev?.nonce ?? 0) + 1 }));

  if (!pool) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-6 text-sm text-muted-foreground">
        No margin-enabled pools on this network.
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      {/* header */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Margin · DeepBook</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Leveraged spot — borrow against collateral, trade the same CLOB.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              data?.ok ? "bg-emerald-500" : "bg-amber-500"
            }`}
          />
          {pool.label} · mid {data?.mid != null ? formatAmount(data.mid, 6) : "—"}
        </div>
      </div>

      {/* margin pool tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {pools.map(p => (
          <button
            key={p.key}
            onClick={() => setPoolKey(p.key)}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              p.key === pool.key
                ? "border-emerald-600 bg-emerald-600/10 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* book + ticket */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <OrderBookCard
          data={data}
          isLoading={book.isLoading}
          baseLabel={pool.base}
          quoteLabel={pool.quote}
          onClickLevel={clickLevel}
        />
        <MarginTicket
          poolKey={pool.key}
          midPrice={data?.mid ?? null}
          prefill={prefill}
        />
      </div>

      {/* position + tpsl + orders + earn */}
      <div className="mt-4 space-y-4">
        <MarginPositionCard poolKey={pool.key} midPrice={data?.mid ?? null} />
        <TpslPanel poolKey={pool.key} midPrice={data?.mid ?? null} />
        <MarginOpenOrders poolKey={pool.key} />
        <EarnPanel />
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Liquidation at risk ratio 1.1 — keep a buffer. Not financial advice. Testnet only.
      </p>
    </div>
  );
}
