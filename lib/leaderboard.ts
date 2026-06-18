/**
 * Shared trader-board aggregation, derived entirely from the public Predict
 * indexer. Used by /api/leaderboard (IV-Edge board) and /api/competition
 * (trading tournament). Server-only — calls the indexer.
 */
import { indexer } from "@/lib/indexer";
import { fromDusdcU64, fromPriceU64 } from "@/lib/deepbook";
import { normalizeRawSvi, ivFromRawSvi } from "@/lib/svi";
import type { SviLatestRow } from "@/lib/indexer";

const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;
/** Min cumulative premium (dUSDC) a trader must have paid to be ranked by ROE. */
const MIN_NOTIONAL = 1;
/** How many recent mint events to scan for entry-size attribution. */
const MINT_SCAN = 1000;

interface Summ {
  realized_pnl: number;
  unrealized_pnl: number;
  account_value: number;
  open_positions: number;
}

export interface TraderRow {
  owner: string;
  pnl: number;
  accountValue: number;
  positions: number;
  /** Cumulative premium paid across all mints (dUSDC) — trading volume. */
  entrySize: number;
  returnOnExposure: number;
  ivEdge: number | null;
  tradeCount: number;
}

/**
 * Aggregate per-trader stats from the indexer:
 *   - entry notional + trade count from mint history (PositionMinted/RangeMinted)
 *   - PnL + account value from manager summaries
 *   - ROE = PnL / entry notional, IV-Edge = ROE / ATM IV
 * Returns rows ranked by ROE (among traders with real size), then PnL.
 */
export async function computeTraderBoard(): Promise<{
  rows: TraderRow[];
  total: number;
}> {
  const [managers, oracleRows] = await Promise.all([
    indexer.managers(),
    indexer.oracles().catch(() => []),
  ]);

  // ── Median ATM IV across active oracles (the vol denominator) ────────────
  const activeOracles = oracleRows.filter((o) => o.status === "active").slice(0, 5);
  const ivSamples: number[] = [];
  await Promise.allSettled(
    activeOracles.map(async (oracle) => {
      const [sviRaw, priceRaw] = await Promise.all([
        indexer.oracleSviLatest(oracle.oracle_id),
        indexer.oraclePriceLatest(oracle.oracle_id).catch(() => null),
      ]);
      const sviRow = Array.isArray(sviRaw) ? sviRaw[0] : sviRaw;
      if (!sviRow) return;
      const params = normalizeRawSvi(sviRow as Required<SviLatestRow>);
      const priceRow = Array.isArray(priceRaw) ? priceRaw?.[0] : priceRaw;
      const forward = priceRow?.forward
        ? fromPriceU64(priceRow.forward)
        : priceRow?.spot
          ? fromPriceU64(priceRow.spot)
          : priceRow?.price
            ? fromPriceU64(priceRow.price)
            : fromPriceU64(oracle.min_strike) * 1.4;
      const tYears = Math.max(1e-6, (oracle.expiry - Date.now()) / MS_PER_YEAR);
      const atmIv = ivFromRawSvi(forward, forward, params, tYears);
      if (atmIv > 0) ivSamples.push(atmIv);
    }),
  );
  ivSamples.sort((a, b) => a - b);
  const medianAtmIv = ivSamples.length ? ivSamples[Math.floor(ivSamples.length / 2)] : null;

  // ── Per-trader entry notional + trade count, from mint history ──────────
  const [posMinted, rngMinted] = await Promise.all([
    indexer.positionsMinted(MINT_SCAN).catch(() => []),
    indexer.rangesMinted(MINT_SCAN).catch(() => []),
  ]);
  const entryByTrader = new Map<string, { size: number; trades: number }>();
  const addEntry = (who: string | undefined, cost: number) => {
    if (!who) return;
    const e = entryByTrader.get(who) ?? { size: 0, trades: 0 };
    e.size += fromDusdcU64(cost ?? 0);
    e.trades += 1;
    entryByTrader.set(who, e);
  };
  for (const m of posMinted) addEntry(m.trader ?? m.sender, m.cost);
  for (const m of rngMinted) addEntry(m.trader ?? m.sender, m.cost);

  // ── Per-owner PnL + account value, from manager summaries ───────────────
  const unique = Array.from(
    new Map(managers.map((m) => [m.manager_id, m])).values(),
  ).slice(0, 80);

  const summaries = await Promise.allSettled(
    unique.map(async (m) => ({
      owner: m.owner,
      s: (await indexer.managerSummary(m.manager_id)) as Summ,
    })),
  );

  const byOwner = new Map<string, { pnl: number; accountValue: number; positions: number }>();
  for (const r of summaries) {
    if (r.status !== "fulfilled") continue;
    const { owner, s } = r.value;
    const cur = byOwner.get(owner) ?? { pnl: 0, accountValue: 0, positions: 0 };
    cur.pnl += fromDusdcU64((s.realized_pnl ?? 0) + (s.unrealized_pnl ?? 0));
    cur.accountValue += fromDusdcU64(s.account_value ?? 0);
    cur.positions += s.open_positions ?? 0;
    byOwner.set(owner, cur);
  }

  // Union of everyone who shows up in summaries OR mint history.
  const owners = new Set<string>([...byOwner.keys(), ...entryByTrader.keys()]);

  const rows: TraderRow[] = Array.from(owners)
    .map((owner) => {
      const v = byOwner.get(owner) ?? { pnl: 0, accountValue: 0, positions: 0 };
      const entry = entryByTrader.get(owner);
      const entrySize = entry?.size ?? 0;
      const tradeCount = entry?.trades ?? 0;
      const roe = entrySize >= MIN_NOTIONAL ? v.pnl / entrySize : 0;
      const ivEdge = medianAtmIv && medianAtmIv > 0 ? roe / (medianAtmIv / 100) : null;
      return {
        owner,
        pnl: v.pnl,
        accountValue: v.accountValue,
        positions: v.positions,
        entrySize,
        returnOnExposure: roe,
        ivEdge,
        tradeCount,
      };
    })
    .filter((r) => r.tradeCount > 0 || r.accountValue > 0 || r.pnl !== 0)
    .sort((a, b) => {
      const aRanked = a.entrySize >= MIN_NOTIONAL;
      const bRanked = b.entrySize >= MIN_NOTIONAL;
      if (aRanked !== bRanked) return aRanked ? -1 : 1;
      if (aRanked && bRanked) return b.returnOnExposure - a.returnOnExposure;
      return b.pnl - a.pnl;
    });

  return { rows, total: owners.size };
}
