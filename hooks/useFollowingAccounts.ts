"use client";

import { useQuery } from "@tanstack/react-query";
import { dexBackendApi } from "@/services/api/dexBackendApi";
import { SocialAccountsResponse } from "@/types/social";

export const useFollowingAccounts = (ready: boolean) => {
  return useQuery({
    queryKey: ["social", "accounts", "following"],
    queryFn: async () => {
      const accounts = await dexBackendApi.getSocialAccounts({
        following: true,
      });
      return accounts as SocialAccountsResponse;
    },
    staleTime: 60 * 1000, // 1 minute
    refetchOnWindowFocus: false,
    enabled: !!ready,
  });
};
