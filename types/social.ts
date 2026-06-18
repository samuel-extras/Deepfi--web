export interface SocialAccount {
  id: string;
  username: string;
  name?: string;
  walletAddress?: string;
  isFollowing?: boolean;
  profilePictureUrl?: string;
  type?: string;
  createdAt?: string;
  updatedAt?: string;
  user?: {
    id: string;
    email: string;
  };
}

export interface SocialAccountsResponse {
  followingCount: number;
  accounts: SocialAccount[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface LeaderboardUser {
  id: string;
  rank: number;
  username: string;
  name?: string;
  profilePictureUrl?: string;
  portfolioValue?: string;
  pnlPercentage?: number;
  walletAddress?: string;
}
export interface UserRank {
  rank: number;
  username: string;
  displayName: string;
  avatarUrl?: string;
  badge?: string;
  tradedVolume: number;
}

export interface LeaderboardResponse {
  user: UserRank;
  topTraders: UserRank[];
}

export type PositionType = "open" | "close";

export interface TimelinePost {
  user: {
    username: string;
    profilePictureUrl?: string;
  };

  id: string;
  status: PositionType;
  symbol: string;
  side: "buy" | "sell";
  amount: number;
  feePaid: number;
  builderFee: number;
  executedAt: string;
  marketType: "perp" | "spot";
  source: "deepbook" | "binance";
  createdAt: string;
}

export interface TimelineResponse {
  timeline: TimelinePost[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface Position {
  id: string;
  status: PositionType;
  symbol: string;
  side: "buy" | "sell";
  amount: number;
  feePaid: number;
  builderFee: number;
  executedAt: string;
  marketType: "perp" | "spot";
  source: "deepbook" | "binance";
  createdAt: string;
}

export interface PositionsResponse {
  positions: Position[];
  pagination?: {
    limit: number;
    offset: number;
    hasMore: boolean;
    nextOffset: number;
  };
}
