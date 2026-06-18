"use client";

import { useState } from "react";
import { LeaderboardTable } from "./LeaderboardTable";
import { PrizeBreakdown } from "./PrizeBreakdown";
import { CompetitionRules } from "./CompetitionRules";
import { TabButton } from "./TabButton";
import type { Competition, LeaderboardEntry } from "./constants";

interface CompetitionDetailResultsProps {
  leaderboardData: LeaderboardEntry[];
  competition: Competition;
}

export default function CompetitionDetailResults({
  leaderboardData,
  competition,
}: CompetitionDetailResultsProps) {
  return (
    <>
      <CompetitionDetailResultsMobile
        leaderboardData={leaderboardData}
        competition={competition}
      />
      <CompetitionDetailResultsDesktop
        leaderboardData={leaderboardData}
        competition={competition}
      />
    </>
  );
}

function CompetitionDetailResultsMobile({
  leaderboardData,
  competition,
}: CompetitionDetailResultsProps) {
  const [activeTab, setActiveTab] = useState<"breakdown" | "rules" | "results">(
    "results"
  );

  return (
    <div className="lg:hidden grid grid-cols-1 gap-6">
      <div>
        <div className="flex gap-2 mb-6">
          <TabButton
            active={activeTab === "results"}
            onClick={() => setActiveTab("results")}
          >
            Results
          </TabButton>
          <TabButton
            active={activeTab === "breakdown"}
            onClick={() => setActiveTab("breakdown")}
          >
            Prize Breakdown
          </TabButton>
          <TabButton
            active={activeTab === "rules"}
            onClick={() => setActiveTab("rules")}
          >
            Rules
          </TabButton>
        </div>

        {activeTab === "results" && <LeaderboardTable data={leaderboardData} />}

        {activeTab === "breakdown" && (
          <PrizeBreakdown prizes={competition.prizes || []} />
        )}

        {activeTab === "rules" && (
          <CompetitionRules
            description={competition.description}
            rules={competition.rules || []}
          />
        )}
      </div>
    </div>
  );
}

function CompetitionDetailResultsDesktop({
  leaderboardData,
  competition,
}: CompetitionDetailResultsProps) {
  const [activeTab, setActiveTab] = useState<"breakdown" | "rules">(
    "breakdown"
  );

  return (
    <div className="hidden lg:block">
      <h2 className="text-xl font-semibold text-white mb-6">Results</h2>
      <div className="grid grid-cols-[1fr_400px] gap-6">
        <LeaderboardTable data={leaderboardData} />

        <div>
          <div className="flex gap-2 mb-6">
            <TabButton
              active={activeTab === "breakdown"}
              onClick={() => setActiveTab("breakdown")}
            >
              Prize Breakdown
            </TabButton>
            <TabButton
              active={activeTab === "rules"}
              onClick={() => setActiveTab("rules")}
            >
              Rules
            </TabButton>
          </div>

          {activeTab === "breakdown" && (
            <PrizeBreakdown prizes={competition.prizes || []} />
          )}

          {activeTab === "rules" && (
            <CompetitionRules
              description={competition.description}
              rules={competition.rules || []}
            />
          )}
        </div>
      </div>
    </div>
  );
}
