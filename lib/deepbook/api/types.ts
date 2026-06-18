/**
 * DTOs for the `/api/deepbook/*` route handlers (client side). These mirror the
 * JSON envelopes the routes return; the server-side read shapes live in
 * `lib/sui/deepbookReads.ts`.
 */
import type { Level } from "../domain/orderbook";

export type OrderbookDTO = {
  ok: boolean;
  mid: number | null;
  bids: Level[];
  asks: Level[];
  bestBid: number | null;
  bestAsk: number | null;
  spread: number | null;
  error?: string;
};

export type TickerDTO = {
  ok: boolean;
  lastPrice?: number;
  change24h?: number;
  change24hPercent?: number;
  baseVolume?: number;
  quoteVolume?: number;
  high24h?: number;
  low24h?: number;
  error?: string;
};

export type SummaryRow = {
  trading_pairs: string;
  last_price: number;
  price_change_percent_24h: number;
  base_volume: number;
  quote_volume: number;
  highest_price_24h: number;
  lowest_price_24h: number;
};

export type SummaryDTO = { ok: boolean; summary: Record<string, SummaryRow> };

export type TradeRow = {
  trade_id: string;
  price: number;
  base_volume: number;
  timestamp: number;
  type: "buy" | "sell";
};

export type TradesDTO = { ok: boolean; trades: TradeRow[] };

export type OrderHistoryRow = {
  order_id: string;
  type: "buy" | "sell";
  current_status: string;
  price: number;
  placed_at: number;
  original_quantity: number;
  filled_quantity: number;
};

export type OrderHistoryDTO = { ok: boolean; orders: OrderHistoryRow[] };
