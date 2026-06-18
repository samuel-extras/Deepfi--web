export interface PrizeDistribution {
  id: string;
  competitionId: string;
  place: number;
  percentage: number;
}

export interface CompetitionParticipant {
  id: string;
  competitionId: string;
  userId: string;
  walletAddress: string;
  tradedVolume: string;
  numberOfTrades: number;
  createdAt: string;
}

export interface CompetitionApiResponse {
  id: string;
  name: string;
  type: string;
  description: string;
  rules?: string;
  startDate: string;
  endDate: string;
  prizePool?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  prizeDistributions?: PrizeDistribution[];
  isParticipating?: boolean;
  _count: {
    participants: number;
  };
}

export interface CompetitionDetailResponse extends Omit<
  CompetitionApiResponse,
  "_count"
> {
  participants: CompetitionParticipant[];
  userRank: number;
}

export type CompetitionsResponse = CompetitionApiResponse[];

export interface JoinCompetitionResponse {
  id: string;
  competitionId: string;
  userId: string;
  walletAddress: string;
  createdAt: string;
}
