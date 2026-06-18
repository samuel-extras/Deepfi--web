"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCompetitionSuspense } from "@/hooks/useCompetition";
import {
  transformCompetitionDetail,
  transformParticipantsToLeaderboard,
} from "@/lib/competition/transformDetail";
import { Button } from "@/components/ui/button";
import { TableFallback } from "@/components/ui/RouteStreamingFallbacks";
import CompetitionDetailBackNav from "./CompetitionDetailBackNav";
import CompetitionDetailHero from "./CompetitionDetailHero";
import { CompetitionStats } from "./CompetitionStats";

const CompetitionDetailResults = dynamic(
  () => import("./CompetitionDetailResults"),
  { loading: () => <TableFallback rows={8} className="mt-2" /> }
);

export default function CompetitionDetailLoaded({
  competitionId,
}: {
  competitionId: string;
}) {
  const router = useRouter();
  const { data } = useCompetitionSuspense(competitionId);

  const competition = useMemo(
    () => (data ? transformCompetitionDetail(data) : null),
    [data]
  );

  const leaderboardData = useMemo(
    () =>
      data?.participants
        ? transformParticipantsToLeaderboard(data.participants)
        : [],
    [data]
  );

  if (!data || !competition) {
    return (
      <div className="text-center">
        <h1 className="text-xl text-white font-semibold mb-4">
          Competition Not Found
        </h1>
        <Button
          onClick={() => router.push("/competition")}
          className="w-fit rounded-full border border-border bg-transparent lg:hover:bg-white/5 text-white font-semibold text-xs"
        >
          Back to Competitions
        </Button>
      </div>
    );
  }

  return (
    <>
      <CompetitionDetailBackNav />
      <CompetitionDetailHero competition={competition} />
      <CompetitionStats competition={competition} />
      <CompetitionDetailResults
        leaderboardData={leaderboardData}
        competition={competition}
      />
    </>
  );
}
