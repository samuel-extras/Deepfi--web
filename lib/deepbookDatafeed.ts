/**
 * TradingView charting_library datafeed backed by the DeepBook indexer
 * (via our /api/deepbook routes). Symbols are DeepBook pool keys
 * (e.g. "SUI_DBUSDC"); bars come from /ohlcv, live updates poll the last bar.
 */
import type {
  Bar,
  DatafeedConfiguration,
  HistoryCallback,
  IDatafeedChartApi,
  IExternalDatafeed,
  LibrarySymbolInfo,
  OnReadyCallback,
  PeriodParams,
  ResolutionString,
  ResolveCallback,
  SearchSymbolsCallback,
  SubscribeBarsCallback,
} from "@/types/charting-library";
import { SPOT_POOLS, getSpotPool } from "@/lib/sui/deepbookSpot";

const SUPPORTED_RESOLUTIONS = [
  "1",
  "5",
  "15",
  "30",
  "60",
  "240",
  "1D",
  "1W",
] as const;

const RESOLUTION_TO_INTERVAL: Record<string, string> = {
  "1": "1m",
  "5": "5m",
  "15": "15m",
  "30": "30m",
  "60": "1h",
  "240": "4h",
  "1D": "1d",
  "1W": "1w",
};

const RESOLUTION_TO_MS: Record<string, number> = {
  "1": 60_000,
  "5": 300_000,
  "15": 900_000,
  "30": 1_800_000,
  "60": 3_600_000,
  "240": 14_400_000,
  "1D": 86_400_000,
  "1W": 604_800_000,
};

const LIVE_POLL_MS = 5_000;

/** Synthetic BTC symbol (e.g. "BTCUSD") — a real BTC reference feed, not a
 *  DeepBook pool. Used by the Predict terminal so the chart reads "BTC". */
const isSyntheticBtc = (sym: string) => /btc/i.test(sym) && !sym.includes("_");

/** pricescale = 10^decimals, sized to the price magnitude (dex heuristic). */
function priceScaleFor(price: number): number {
  if (!price || price <= 0) return 100;
  const thresholds: Array<{ max: number; scale: number }> = [
    { max: 0.0001, scale: 100_000_000 },
    { max: 0.001, scale: 10_000_000 },
    { max: 0.01, scale: 1_000_000 },
    { max: 0.1, scale: 100_000 },
    { max: 1, scale: 10_000 },
    { max: 10, scale: 1_000 },
    { max: 100, scale: 100 },
  ];
  for (const t of thresholds) if (price < t.max) return t.scale;
  return 100;
}

type Candle = [number, number, number, number, number, number] | {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

/** Datafeed interval → Coinbase granularity (seconds). Only these are valid. */
const COINBASE_GRANULARITY: Record<string, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "6h": 21600,
  "1d": 86400,
};

/**
 * Browser-direct BTC candles from CORS-enabled exchanges. The chart runs in the
 * browser, which can reach these even when the server can't (proxy/geo egress
 * limits) — that's why the testnet BTC pool + our server proxy come back empty.
 * Binance covers every interval; Coinbase is the US-friendly fallback.
 */
async function fetchBtcBarsDirect(
  interval: string,
  startMs?: number,
  endMs?: number
): Promise<Bar[]> {
  try {
    const qs = new URLSearchParams({
      symbol: "BTCUSDT",
      interval,
      limit: "1000",
    });
    if (startMs) qs.set("startTime", String(Math.floor(startMs)));
    if (endMs) qs.set("endTime", String(Math.floor(endMs)));
    const r = await fetch(`https://api.binance.com/api/v3/klines?${qs}`);
    if (r.ok) {
      const j = (await r.json()) as (string | number)[][];
      const bars = j.map(k => ({
        time: Number(k[0]),
        open: Number(k[1]),
        high: Number(k[2]),
        low: Number(k[3]),
        close: Number(k[4]),
        volume: Number(k[5]),
      }));
      if (bars.length) return bars;
    }
  } catch {
    /* try Coinbase */
  }
  const gran = COINBASE_GRANULARITY[interval];
  if (gran) {
    try {
      const qs = new URLSearchParams({ granularity: String(gran) });
      if (startMs) qs.set("start", new Date(startMs).toISOString());
      if (endMs) qs.set("end", new Date(endMs).toISOString());
      const r = await fetch(
        `https://api.exchange.coinbase.com/products/BTC-USD/candles?${qs}`
      );
      if (r.ok) {
        // coinbase rows: [time(s), low, high, open, close, volume]
        const j = (await r.json()) as number[][];
        const bars = j.map(k => ({
          time: k[0] * 1000,
          low: k[1],
          high: k[2],
          open: k[3],
          close: k[4],
          volume: k[5],
        }));
        if (bars.length) return bars.sort((a, b) => a.time - b.time);
      }
    } catch {
      /* fall through */
    }
  }
  return [];
}

async function fetchBars(
  poolKey: string,
  resolution: string,
  startMs?: number,
  endMs?: number
): Promise<Bar[]> {
  const interval = RESOLUTION_TO_INTERVAL[resolution] ?? "1h";
  // Synthetic BTC symbol → fetch real BTC candles straight from the browser
  // (CORS-enabled exchanges); fall back to the server route only if that fails.
  if (isSyntheticBtc(poolKey)) {
    const direct = await fetchBtcBarsDirect(interval, startMs, endMs);
    if (direct.length) return direct.sort((a, b) => a.time - b.time);
  }
  const qs = new URLSearchParams({ pool: poolKey, interval });
  if (startMs) qs.set("start", String(Math.floor(startMs)));
  if (endMs) qs.set("end", String(Math.floor(endMs)));
  const res = await fetch(`/api/deepbook/ohlcv?${qs.toString()}`, {
    cache: "no-store",
  });
  const json = (await res.json()) as { candles?: Candle[] };
  return (json.candles ?? [])
    .map(c =>
      Array.isArray(c)
        ? { time: c[0], open: c[1], high: c[2], low: c[3], close: c[4], volume: c[5] }
        : { time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume }
    )
    .sort((a, b) => a.time - b.time);
}

type Subscription = {
  timer: ReturnType<typeof setInterval>;
  lastBarTime: number;
};

class DeepBookDatafeed implements IDatafeedChartApi, IExternalDatafeed {
  #subs = new Map<string, Subscription>();
  #lastPriceCache = new Map<string, number>();
  /** Last HISTORY bar per `${ticker}:${resolution}` — streaming must never
   * deliver a tick before/behind history or the series wedges silently. */
  #lastBars = new Map<string, Bar>();

  onReady(callback: OnReadyCallback) {
    const config: DatafeedConfiguration = {
      supported_resolutions: [...SUPPORTED_RESOLUTIONS] as ResolutionString[],
      supports_marks: false,
      supports_timescale_marks: false,
      supports_time: true,
    };
    setTimeout(() => callback(config), 0);
  }

  searchSymbols(
    userInput: string,
    _exchange: string,
    _symbolType: string,
    onResult: SearchSymbolsCallback
  ) {
    const q = userInput.toUpperCase();
    onResult(
      SPOT_POOLS.filter(p => p.key.includes(q) || p.label.includes(q)).map(p => ({
        symbol: p.key,
        full_name: p.key,
        description: p.label,
        exchange: "DeepBook",
        ticker: p.key,
        type: "crypto",
      }))
    );
  }

  async resolveSymbol(symbolName: string, onResolve: ResolveCallback) {
    // Synthetic BTC reference symbol — label it as plain "BTC", no pool lookup.
    if (isSyntheticBtc(symbolName)) {
      const btcInfo: LibrarySymbolInfo = {
        ticker: symbolName,
        name: "BTC",
        description: "Bitcoin · BTC/USD",
        type: "crypto",
        session: "24x7",
        timezone: "Etc/UTC",
        exchange: "Reference",
        listed_exchange: "Binance",
        format: "price",
        minmov: 1,
        pricescale: 100,
        has_intraday: true,
        has_weekly_and_monthly: true,
        visible_plots_set: "ohlcv",
        supported_resolutions: [...SUPPORTED_RESOLUTIONS] as ResolutionString[],
        volume_precision: 2,
        data_status: "streaming",
      };
      setTimeout(() => onResolve(btcInfo), 0);
      return;
    }

    const pool = getSpotPool(symbolName);
    let lastPrice = this.#lastPriceCache.get(symbolName) ?? 0;
    if (!lastPrice) {
      try {
        const res = await fetch(`/api/deepbook/ticker?pool=${symbolName}`, {
          cache: "no-store",
        });
        const t = (await res.json()) as { lastPrice?: number };
        lastPrice = t.lastPrice ?? 0;
        if (lastPrice) this.#lastPriceCache.set(symbolName, lastPrice);
      } catch {
        // fall back to default scale
      }
    }

    const symbolInfo: LibrarySymbolInfo = {
      ticker: pool.key,
      name: `${pool.base}/${pool.quote}`,
      description: `${pool.base}/${pool.quote} · DeepBook`,
      type: "crypto",
      session: "24x7",
      timezone: "Etc/UTC",
      exchange: "DeepBook",
      listed_exchange: "DeepBook",
      format: "price",
      minmov: 1,
      pricescale: priceScaleFor(lastPrice),
      has_intraday: true,
      has_weekly_and_monthly: true,
      visible_plots_set: "ohlcv",
      supported_resolutions: [...SUPPORTED_RESOLUTIONS] as ResolutionString[],
      volume_precision: 2,
      data_status: "streaming",
    };
    setTimeout(() => onResolve(symbolInfo), 0);
  }

  async getBars(
    symbolInfo: LibrarySymbolInfo,
    resolution: ResolutionString,
    periodParams: PeriodParams,
    onResult: HistoryCallback,
    onError: (reason: string) => void
  ) {
    try {
      const bars = await fetchBars(
        symbolInfo.ticker!,
        resolution,
        periodParams.from * 1000,
        periodParams.to * 1000
      );
      const inRange = bars.filter(
        b => b.time >= periodParams.from * 1000 && b.time < periodParams.to * 1000
      );
      if (periodParams.firstDataRequest && inRange.length > 0) {
        this.#lastBars.set(
          `${symbolInfo.ticker}:${resolution}`,
          inRange[inRange.length - 1]
        );
      }
      onResult(inRange, { noData: inRange.length === 0 });
    } catch (e) {
      onError(String(e));
    }
  }

  subscribeBars(
    symbolInfo: LibrarySymbolInfo,
    resolution: ResolutionString,
    onTick: SubscribeBarsCallback,
    listenerGuid: string
  ) {
    this.unsubscribeBars(listenerGuid);
    const key = `${symbolInfo.ticker}:${resolution}`;
    const sub: Subscription = { timer: 0 as never, lastBarTime: 0 };
    const span = RESOLUTION_TO_MS[resolution] ?? 3_600_000;

    const poll = async () => {
      try {
        // never stream before history primed the series (canonical TV rule)
        const baseline = this.#lastBars.get(key);
        if (!baseline) return;
        const now = Date.now();
        const bars = await fetchBars(
          symbolInfo.ticker!,
          resolution,
          now - span * 3,
          now
        );
        const last = bars[bars.length - 1];
        if (!last) return;
        // ticks must be monotonically non-decreasing vs the last known bar
        if (last.time >= Math.max(baseline.time, sub.lastBarTime)) {
          sub.lastBarTime = last.time;
          this.#lastBars.set(key, last);
          onTick(last);
          this.#lastPriceCache.set(symbolInfo.ticker!, last.close);
        }
      } catch {
        // transient polling errors are fine
      }
    };

    sub.timer = setInterval(poll, LIVE_POLL_MS);
    this.#subs.set(listenerGuid, sub);
  }

  unsubscribeBars(listenerGuid: string) {
    const sub = this.#subs.get(listenerGuid);
    if (sub) {
      clearInterval(sub.timer);
      this.#subs.delete(listenerGuid);
    }
  }

  clearCache() {
    this.#lastPriceCache.clear();
    this.#lastBars.clear();
  }
}

export const deepbookDatafeed = new DeepBookDatafeed();
