"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { dexBackendApi } from "@/services/api/dexBackendApi";

export const useFollowUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (username: string) => {
      return await dexBackendApi.followUser(username);
    },
    onSuccess: () => {
      // Invalidate and refetch social accounts after successful follow
      queryClient.invalidateQueries({ queryKey: ["social", "accounts"] });
      // Also invalidate following accounts to update the following list
      queryClient.invalidateQueries({
        queryKey: ["social", "accounts", "following"],
      });
    },
  });
};
