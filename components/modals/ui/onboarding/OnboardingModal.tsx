"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/useAuthStore";
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import { useOnboardingManager } from "@/hooks/useOnboardingManager";
import { useModalControls } from "@/components/modals/hooks/useModalControls";
import type { ModalRenderProps } from "@/components/modals/model/types";

type Props = ModalRenderProps<"onboarding">;

export default function OnboardingModal({ onClose }: Props) {
  const { userInfo } = useAuthStore();
  const { markAsShown } = useOnboardingStore();
  const { currentStep, isComplete, nextStep, skipCurrentStep, skipAll } =
    useOnboardingManager();

  useEffect(() => {
    if (userInfo.walletAddress) {
      markAsShown(userInfo.walletAddress);
    }
  }, [userInfo.walletAddress, markAsShown]);

  // Prevent closing via backdrop, but allow close button (which will skip all)
  useModalControls(
    {
      closeOnBackdropClick: false,
      showCloseButton: true,
      beforeClose: () => {
        // When close button is clicked, skip all steps
        skipAll();
        return true; // Allow the close to proceed
      },
    },
    [skipAll]
  );

  // Close modal if onboarding is complete
  useEffect(() => {
    if (isComplete || !currentStep) {
      onClose();
    }
  }, [isComplete, currentStep, onClose]);

  if (isComplete || !currentStep) {
    return null;
  }

  const StepComponent = currentStep.component;

  const handleNext = () => {
    nextStep();
  };

  const handleSkip = () => {
    skipCurrentStep();
  };

  const handleSkipAll = () => {
    skipAll();
    onClose();
  };

  return (
    <div
      className="w-full h-full"
      // style={{
      //   backgroundColor: "#1A1D1F",
      //   backgroundImage:
      //     "linear-gradient(2.98deg, rgba(0, 0, 0, 0) 75.18%, rgba(2, 218, 139, 0.2) 107.85%)",
      // }}
    >
      <StepComponent
        onNext={handleNext}
        onSkip={handleSkip}
        onSkipAll={handleSkipAll}
      />
    </div>
  );
}
