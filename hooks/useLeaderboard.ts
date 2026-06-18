"use client";

import { useQuery } from "@tanstack/react-query";
import { dexBackendApi } from "@/services/api/dexBackendApi";
import { LeaderboardResponse } from "@/types/social";

export const useLeaderboard = (ready: boolean) => {
  return useQuery({
    queryKey: ["social", "leaderboard"],
    queryFn: async () => {
      const leaderboard = await dexBackendApi.getLeaderboard();
      return leaderboard as LeaderboardResponse;
    },
    staleTime: 60 * 1000, // 1 minute
    refetchOnWindowFocus: false,
    enabled: !!ready,
  });
};
