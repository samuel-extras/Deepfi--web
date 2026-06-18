"use client";
import dynamic from "next/dynamic";
import { TableFallback } from "@/components/ui/RouteStreamingFallbacks";
import { LiveCompetitionBanner } from "@/components/competition/LiveCompetitionBanner";

const CompetitionList = dynamic(
  () => import("@/components/competition/CompetitionList"),
  { loading: () => <TableFallback rows={6} className="mt-10" /> }
);

export default function CompetitionPage() {
  return (
    <div className="px-4 py-6 w-full lg:max-w-[87.5%] mx-auto text-sm text-white/80 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl text-white font-semibold mb-1">Competition</h1>
          <p className="text-xs text-nav-inactive font-normal">
            Compete with other users to win prizes.
          </p>
        </div>
      </div>

      <div className="mt-5 lg:mt-10">
        <LiveCompetitionBanner />
        <CompetitionList />
      </div>
    </div>
  );
}
