"use client";

import { useState, useEffect, useCallback } from "react";
import { dexBackendApi } from "@/services/api/dexBackendApi";
import { useReferralTreeStore } from "@/stores/useReferralTreeStore";
import { useAuthStore } from "@/stores/useAuthStore";

export const useReferralTreeSync = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated, jwtToken } = useAuthStore();
  const { setReferrals, reset } = useReferralTreeStore();

  const fetchReferrals = useCallback(async () => {
    if (!isAuthenticated || !jwtToken) {
      reset();
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const referrals = await dexBackendApi.getReferralTree();
      setReferrals(referrals);
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to fetch referrals";
      console.error("Error fetching referral tree:", err);
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, jwtToken, setReferrals, reset]);

  useEffect(() => {
    fetchReferrals();
  }, [fetchReferrals]);

  return { isLoading, error, refetch: fetchReferrals };
};
