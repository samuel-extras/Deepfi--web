"use client";

import { useState, useEffect, useCallback } from "react";
import { dexBackendApi } from "@/services/api/dexBackendApi";
import { useActivityConfigStore } from "@/stores/useActivityConfigStore";

export const useActivityConfigSync = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setConfig } = useActivityConfigStore();

  const fetchConfig = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const config = await dexBackendApi.getActivityConfig();
      setConfig(config);
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to fetch activity config";
      console.error("Error fetching activity config:", err);
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [setConfig]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  return { isLoading, error, refetch: fetchConfig };
};
