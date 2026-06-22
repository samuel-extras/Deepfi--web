// ---------------------------------------------------------------------------
// Adapter: DeepBook Predict oracles → card-ready events.
//
// Each active oracle is a binary market — "<asset> above or below <ATM strike>
// on <expiry>?" — and settled oracles carry their resolution. The list/table
// view + filter pipeline read the generic `EventBase` shape below, and each
// event also carries a `predict` payload the card reads for the above/below
// framing.
// ---------------------------------------------------------------------------

/** One binary/categorical market within an event. */
export type EventMarket = {
  id: string;
  question: string;
  conditionId: string;
  slug: string;
  /** JSON-encoded string[] e.g. '["Yes","No"]'. */
  outcomes: string;
  /** JSON-encoded string[] of 0..1 prices, aligned with `outcomes`. */
  outcomePrices: string;
  /** Stringified notional. */
  volume: string;
  active: boolean;
  closed: boolean;
  groupItemTitle: string;
  image?: string;
  icon?: string;
  description?: string;
  liquidity?: string;
  spread?: number;
  bestBid?: number;
  bestAsk?: number;
};

/** A tradeable event grouping one or more `markets`. */
export type EventBase = {
  id: string;
  ticker: string;
  slug: string;
  title: string;
  active: boolean;
  closed: boolean;
  volume: number;
  liquidity: number;
  /** ISO timestamps. */
  endDate: string;
  startDate: string;
  markets: EventMarket[];
  image?: string;
  icon?: string;
  description?: string;
};

/** Shape returned by /api/prediction-markets (see app/api/prediction-markets). */
export type PredictMarketDTO = {
  oracleId: string;
  asset: string;
  expiry: number;
  status: string;
  minStrike: number;
  tickSize: number;
  settlementPrice: number | null;
  atmStrike: number | null;
  aboveProb: number | null;
  atmIv: number | null;
  volume: number;
};

/** DeepBook specifics the card needs that don't fit the base event shape. */
export type PredictPayload = {
  oracleId: string;
  asset: string;
  expiry: number;
  status: string;
  minStrike: number;
  tickSize: number;
  atmStrike: number | null;
  aboveProb: number | null; // 0..1
  atmIv: number | null;
  settlementPrice: number | null;
};

export type PredictEvent = EventBase & { predict: PredictPayload };

/** One recent buy from /api/prediction-activity — drives the live float feed. */
export type MintActivity = {
  key: string;
  oracleId: string;
  isUp: boolean;
  cost: number; // USD
  ts: number;
};

const usd0 = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

/**
 * "Jun 16, 3:30 PM UTC". Rendered in UTC (the protocol's instants are UTC) with
 * an explicit label, so the time isn't ambiguous across viewers' timezones.
 */
export function expiryLabel(ms: number): string {
  const t = new Date(ms).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
  return `${t} UTC`;
}

export function marketsToEvents(dtos: PredictMarketDTO[]): PredictEvent[] {
  return dtos.map((d) => {
    const isActive = d.status === "active";
    const when = expiryLabel(d.expiry);

    const title = !isActive
      ? `${d.asset} settled ${d.settlementPrice != null ? usd0(d.settlementPrice) : ""} · ${when}`
      : d.atmStrike != null
        ? `${d.asset} above or below ${usd0(d.atmStrike)} on ${when}?`
        : `${d.asset} price on ${when}?`;

    // A single binary market keeps the table view's extractEventOptions() happy.
    const aboveP = d.aboveProb ?? 0.5;
    const markets =
      d.atmStrike != null
        ? [
            {
              id: d.oracleId,
              question: title,
              conditionId: d.oracleId,
              slug: d.oracleId,
              outcomes: JSON.stringify(["Yes", "No"]),
              outcomePrices: JSON.stringify([
                aboveP.toFixed(4),
                (1 - aboveP).toFixed(4),
              ]),
              volume: String(Math.round(d.volume)),
              active: isActive,
              closed: !isActive,
              groupItemTitle: `Above ${usd0(d.atmStrike)}`,
            },
          ]
        : [];

    return {
      id: d.oracleId,
      ticker: d.oracleId,
      slug: d.oracleId,
      title,
      active: isActive,
      closed: !isActive,
      volume: d.volume,
      liquidity: 0, // PLP liquidity is a shared vault, not per-market
      endDate: new Date(d.expiry).toISOString(),
      startDate: new Date(d.expiry).toISOString(),
      markets,
      predict: {
        oracleId: d.oracleId,
        asset: d.asset,
        expiry: d.expiry,
        status: d.status,
        minStrike: d.minStrike,
        tickSize: d.tickSize,
        atmStrike: d.atmStrike,
        aboveProb: d.aboveProb,
        atmIv: d.atmIv,
        settlementPrice: d.settlementPrice,
      },
    };
  });
}

// ── Series grouping: collapse rolling same-cadence oracles into one card ──────

/** A grid unit: either a single market or a merged rolling series. */
export type MarketItem =
  | { kind: "single"; event: PredictEvent }
  | {
      kind: "series";
      id: string;
      asset: string;
      intervalLabel: string; // "15m"
      count: number;
      current: PredictEvent; // soonest-to-settle member — drives gauge + trade
      members: PredictEvent[];
    };

const CADENCES: { ms: number; label: string }[] = [
  { ms: 5 * 60_000, label: "5m" },
  { ms: 15 * 60_000, label: "15m" },
  { ms: 30 * 60_000, label: "30m" },
  { ms: 60 * 60_000, label: "1h" },
  { ms: 4 * 60 * 60_000, label: "4h" },
  { ms: 24 * 60 * 60_000, label: "1d" },
];

/** Nearest known cadence to a gap (±25% tolerance), else null. */
function nearestCadence(gapMs: number): string | null {
  let best: { label: string; err: number } | null = null;
  for (const c of CADENCES) {
    const err = Math.abs(gapMs - c.ms);
    if (err <= c.ms * 0.25 && (!best || err < best.err)) {
      best = { label: c.label, err };
    }
  }
  return best?.label ?? null;
}

const isLiveEvent = (e: PredictEvent, now: number) =>
  e.active && !e.closed && e.predict.expiry > now;

/**
 * Group live oracles that roll at the same cadence (≥ `minSeries` of them) into
 * one series item; everything else stays a single card. Input order (current-
 * first) is preserved — a series takes the slot of its soonest member.
 */
export function groupIntoItems(
  events: PredictEvent[],
  minSeries = 4,
  now = Date.now(),
): MarketItem[] {
  // Cadence label per live event, inferred from the tighter of its neighbours.
  const cadenceOf = new Map<string, string>();
  const byAsset = new Map<string, PredictEvent[]>();
  for (const e of events) {
    if (!isLiveEvent(e, now)) continue;
    const arr = byAsset.get(e.predict.asset) ?? [];
    arr.push(e);
    byAsset.set(e.predict.asset, arr);
  }
  for (const arr of byAsset.values()) {
    arr.sort((a, b) => a.predict.expiry - b.predict.expiry);
    for (let i = 0; i < arr.length; i++) {
      const prev =
        i > 0 ? arr[i].predict.expiry - arr[i - 1].predict.expiry : Infinity;
      const next =
        i < arr.length - 1
          ? arr[i + 1].predict.expiry - arr[i].predict.expiry
          : Infinity;
      const label = nearestCadence(Math.min(prev, next));
      if (label) cadenceOf.set(arr[i].id, label);
    }
  }

  const keyOf = (e: PredictEvent) =>
    `${e.predict.asset}|${cadenceOf.get(e.id)}`;
  const members = new Map<string, PredictEvent[]>();
  for (const e of events) {
    if (!isLiveEvent(e, now) || !cadenceOf.has(e.id)) continue;
    const k = keyOf(e);
    const arr = members.get(k) ?? [];
    arr.push(e);
    members.set(k, arr);
  }
  const big = new Set(
    [...members].filter(([, v]) => v.length >= minSeries).map(([k]) => k),
  );

  const items: MarketItem[] = [];
  const emitted = new Set<string>();
  for (const e of events) {
    const inBig =
      isLiveEvent(e, now) && cadenceOf.has(e.id) && big.has(keyOf(e));
    if (!inBig) {
      items.push({ kind: "single", event: e });
      continue;
    }
    const k = keyOf(e);
    if (emitted.has(k)) continue;
    emitted.add(k);
    const ms = [...members.get(k)!].sort(
      (a, b) => a.predict.expiry - b.predict.expiry,
    );
    items.push({
      kind: "series",
      id: k,
      asset: e.predict.asset,
      intervalLabel: cadenceOf.get(e.id)!,
      count: ms.length,
      current: ms[0],
      members: ms,
    });
  }
  return items;
}
