"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Wallet balances shown across the app (portfolio, onboarding checks).
 * Fed exclusively by useDeepBookPortfolioSync with real DeepBook data:
 *  - spotBalances    <- DeepBook collateral balances
 *  - marginSummary   <- DeepBook margin equity/debt overview
 *  - predictionsBalance <- DeepBook Predict account value
 */
export interface SpotBalance {
  coin: string;
  token: number;
  hold: string;
  total: string;
  /** USD value of the balance (DeepBook indexer balance_usd). */
  entryNtl: string;
}

export interface MarginOverview {
  /** Net (withdrawable) value in USD. */
  withdrawable: string;
  /** Total margin-account equity in USD. */
  accountValue: string;
  /** Total outstanding debt in USD. */
  totalDebt: string;
}

interface BalanceState {
  marginOverview: MarginOverview | null;
  spotBalances: SpotBalance[];
  /** Total Predict manager account value in USD (cash + open positions). */
  predictionsBalance: string;
  /** Spendable (uncommitted) dUSDC inside the Predict manager, in USD. */
  predictionsTradingBalance: string;
  /**
   * Monotonic counter bumped to request an out-of-band re-sync (e.g. right
   * after a transfer) so venue balances refresh without waiting for the poll.
   * Not persisted — it's an ephemeral signal.
   */
  refreshSeq: number;
}

interface BalanceActions {
  setMarginOverview: (overview: MarginOverview | null) => void;
  setSpotBalances: (balances: SpotBalance[]) => void;
  setPredictionsBalance: (balance: string) => void;
  setPredictionsTradingBalance: (balance: string) => void;
  /** Trigger an immediate balance re-sync (see useDeepBookPortfolioSync). */
  requestRefresh: () => void;
  reset: () => void;
}

const initialState: BalanceState = {
  marginOverview: null,
  spotBalances: [],
  predictionsBalance: "0.00",
  predictionsTradingBalance: "0.00",
  refreshSeq: 0,
};

export const useBalanceStore = create<BalanceState & BalanceActions>()(
  persist(
    set => ({
      ...initialState,

      setMarginOverview: overview => {
        set({ marginOverview: overview });
      },

      setSpotBalances: balances => {
        set({ spotBalances: balances });
      },

      setPredictionsBalance: balance => {
        set({ predictionsBalance: balance });
      },

      setPredictionsTradingBalance: balance => {
        set({ predictionsTradingBalance: balance });
      },

      requestRefresh: () => {
        set(state => ({ refreshSeq: state.refreshSeq + 1 }));
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: "dex:balances",
      partialize: state => ({
        marginOverview: state.marginOverview,
        spotBalances: state.spotBalances,
        predictionsBalance: state.predictionsBalance,
        predictionsTradingBalance: state.predictionsTradingBalance,
      }),
    }
  )
);

export const usePredictionsBalance = () =>
  useBalanceStore(state => state.predictionsBalance);

export const usePredictionsTradingBalance = () =>
  useBalanceStore(state => state.predictionsTradingBalance);

export const useBalanceRefreshSeq = () =>
  useBalanceStore(state => state.refreshSeq);

export const useMarginOverview = () =>
  useBalanceStore(state => state.marginOverview);

export const useSpotBalances = () =>
  useBalanceStore(state => state.spotBalances);

export const usePerpsBalance = () =>
  useBalanceStore(state => state.marginOverview?.withdrawable || "0.00");
