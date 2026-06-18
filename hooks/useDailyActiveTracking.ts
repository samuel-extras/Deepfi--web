import { useEffect, useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { dexBackendApi } from "@/services/api/dexBackendApi";
import { EventType } from "@/services/api/types";
import { useAuthStore } from "@/stores/useAuthStore";

/**
 * Tracks daily active event when user is authenticated
 */
export function useDailyActiveTracking() {
  const { user, authenticated } = usePrivy();
  const { jwtToken } = useAuthStore();
  const walletAddress = user?.wallet?.address || "";
  const trackedTodayRef = useRef<string | null>(null);

  useEffect(() => {
    if (!authenticated || !user?.id || !jwtToken) {
      trackedTodayRef.current = null;
      return;
    }

    const date = new Date().toISOString()?.split("T")?.[0];
    const clientEventId = `${user.id}-${date}`;

    // Skip if already tracked today
    if (trackedTodayRef.current === clientEventId) {
      return;
    }

    const eventData: Record<string, unknown> = {
      walletAddress: user.wallet?.address || walletAddress,
      privyId: user.id,
      timestamp: new Date().toISOString(),
    };

    if (user.email?.address) eventData.email = user.email.address;
    if (typeof navigator !== "undefined" && navigator.userAgent) {
      eventData.userAgent = navigator.userAgent;
    }

    dexBackendApi.trackActivity({
      eventType: EventType.DAILY_ACTIVE,
      eventData,
      clientEventId,
    });

    trackedTodayRef.current = clientEventId;
  }, [authenticated, user, walletAddress, jwtToken]);
}
