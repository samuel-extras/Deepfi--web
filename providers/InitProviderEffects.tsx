"use client";

import { useDailyActiveTracking } from "@/hooks/useDailyActiveTracking";
import { useUserProfileSync } from "@/hooks/useUserProfileSync";
import { useActivityConfigSync } from "@/hooks/useActivityConfigSync";
import { useOnboardingTrigger } from "@/hooks/useOnboardingTrigger";

/**
 * Global, route-independent boot effects. Auth is driven by the real Sui
 * wallet (see SuiAuthBridge); these hooks only wire user profile, points
 * config, activity tracking and the onboarding modal trigger.
 */
export default function InitProviderEffects() {
  useDailyActiveTracking();
  useUserProfileSync();
  useActivityConfigSync();
  useOnboardingTrigger();

  return null;
}
