"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PeopleIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_CONFIG, type Competition } from "./";
import { useCompetitions } from "@/hooks/useCompetitions";
import { useJoinCompetition } from "@/hooks/useJoinCompetition";
import type {
  CompetitionApiResponse,
  CompetitionsResponse,
} from "@/types/competition";
import { debounce } from "lodash";

const filters = ["All", "Upcoming", "Live", "Ended"] as const;
type FilterType = (typeof filters)[number];

// Utility function to calculate time remaining
const calculateTimeRemaining = (targetDate: string): string => {
  const now = new Date();
  const target = new Date(targetDate);
  const diff = target.getTime() - now.getTime();

  if (diff <= 0) return "";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}mins`);

  return parts.join(" ") || "0mins";
};

// Utility function to determine competition status
const getCompetitionStatus = (
  status: string,
  startDate: string,
  endDate: string
): "live" | "upcoming" | "ended" => {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (now < start) return "upcoming";
  if (now > end) return "ended";
  return "live";
};

// Transform API response to Competition type
const transformCompetition = (
  apiCompetition: CompetitionApiResponse
): Competition => {
  const status = getCompetitionStatus(
    apiCompetition.status,
    apiCompetition.startDate,
    apiCompetition.endDate
  );

  const targetDate =
    status === "upcoming" ? apiCompetition.startDate : apiCompetition.endDate;
  const timeInfo = status !== "ended" ? calculateTimeRemaining(targetDate) : "";

  return {
    id: apiCompetition.id,
    title: apiCompetition.name,
    prizePool: apiCompetition.prizePool ?? "",

    status,
    timeInfo,
    participants: apiCompetition._count.participants,
    description: apiCompetition.description,
    startDate: new Date(apiCompetition.startDate).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    endDate: new Date(apiCompetition.endDate).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    isParticipating: apiCompetition.isParticipating,
  };
};

interface CompetitionListProps {
  initialData?: CompetitionsResponse;
}

const CompetitionList = ({ initialData }: CompetitionListProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("All");

  // Debounce search query to avoid too many API calls
  useEffect(() => {
    const debounced = debounce((value: string) => {
      setDebouncedSearchQuery(value);
    }, 500);

    debounced(searchQuery);

    return () => {
      debounced.cancel();
    };
  }, [searchQuery]);

  // Map filter to API status format (capitalize first letter)
  const apiStatus = activeFilter !== "All" ? activeFilter : undefined;

  const { data, isLoading, error } = useCompetitions(
    {
      status: apiStatus,
      search: debouncedSearchQuery.trim() || undefined,
    },
    true,
    initialData
  );

  const competitions = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    return data.map(transformCompetition);
  }, [data]);

  return (
    <div className="mt-10 lg:mt-20">
      <div className="flex flex-col lg:flex-row justify-center items-center gap-3">
        <div className="flex flex-wrap justify-center items-center gap-2">
          {filters.map(filter => (
            <Button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              variant="ghost"
              className={cn(
                "rounded-full border text-xs font-semibold px-3 py-1.5 h-8 transition-colors",
                activeFilter === filter
                  ? "bg-white text-black border-white"
                  : "bg-[#1A1D1F] text-[#838384] border-[#2D3134]"
              )}
            >
              {filter}
            </Button>
          ))}
        </div>

        <div className="relative bg-transparent w-64 border border-border rounded-full overflow-hidden h-10 lg:ml-4">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10 placeholder:text-[#A9A9A9] text-white bg-transparent border-none outline-none h-full"
          />
        </div>
      </div>

      {isLoading && competitions.length === 0 && (
        <div className="text-center py-12 text-nav-inactive">
          Loading competitions...
        </div>
      )}

      {error && competitions.length === 0 && (
        <div className="text-center py-12 text-[#FF4444]">
          Failed to load competitions. Please try again.
        </div>
      )}

      {competitions.length > 0 && (
        <>
          {isLoading && (
            <div className="text-center py-4 text-nav-inactive text-xs">
              Updating competitions...
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 py-6">
            {competitions.map(competition => (
              <CompetitionCard key={competition.id} competition={competition} />
            ))}
          </div>
        </>
      )}

      {!isLoading && !error && competitions.length === 0 && (
        <div className="text-center py-12 text-nav-inactive">
          No competitions found
        </div>
      )}
    </div>
  );
};

interface CompetitionCardProps {
  competition: Competition;
}

const CompetitionCard = ({ competition }: CompetitionCardProps) => {
  const router = useRouter();
  const config = STATUS_CONFIG[competition.status];
  const { mutate: joinCompetition, isPending: isJoining } =
    useJoinCompetition();

  const handleViewDetails = () => {
    router.push(`/competition/${competition.id}`);
  };

  const handleJoinCompetition = () => {
    joinCompetition(competition.id);
  };

  return (
    <div
      className="border border-border p-4 lg:p-5 rounded-2xl space-y-4 transition-all lg:hover:border-border-hover relative"
      style={{
        background:
          "linear-gradient(70.71deg, rgba(26, 29, 31, 0) 38.59%, #1A1D1F 96.76%)",
      }}
    >
      <div className="flex items-center justify-between">
        <div
          className={`px-2 py-1 lg:px-4 lg:py-2 rounded-full ${config.bgColor} flex items-center gap-x-2 w-fit`}
        >
          <div className={`w-1.5 h-1.5 rounded-full ${config.color}`} />
          <p className={`text-xs ${config.textColor} font-semibold`}>
            {config.label}
          </p>
        </div>

        <div className="text-right">
          <p className="text-xs text-nav-inactive font-normal">Prize Pool</p>
          <p className="text-white font-semibold text-base">
            {competition.prizePool}
          </p>
        </div>
      </div>

      <p className="text-base font-medium text-white min-h-[48px]">
        {competition.title}
      </p>

      <div className="flex gap-x-6 items-center">
        {competition.status !== "ended" && (
          <div className="flex gap-x-2 items-center">
            <Clock className="w-4 h-4 text-nav-inactive" />
            <p className="text-xs text-nav-inactive font-normal">
              {competition.status === "upcoming" ? "Starts in" : "Ends in"}{" "}
              <span className="text-white font-medium">
                {competition.timeInfo}
              </span>
            </p>
          </div>
        )}

        {competition.status === "ended" && (
          <div className="flex gap-x-2 items-center">
            <Clock className="w-4 h-4 text-nav-inactive" />
            <p className="text-xs text-nav-inactive font-normal">Ended</p>
          </div>
        )}

        <div className="flex gap-x-2 items-center">
          <PeopleIcon className="w-4 h-4 text-nav-inactive" />
          <p className="text-xs text-white font-medium">
            {competition.participants}
          </p>
        </div>
      </div>

      <div className="flex flex-row gap-x-2 items-center w-full max-w-full">
        <Button
          onClick={handleViewDetails}
          className={`${
            competition.isParticipating ? "w-full" : "flex flex-1"
          } rounded-full border border-border bg-transparent lg:hover:bg-white/5 text-white font-semibold text-xs mt-4`}
        >
          View Details
        </Button>
        {!competition.isParticipating && (
          <Button
            onClick={handleJoinCompetition}
            disabled={isJoining}
            className="flex flex-1 rounded-full border border-border bg-[#02DA8B] lg:hover:bg-[#02DA8B]/90 text-black font-semibold text-xs mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isJoining ? "Joining..." : "Join Competition"}
          </Button>
        )}
      </div>
    </div>
  );
};

export default CompetitionList;
