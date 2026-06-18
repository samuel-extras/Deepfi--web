/**
 * Typed fetchers for the `/api/deepbook/*` route handlers. Every read is
 * `cache: "no-store"` — the book, tape, and account state must be live.
 *
 * This is the single place URLs and query params are constructed; the React
 * Query hooks in `./queries` wrap these with keys + refetch intervals.
 */
import type {
  OrderbookDTO,
  TickerDTO,
  SummaryDTO,
  TradesDTO,
  OrderHistoryDTO,
} from "./types";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  return (await res.json()) as T;
}

export const deepbookApi = {
  orderbook: (pool: string, ticks = 100) =>
    getJson<OrderbookDTO>(`/api/deepbook/orderbook?pool=${pool}&ticks=${ticks}`),

  ticker: (pool: string) =>
    getJson<TickerDTO>(`/api/deepbook/ticker?pool=${pool}`),

  summary: () => getJson<SummaryDTO>(`/api/deepbook/summary`),

  trades: (pool: string, limit = 40) =>
    getJson<TradesDTO>(`/api/deepbook/trades?pool=${pool}&limit=${limit}`),

  orderHistory: (pool: string, bm: string, limit = 50) =>
    getJson<OrderHistoryDTO>(
      `/api/deepbook/orders?pool=${pool}&bm=${bm}&limit=${limit}`
    ),
};
