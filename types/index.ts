export enum FundingPeriod {
  HOURLY = "Hourly",
  EIGHT_HOURS = "8 Hours",
  DAILY = "Daily",
  WEEKLY = "Weekly",
  YEARLY = "Yearly",
}

// User Profile Types
export interface UserProfileResponse {
  user: UserBasicInfo;
  points: PointsData;
  streak: StreakData;
  referrals: ReferralStats;
  payouts: PayoutStats;
}

export interface UserBasicInfo {
  id: string;
  email: string | null;
  privyId: string | null;
  referralCode: string;
  referredByUserId?: string | null;
  status: string;
  createdAt: string;
  lastActiveAt: string | null;
}

export interface PointsData {
  total: number;
  level: number;
  history: XpTransactionItem[];
}

export interface XpTransactionItem {
  id: string;
  activityKey: string;
  amount: number;
  awardedAt: string;
  notes: string | null;
}

export interface StreakData {
  current: number;
  longest: number;
  last7Days: boolean[];
}

export interface ReferralStats {
  totalReferrals: number;
  level1Count: number;
  level2Count: number;
  level3Count: number;
  activeReferralsCount: number;
  totalEarnings: number;
  pendingRewards: number;
  confirmedRewards: number;
}

export interface PayoutStats {
  totalPaid: number;
  pendingAmount: number;
  availableForPayout: number;
  canRequestPayout: boolean;
  minimumPayoutAmount: number;
  ineligibilityReason?: string;
}

// Referral Tree Types
export interface ReferralTreeResponse {
  referrals: ReferralTreeItem[];
}

export interface ReferralTreeItem {
  id: string;
  referredUserId: string;
  referredByUserId: string | null;
  level: number;
  walletAddress: string;
  volume: number;
  totalCompensation: number;
  status: string;
  joinedAt: string;
}

// Payout Types
export interface Payout {
  id: string;
  userId: string;
  amount: number;
  walletAddress: string;
  type: string;
  status: "pending" | "processing" | "completed" | "failed";
  txHash: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface PayoutFilters {
  status?: "pending" | "processing" | "completed" | "failed";
  minAmount?: number;
  maxAmount?: number;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

export enum PayoutType {
  REFERRAL_REWARD = "referral_reward",
  XP_REWARD = "xp_reward",
  BONUS = "bonus",
}

export interface RequestPayoutParams {
  amount: number;
  walletAddress: string;
  type: PayoutType;
}

// Activity Config Types
export interface ActivityConfigResponse {
  activityRules: ActivityRule[];
  activityMilestones: ActivityMilestone[];
  referralCommissions: ReferralCommissionTier[];
}

export interface ActivityRule {
  id: string;
  activityKey: string;
  baseXp: number;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityMilestone {
  id: string;
  activityKey: string;
  milestoneType: "streak" | "cumulative";
  threshold: number;
  baseXp: number;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReferralCommissionTier {
  id: string;
  level: number;
  commissionPercent: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// API Response Wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
  };
}
