/**
 * Server-side DeepBook V3 read helpers (testnet).
 *
 * Reads come from the public DeepBook indexer REST API
 * (deepbook-indexer.testnet.mystenlabs.com) — much simpler and lighter than the
 * gRPC `simulateTransaction` path. The DeepBook SDK / gRPC client is reserved
 * for WRITE PTBs (placing orders) in a later phase.
 *
 * Keep this SERVER-ONLY (imported from app/api/* route handlers).
 */

export const DEEPBOOK_INDEXER =
  // `|| `, not `?? ` — a present-but-empty env (`NEXT_PUBLIC_DEEPBOOK_INDEXER=`) is
  // `""`, which would otherwise make fetch hit the app's own origin.
  process.env.NEXT_PUBLIC_DEEPBOOK_INDEXER?.trim() ||
  "https://deepbook-indexer.testnet.mystenlabs.com";

async function idx<T>(path: string): Promise<T> {
  const res = await fetch(`${DEEPBOOK_INDEXER}${path}`, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`deepbook-indexer ${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

export type SpotLevel = { px: number; sz: number };
export type SpotBook = {
  pool: string;
  mid: number | null;
  bids: SpotLevel[];
  asks: SpotLevel[];
};

type IndexerBook = {
  timestamp: string;
  bids: [string, string][]; // [price, size], best -> worst
  asks: [string, string][];
};

/** Level-2 book for a pool key (e.g. "SUI_DBUSDC"). `depth` = total levels. */
export async function getSpotBook(
  poolKey: string,
  depth = 40
): Promise<SpotBook> {
  const book = await idx<IndexerBook>(
    `/orderbook/${poolKey}?level=2&depth=${depth}`
  );
  const toLevels = (rows: [string, string][]): SpotLevel[] =>
    (rows ?? []).map(([px, sz]) => ({ px: Number(px), sz: Number(sz) }));

  const bids = toLevels(book.bids).sort((a, b) => b.px - a.px);
  const asks = toLevels(book.asks).sort((a, b) => a.px - b.px);
  const mid =
    bids[0] && asks[0] ? (bids[0].px + asks[0].px) / 2 : null;
  return { pool: poolKey, mid, bids, asks };
}

export type Ticker = {
  base_volume: number;
  quote_volume: number;
  last_price: number;
  isFrozen: number;
};

/** All-pairs ticker (scaled volumes + last price). */
export function getTickers(): Promise<Record<string, Ticker>> {
  return idx<Record<string, Ticker>>("/ticker");
}

export type SummaryRow = {
  trading_pairs: string;
  base_currency: string;
  quote_currency: string;
  last_price: number;
  base_volume: number;
  quote_volume: number;
  price_change_percent_24h: number;
  highest_price_24h: number;
  lowest_price_24h: number;
  highest_bid: number;
  lowest_ask: number;
};

/** Per-pair 24h summary, keyed by pool name (e.g. "SUI_DBUSDC"). */
export async function getSummaryByPool(): Promise<Record<string, SummaryRow>> {
  const rows = await idx<SummaryRow[]>("/summary");
  const out: Record<string, SummaryRow> = {};
  for (const r of rows) out[r.trading_pairs] = r;
  return out;
}

export type Candle = {
  time: number; // ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

// indexer /ohlcv supports: 1m,5m,15m,30m,1h,4h,1d,1w — map the rest.
const OHLCV_INTERVAL: Record<string, string> = {
  "1m": "1m", "3m": "5m", "5m": "5m", "15m": "15m", "30m": "30m",
  "1h": "1h", "2h": "1h", "4h": "4h", "1d": "1d", "3d": "1d",
  "1w": "1w", "1M": "1w",
};

/**
 * OHLCV candles for a pool, normalized to ms timestamps.
 * NOTE: despite the docs saying seconds, the indexer's start_time/end_time are
 * in MILLISECONDS (matching its candle timestamps).
 */
export async function getOhlcv(
  poolKey: string,
  interval: string,
  startMs?: number,
  endMs?: number,
  limit = 1000
): Promise<Candle[]> {
  const iv = OHLCV_INTERVAL[interval] ?? "1h";
  const qs = new URLSearchParams({ interval: iv, limit: String(limit) });
  if (startMs) qs.set("start_time", String(Math.floor(startMs)));
  if (endMs) qs.set("end_time", String(Math.floor(endMs)));
  // NOTE: the indexer endpoint is spelled "ohclv" (typo baked into the API).
  const res = await idx<{ candles: [number, number, number, number, number, number][] }>(
    `/ohclv/${poolKey}?${qs.toString()}`
  );
  return (res.candles ?? [])
    .map(([t, o, h, l, c, v]) => ({
      time: t < 1e12 ? t * 1000 : t, // seconds -> ms
      open: o,
      high: h,
      low: l,
      close: c,
      volume: v,
    }))
    .sort((a, b) => a.time - b.time); // TradingView needs ascending time
}

export type TradeRow = {
  trade_id: string;
  price: number;
  base_volume: number;
  quote_volume: number;
  timestamp: number; // ms
  type: "buy" | "sell";
  maker_balance_manager_id: string;
  taker_balance_manager_id: string;
};

/** Recent trades for a pool (newest first). */
export function getTrades(poolKey: string, limit = 50): Promise<TradeRow[]> {
  return idx<TradeRow[]>(`/trades/${poolKey}?limit=${limit}`);
}

export type OrderHistoryRow = {
  order_id: string;
  balance_manager_id: string;
  type: "buy" | "sell";
  current_status: string; // Placed | Canceled | Filled | Expired | Modified
  price: number;
  placed_at: number; // ms
  last_updated_at: number; // ms
  original_quantity: number;
  filled_quantity: number;
  remaining_quantity: number;
};

/**
 * Order history for a balance manager on a pool (newest first).
 *
 * The indexer's `/orders` endpoint only records resting (limit) orders —
 * immediate-fill market/taker orders never appear there. So we also pull
 * `/trades` and synthesize Filled rows for this manager's *taker* fills, which
 * is the only place they show up. (Maker fills already update the resting
 * order in `/orders`, so we don't duplicate those.)
 */
export async function getOrderHistory(
  poolKey: string,
  balanceManagerId: string,
  limit = 50
): Promise<OrderHistoryRow[]> {
  const bm = balanceManagerId.toLowerCase();
  const [orders, trades] = await Promise.all([
    idx<OrderHistoryRow[]>(`/orders/${poolKey}/${balanceManagerId}?limit=${limit}`).catch(
      () => [] as OrderHistoryRow[]
    ),
    getTrades(poolKey, 200).catch(() => [] as TradeRow[]),
  ]);

  const seen = new Set(orders.map(o => o.order_id));
  const takerFills: OrderHistoryRow[] = trades
    .filter(t => t.taker_balance_manager_id?.toLowerCase() === bm)
    .map(t => ({
      order_id: t.trade_id,
      balance_manager_id: balanceManagerId,
      type: t.type, // taker side
      current_status: "Filled",
      price: t.price,
      placed_at: t.timestamp,
      last_updated_at: t.timestamp,
      original_quantity: t.base_volume,
      filled_quantity: t.base_volume,
      remaining_quantity: 0,
    }))
    .filter(r => !seen.has(r.order_id));

  return [...orders, ...takerFills]
    .sort((a, b) => b.placed_at - a.placed_at)
    .slice(0, limit);
}

/* ----------------------------- portfolio ------------------------------ */

export type MarginPosition = {
  margin_manager_id: string;
  pool: string;
  base_asset_symbol: string;
  quote_asset_symbol: string;
  base_asset: number;
  quote_asset: number;
  base_debt: number;
  quote_debt: number;
  total_debt_usd: number;
  net_value_usd: number;
  risk_ratio: number;
};
export type Portfolio = {
  margin_positions: MarginPosition[];
  collateral_balances: { asset: string; balance: number; balance_usd: number }[];
  lp_positions: {
    margin_pool_id: string;
    asset: string;
    supplied: number;
    shares: number;
    supplied_usd: number;
  }[];
  summary: {
    total_equity_usd: number;
    total_debt_usd: number;
    net_value_usd: number;
  };
};

/** Unified DeepBook portfolio for a wallet (margin + collateral + LP + equity). */
export function getPortfolio(wallet: string): Promise<Portfolio> {
  return idx<Portfolio>(`/portfolio/${wallet}`);
}

/* ------------------------------- margin -------------------------------- */

// smallest-unit scalars per DeepBook asset (from the indexer docs).
const ASSET_SCALAR: Record<string, number> = {
  DBUSDC: 6, DBUSDT: 6, USDC: 6, AUSD: 6, SUI: 9, DEEP: 6,
  DBTC: 8, BETH: 8, WAL: 9, NS: 6,
};
const scaleAsset = (sym: string, raw: number) =>
  raw / Math.pow(10, ASSET_SCALAR[sym] ?? 9);

export type MarginPool = { asset: string; supply: number; supplyRaw: number };

/** Total supply per margin pool, scaled to human units. */
export async function getMarginSupply(): Promise<MarginPool[]> {
  const raw = await idx<Record<string, number>>("/margin_supply");
  return Object.entries(raw).map(([asset, supplyRaw]) => ({
    asset,
    supplyRaw,
    supply: scaleAsset(asset, supplyRaw),
  }));
}

export type MarginManagerInfo = {
  margin_manager_id: string;
  deepbook_pool_id: string;
  base_asset_symbol: string;
  quote_asset_symbol: string;
  base_margin_pool_id: string;
  quote_margin_pool_id: string;
};
export function getMarginManagersInfo(): Promise<MarginManagerInfo[]> {
  return idx<MarginManagerInfo[]>("/margin_managers_info");
}

export type MarginManagerState = {
  margin_manager_id: string;
  deepbook_pool_id: string;
  base_asset_symbol: string;
  quote_asset_symbol: string;
  risk_ratio: string;
  base_asset: string;
  quote_asset: string;
  base_debt: string;
  quote_debt: string;
  current_price: string;
};
/** Current margin-manager states (risk ratios, debt). Optional pool/risk filters. */
export function getMarginManagerStates(opts?: {
  maxRiskRatio?: number;
  deepbookPoolId?: string;
}): Promise<MarginManagerState[]> {
  const qs = new URLSearchParams();
  if (opts?.maxRiskRatio) qs.set("max_risk_ratio", String(opts.maxRiskRatio));
  if (opts?.deepbookPoolId) qs.set("deepbook_pool_id", opts.deepbookPoolId);
  const q = qs.toString();
  return idx<MarginManagerState[]>(`/margin_manager_states${q ? `?${q}` : ""}`);
}
