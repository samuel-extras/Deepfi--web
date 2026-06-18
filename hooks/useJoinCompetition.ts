"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { JoinCompetitionResponse } from "@/types/competition";
import { toast } from "sonner";

/**
 * The season is derived live from the on-chain indexer — there's no off-chain
 * registration. You're entered the moment you place a Predict trade, so "join"
 * just confirms that and refreshes the board.
 */
export const useJoinCompetition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (competitionId: string): Promise<JoinCompetitionResponse> => ({
      id: competitionId,
      competitionId,
      userId: "",
      walletAddress: "",
      createdAt: new Date().toISOString(),
    }),
    onSuccess: (data: JoinCompetitionResponse) => {
      queryClient.invalidateQueries({ queryKey: ["competitions"] });
      queryClient.invalidateQueries({ queryKey: ["competition", "latest"] });
      queryClient.invalidateQueries({ queryKey: ["competition", data.competitionId] });
      toast.success("You're entered — every Predict trade counts toward your rank.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to join competition");
    },
  });
};
