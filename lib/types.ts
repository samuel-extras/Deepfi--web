// Shared domain types for DeepFi (frontend phase — backed by mock data for now).

export type Direction = "up" | "down";

export type CollateralAsset = "SUI" | "BTC" | "dUSDC";

/** A Predict binary/range position the user is configuring or holds. */
export interface PredictRange {
  /** lower strike bound (USD) */
  strikeLow: number;
  /** upper strike bound (USD) */
  strikeHigh: number;
  /** expiry in minutes from mint */
  expiryMinutes: number;
}

/** Live-ish market snapshot used across the app. */
export interface MarketSnapshot {
  symbol: string; // "BTC"
  spot: number; // underlying price
  change24hPct: number;
  /** ATM implied vol (annualized, %) derived from SVI */
  atmIv: number;
}

/** A single SVI smile sample (strike -> implied vol). */
export interface SviPoint {
  strike: number;
  iv: number; // %
}

/** One expiry slice of the vol surface. */
export interface SviSlice {
  expiryMinutes: number;
  points: SviPoint[];
}

export interface OrderbookLevel {
  price: number;
  size: number;
  total: number;
}

export interface Orderbook {
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  spread: number;
}

export interface Candle {
  time: number; // epoch ms
  open: number;
  high: number;
  low: number;
  close: number;
}

/** A trade surfaced in the Whale Feed. */
export interface FeedTrade {
  id: string;
  txDigest: string;
  sender: string;
  ens?: string;
  direction: Direction;
  leverage: number;
  range: PredictRange;
  sizeDusdc: number;
  isCombo: boolean;
  timestamp: number;
}

/** A position in the unified portfolio view. */
export interface PortfolioPosition {
  id: string;
  range: PredictRange;
  direction: Direction;
  leverage: number;
  sizeDusdc: number;
  entryIv: number;
  markValue: number;
  pnl: number;
  pnlPct: number;
  /** ms until settlement; <=0 means settled & redeemable */
  timeToSettleMs: number;
  isCombo: boolean;
}

export interface MarginAccount {
  collateralDusdc: number;
  debtDusdc: number;
  /** > 1 healthy, < 1 liquidatable */
  healthFactor: number;
  liquidationPrice: number;
  borrowApr: number;
}

export interface WalletBalance {
  asset: string;
  amount: number;
  usdValue: number;
}

export interface LeaderboardEntry {
  rank: number;
  sender: string;
  ens?: string;
  ivEdge: number; // realized return / implied vol at entry
  sharpe30d: number;
  winRate: number;
  trades: number;
  pnl: number;
  followers: number;
}

export interface StreakDay {
  date: string; // ISO date
  result: "win" | "loss" | "pending" | "none";
}

export interface ComboPlan {
  asset: CollateralAsset;
  inputAmount: number; // in `asset` units
  leverage: number;
  direction: Direction;
  range: PredictRange;
  /** dUSDC obtained from spot swap leg (0 if asset is dUSDC) */
  swappedDusdc: number;
  /** dUSDC borrowed from margin */
  borrowedDusdc: number;
  /** total dUSDC routed into predict::mint */
  notionalDusdc: number;
  estPayoutDusdc: number;
  estMaxLossDusdc: number;
  healthFactorAfter: number;
  entryIv: number;
}
