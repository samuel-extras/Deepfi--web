import type { UserProfileResponse } from "@/types";
import type { StepId } from "@/stores/useOnboardingStore";

export interface OnboardingContext {
  userProfile: UserProfileResponse | null;
  walletAddress: string | null;
  hasReferrerOrReferralCode: boolean; // referred already or referral code present
  hasPerpsBalance: boolean; // perps balance > 0
  hasSpotBalance: boolean; // spot balance > 0
}

export interface OnboardingStep {
  id: StepId;
  component: React.ComponentType<OnboardingStepProps>;
  shouldShow: (context: OnboardingContext) => boolean;
  canSkip?: boolean;
  order?: number; // Optional explicit order (defaults to array index if not provided)
}

export interface OnboardingStepProps {
  onNext: () => void;
  onSkip: () => void;
  onSkipAll: () => void;
}
