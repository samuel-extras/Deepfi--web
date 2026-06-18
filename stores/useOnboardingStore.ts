"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type StepStatus = "completed" | "skipped" | null;
export type StepId = "welcome" | "referralCode" | "depositPrompt";

interface WalletOnboardingData {
  steps: Record<StepId, StepStatus>;
  completedAt: number | null;
  shownAt: number | null;
}

interface OnboardingState {
  onboarding: Record<string, WalletOnboardingData>;
}

interface OnboardingActions {
  completeStep: (walletAddress: string, stepId: StepId) => void;
  skipStep: (walletAddress: string, stepId: StepId) => void;
  skipAll: (walletAddress: string) => void;
  reset: (walletAddress: string) => void;
  isStepCompleted: (walletAddress: string, stepId: StepId) => boolean;
  isStepSkipped: (walletAddress: string, stepId: StepId) => boolean;
  isOnboardingComplete: (walletAddress: string) => boolean;
  markAsShown: (walletAddress: string) => void;
  hasBeenShown: (walletAddress: string) => boolean;
}

const getInitialWalletData = (): WalletOnboardingData => ({
  steps: {
    welcome: null,
    referralCode: null,
    depositPrompt: null,
  },
  completedAt: null,
  shownAt: null,
});

const initialState: OnboardingState = {
  onboarding: {},
};

export const useOnboardingStore = create<OnboardingState & OnboardingActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      completeStep: (walletAddress: string, stepId: StepId) => {
        set(state => {
          const walletData =
            state.onboarding[walletAddress] || getInitialWalletData();
          const newSteps = {
            ...walletData.steps,
            [stepId]: "completed" as StepStatus,
          };
          const allCompleted = Object.values(newSteps).every(
            status => status === "completed" || status === "skipped"
          );
          return {
            onboarding: {
              ...state.onboarding,
              [walletAddress]: {
                ...walletData,
                steps: newSteps,
                completedAt: allCompleted ? Date.now() : walletData.completedAt,
              },
            },
          };
        });
      },

      skipStep: (walletAddress: string, stepId: StepId) => {
        set(state => {
          const walletData =
            state.onboarding[walletAddress] || getInitialWalletData();
          const newSteps = {
            ...walletData.steps,
            [stepId]: "skipped" as StepStatus,
          };
          const allCompleted = Object.values(newSteps).every(
            status => status === "completed" || status === "skipped"
          );
          return {
            onboarding: {
              ...state.onboarding,
              [walletAddress]: {
                ...walletData,
                steps: newSteps,
                completedAt: allCompleted ? Date.now() : walletData.completedAt,
              },
            },
          };
        });
      },

      skipAll: (walletAddress: string) => {
        set(state => ({
          onboarding: {
            ...state.onboarding,
            [walletAddress]: {
              steps: {
                welcome: "skipped",
                referralCode: "skipped",
                depositPrompt: "skipped",
              },
              completedAt: Date.now(),
              shownAt: state.onboarding[walletAddress]?.shownAt || null,
            },
          },
        }));
      },

      reset: (walletAddress: string) => {
        set(state => {
          const newOnboarding = { ...state.onboarding };
          delete newOnboarding[walletAddress];
          return {
            onboarding: newOnboarding,
          };
        });
      },

      isStepCompleted: (walletAddress: string, stepId: StepId) => {
        const state = get();
        const walletData = state.onboarding[walletAddress];
        return walletData?.steps[stepId] === "completed";
      },

      isStepSkipped: (walletAddress: string, stepId: StepId) => {
        const state = get();
        const walletData = state.onboarding[walletAddress];
        return walletData?.steps[stepId] === "skipped";
      },

      isOnboardingComplete: (walletAddress: string) => {
        const state = get();
        const walletData = state.onboarding[walletAddress];
        if (!walletData) return false;
        if (
          walletData.completedAt !== null &&
          walletData.completedAt !== undefined
        ) {
          return true;
        }
        return Object.values(walletData.steps).every(
          status => status === "completed" || status === "skipped"
        );
      },

      markAsShown: (walletAddress: string) => {
        set(state => {
          const walletData =
            state.onboarding[walletAddress] || getInitialWalletData();
          return {
            onboarding: {
              ...state.onboarding,
              [walletAddress]: {
                ...walletData,
                shownAt: Date.now(),
              },
            },
          };
        });
      },

      hasBeenShown: (walletAddress: string) => {
        const state = get();
        const walletData = state.onboarding[walletAddress];
        return (
          walletData?.shownAt !== null && walletData?.shownAt !== undefined
        );
      },
    }),
    {
      name: "dex:onboarding",
      partialize: state => ({
        onboarding: state.onboarding,
      }),
    }
  )
);
