/**
 * Order-book aggregation — pure transforms from raw indexer levels into the
 * grouped, depth-shaded rows the book renders. No React, no formatting.
 */

export type Level = { px: number; sz: number };
export type DepthRow = Level & { amount: number; total: number };

/**
 * Collapse price levels into `group`-sized buckets. Bids round the price down,
 * asks round up, so each bucket's label is the worst price it contains. Result
 * is sorted best-first (bids desc, asks asc).
 */
export function aggregateLevels(
  levels: Level[],
  group: number,
  side: "bid" | "ask"
): Level[] {
  if (group <= 0) return levels;
  const buckets = new Map<number, number>();
  for (const { px, sz } of levels) {
    const bucket =
      side === "bid"
        ? Math.floor(px / group + 1e-9) * group
        : Math.ceil(px / group - 1e-9) * group;
    const key = Number(bucket.toFixed(12));
    buckets.set(key, (buckets.get(key) ?? 0) + sz);
  }
  const rows = [...buckets.entries()].map(([px, sz]) => ({ px, sz }));
  return rows.sort((a, b) => (side === "bid" ? b.px - a.px : a.px - b.px));
}

/**
 * Turn levels into depth rows: `amount` is base size or quote notional
 * depending on `sizeIn`; `total` is the running cumulative amount.
 */
export function toDepthRows(levels: Level[], sizeIn: "base" | "quote"): DepthRow[] {
  return levels.reduce<DepthRow[]>((acc, o) => {
    const amount = sizeIn === "base" ? o.sz : o.sz * o.px;
    const prev = acc.length ? acc[acc.length - 1].total : 0;
    acc.push({ ...o, amount, total: prev + amount });
    return acc;
  }, []);
}

export type BookView = {
  asks: Level[];
  bids: Level[];
  maxAmount: number;
  spread: number | null;
  spreadPct: number | null;
  mid: number | null;
};

/**
 * Build the full render model for the order book: grouped + truncated sides,
 * the max amount (for depth-bar scaling), and the spread off the *raw* tops of
 * book (not the grouped buckets).
 */
export function computeBookView(args: {
  rawBids: Level[];
  rawAsks: Level[];
  group: number;
  rowsPerSide: number;
  sizeIn: "base" | "quote";
  mid: number | null;
}): BookView {
  const { rawBids, rawAsks, group, rowsPerSide, sizeIn, mid } = args;
  const bids = aggregateLevels(rawBids, group, "bid").slice(0, rowsPerSide);
  const asks = aggregateLevels(rawAsks, group, "ask").slice(0, rowsPerSide);
  const toAmount = (l: Level) => (sizeIn === "base" ? l.sz : l.sz * l.px);
  const maxAmount = Math.max(1e-12, ...asks.map(toAmount), ...bids.map(toAmount));
  const bestBid = rawBids[0]?.px;
  const bestAsk = rawAsks[0]?.px;
  const spread = bestBid != null && bestAsk != null ? bestAsk - bestBid : null;
  return {
    asks,
    bids,
    maxAmount,
    spread,
    spreadPct: spread != null && mid ? (spread / mid) * 100 : null,
    mid,
  };
}
