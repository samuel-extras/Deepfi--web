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

async function fetchBars(
  poolKey: string,
  resolution: string,
  startMs?: number,
  endMs?: number
): Promise<Bar[]> {
  const interval = RESOLUTION_TO_INTERVAL[resolution] ?? "1h";
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
