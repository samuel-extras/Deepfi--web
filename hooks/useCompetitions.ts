"use client";

import { useQuery } from "@tanstack/react-query";
import { CompetitionsResponse } from "@/types/competition";

interface UseCompetitionsParams {
  status?: string;
  search?: string;
}

async function fetchCompetitions(): Promise<CompetitionsResponse> {
  const res = await fetch("/api/competition", { headers: { accept: "application/json" } });
  if (!res.ok) return [];
  return (await res.json()) as CompetitionsResponse;
}

export const useCompetitions = (
  params?: UseCompetitionsParams,
  ready: boolean = true,
  initialData?: CompetitionsResponse
) => {
  return useQuery({
    queryKey: ["competitions", params?.status, params?.search],
    queryFn: fetchCompetitions,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: previousData => previousData,
    initialData,
    enabled: !!ready,
  });
};
