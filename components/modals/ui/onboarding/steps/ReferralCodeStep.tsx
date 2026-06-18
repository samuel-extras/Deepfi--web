"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSearchParams } from "next/navigation";
import { useAuthStore } from "@/stores/useAuthStore";
import type { OnboardingStepProps } from "@/components/modals/ui/onboarding/types";
import { dexBackendApi } from "@/services/api/dexBackendApi";
import { toast } from "sonner";
import { useReferredByUserId } from "@/stores/useUserProfileStore";
import { eventBus, EventType as EventBusType } from "@/lib/events/eventBus";

export default function ReferralCodeStep({
  onNext,
  onSkip,
}: OnboardingStepProps) {
  const [referralCode, setReferralCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const { jwtToken } = useAuthStore();
  const referredByUserId = useReferredByUserId();
  const hasReferrer = Boolean(referredByUserId);
  // Check if referral code already in URL
  const existingReferralCode = searchParams?.get("referralCode");

  useEffect(() => {
    if (existingReferralCode) {
      setReferralCode(existingReferralCode.toUpperCase());
    }
  }, [existingReferralCode]);

  useEffect(() => {
    if (hasReferrer) {
      onNext();
    }
  }, [hasReferrer, onNext]);

  const handleSubmit = async () => {
    if (!referralCode.trim()) {
      setError("Please enter a referral code");
      return;
    }

    if (!jwtToken) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const payload = {
      referralCode: referralCode.trim().toUpperCase(),
    };

    const baseUrl = process.env.NEXT_PUBLIC_DEX_API_BASE_URL;
    const beaconUrl = baseUrl ? `${baseUrl}/api/users/me/referrer` : null;

    // Prefer a fire-and-forget beacon to survive tab closes; fallback awaits API.
    if (typeof navigator !== "undefined" && navigator.sendBeacon && beaconUrl) {
      try {
        const sent = navigator.sendBeacon(
          beaconUrl,
          new Blob([JSON.stringify(payload)], { type: "application/json" })
        );

        eventBus.emit(EventBusType.PROFILE_UPDATED);

        if (sent) {
          onNext();
          setIsSubmitting(false);
          return;
        }
      } catch (err) {
        console.error("Failed to send referral via beacon, falling back:", err);
      }
    }

    try {
      const response = await dexBackendApi.setReferrer(payload);

      if (!response) {
        throw new Error("Unable to set referrer. Please try again.");
      }

      toast.success("Referrer set successfully");
      onNext();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to apply referral code"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (hasReferrer || !jwtToken) {
    return null;
  }

  return (
    <div className="w-full h-full lg:w-[400px] space-y-8">
      <h1 className="font-normal text-2xl text-white text-center">
        Who referred you <br /> to DEX?
      </h1>

      <div className="flex gap-2 items-center">
        <div className="relative flex-1 bg-[#121417] w-full border border-border rounded-full overflow-hidden h-10">
          <Input
            placeholder="Referral code..."
            value={referralCode}
            onChange={e => {
              setReferralCode(e.target.value.toUpperCase());
              setError(null);
            }}
            disabled={isSubmitting}
            autoFocus
            className="pl-4 pr-2 text-xs text-white border-none outline-none h-full placeholder:text-nav-inactive bg-transparent"
          />
        </div>

        <Button
          size="lg"
          className="font-semibold text-xs text-[#1F1F1F] rounded-[25px] transition-all duration-200 w-fit"
          onClick={handleSubmit}
          disabled={isSubmitting || !referralCode.trim()}
          type="button"
        >
          Proceed
        </Button>
      </div>

      {error && (
        <p className="text-xs text-red-400 mt-1 text-center">{error}</p>
      )}

      <button
        type="button"
        aria-label="skip button"
        className="mx-auto block text-center font-semibold cursor-pointer text-xs text-white bg-transparent hover:text-white/80 transition-all duration-200"
        onClick={onSkip}
      >
        I’ll do this later
      </button>
    </div>
  );
}
