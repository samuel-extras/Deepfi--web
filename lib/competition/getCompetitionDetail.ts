import { cache } from "react";
import { buildCompetitionMeta, SEASON_ID } from "@/lib/competition/season";
import type { CompetitionDetailResponse } from "@/types/competition";

/**
 * Lightweight season meta for RSC metadata generation (title/description only).
 * The live participant board is fetched client-side via /api/competition/:id.
 */
export const getCompetitionDetailCached = cache(
  async (id: string): Promise<CompetitionDetailResponse | null> => {
    if (id !== SEASON_ID) return null;
    return buildCompetitionMeta();
  }
);
