"use client";

import { create } from "zustand";
import type { UserProfileResponse } from "@/types";

interface UserProfileState {
  profile: UserProfileResponse | null;
  lastFetched: number | null;
}

interface UserProfileActions {
  setProfile: (profile: UserProfileResponse | null) => void;
  updateReferredByUserId: (referredByUserId: string | null) => void;
  reset: () => void;
}

const initialState: UserProfileState = {
  profile: null,
  lastFetched: null,
};

export const useUserProfileStore = create<
  UserProfileState & UserProfileActions
>()(set => ({
  ...initialState,
  setProfile: profile => set({ profile, lastFetched: Date.now() }),
  updateReferredByUserId: referredByUserId =>
    set(state => {
      if (!state.profile) {
        return state;
      }

      return {
        profile: {
          ...state.profile,
          user: {
            ...state.profile.user,
            referredByUserId,
          },
        },
        lastFetched: Date.now(),
      };
    }),
  reset: () => set(initialState),
}));

// Selectors - these return null when profile not loaded, which is stable
export const useUserProfile = () => useUserProfileStore(s => s.profile);
export const useUserPoints = () =>
  useUserProfileStore(s => s.profile?.points || null);
export const useUserStreak = () =>
  useUserProfileStore(s => s.profile?.streak || null);
export const useReferralStats = () =>
  useUserProfileStore(s => s.profile?.referrals || null);
export const usePayoutStats = () =>
  useUserProfileStore(s => s.profile?.payouts || null);
export const useReferralCode = () =>
  useUserProfileStore(s => s.profile?.user.referralCode || null);
export const useReferredByUserId = () =>
  useUserProfileStore(s => s.profile?.user.referredByUserId ?? null);
