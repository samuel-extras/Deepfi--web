/**
 * Typed client for the public Predict indexer
 * (predict-server.testnet.mystenlabs.com). Server-safe — called from Next route
 * handlers in app/api/* to avoid browser CORS and to shape data for the UI.
 */

import { PREDICT_INDEXER_URL, OBJECTS, PRICE_SCALE } from "./deepbook";

const BASE = PREDICT_INDEXER_URL;
const PREDICT_ID = OBJECTS.predict;

async function get<T>(
  path: string,
  revalidate = 5,
  opts?: { noStore?: boolean },
): Promise<T> {
  // The oracles list is the protocol's full history (~3MB) — over Next's 2MB
  // data-cache limit, so caching it fails noisily on every call. `noStore`
  // skips the data cache for that one body; route handlers still cache their
  // small derived JSON via `export const revalidate`.
  const cacheOpt: RequestInit = opts?.noStore
    ? { cache: "no-store" }
    : { next: { revalidate } };
  const res = await fetch(`${BASE}${path}`, {
    ...cacheOpt,
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`indexer ${path} -> ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ---------- response types (match live JSON) ----------
export interface IndexerStatus {
  status: string;
  latest_onchain_checkpoint: number;
  current_time_ms: number;
  max_checkpoint_lag: number;
  max_time_lag_seconds: number;
  pipelines: {
    pipeline: string;
    checkpoint_lag: number;
    time_lag_ms: number;
  }[];
}

export interface OracleRow {
  predict_id: string;
  oracle_id: string;
  oracle_cap_id: string;
  underlying_asset: string;
  expiry: number; // epoch ms
  min_strike: number; // 1e9 scale
  tick_size: number; // 1e9 scale
  status: "live" | "settled" | "pending" | string;
  activated_at: number;
  settlement_price: number | null;
  settled_at: number | null;
  created_checkpoint: number;
}

export interface PositionMintedRow {
  digest: string;
  event_digest: string;
  sender: string;
  checkpoint_timestamp_ms: number;
  predict_id: string;
  manager_id: string;
  trader: string;
  quote_asset: string;
  oracle_id: string;
  expiry: number;
  strike: number; // 1e9
  is_up: boolean;
  quantity: number;
  cost: number; // dUSDC 1e6
  ask_price: number;
}

/** Row of /positions/redeemed — one PositionRedeemed event (newest first). */
export interface PositionRedeemedRow {
  digest: string;
  event_digest: string;
  checkpoint_timestamp_ms: number;
  predict_id: string;
  manager_id: string;
  /** the position owner (paid out) */
  owner: string;
  /** who executed the redeem (differs from owner for permissionless redeems) */
  executor: string;
  quote_asset: string;
  oracle_id: string;
  expiry: number;
  strike: number; // 1e9
  is_up: boolean;
  quantity: number;
  payout: number; // dUSDC 1e6
  bid_price: number; // 1e9
  is_settled: boolean;
}

export interface RangeMintedRow {
  digest: string;
  event_digest: string;
  sender: string;
  checkpoint_timestamp_ms: number;
  predict_id: string;
  manager_id: string;
  trader: string;
  quote_asset: string;
  oracle_id: string;
  expiry: number;
  lower_strike: number; // 1e9
  higher_strike: number; // 1e9
  quantity: number;
  cost: number; // dUSDC 1e6
  ask_price: number;
}

export interface ManagerRow {
  manager_id: string;
  owner: string;
  checkpoint_timestamp_ms: number;
}

/** Row of /ranges/redeemed — one RangeRedeemed event (newest first). */
export interface RangeRedeemedRow {
  digest: string;
  event_digest: string;
  sender: string;
  checkpoint_timestamp_ms: number;
  predict_id: string;
  manager_id: string;
  trader: string;
  quote_asset: string;
  oracle_id: string;
  expiry: number;
  lower_strike: number; // 1e9
  higher_strike: number; // 1e9
  quantity: number;
  payout: number; // dUSDC 1e6
  bid_price: number; // 1e9
  is_settled: boolean;
}

/** Raw response of /managers/:id/ranges — mint/redeem events, not netted. */
export interface ManagerRangesRaw {
  minted: RangeMintedRow[];
  redeemed: RangeRedeemedRow[];
}

/**
 * Open range position, netted client-side from /managers/:id/ranges events
 * (the server has no /managers/:id/ranges/summary route). Shape mirrors the
 * binary rows of /managers/:id/positions/summary so the portfolio UI can
 * render both kinds uniformly.
 */
export interface RangeSummaryRow {
  oracle_id: string;
  underlying_asset: string;
  expiry: number;
  lower_strike: number; // 1e9
  higher_strike: number; // 1e9
  open_quantity: number;
  total_cost: number;
  mark_value: number;
  unrealized_pnl: number;
  realized_pnl: number;
  average_entry_price: number;
  mark_price: number;
  status: string;
}

export interface SviLatestRow {
  oracle_id: string;
  timestamp_ms?: number;
  // SVI raw params (names per indexer; tolerated as optional)
  a?: number;
  b?: number;
  rho?: number;
  m?: number;
  sigma?: number;
  forward?: number;
  atm_iv?: number;
  [k: string]: unknown;
}

export interface PriceLatestRow {
  oracle_id: string;
  /** live rows carry spot/forward; older deployments used `price` */
  spot?: number; // 1e9
  forward?: number; // 1e9
  price?: number; // 1e9 (legacy)
  timestamp_ms?: number;
  [k: string]: unknown;
}

/** Live shape of /predicts/:id/vault/summary. Amounts are dUSDC 1e6 raw. */
export interface VaultSummary {
  predict_id: string;
  quote_assets: string[];
  vault_balance: number;
  vault_value: number;
  total_mtm: number;
  total_max_payout: number;
  available_liquidity: number;
  available_withdrawal: number;
  plp_total_supply: number;
  /** dUSDC per PLP share (already a float, not 1e6-scaled). */
  plp_share_price: number;
  /** Fraction 0..1 (not percent). */
  utilization: number;
  max_payout_utilization: number;
  net_deposits: number;
  total_supplied: number;
  total_withdrawn: number;
}

/** Row of /oracles/:id/prices — one OraclePricesUpdated event (newest first). */
export interface PriceHistoryRow {
  oracle_id: string;
  spot: number; // 1e9
  forward: number; // 1e9
  checkpoint_timestamp_ms: number;
  onchain_timestamp: number;
  [k: string]: unknown;
}

/**
 * Net RangeMinted − RangeRedeemed quantities per (oracle_id, expiry,
 * lower_strike, higher_strike) into open range-position rows.
 *
 * Status mirrors the server's binary-position semantics: once the oracle has
 * settled the position is "redeemable" (redeem_range pays $1·qty if the
 * settlement landed in (lower, higher], else 0), otherwise "active".
 */
export function netManagerRanges(
  raw: ManagerRangesRaw,
  oracles: OracleRow[],
): RangeSummaryRow[] {
  const oracleById = new Map(oracles.map((o) => [o.oracle_id, o]));

  interface Agg {
    first: RangeMintedRow;
    minted: number;
    redeemed: number;
    cost: number; // dUSDC 1e6, sum of mint costs
    payout: number; // dUSDC 1e6, sum of redeem payouts
  }
  const rangeKey = (r: { oracle_id: string; expiry: number; lower_strike: number; higher_strike: number }) =>
    `${r.oracle_id}|${r.expiry}|${r.lower_strike}|${r.higher_strike}`;

  const byKey = new Map<string, Agg>();
  for (const m of raw.minted ?? []) {
    const k = rangeKey(m);
    const a = byKey.get(k) ?? { first: m, minted: 0, redeemed: 0, cost: 0, payout: 0 };
    a.minted += m.quantity;
    a.cost += m.cost;
    byKey.set(k, a);
  }
  for (const r of raw.redeemed ?? []) {
    const a = byKey.get(rangeKey(r));
    if (!a) continue;
    a.redeemed += r.quantity;
    a.payout += r.payout;
  }

  const rows: RangeSummaryRow[] = [];
  for (const a of byKey.values()) {
    const minted = a.minted;
    const redeemed = Math.min(Math.max(a.redeemed, 0), minted);
    const open = minted - redeemed;
    if (open <= 0) continue;

    const oracle = oracleById.get(a.first.oracle_id);
    const settled = oracle?.status === "settled";
    const closedCost = minted > 0 ? Math.round((a.cost * redeemed) / minted) : 0;
    const openCost = a.cost - closedCost;
    // Settled ranges pay $1 per contract when the settlement price landed in
    // (lower, higher]; pre-settlement we have no server mark, so carry cost.
    const inBand =
      settled &&
      oracle?.settlement_price != null &&
      oracle.settlement_price > a.first.lower_strike &&
      oracle.settlement_price <= a.first.higher_strike;
    const markValue = settled ? (inBand ? open : 0) : openCost;

    rows.push({
      oracle_id: a.first.oracle_id,
      underlying_asset: oracle?.underlying_asset ?? "",
      expiry: a.first.expiry,
      lower_strike: a.first.lower_strike,
      higher_strike: a.first.higher_strike,
      open_quantity: open,
      total_cost: a.cost,
      mark_value: markValue,
      unrealized_pnl: markValue - openCost,
      realized_pnl: a.payout - closedCost,
      average_entry_price: minted > 0 ? Math.floor((a.cost * PRICE_SCALE) / minted) : 0,
      mark_price: Math.floor((markValue * PRICE_SCALE) / open),
      status: settled ? "redeemable" : "active",
    });
  }

  return rows.sort((x, y) => x.expiry - y.expiry);
}

// ---------- endpoints ----------
export const indexer = {
  status: () => get<IndexerStatus>("/status", 3),

  oracles: () => get<OracleRow[]>(`/predicts/${PREDICT_ID}/oracles`, 5, { noStore: true }),

  oracleSviLatest: (oracleId: string) =>
    get<SviLatestRow | SviLatestRow[]>(`/oracles/${oracleId}/svi/latest`, 5),

  oraclePriceLatest: (oracleId: string) =>
    get<PriceLatestRow | PriceLatestRow[]>(
      `/oracles/${oracleId}/prices/latest`,
      3,
    ),

  /** Newest-first price tape (~1 update/sec). limit≈900 covers a 15m expiry. */
  oraclePrices: (oracleId: string, limit = 900) =>
    get<PriceHistoryRow[]>(`/oracles/${oracleId}/prices?limit=${limit}`, 3),

  positionsMinted: (limit = 200) =>
    get<PositionMintedRow[]>(`/positions/minted?limit=${limit}`, 5),
  positionsRedeemed: (limit = 200) =>
    get<PositionRedeemedRow[]>(`/positions/redeemed?limit=${limit}`, 5),
  rangesMinted: (limit = 200) =>
    get<RangeMintedRow[]>(`/ranges/minted?limit=${limit}`, 5),
  rangesRedeemed: (limit = 200) =>
    get<RangeRedeemedRow[]>(`/ranges/redeemed?limit=${limit}`, 5),

  managers: () => get<ManagerRow[]>("/managers", 5),

  vaultSummary: () => get<VaultSummary>(`/predicts/${PREDICT_ID}/vault/summary`, 10),
  vaultPerformance: () => get(`/predicts/${PREDICT_ID}/vault/performance`, 30),

  managerSummary: (managerId: string) =>
    get(`/managers/${managerId}/summary`, 5),
  managerPositions: (managerId: string) =>
    get(`/managers/${managerId}/positions/summary`, 5),
  /** Open range positions for a manager, netted from raw mint/redeem events. */
  managerRanges: async (managerId: string): Promise<RangeSummaryRow[]> => {
    const [raw, oracles] = await Promise.all([
      get<ManagerRangesRaw>(`/managers/${managerId}/ranges`, 5),
      get<OracleRow[]>(`/predicts/${PREDICT_ID}/oracles`, 5, { noStore: true }),
    ]);
    return netManagerRanges(raw, oracles);
  },
  managerPnl: (managerId: string) => get(`/managers/${managerId}/pnl`, 5),
};

/** Pick currently-tradeable ("active") oracles, soonest expiry first. */
export function activeOracles(rows: OracleRow[]): OracleRow[] {
  return rows
    .filter((o) => o.status === "active")
    .sort((a, b) => a.expiry - b.expiry);
}
