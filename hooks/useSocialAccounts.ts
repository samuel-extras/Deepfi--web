"use client";

import { useQuery } from "@tanstack/react-query";
import { dexBackendApi } from "@/services/api/dexBackendApi";
import { SocialAccountsResponse } from "@/types/social";

export const useSocialAccounts = (ready: boolean) => {
  return useQuery({
    queryKey: ["social", "accounts"],
    queryFn: async () => {
      const accounts = await dexBackendApi.getSocialAccounts();
      return accounts as SocialAccountsResponse;
    },
    staleTime: 60 * 1000, // 1 minute
    refetchOnWindowFocus: false,
    enabled: !!ready,
  });
};
