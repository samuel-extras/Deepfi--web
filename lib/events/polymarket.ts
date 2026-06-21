// ---------------------------------------------------------------------------
// Polymarket-compatible event shape.
//
// deepfi's prediction cards/table were ported from a Polymarket-style UI, so the
// adapter in ./index builds DeepBook Predict oracles into THIS shape (the real
// protocol data rides alongside in `predict`). This is just the structural
// contract the views read — no Polymarket network calls.
// ---------------------------------------------------------------------------

/** One binary/categorical market within an event. */
export type Market = {
  id: string;
  question: string;
  conditionId: string;
  slug: string;
  /** JSON-encoded string[] e.g. '["Yes","No"]'. */
  outcomes: string;
  /** JSON-encoded string[] of 0..1 prices, aligned with `outcomes`. */
  outcomePrices: string;
  /** Stringified notional, Polymarket-style. */
  volume: string;
  active: boolean;
  closed: boolean;
  groupItemTitle: string;
  // Optional Polymarket fields some ported views read.
  image?: string;
  icon?: string;
  description?: string;
  liquidity?: string;
  spread?: number;
  bestBid?: number;
  bestAsk?: number;
};

/** A tradeable event grouping one or more `markets`. */
export type PolymarketEvent = {
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
  markets: Market[];
  // Optional Polymarket fields some ported views read.
  image?: string;
  icon?: string;
  description?: string;
};
