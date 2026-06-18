import { useQuery } from "@tanstack/react-query";
import { CompetitionApiResponse, CompetitionsResponse } from "@/types/competition";

export const useLatestCompetition = (
  ready: boolean = true,
  initialData?: CompetitionApiResponse | null
) => {
  return useQuery({
    queryKey: ["competition", "latest"],
    queryFn: async () => {
      const res = await fetch("/api/competition", { headers: { accept: "application/json" } });
      if (!res.ok) return null;
      const list = (await res.json()) as CompetitionsResponse;
      return (list[0] ?? null) as CompetitionApiResponse | null;
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: previousData => previousData,
    initialData,
    enabled: !!ready,
  });
};
