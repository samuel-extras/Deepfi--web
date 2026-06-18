"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface FavoriteMarketsStore {
  /** Pool keys the user has starred (e.g. "SUI_DBUSDC"). Shared across spot + margin. */
  favorites: string[];
  toggleFavorite: (key: string) => void;
  isFavorite: (key: string) => boolean;
  clearFavorites: () => void;
}

export const useFavoriteMarketsStore = create<FavoriteMarketsStore>()(
  persist(
    (set, get) => ({
      favorites: [],

      toggleFavorite: key =>
        set(state => ({
          favorites: state.favorites.includes(key)
            ? state.favorites.filter(k => k !== key)
            : [...state.favorites, key],
        })),

      isFavorite: key => get().favorites.includes(key),

      clearFavorites: () => set({ favorites: [] }),
    }),
    {
      // localStorage key — survives reloads on the user's device
      name: "favorite-markets",
    }
  )
);

// Selectors
export const useFavoriteMarkets = () =>
  useFavoriteMarketsStore(state => state.favorites);

export const useToggleFavoriteMarket = () =>
  useFavoriteMarketsStore(state => state.toggleFavorite);
