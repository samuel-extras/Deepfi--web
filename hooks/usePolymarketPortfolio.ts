"use client";

/**
 * STUB — data source for the (verbatim dex) prediction portfolio UI.
 *
 * Returns the exact shape the dex portfolio expects, with empty data, so the UI
 * renders identically. Wire this to deepfi's on-chain portfolio (`/api/portfolio`
 * + the zkLogin address) next — keep the return shape the same.
 */
import { useActiveAccount } from "@/hooks/useActiveAccount";

export type PortfolioTimeframe = "24H" | "7D" | "30D" | "ALL";

export interface PolymarketPortfolio {
  profile: { name?: string; pseudonym?: string } | null;
  positions: any[];
  closedPositions: any[];
  orders: any[];
  activity: any[];
  totalValue: number;
  cashBalance: number;
  tradedCount: number;
  plHistory: { time: string; value: number }[];
  isLoading: boolean;
  error: string | null;
  address: string | null;
  refresh: () => void;
}

export function usePolymarketPortfolio(
  _timeframe: PortfolioTimeframe = "ALL",
  _clobClient?: unknown,
): PolymarketPortfolio {
  const account = useActiveAccount();
  return {
    profile: null,
    positions: [],
    closedPositions: [],
    orders: [],
    activity: [],
    totalValue: 0,
    cashBalance: 0,
    tradedCount: 0,
    plHistory: [],
    isLoading: false,
    error: null,
    address: account?.address ?? null,
    refresh: () => {},
  };
}
