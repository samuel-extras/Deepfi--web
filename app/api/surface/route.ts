import { NextRequest, NextResponse } from "next/server";
import {
  indexer,
  type SviLatestRow,
  type PriceLatestRow,
  type PriceHistoryRow,
} from "@/lib/indexer";
import { fromPriceU64 } from "@/lib/deepbook";
import {
  normalizeRawSvi,
  ivAcrossMoneyness,
  butterflyG,
  calendarBreaches,
} from "@/lib/svi";

export const revalidate = 5;

const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;
const MAX_EXPIRIES = 10; // distinct expiry slices to render
const WIDTH = 0.06; // ±6% log-moneyness
const STEPS = 41; // points across each smile
// Oracles roll sub-hour, so older snapshots predate the current active set.
// Keep the scrub window inside the zone where today's oracles have history.
const SCRUB_WINDOW_MS = 20 * 60 * 1000; // 20m time-travel range

function first<T>(v: T | T[]): T {
  return Array.isArray(v) ? v[0] : v;
}

/** Newest-first rows → the first snapshot at or before `at`. */
function atOrBefore<T extends Record<string, unknown>>(
  rows: T[],
  at: number,
): T | null {
  for (const r of rows) {
    const ts = Number(r.checkpoint_timestamp_ms ?? r.timestamp_ms ?? 0);
    if (ts && ts <= at) return r;
  }
  return null;
}

/**
 * GET /api/surface[?at=<ms>] — the SVI volatility surface across active oracles.
 *
 * Live (no `at`): latest SVI + forward per oracle. Time-travel (`at` set):
 * each oracle's SVI + price history snapshot nearest at-or-before `at`; oracles
 * that didn't exist yet are dropped. Runs butterfly (Gatheral g(k) ≥ 0) per
 * slice and calendar (total variance ↑ in expiry) no-arbitrage checks.
 */
export async function GET(req: NextRequest) {
  try {
    const now = Date.now();
    const atParam = req.nextUrl.searchParams.get("at");
    const at = atParam ? Number(atParam) : null;
    const historical = at != null && Number.isFinite(at);
    const tRef = historical ? (at as number) : now;

    const rows = await indexer.oracles();
    const active = rows
      .filter((o) => o.status === "active" && o.expiry > tRef)
      .sort((a, b) => a.expiry - b.expiry)
      .slice(0, MAX_EXPIRIES);

    const ks = Array.from(
      { length: STEPS },
      (_, i) => -WIDTH + (2 * WIDTH * i) / (STEPS - 1),
    );

    const built = await Promise.all(
      active.map(async (o) => {
        let p: ReturnType<typeof normalizeRawSvi>;
        let forward: number;

        if (historical) {
          const [sviHist, priceHist] = await Promise.all([
            indexer
              .oracleSviHistory(o.oracle_id, 400)
              .catch(() => [] as SviLatestRow[]),
            indexer
              .oraclePrices(o.oracle_id, 900)
              .catch(() => [] as PriceHistoryRow[]),
          ]);
          const sviRow = atOrBefore(sviHist, tRef);
          if (!sviRow) return null; // oracle didn't exist yet at tRef
          p = normalizeRawSvi(sviRow as Required<SviLatestRow>);
          const priceRow = atOrBefore(priceHist, tRef);
          const fwdRaw = priceRow?.forward ?? priceRow?.spot;
          forward = fwdRaw
            ? fromPriceU64(fwdRaw)
            : fromPriceU64(o.min_strike) * 1.4;
        } else {
          const [sviRaw, priceRaw] = await Promise.all([
            indexer
              .oracleSviLatest(o.oracle_id)
              .then(first<SviLatestRow>)
              .catch(() => null),
            indexer
              .oraclePriceLatest(o.oracle_id)
              .then(first<PriceLatestRow>)
              .catch(() => null),
          ]);
          if (!sviRaw) return null;
          p = normalizeRawSvi(sviRaw as Required<SviLatestRow>);
          const fwdRaw = priceRaw?.forward ?? priceRaw?.spot ?? priceRaw?.price;
          forward = fwdRaw
            ? fromPriceU64(fwdRaw)
            : fromPriceU64(o.min_strike) * 1.4;
        }

        const tYears = Math.max(1e-6, (o.expiry - tRef) / MS_PER_YEAR);
        const iv = ivAcrossMoneyness(p, tYears, ks);
        const g = butterflyG(p, ks);
        const butterflyKs = ks
          .filter((_, i) => g[i] < 0)
          .map((k) => +(k * 100).toFixed(2));
        return {
          oracleId: o.oracle_id,
          asset: o.underlying_asset,
          expiry: o.expiry,
          minutesToExpiry: Math.max(1, Math.round((o.expiry - tRef) / 60000)),
          forward,
          atmIv: ivAcrossMoneyness(p, tYears, [0])[0],
          iv,
          butterflyKs,
          _p: p,
        };
      }),
    );
    const expiries = built.filter(Boolean) as NonNullable<
      (typeof built)[number]
    >[];

    const calendar = calendarBreaches(
      expiries.map((e) => ({ label: `${e.minutesToExpiry}m`, p: e._p })),
      ks,
    );

    return NextResponse.json({
      ok: true,
      asOf: now,
      at: historical ? tRef : null,
      mode: historical ? "historical" : "live",
      range: { earliest: now - SCRUB_WINDOW_MS, latest: now },
      moneyness: ks.map((k) => +(k * 100).toFixed(2)),
      expiries: expiries.map(({ _p, ...rest }) => rest),
      arb: {
        butterflyExpiries: expiries
          .filter((e) => e.butterflyKs.length)
          .map((e) => e.minutesToExpiry),
        calendarBreaches: calendar.length,
        calendarPairs: [
          ...new Set(calendar.map((c) => `${c.earlier} → ${c.later}`)),
        ],
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) });
  }
}
