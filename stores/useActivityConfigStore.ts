"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ActivityConfigResponse } from "@/types";

interface ActivityConfigState {
  config: ActivityConfigResponse | null;
  lastFetched: number | null;
}

interface ActivityConfigActions {
  setConfig: (config: ActivityConfigResponse | null) => void;
  reset: () => void;
}

const initialState: ActivityConfigState = {
  config: null,
  lastFetched: null,
};

// Stable empty arrays to prevent infinite re-renders
const EMPTY_RULES: ActivityConfigResponse["activityRules"] = [];
const EMPTY_MILESTONES: ActivityConfigResponse["activityMilestones"] = [];
const EMPTY_COMMISSIONS: ActivityConfigResponse["referralCommissions"] = [];

export const useActivityConfigStore = create<
  ActivityConfigState & ActivityConfigActions
>()(
  persist(
    set => ({
      ...initialState,
      setConfig: config => set({ config, lastFetched: Date.now() }),
      reset: () => set(initialState),
    }),
    {
      name: "dex:activity:config",
    }
  )
);

// Selectors with stable references
export const useActivityRules = () =>
  useActivityConfigStore(s => s.config?.activityRules || EMPTY_RULES);
export const useActivityMilestones = () =>
  useActivityConfigStore(s => s.config?.activityMilestones || EMPTY_MILESTONES);
export const useReferralCommissions = () =>
  useActivityConfigStore(
    s => s.config?.referralCommissions || EMPTY_COMMISSIONS
  );
