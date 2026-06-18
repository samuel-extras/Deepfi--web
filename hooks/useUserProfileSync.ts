"use client";

import { useState, useEffect, useCallback } from "react";
import { dexBackendApi } from "@/services/api/dexBackendApi";
import { useUserProfileStore } from "@/stores/useUserProfileStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { eventBus, EventType } from "@/lib/events/eventBus";

export const useUserProfileSync = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated, jwtToken } = useAuthStore();
  const { setProfile } = useUserProfileStore();

  const fetchProfile = useCallback(async () => {
    if (!isAuthenticated || !jwtToken) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const profile = await dexBackendApi.getUserProfile();
      setProfile(profile);
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to fetch profile";
      console.error("Error fetching user profile:", err);
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, jwtToken, setProfile]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    const unsubscribe = eventBus.on(EventType.PROFILE_UPDATED, fetchProfile);
    return unsubscribe;
  }, [fetchProfile]);

  return { isLoading, error, refetch: fetchProfile };
};
