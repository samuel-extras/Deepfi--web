"use client";

import { useState, useEffect, useCallback } from "react";
import { dexBackendApi } from "@/services/api/dexBackendApi";
import { usePayoutStore } from "@/stores/usePayoutStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { eventBus, EventType } from "@/lib/events/eventBus";
import type { PayoutFilters } from "@/types";

export const usePayoutsSync = (filters?: PayoutFilters) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated, jwtToken } = useAuthStore();
  const { setPayouts, reset } = usePayoutStore();

  const fetchPayouts = useCallback(async () => {
    if (!isAuthenticated || !jwtToken) {
      reset();
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const payouts = await dexBackendApi.getPayouts(filters);
      setPayouts(payouts);
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to fetch payouts";
      console.error("Error fetching payouts:", err);
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, jwtToken, filters, setPayouts, reset]);

  useEffect(() => {
    fetchPayouts();
  }, [fetchPayouts]);

  // Refetch when payout is completed
  useEffect(() => {
    const unsubscribe = eventBus.on(EventType.PAYOUT_COMPLETED, fetchPayouts);
    return unsubscribe;
  }, [fetchPayouts]);

  return { isLoading, error, refetch: fetchPayouts };
};
