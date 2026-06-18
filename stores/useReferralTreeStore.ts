"use client";

import { create } from "zustand";
import type { ReferralTreeItem } from "@/types";

interface ReferralTreeState {
  referrals: ReferralTreeItem[];
  lastFetched: number | null;
}

interface ReferralTreeActions {
  setReferrals: (referrals: ReferralTreeItem[]) => void;
  reset: () => void;
}

const initialState: ReferralTreeState = {
  referrals: [],
  lastFetched: null,
};

export const useReferralTreeStore = create<
  ReferralTreeState & ReferralTreeActions
>()(set => ({
  ...initialState,
  setReferrals: referrals => set({ referrals, lastFetched: Date.now() }),
  reset: () => set(initialState),
}));

// Selectors - all stable because array is always defined in state
export const useReferralTree = () => useReferralTreeStore(s => s.referrals);

// Note: These create new arrays on every call but only when used with filters
// If you use them, wrap in useMemo in the component
export const useReferralsByLevel = (level: number) =>
  useReferralTreeStore(s => s.referrals.filter(r => r.level === level));
export const useTotalReferralVolume = () =>
  useReferralTreeStore(s => s.referrals.reduce((sum, r) => sum + r.volume, 0));
export const useTotalReferralCompensation = () =>
  useReferralTreeStore(s =>
    s.referrals.reduce((sum, r) => sum + r.totalCompensation, 0)
  );
