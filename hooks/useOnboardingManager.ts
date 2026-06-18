"use client";

import { useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import { useUserProfile } from "@/stores/useUserProfileStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { usePerpsBalance, useSpotBalances } from "@/stores/useBalanceStore";
import { ONBOARDING_STEPS } from "@/config/onboardingSteps";
import type { OnboardingContext } from "@/components/modals/ui/onboarding/types";

export function useOnboardingManager() {
  const searchParams = useSearchParams();
  const userProfile = useUserProfile();
  const { userInfo } = useAuthStore();
  const perpsBalance = usePerpsBalance();
  const spotBalances = useSpotBalances();

  const walletAddress = userInfo.walletAddress || "";

  const {
    completeStep,
    skipStep,
    skipAll,
    isStepCompleted,
    isStepSkipped,
    isOnboardingComplete,
  } = useOnboardingStore();

  // Build context for conditional checks
  const context: OnboardingContext = useMemo(() => {
    const walletAddress = userInfo.walletAddress || null;

    // Treat user as referred if backend already knows their referrer or a referral code is present in the URL
    const hasReferrerFromProfile = Boolean(userProfile?.user?.referredByUserId);
    const hasReferralCodeInUrl = Boolean(searchParams?.get("referralCode"));
    const hasReferrerOrReferralCode =
      hasReferrerFromProfile || hasReferralCodeInUrl;

    // Check balances
    const perpsBalanceNum = parseFloat(perpsBalance || "0");
    const hasPerpsBalance = perpsBalanceNum > 0;

    const hasSpotBalance = spotBalances.some(
      balance => parseFloat(balance.total || "0") > 0
    );

    return {
      userProfile,
      walletAddress,
      hasReferrerOrReferralCode,
      hasPerpsBalance,
      hasSpotBalance,
    };
  }, [
    userProfile,
    userInfo.walletAddress,
    perpsBalance,
    spotBalances,
    searchParams,
  ]);

  // Filter and sort steps based on conditionals and order
  const availableSteps = useMemo(() => {
    const filtered = ONBOARDING_STEPS.filter(step => step.shouldShow(context));

    // Sort by explicit order if provided, otherwise maintain array order
    return filtered.sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) {
        return a.order - b.order;
      }
      if (a.order !== undefined) return -1;
      if (b.order !== undefined) return 1;
      // Maintain original array order if no explicit order
      return 0;
    });
  }, [context]);

  // Get current step (first incomplete/non-skipped step)
  const currentStep = useMemo(() => {
    if (!walletAddress) return null;
    return (
      availableSteps.find(
        step =>
          !isStepCompleted(walletAddress, step.id) &&
          !isStepSkipped(walletAddress, step.id)
      ) || null
    );
  }, [availableSteps, walletAddress, isStepCompleted, isStepSkipped]);

  const currentStepIndex = useMemo(() => {
    if (!currentStep) return -1;
    return availableSteps.findIndex(step => step.id === currentStep.id);
  }, [currentStep, availableSteps]);

  const isComplete = useMemo(() => {
    if (!walletAddress) return true;
    return isOnboardingComplete(walletAddress) || availableSteps.length === 0;
  }, [walletAddress, isOnboardingComplete, availableSteps.length]);

  const nextStep = useCallback(() => {
    if (!currentStep || !walletAddress) return;
    completeStep(walletAddress, currentStep.id);
  }, [currentStep, walletAddress, completeStep]);

  const skipCurrentStep = useCallback(() => {
    if (!currentStep || !walletAddress) return;
    skipStep(walletAddress, currentStep.id);
  }, [currentStep, walletAddress, skipStep]);

  const handleSkipAll = useCallback(() => {
    if (!walletAddress) return;
    skipAll(walletAddress);
  }, [walletAddress, skipAll]);

  return {
    currentStep,
    availableSteps,
    currentStepIndex,
    totalSteps: availableSteps.length,
    isComplete,
    nextStep,
    skipCurrentStep,
    skipAll: handleSkipAll,
    context,
  };
}
