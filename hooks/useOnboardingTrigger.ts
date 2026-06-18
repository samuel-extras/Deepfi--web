"use client";

import { useEffect, useRef } from "react";
import { useAuthStore } from "@/stores/useAuthStore";
import { useUserProfile } from "@/stores/useUserProfileStore";
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import { useModalStore } from "@/components/modals/model/useModalStore";

export function useOnboardingTrigger() {
  const { isAuthenticated, jwtToken } = useAuthStore();
  const walletAddressFromStore = useAuthStore(
    state => state.userInfo.walletAddress
  );
  const userProfile = useUserProfile();
  const { isOnboardingComplete, hasBeenShown, markAsShown } =
    useOnboardingStore();
  const { openModal, activeModal } = useModalStore();
  const hasTriggeredRef = useRef(false);

  const walletAddress = walletAddressFromStore || null;
  const authReady =
    isAuthenticated && !!jwtToken && !!userProfile && !!walletAddress;

  useEffect(() => {
    if (hasTriggeredRef.current) return;
    if (activeModal) return;
    if (!authReady) return;

    if (isOnboardingComplete(walletAddress)) {
      hasTriggeredRef.current = true;
      return;
    }

    if (hasBeenShown(walletAddress)) {
      hasTriggeredRef.current = true;
      return;
    }

    hasTriggeredRef.current = true;
    markAsShown(walletAddress);
    setTimeout(() => {
      openModal("onboarding", {});
    }, 500);
  }, [
    isAuthenticated,
    jwtToken,
    authReady,
    walletAddress,
    isOnboardingComplete,
    hasBeenShown,
    markAsShown,
    openModal,
    activeModal,
  ]);
}
