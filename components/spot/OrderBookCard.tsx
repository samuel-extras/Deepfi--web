"use client";

/**
 * Shared live order-book card (spot + margin pages). Data comes from
 * /api/deepbook/orderbook; clicking a level reports the price upward.
 */
import { formatAmount } from "@/lib/sui/deepbookSpot";

export type BookLevel = { px: number; sz: number };
export type BookData = {
  ok: boolean;
  mid: number | null;
  bids: BookLevel[];
  asks: BookLevel[];
  bestBid: number | null;
  bestAsk: number | null;
  spread: number | null;
};

export default function OrderBookCard({
  data,
  isLoading,
  baseLabel,
  quoteLabel,
  onClickLevel,
  rows = 11,
}: {
  data: BookData | undefined;
  isLoading: boolean;
  baseLabel: string;
  quoteLabel: string;
  onClickLevel: (px: number) => void;
  rows?: number;
}) {
  const asks = (data?.asks ?? []).slice(0, rows).reverse();
  const bids = (data?.bids ?? []).slice(0, rows);
  const maxSz = Math.max(1, ...asks.map(l => l.sz), ...bids.map(l => l.sz));

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="grid grid-cols-3 border-b border-border px-4 py-2 text-xs text-muted-foreground">
        <span>Price ({quoteLabel})</span>
        <span className="text-right">Size ({baseLabel})</span>
        <span className="text-right">Total ({quoteLabel})</span>
      </div>

      {isLoading ? (
        <div className="p-6 text-sm text-muted-foreground">Loading live book…</div>
      ) : !data?.ok ? (
        <div className="p-6 text-sm text-rose-400">Couldn’t load the book. Retrying…</div>
      ) : (
        <div className="py-1">
          {asks.map((l, i) => (
            <Row key={`a${i}`} l={l} side="ask" maxSz={maxSz} onClick={onClickLevel} />
          ))}
          <div className="my-1 flex items-center justify-between border-y border-border bg-muted/30 px-4 py-1.5 text-sm">
            <span className="font-semibold text-foreground">
              {data.mid != null ? formatAmount(data.mid, 6) : "—"}
            </span>
            <span className="text-xs text-muted-foreground">
              mid · spread {data.spread != null ? formatAmount(data.spread, 6) : "—"}
            </span>
          </div>
          {bids.map((l, i) => (
            <Row key={`b${i}`} l={l} side="bid" maxSz={maxSz} onClick={onClickLevel} />
          ))}
        </div>
      )}
    </div>
  );
}

function Row({
  l,
  side,
  maxSz,
  onClick,
}: {
  l: BookLevel;
  side: "bid" | "ask";
  maxSz: number;
  onClick: (px: number) => void;
}) {
  const pct = Math.min(100, (l.sz / maxSz) * 100);
  const color = side === "bid" ? "text-emerald-400" : "text-rose-400";
  const bar = side === "bid" ? "bg-emerald-500/10" : "bg-rose-500/10";
  return (
    <button
      onClick={() => onClick(l.px)}
      className="relative grid w-full grid-cols-3 px-4 py-[3px] text-left text-sm hover:bg-muted/40"
      title="Use this price"
    >
      <div className={`absolute inset-y-0 right-0 ${bar}`} style={{ width: `${pct}%` }} />
      <span className={`relative z-10 ${color}`}>{formatAmount(l.px, 6)}</span>
      <span className="relative z-10 text-right text-foreground">{formatAmount(l.sz, 4)}</span>
      <span className="relative z-10 text-right text-muted-foreground">
        {formatAmount(l.px * l.sz, 2)}
      </span>
    </button>
  );
}
