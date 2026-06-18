"use client";

import { useState, useCallback } from "react";
import { dexBackendApi } from "@/services/api/dexBackendApi";
import type { RequestPayoutParams } from "@/types";

export const useRequestPayout = () => {
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestPayout = useCallback(async (params: RequestPayoutParams) => {
    setIsRequesting(true);
    setError(null);

    try {
      const success = await dexBackendApi.requestPayout(params);
      return success;
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to request payout";
      console.error("Error requesting payout:", err);
      setError(errorMsg);
      return false;
    } finally {
      setIsRequesting(false);
    }
  }, []);

  return { requestPayout, isRequesting, error };
};
