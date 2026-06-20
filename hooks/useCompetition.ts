"use client";

import { useActiveAccount } from "@/hooks/useActiveAccount";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import type { CompetitionDetailResponse } from "@/types/competition";

async function fetchCompetition(
  id: string,
  owner?: string,
): Promise<CompetitionDetailResponse | null> {
  const qs = owner ? `?owner=${owner}` : "";
  const res = await fetch(`/api/competition/${id}${qs}`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) return null;
  return (await res.json()) as CompetitionDetailResponse;
}

export const useCompetition = (id: string | undefined, ready: boolean = true) => {
  const owner = useActiveAccount()?.address;
  return useQuery({
    queryKey: ["competition", id, owner ?? null],
    queryFn: () => (id ? fetchCompetition(id, owner) : Promise.resolve(null)),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
    enabled: !!ready && !!id,
  });
};

/** Used by the detail page inside `<Suspense>`. */
export function useCompetitionSuspense(id: string) {
  const owner = useActiveAccount()?.address;
  return useSuspenseQuery({
    queryKey: ["competition", id, owner ?? null],
    queryFn: () => fetchCompetition(id, owner),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });
}
