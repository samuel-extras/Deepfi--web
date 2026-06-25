/**
 * DeepBook Predict terminal — shared types, theme constants, and formatters.
 * Data shapes mirror the /api/oracles, /api/svi and /api/prices proxies.
 */

// ─── server DTOs ──────────────────────────────────────────────────────────────
export type OracleDTO = {
  oracleId: string;
  asset: string;
  expiry: number; // epoch ms
  status: string;
  minStrike: number; // USD
  tickSize: number; // USD
  settlementPrice: number | null;
  /** When the market opened (epoch ms). expiry − activatedAt = its interval. */
  activatedAt?: number | null;
};

export type OraclesResponse = {
  ok: boolean;
  active: OracleDTO[];
  /** A handful of the most-recently-settled markets, for the "Past" rail. */
  settled?: OracleDTO[];
};

export type SviResponse = {
  ok: boolean;
  oracleId?: string;
  asset?: string;
  expiry?: number;
  forward?: number;
  atmIv?: number; // IV% annualized
  points?: { strike: number; iv: number }[];
  params?: { a: number; b: number; rho: number; m: number; sigma: number };
};

export type PricePoint = { t: number; spot: number; forward: number };

export type PricesResponse = {
  ok: boolean;
  oracleId?: string;
  points: PricePoint[];
  spot: number | null;
  forward: number | null;
  asOf: number | null;
};

// ─── selection state ──────────────────────────────────────────────────────────
export type PositionType = "binary" | "range";
export type Direction = "up" | "down";

/** Everything the ticket / chart / ladder agree on. */
export type Selection = {
  posType: PositionType;
  direction: Direction; // binary: above/below · range: which side of ATM
  strikeUsd: number | null; // binary strike
  lowerUsd: number | null; // range bounds
  higherUsd: number | null;
};

// ─── theme (dex design language) ──────────────────────────────────────────────
export const UP = "#02DA8B";
export const DOWN = "#EF4444";
export const BTC = "#F7931A"; // Bitcoin gold — the price line on the BTC chart
export const DOWN_TEXT = "#FF5C5C";
export const MUTED = "#6B7280";
export const AXIS = "#A9A9A9";
export const SURFACE = "#16181D"; // card on #121417 page
export const SURFACE_2 = "#1E2024"; // popover / elevated
export const SURFACE_INPUT = "#0E1217"; // input wells

// ─── formatters ───────────────────────────────────────────────────────────────
export const usd0 = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

export const usd2 = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** 0.382 → "38¢" (price of a $1-payout contract ≈ implied probability). */
export const cents = (p: number) => `${Math.round(p * 100)}¢`;

export const compactUsd = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}k` : `$${n.toFixed(0)}`;

export function clockTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * On-chain → human scale for position contract quantities. The indexer's
 * `open_quantity` is a raw u64 (e.g. 2_766_329); a "contract" pays $1 at
 * settlement, so human contracts = raw / 1e6 (≈ 2.77). Redeems must pass the
 * RAW quantity back on-chain.
 */
export const CONTRACT_SCALE = 1_000_000;

// ─── market interval (cadence) ─────────────────────────────────────────────────
/** Known market durations, shortest first. */
export const PREDICT_CADENCES: { ms: number; label: string }[] = [
  { ms: 5 * 60_000, label: "5m" },
  { ms: 15 * 60_000, label: "15m" },
  { ms: 30 * 60_000, label: "30m" },
  { ms: 60 * 60_000, label: "1h" },
  { ms: 4 * 60 * 60_000, label: "4h" },
  { ms: 24 * 60 * 60_000, label: "1d" },
];

/** Nearest known cadence to a gap (±25% tolerance), else null. */
export function nearestCadenceLabel(gapMs: number): string | null {
  let best: { label: string; err: number } | null = null;
  for (const c of PREDICT_CADENCES) {
    const err = Math.abs(gapMs - c.ms);
    if (err <= c.ms * 0.25 && (!best || err < best.err)) {
      best = { label: c.label, err };
    }
  }
  return best?.label ?? null;
}

/**
 * Map each oracle to its rolling cadence — inferred from the spacing to its
 * nearest same-asset neighbour (the gap between consecutive expiries), NOT the
 * market's lifetime. On testnet markets are activated at arbitrary earlier
 * times, so duration is meaningless; the expiry gap is the true cadence (this is
 * how the markets-list page groups its series, so the two agree).
 */
export function cadenceByOracle(
  oracles: { oracleId: string; asset: string; expiry: number }[],
): Map<string, string> {
  const out = new Map<string, string>();
  const byAsset = new Map<string, typeof oracles>();
  for (const o of oracles) {
    const arr = byAsset.get(o.asset) ?? [];
    arr.push(o);
    byAsset.set(o.asset, arr);
  }
  for (const arr of byAsset.values()) {
    arr.sort((a, b) => a.expiry - b.expiry);
    for (let i = 0; i < arr.length; i++) {
      const prev = i > 0 ? arr[i].expiry - arr[i - 1].expiry : Infinity;
      const next =
        i < arr.length - 1 ? arr[i + 1].expiry - arr[i].expiry : Infinity;
      const lbl = nearestCadenceLabel(Math.min(prev, next));
      if (lbl) out.set(arr[i].oracleId, lbl);
    }
  }
  return out;
}

export function snapToTick(price: number, minStrike: number, tick: number): number {
  if (!(tick > 0)) return Math.round(price);
  return minStrike + Math.round((price - minStrike) / tick) * tick;
}

/**
 * Strike spacing that means something. The on-chain tick can be tiny ($1), so
 * ladder rungs / stepper increments scale with the expected move instead:
 * half a standard deviation at expiry, rounded to a 1/2/5×10ᵏ number and
 * snapped onto the strike grid. ±3 rungs ≈ ±1.5σ ≈ the 7%…93% odds band.
 */
export function volStep(
  refPrice: number,
  ivPct: number | undefined,
  expiryMs: number,
  tick: number,
): number {
  const tYears = Math.max(0, expiryMs - Date.now()) / (365 * 24 * 60 * 60 * 1000);
  const sigma = refPrice * ((ivPct ?? 50) / 100) * Math.sqrt(tYears);
  const raw = sigma / 2;
  if (!(raw > 0)) return tick;
  const mag = 10 ** Math.floor(Math.log10(raw));
  let nice = 10 * mag;
  for (const m of [1, 2, 5]) {
    if (m * mag >= raw) {
      nice = m * mag;
      break;
    }
  }
  // keep rungs on the strike grid
  return Math.max(tick, Math.round(nice / tick) * tick);
}
