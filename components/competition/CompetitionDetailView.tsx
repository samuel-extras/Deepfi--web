"use client";

import { Suspense } from "react";
import { CompetitionDetailPageSkeleton } from "@/components/ui/RouteStreamingFallbacks";
import CompetitionDetailLoaded from "./CompetitionDetailLoaded";

export default function CompetitionDetailView({
  competitionId,
}: {
  competitionId: string;
}) {
  return (
    <div className="px-4 py-6 w-full lg:max-w-[87.5%] mx-auto text-sm text-white/80">
      <Suspense fallback={<CompetitionDetailPageSkeleton />}>
        <CompetitionDetailLoaded competitionId={competitionId} />
      </Suspense>
    </div>
  );
}
