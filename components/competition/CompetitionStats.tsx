import { ChartSpline, Clock, Trophy } from "lucide-react";
import { PeopleIcon } from "@/components/icons";
import type { Competition } from "./constants";

interface CompetitionStatsProps {
  competition: Competition;
}

export const CompetitionStats = ({ competition }: CompetitionStatsProps) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full lg:w-10/12 mb-8">
      <div className="border border-border rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Trophy className="w-4 h-4 text-nav-inactive" />
          <p className="text-xs text-nav-inactive font-normal">Prize</p>
        </div>
        <p className="text-primary font-semibold text-xl">
          {competition.prizePool}
        </p>
      </div>

      <div className="border border-border rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <PeopleIcon className="w-4 h-4 text-nav-inactive" />
          <p className="text-xs text-nav-inactive font-normal">Participants</p>
        </div>
        <p className="text-white font-semibold text-xl">
          {competition.participants}
        </p>
      </div>

      <div className="border border-border rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-4 h-4 text-nav-inactive" />
          <p className="text-xs text-nav-inactive font-normal">
            {competition.status === "ended" ? "Ended" : "Ends"}
          </p>
        </div>
        <p className="text-white font-semibold text-xl">
          {competition.status === "ended" ? "-" : competition.timeInfo}
        </p>
        {competition.status === "ended" ? (
          <span className=" text-xs text-nav-inactive mt-1">-</span>
        ) : (
          <p className="text-xs text-nav-inactive mt-1">
            {competition.endDate}
          </p>
        )}
      </div>

      <div className="border border-border rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <ChartSpline className="w-4 h-4 text-nav-inactive" />
          <p className="text-xs text-nav-inactive font-normal">Rank</p>
        </div>
        <p className="text-white font-semibold text-xl">
          {competition.userRank ? competition.userRank : "-"}
        </p>
        <p className="text-xs text-nav-inactive mt-1">
          Out of {competition.participants.toLocaleString()}
        </p>
      </div>
    </div>
  );
};
