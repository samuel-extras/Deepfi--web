import type {
  Competition,
  LeaderboardEntry,
  Prize,
} from "@/components/competition/constants";
import type { CompetitionDetailResponse } from "@/types/competition";

export function calculateTimeRemaining(targetDate: string): string {
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
}

export function getCompetitionStatus(
  status: string,
  startDate: string,
  endDate: string
): "live" | "upcoming" | "ended" {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (now < start) return "upcoming";
  if (now > end) return "ended";
  return "live";
}

export function transformCompetitionDetail(
  apiCompetition: CompetitionDetailResponse
): Competition {
  const status = getCompetitionStatus(
    apiCompetition.status,
    apiCompetition.startDate,
    apiCompetition.endDate
  );

  const targetDate =
    status === "upcoming" ? apiCompetition.startDate : apiCompetition.endDate;
  const timeInfo = status !== "ended" ? calculateTimeRemaining(targetDate) : "";

  const prizePool = apiCompetition.prizePool
    ? `$${parseFloat(apiCompetition.prizePool).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : "";

  const prizes: Prize[] =
    apiCompetition.prizeDistributions
      ?.sort((a, b) => a.place - b.place)
      .map(dist => {
        const prizeAmount = apiCompetition.prizePool
          ? (parseFloat(apiCompetition.prizePool) * dist.percentage) / 100
          : 0;
        const placeLabel =
          dist.place === 1
            ? "1st Place"
            : dist.place === 2
              ? "2nd Place"
              : dist.place === 3
                ? "3rd Place"
                : `${dist.place}th Place`;

        return {
          place: placeLabel,
          amount: `$${prizeAmount.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,
          percentage: `${dist.percentage}% of Pool`,
          rank: dist.place,
        };
      }) || [];

  const rules = apiCompetition.rules
    ? apiCompetition.rules
        .split(/\n|;/)
        .map(rule => rule.trim())
        .filter(rule => rule.length > 0)
    : [];

  return {
    id: apiCompetition.id,
    title: apiCompetition.name,
    prizePool,
    status,
    timeInfo,
    participants: apiCompetition.participants?.length || 0,
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
    rules:
      rules.length > 0
        ? rules
        : apiCompetition.rules
          ? [apiCompetition.rules]
          : [],
    prizes,
    userRank: apiCompetition.userRank,
  };
}

export function transformParticipantsToLeaderboard(
  participants: CompetitionDetailResponse["participants"]
): LeaderboardEntry[] {
  return participants
    .map((participant, index) => ({
      rank: index + 1,
      trader: participant.walletAddress,
      tradingVolume: `$${parseFloat(participant.tradedVolume).toLocaleString(
        "en-US",
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }
      )}`,
      trades: participant.numberOfTrades,
    }))
    .sort((a, b) => {
      const volumeA = parseFloat(a.tradingVolume.replace(/[$,]/g, ""));
      const volumeB = parseFloat(b.tradingVolume.replace(/[$,]/g, ""));
      return volumeB - volumeA;
    })
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
}
