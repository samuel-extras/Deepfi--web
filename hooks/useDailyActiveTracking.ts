import { useEffect, useRef } from "react";
import { dexBackendApi } from "@/services/api/dexBackendApi";
import { EventType } from "@/services/api/types";
import { useAuthStore } from "@/stores/useAuthStore";

/**
 * Tracks daily active event when user is authenticated.
 * Identity comes from the Sui auth store (zkLogin / connected wallet).
 */
export function useDailyActiveTracking() {
  const { isAuthenticated, userInfo, jwtToken } = useAuthStore();
  const walletAddress = userInfo?.walletAddress || "";
  const trackedTodayRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !walletAddress || !jwtToken) {
      trackedTodayRef.current = null;
      return;
    }

    const date = new Date().toISOString()?.split("T")?.[0];
    const clientEventId = `${walletAddress}-${date}`;

    // Skip if already tracked today
    if (trackedTodayRef.current === clientEventId) {
      return;
    }

    const eventData: Record<string, unknown> = {
      walletAddress,
      timestamp: new Date().toISOString(),
    };

    if (userInfo?.email) eventData.email = userInfo.email;
    if (typeof navigator !== "undefined" && navigator.userAgent) {
      eventData.userAgent = navigator.userAgent;
    }

    dexBackendApi.trackActivity({
      eventType: EventType.DAILY_ACTIVE,
      eventData,
      clientEventId,
    });

    trackedTodayRef.current = clientEventId;
  }, [isAuthenticated, walletAddress, userInfo, jwtToken]);
}
