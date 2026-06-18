"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AppSettings {
  hideSmallBalances: boolean;
  disableBackgroundNotifications: boolean;
  hidePnl: boolean;
  animateOrderbook: boolean;
}

interface AppSettingsStore extends AppSettings {
  updateSetting: <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => void;
  reset: () => void;
}

const initialSettings: AppSettings = {
  hideSmallBalances: false,
  disableBackgroundNotifications: false,
  hidePnl: false,
  animateOrderbook: true,
};

export const useAppSettingsStore = create<AppSettingsStore>()(
  persist(
    set => ({
      ...initialSettings,

      updateSetting: (key, value) =>
        set(state => ({
          ...state,
          [key]: value,
        })),

      reset: () => set(initialSettings),
    }),
    {
      name: "app-settings",
    }
  )
);

// Selectors
export const useHideSmallBalances = () =>
  useAppSettingsStore(state => state.hideSmallBalances);

export const useDisableBackgroundNotifications = () =>
  useAppSettingsStore(state => state.disableBackgroundNotifications);

export const useHidePnl = () => useAppSettingsStore(state => state.hidePnl);

export const useAnimateOrderbook = () =>
  useAppSettingsStore(state => state.animateOrderbook);
