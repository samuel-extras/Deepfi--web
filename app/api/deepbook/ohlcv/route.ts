import { NextRequest, NextResponse } from "next/server";
import { getOhlcv, type Candle } from "@/lib/sui/deepbookReads";

export const revalidate = 0;

/** Treat any pool whose base is BTC (e.g. DBTC_DBUSDC) as a BTC market. */
const isBtcPool = (pool: string) => /btc/i.test(pool);

/** Synthetic BTC symbol (e.g. "BTCUSD") — pure reference feed, not a real pool. */
const isSyntheticBtc = (pool: string) => isBtcPool(pool) && !pool.includes("_");

/** Datafeed interval → Coinbase granularity (seconds). Only these are valid. */
const CB_GRANULARITY: Record<string, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "6h": 21600,
  "1d": 86400,
};

async function withTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>,
  ms = 6000,
): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await run(ctrl.signal);
  } finally {
    clearTimeout(t);
  }
}

/** Datafeed interval → Kraken OHLC interval (minutes). */
const KRAKEN_MINUTES: Record<string, number> = {
  "1m": 1,
  "5m": 5,
  "15m": 15,
  "30m": 30,
  "1h": 60,
  "4h": 240,
  "1d": 1440,
  "1w": 10080,
};

/** Real BTC candles from Kraken (XBTUSD) — free, no key, rarely geo-blocked. */
async function fromKraken(
  interval: string,
  startMs?: number,
): Promise<Candle[]> {
  const minutes = KRAKEN_MINUTES[interval];
  if (!minutes) return [];
  const qs = new URLSearchParams({ pair: "XBTUSD", interval: String(minutes) });
  if (startMs) qs.set("since", String(Math.floor(startMs / 1000)));
  return withTimeout(async (signal) => {
    const r = await fetch(`https://api.kraken.com/0/public/OHLC?${qs}`, {
      signal,
      cache: "no-store",
      headers: { "User-Agent": "deepcast/1.0" },
    });
    if (!r.ok) throw new Error(`kraken ${r.status}`);
    const j = (await r.json()) as {
      error?: string[];
      result?: Record<string, unknown>;
    };
    if (j.error?.length) throw new Error(`kraken ${j.error.join(",")}`);
    const result = j.result ?? {};
    const key = Object.keys(result).find((k) => k !== "last");
    const rows = (key ? result[key] : []) as (string | number)[][];
    // kraken rows: [time(s), open, high, low, close, vwap, volume, count]
    return rows.map((k) => ({
      time: Number(k[0]) * 1000,
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4]),
      volume: Number(k[6]),
    }));
  });
}

/** Real BTC klines from Binance (BTCUSDT). Intervals match the datafeed's. */
async function fromBinance(
  interval: string,
  startMs?: number,
  endMs?: number,
): Promise<Candle[]> {
  const qs = new URLSearchParams({
    symbol: "BTCUSDT",
    interval,
    limit: "1000",
  });
  if (startMs) qs.set("startTime", String(Math.floor(startMs)));
  if (endMs) qs.set("endTime", String(Math.floor(endMs)));
  return withTimeout(async (signal) => {
    const r = await fetch(`https://api.binance.com/api/v3/klines?${qs}`, {
      signal,
      cache: "no-store",
      headers: { "User-Agent": "deepcast/1.0" },
    });
    if (!r.ok) throw new Error(`binance ${r.status}`);
    const j = (await r.json()) as (string | number)[][];
    return j.map((k) => ({
      time: Number(k[0]),
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4]),
      volume: Number(k[5]),
    }));
  });
}

/** Real BTC candles from Coinbase (fallback for intervals it supports). */
async function fromCoinbase(
  interval: string,
  startMs?: number,
  endMs?: number,
): Promise<Candle[]> {
  const gran = CB_GRANULARITY[interval];
  if (!gran) return [];
  const qs = new URLSearchParams({ granularity: String(gran) });
  if (startMs) qs.set("start", new Date(startMs).toISOString());
  if (endMs) qs.set("end", new Date(endMs).toISOString());
  return withTimeout(async (signal) => {
    const r = await fetch(
      `https://api.exchange.coinbase.com/products/BTC-USD/candles?${qs}`,
      { signal, cache: "no-store", headers: { "User-Agent": "deepcast/1.0" } },
    );
    if (!r.ok) throw new Error(`coinbase ${r.status}`);
    // coinbase rows: [time(s), low, high, open, close, volume]
    const j = (await r.json()) as number[][];
    return j
      .map((k) => ({
        time: k[0] * 1000,
        low: k[1],
        high: k[2],
        open: k[3],
        close: k[4],
        volume: k[5],
      }))
      .sort((a, b) => a.time - b.time);
  });
}

/**
 * Best-effort real BTC reference candles. Kraken first — it's free, keyless, and
 * (unlike Binance/Coinbase) generally reachable from cloud regions; Binance and
 * Coinbase are fallbacks for when Kraken is down.
 */
async function btcReference(
  interval: string,
  startMs?: number,
  endMs?: number,
): Promise<Candle[]> {
  const sources = [
    () => fromKraken(interval, startMs),
    () => fromBinance(interval, startMs, endMs),
    () => fromCoinbase(interval, startMs, endMs),
  ];
  for (const src of sources) {
    try {
      const c = await src();
      if (c.length) return c;
    } catch {
      /* try the next source */
    }
  }
  return [];
}

/** GET /api/deepbook/ohlcv?pool=SUI_DBUSDC&interval=1h&start=<ms>&end=<ms> */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const pool = sp.get("pool") || "SUI_DBUSDC";
  const interval = sp.get("interval") || "1h";
  const start = sp.get("start") ? Number(sp.get("start")) : undefined;
  const end = sp.get("end") ? Number(sp.get("end")) : undefined;

  // Synthetic BTC symbol → skip DeepBook entirely, serve the real BTC feed.
  if (isSyntheticBtc(pool)) {
    const ref = await btcReference(interval, start, end);
    return NextResponse.json({
      ok: ref.length > 0,
      pool,
      interval,
      source: "btc-reference",
      candles: ref,
    });
  }

  try {
    let candles = await getOhlcv(pool, interval, start, end);
    let source = "deepbook";
    // Testnet BTC pool has ~no trades → the chart is empty. Fall back to a real
    // BTC reference feed so the prediction (and BTC spot) chart shows BTC data.
    if (candles.length === 0 && isBtcPool(pool)) {
      const ref = await btcReference(interval, start, end);
      if (ref.length) {
        candles = ref;
        source = "btc-reference";
      }
    }
    return NextResponse.json({ ok: true, pool, interval, source, candles });
  } catch (e) {
    if (isBtcPool(pool)) {
      const ref = await btcReference(interval, start, end);
      if (ref.length) {
        return NextResponse.json({
          ok: true,
          pool,
          interval,
          source: "btc-reference",
          candles: ref,
        });
      }
    }
    return NextResponse.json({ ok: false, pool, error: String(e), candles: [] });
  }
}
