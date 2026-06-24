import { NextRequest, NextResponse } from "next/server";
import { runBacktests, DEFAULT_CONFIG, type Candle } from "@/lib/simulation/backtest";
import snapshot from "@/lib/simulation/btc-15m.json";

export const revalidate = 1800;

const N = 1000;

/** Bundled real BTC 15m snapshot — reproducible, the default source. */
function fromSnapshot(): Candle[] {
  return (snapshot.candles as number[][]).map(k => ({
    time: k[0], open: k[1], high: k[2], low: k[3], close: k[4],
  }));
}

/** Optional live refresh (opt-in via ?live=1). Short timeout → no hang. */
async function fetchLive(url: string, map: (j: unknown) => Candle[]): Promise<Candle[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "deepcast/1.0" } });
    if (!r.ok) throw new Error(String(r.status));
    return map(await r.json());
  } finally {
    clearTimeout(t);
  }
}

const binanceMap = (j: unknown) =>
  (j as (string | number)[][]).map(k => ({
    time: Number(k[0]), open: Number(k[1]), high: Number(k[2]), low: Number(k[3]), close: Number(k[4]),
  }));

const coinbaseMap = (j: unknown) =>
  (j as number[][])
    .map(k => ({ time: k[0] * 1000, low: k[1], high: k[2], open: k[3], close: k[4] }))
    .sort((a, b) => a.time - b.time);

export async function GET(req: NextRequest) {
  const live = req.nextUrl.searchParams.get("live") === "1";
  let candles = fromSnapshot();
  let source = `snapshot (${snapshot.source})`;

  if (live) {
    for (const [name, url, map] of [
      ["binance", `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=15m&limit=${N}`, binanceMap],
      ["coinbase", "https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=900", coinbaseMap],
    ] as const) {
      try {
        const c = await fetchLive(url, map);
        if (c.length > DEFAULT_CONFIG.volWindow + 2) { candles = c; source = `live (${name})`; break; }
      } catch { /* fall through to snapshot */ }
    }
  }

  try {
    const results = runBacktests(candles, DEFAULT_CONFIG);
    return NextResponse.json({
      ok: true,
      source,
      asset: "BTC",
      interval: "15m",
      candles: candles.length,
      from: candles[0]?.time ?? null,
      to: candles[candles.length - 1]?.time ?? null,
      config: DEFAULT_CONFIG,
      results,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
