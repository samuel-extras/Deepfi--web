export type CompetitionStatus = "live" | "upcoming" | "ended";

export interface Competition {
  id: string;
  title: string;
  prizePool?: string | null;
  status: CompetitionStatus;
  timeInfo: string;
  participants: number;
  userRank?: number | null;
  description: string;
  startDate: string;
  endDate: string;
  rules?: string[] | null;
  prizes?: Prize[] | null;
  isParticipating?: boolean;
}

export interface Prize {
  place: string;
  amount: string;
  percentage?: string;
  rank?: number; // Add rank for dynamic icon rendering
}

export interface LeaderboardEntry {
  rank: number;
  trader: string;
  tradingVolume: string;
  trades: number;
}

export const STATUS_CONFIG = {
  live: {
    label: "Live",
    color: "bg-primary",
    bgColor: "bg-primary/15",
    textColor: "text-primary",
  },
  upcoming: {
    label: "Upcoming",
    color: "bg-[#F59E0B]",
    bgColor: "bg-[#F59E0B]/15",
    textColor: "text-[#F59E0B]",
  },
  ended: {
    label: "Ended",
    color: "bg-[#6B7280]",
    bgColor: "bg-[#6B7280]/15",
    textColor: "text-[#6B7280]",
  },
} as const;

// Mock competitions data
export const MOCK_COMPETITIONS: Competition[] = [
  {
    id: "1",
    title: "DEX Millionaires' Spot and Perps Trading Competition",
    prizePool: "$50,000",
    status: "live",
    timeInfo: "2d 20h 30mins",
    participants: 5034,
    description:
      "Join the ultimate trading competition where the best traders compete for massive prizes. Trade spot and perpetual contracts to climb the leaderboard and win your share of $50,000 in prizes.",
    startDate: "March 1, 2025",
    endDate: "March 31, 2025",
    rules: [
      "Competition is open to all verified users",
      "Trading volume and PnL are both factored into rankings",
      "Minimum trading volume of $10,000 required to qualify",
      "Winners will be announced within 48 hours of competition end",
      "Prizes will be distributed within 7 days of announcement",
    ],
    prizes: [
      {
        place: "1st Place",
        amount: "$25,000",
        percentage: "35% of Pool",
        rank: 1,
      },
      {
        place: "2nd Place",
        amount: "$12,500",
        percentage: "35% of Pool",
        rank: 2,
      },
      {
        place: "3rd Place",
        amount: "$7,500",
        percentage: "35% of Pool",
        rank: 3,
      },
      {
        place: "4th-10th Place",
        amount: "$5,000 (shared)",
        percentage: "35% of Pool",
      },
    ],
  },
  {
    id: "2",
    title: "Weekly Derivatives Trading Challenge",
    prizePool: "$25,000",
    status: "live",
    timeInfo: "5d 10h 15mins",
    participants: 3421,
    description:
      "A weekly competition focused on derivatives trading. Show your skills in futures and perpetual contracts.",
    startDate: "March 15, 2025",
    endDate: "March 22, 2025",
    rules: [
      "Only derivatives trading counts towards ranking",
      "Minimum 50 trades required",
      "PnL-based ranking system",
    ],
    prizes: [
      {
        place: "1st Place",
        amount: "$12,500",
        percentage: "35% of Pool",
        rank: 1,
      },
      {
        place: "2nd Place",
        amount: "$7,500",
        percentage: "35% of Pool",
        rank: 2,
      },
      {
        place: "3rd Place",
        amount: "$5,000",
        percentage: "35% of Pool",
        rank: 3,
      },
      {
        place: "4th Place",
        amount: "$12,500",
        percentage: "35% of Pool",
        rank: 4,
      },
      {
        place: "5th Place",
        amount: "$7,500",
        percentage: "35% of Pool",
        rank: 5,
      },
      {
        place: "6th Place",
        amount: "$5,000",
        percentage: "35% of Pool",
        rank: 6,
      },
    ],
  },
  {
    id: "3",
    title: "Spot Trading Championship 2025",
    prizePool: "$75,000",
    status: "upcoming",
    timeInfo: "3d 5h 45mins",
    participants: 1523,
    description:
      "The premier spot trading competition of 2025. Trade your favorite tokens and compete for the top spot.",
    startDate: "April 1, 2025",
    endDate: "April 30, 2025",
    rules: [
      "Spot trading only",
      "Volume and profitability both matter",
      "No minimum volume requirement",
    ],
    prizes: [
      {
        place: "1st Place",
        amount: "$37,500",
        percentage: "35% of Pool",
        rank: 1,
      },
      {
        place: "2nd Place",
        amount: "$22,500",
        percentage: "35% of Pool",
        rank: 2,
      },
      {
        place: "3rd Place",
        amount: "$15,000",
        percentage: "35% of Pool",
        rank: 3,
      },
    ],
  },
  {
    id: "4",
    title: "Futures Masters Tournament",
    prizePool: "$100,000",
    status: "upcoming",
    timeInfo: "7d 12h 00mins",
    participants: 892,
    description:
      "Test your futures trading skills in this intensive tournament.",
    startDate: "April 15, 2025",
    endDate: "April 22, 2025",
    rules: [
      "Futures trading only",
      "High leverage allowed",
      "Risk management is key",
    ],
    prizes: [
      {
        place: "1st Place",
        amount: "$50,000",
        percentage: "35% of Pool",
        rank: 1,
      },
      {
        place: "2nd Place",
        amount: "$30,000",
        percentage: "35% of Pool",
        rank: 2,
      },
      {
        place: "3rd Place",
        amount: "$20,000",
        percentage: "35% of Pool",
        rank: 3,
      },
    ],
  },
  {
    id: "5",
    title: "Crypto Trading World Cup",
    prizePool: "$150,000",
    status: "ended",
    timeInfo: "",
    participants: 8234,
    description:
      "The world cup of crypto trading has concluded. Congratulations to all winners!",
    startDate: "January 1, 2025",
    endDate: "January 31, 2025",
    rules: [
      "Competition was open to all verified users",
      "Trading volume and PnL were both factored into rankings",
      "Minimum trading volume of $10,000 was required to qualify",
    ],
    prizes: [
      {
        place: "1st Place",
        amount: "$75,000",
        percentage: "35% of Pool",
        rank: 1,
      },
      {
        place: "2nd Place",
        amount: "$45,000",
        percentage: "35% of Pool",
        rank: 2,
      },
      {
        place: "3rd Place",
        amount: "$30,000",
        percentage: "35% of Pool",
        rank: 3,
      },
    ],
  },
  {
    id: "6",
    title: "Spring Trading Showdown",
    prizePool: "$30,000",
    status: "ended",
    timeInfo: "",
    participants: 4567,
    description: "The spring showdown has ended. Thank you for participating!",
    startDate: "February 1, 2025",
    endDate: "February 28, 2025",
    rules: [
      "All trading pairs were eligible",
      "Volume-based ranking",
      "Prizes distributed within 7 days",
    ],
    prizes: [
      {
        place: "1st Place",
        amount: "$15,000",
        percentage: "35% of Pool",
        rank: 1,
      },
      {
        place: "2nd Place",
        amount: "$9,000",
        percentage: "35% of Pool",
        rank: 2,
      },
      {
        place: "3rd Place",
        amount: "$6,000",
        percentage: "35% of Pool",
        rank: 3,
      },
    ],
  },
];

// Mock leaderboard data
export const generateMockLeaderboard = (
  count: number = 20
): LeaderboardEntry[] =>
  Array.from({ length: count }, (_, i) => ({
    rank: i + 1,
    trader: `0x${Math.random().toString(16).substring(2, 42)}`,
    tradingVolume: "$12,000.23",
    trades: Math.floor(Math.random() * 1000) + 500,
  }));
