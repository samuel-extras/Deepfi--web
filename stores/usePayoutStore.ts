"use client";

import { create } from "zustand";
import type { Payout } from "@/types";

interface PayoutState {
  payouts: Payout[];
  lastFetched: number | null;
}

interface PayoutActions {
  setPayouts: (payouts: Payout[]) => void;
  reset: () => void;
}

const initialState: PayoutState = {
  payouts: [],
  lastFetched: null,
};

export const usePayoutStore = create<PayoutState & PayoutActions>()(set => ({
  ...initialState,
  setPayouts: payouts => set({ payouts, lastFetched: Date.now() }),
  reset: () => set(initialState),
}));

// Selectors - payouts array is always defined in state
export const usePayouts = () => usePayoutStore(s => s.payouts);

// Note: This creates a new array on every call - wrap in useMemo if used
export const usePayoutsByStatus = (status: string) =>
  usePayoutStore(s => s.payouts.filter(p => p.status === status));
