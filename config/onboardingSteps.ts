import type {
  OnboardingStep,
  OnboardingContext,
} from "@/components/modals/ui/onboarding/types";
import ReferralCodeStep from "@/components/modals/ui/onboarding/steps/ReferralCodeStep";

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "referralCode",
    component: ReferralCodeStep,
    shouldShow: (context: OnboardingContext) => {
      // Show if user has not been referred and has no referral code in URL
      return !context.hasReferrerOrReferralCode;
    },
    canSkip: true,
    order: 2,
  },
];
