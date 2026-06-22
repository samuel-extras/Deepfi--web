import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
} from "axios";
import axiosRetry, { exponentialDelay } from "axios-retry";
import { useAuthStore } from "@/stores/useAuthStore";
import { useUserProfileStore } from "@/stores/useUserProfileStore";
import { EventType } from "./types";
import { eventBus, EventType as EventBusType } from "@/lib/events/eventBus";
import type {
  UserProfileResponse,
  ReferralTreeResponse,
  ReferralTreeItem,
  Payout,
  PayoutFilters,
  ActivityConfigResponse,
  ApiResponse,
  RequestPayoutParams,
} from "@/types";
import {
  SocialAccountsResponse,
  LeaderboardResponse,
  TimelineResponse,
  PositionsResponse,
} from "@/types/social";
import {
  CompetitionsResponse,
  CompetitionDetailResponse,
  CompetitionApiResponse,
  JoinCompetitionResponse,
} from "@/types/competition";

import type {
  SetReferrerInput,
  SetReferrerResponse,
} from "@/validations/user.validations";

const api = (path: string): string => `/api${path}`;

const API_ENDPOINTS = {
  auth: {
    authenticate: api("/auth/authenticate"),
    logout: api("/auth/logout"),
  },
  users: {
    me: api("/users/me"),
    setReferrer: api("/users/me/referrer"),
    referrals: api("/users/me/referrals"),
    payouts: api("/users/me/payouts"),
    activityConfig: api("/users/activity-config"),
  },
  social: {
    linkTwitter: api("/social/init"),
    accounts: api("/social/accounts"),
    follow: (username: string) => api(`/social/follow/${username}`),
    leaderboard: api("/social/leaderboard"),
    timeline: (query: string) => api(`/social/timeline?${query}`),
    positions: api("/social/positions"),
  },
  competitions: {
    list: api("/competitions"),
    getById: (id: string) => api(`/competitions/${id}`),
    latest: api("/competitions/latest"),
    join: (id: string) => api(`/competitions/${id}/join`),
  },
  events: {
    track: api("/events"),
  },
  defi: {
    track: api("/defi"),
  },
} as const;

const PUBLIC_ENDPOINTS = [
  API_ENDPOINTS.auth.authenticate,
  API_ENDPOINTS.users.activityConfig,
] as const;

const DEFAULT_RETRIES = 3;
const RETRYABLE_CLIENT_ERRORS = [408, 429] as const;

function shouldRetryRequest(error: AxiosError): boolean {
  // Don't retry on 401 errors (authentication failures)
  if (error.response?.status === 401) {
    return false;
  }
  // Network errors (no response means network/connection issue)
  if (!error.response) {
    return true;
  }
  // Retry on all 5xx server errors and specific client errors
  const status = error.response.status;
  return (
    status >= 500 ||
    (RETRYABLE_CLIENT_ERRORS as readonly number[]).includes(status)
  );
}

function createAxiosInstanceWithRetry(
  baseURL: string,
  retries = DEFAULT_RETRIES
): AxiosInstance {
  const instance = axios.create({
    baseURL,
    headers: {
      "Content-Type": "application/json",
    },
  });

  axiosRetry(instance, {
    retries,
    retryDelay: exponentialDelay,
    retryCondition: shouldRetryRequest,
  });

  instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      // Skip auth header for public endpoints
      const isPublicEndpoint = PUBLIC_ENDPOINTS.some(endpoint =>
        config.url?.includes(endpoint)
      );
      if (isPublicEndpoint) {
        return config;
      }

      const token = useAuthStore.getState().jwtToken;

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      return config;
    },
    error => Promise.reject(error)
  );

  instance.interceptors.response.use(
    response => response,
    (error: AxiosError) => {
      if (error.response?.status === 401) {
        const errorData = error.response?.data as
          | { error?: { code?: string; message?: string } }
          | undefined;

        // Only clear token for specific token-related errors
        const shouldClearToken =
          error.config?.url?.includes(API_ENDPOINTS.auth.logout) ||
          errorData?.error?.code === "TOKEN_EXPIRED" ||
          errorData?.error?.code === "INVALID_TOKEN" ||
          errorData?.error?.message?.toLowerCase().includes("token expired") ||
          errorData?.error?.message?.toLowerCase().includes("invalid token");

        if (shouldClearToken) {
          useAuthStore.getState().clearJwtToken();
        }
      }
      return Promise.reject(error);
    }
  );

  return instance;
}

interface LogoutResponse {
  success: boolean;
  message: string;
}

interface TrackActivityParams {
  eventType: EventType;
  eventData: Record<string, unknown>;
  clientEventId: string;
}

interface TrackActivityRequest {
  eventType: EventType;
  metadata: Record<string, unknown>;
  clientEventId: string;
}

interface TrackActivityResponse {
  success: boolean;
  message: string;
}

interface DefiTradeRequest {
  walletAddress: string;
  action: "buy" | "sell";
  executionMethod: "cow" | "ua";
  tokenAddress: string;
  chainId: number;
  tokenSymbol: string;
  tokenIcon?: string;
  amount: string;
  quoteAmount: string;
  orderId?: string;
  transactionId?: string;
}

interface DefiTradeResponse {
  success: boolean;
  message: string;
  data?: unknown;
}

class DexBackendApiService {
  private client: AxiosInstance | null = null;

  constructor() {
    const baseURL = process.env.NEXT_PUBLIC_DEX_API_BASE_URL;
    if (!baseURL) {
      console.warn(
        "NEXT_PUBLIC_DEX_API_BASE_URL is not set. Backend API calls will be skipped."
      );
      return;
    }
    this.client = createAxiosInstanceWithRetry(baseURL);
  }

  public async logout(token?: string | null): Promise<void> {
    if (!this.client) {
      console.warn("Backend API client not initialized. Skipping logout.");
      return;
    }

    const tokenToUse = token ?? useAuthStore.getState().jwtToken;

    if (!tokenToUse) {
      // No token to revoke, silently skip
      return;
    }

    try {
      await this.client.post<LogoutResponse>(
        API_ENDPOINTS.auth.logout,
        {},
        {
          headers: {
            Authorization: `Bearer ${tokenToUse}`,
          },
        }
      );
    } catch (error) {
      console.error("Failed to logout from backend:", error);
      if (error instanceof AxiosError) {
        console.error("Logout error details:", {
          status: error.response?.status,
          data: error.response?.data,
        });
      }
    }
  }

  // Note: clientEventId must be unique per event instance. For idempotency:
  public async trackActivity(params: TrackActivityParams): Promise<void> {
    if (!this.client) {
      console.warn(
        "Backend API client not initialized. Skipping trackActivity."
      );
      return;
    }

    try {
      const { eventType, eventData, clientEventId } = params;

      const requestData: TrackActivityRequest = {
        eventType,
        metadata: eventData,
        clientEventId,
      };

      await this.client.post<TrackActivityResponse>(
        API_ENDPOINTS.events.track,
        requestData
      );
    } catch (error) {
      console.error("Failed to track activity:", error);
      if (error instanceof AxiosError) {
        console.error(
          "Event:",
          params.eventType,
          "Response:",
          error.response?.data
        );
      }
      return;
    }
  }

  public async getUserProfile(): Promise<UserProfileResponse | null> {
    if (!this.client) {
      console.warn(
        "Backend API client not initialized. Skipping getUserProfile."
      );
      return null;
    }

    try {
      const response = await this.client.get<ApiResponse<UserProfileResponse>>(
        API_ENDPOINTS.users.me
      );
      return response.data.data ?? null;
    } catch (error) {
      console.error("Failed to get user profile:", error);
      return null;
    }
  }

  public async setReferrer(
    input: SetReferrerInput
  ): Promise<SetReferrerResponse | null> {
    if (!this.client) {
      console.warn("Backend API client not initialized. Skipping setReferrer.");
      return null;
    }

    try {
      const response = await this.client.post<ApiResponse<SetReferrerResponse>>(
        API_ENDPOINTS.users.setReferrer,
        input
      );

      const payload = response.data.data ?? null;

      if (response.data.success && payload) {
        useUserProfileStore
          .getState()
          .updateReferredByUserId(payload.referredByUserId);
        eventBus.emit(EventBusType.PROFILE_UPDATED);
      }

      return payload;
    } catch (error) {
      console.error("Failed to set referrer:", error);
      if (error instanceof AxiosError) {
        const apiError = error.response?.data?.error as
          | { code?: string; message?: string }
          | undefined;
        const message =
          apiError?.code ||
          apiError?.message ||
          "Failed to set referrer. Please try again.";
        throw new Error(message);
      }
      throw error;
    }
  }

  public async getReferralTree(): Promise<ReferralTreeItem[]> {
    if (!this.client) {
      console.warn(
        "Backend API client not initialized. Skipping getReferralTree."
      );
      return [];
    }

    try {
      const response = await this.client.get<ApiResponse<ReferralTreeResponse>>(
        API_ENDPOINTS.users.referrals
      );
      return response.data.data?.referrals ?? [];
    } catch (error) {
      console.error("Failed to get referral tree:", error);
      return [];
    }
  }

  public async getPayouts(filters?: PayoutFilters): Promise<Payout[]> {
    if (!this.client) {
      console.warn("Backend API client not initialized. Skipping getPayouts.");
      return [];
    }

    try {
      // Sanitize filters: remove null, undefined, empty strings
      const sanitizeParams: Record<string, string | number> = {};
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== null && value !== undefined && value !== "") {
            sanitizeParams[key] = value;
          }
        });
      }

      const response = await this.client.get<ApiResponse<Payout[]>>(
        API_ENDPOINTS.users.payouts,
        { params: sanitizeParams }
      );
      return response.data.data ?? [];
    } catch (error) {
      console.error("Failed to get payouts:", error);
      return [];
    }
  }

  public async requestPayout(params: RequestPayoutParams): Promise<boolean> {
    if (!this.client) {
      console.warn(
        "Backend API client not initialized. Skipping requestPayout."
      );
      return false;
    }

    try {
      const response = await this.client.post<ApiResponse<unknown>>(
        API_ENDPOINTS.users.payouts,
        params
      );

      const success = response.data.success;

      if (success) {
        eventBus.emit(EventBusType.PAYOUT_COMPLETED);
        eventBus.emit(EventBusType.PROFILE_UPDATED);
      }

      return success;
    } catch (error) {
      console.error("Failed to request payout:", error);
      if (error instanceof AxiosError) {
        throw new Error(
          error.response?.data?.error?.message || "Failed to request payout"
        );
      }
      throw error;
    }
  }

  public async getActivityConfig(): Promise<ActivityConfigResponse | null> {
    if (!this.client) {
      console.warn(
        "Backend API client not initialized. Skipping getActivityConfig."
      );
      return null;
    }

    try {
      const response = await this.client.get<
        ApiResponse<ActivityConfigResponse>
      >(API_ENDPOINTS.users.activityConfig);
      return response.data.data ?? null;
    } catch (error) {
      console.error("Failed to get activity config:", error);
      return null;
    }
  }

  public async initSocial(data: {
    name?: string;
    username?: string;
    profilePictureUrl?: string;
  }): Promise<unknown> {
    if (!this.client) {
      console.warn("Backend API client not initialized. Skipping initSocial.");
      return null;
    }

    try {
      const response = await this.client.post<ApiResponse<unknown>>(
        API_ENDPOINTS.social.linkTwitter,
        data
      );

      console.log("Response from init social:", response?.data);
      return response.data.data ?? null;
    } catch (error) {
      console.log("Error from init social:", error);
      console.error("Failed to init social:", error);
      return null;
    }
  }

  public async getSocialAccounts(options?: {
    following?: boolean;
  }): Promise<SocialAccountsResponse | null> {
    if (!this.client) {
      console.warn(
        "Backend API client not initialized. Skipping getSocialAccounts."
      );
      return null;
    }

    try {
      const params =
        options?.following !== undefined
          ? { following: options.following }
          : undefined;

      const response = await this.client.get<
        ApiResponse<SocialAccountsResponse>
      >(API_ENDPOINTS.social.accounts, { params });
      return response.data.data ?? null;
    } catch (error) {
      console.error("Failed to get social accounts:", error);
      return null;
    }
  }

  public async followUser(username: string): Promise<boolean> {
    if (!this.client) {
      console.warn("Backend API client not initialized. Skipping followUser.");
      return false;
    }

    try {
      const response = await this.client.post<ApiResponse<unknown>>(
        API_ENDPOINTS.social.follow(username)
      );
      return response.data.success ?? false;
    } catch (error) {
      console.error("Failed to follow user:", error);
      if (error instanceof AxiosError) {
        throw new Error(
          error.response?.data?.error?.message || "Failed to follow user"
        );
      }
      throw error;
    }
  }

  public async getLeaderboard(): Promise<LeaderboardResponse | null> {
    if (!this.client) {
      console.warn(
        "Backend API client not initialized. Skipping getLeaderboard."
      );
      return null;
    }

    try {
      const response = await this.client.get<ApiResponse<LeaderboardResponse>>(
        API_ENDPOINTS.social.leaderboard
      );
      return response.data.data ?? null;
    } catch (error) {
      console.error("Failed to get leaderboard:", error);
      return null;
    }
  }

  public async getTimeline(query: string): Promise<TimelineResponse | null> {
    if (!this.client) {
      console.warn("Backend API client not initialized. Skipping getTimeline.");
      return null;
    }

    try {
      const response = await this.client.get<ApiResponse<TimelineResponse>>(
        API_ENDPOINTS.social.timeline(query)
      );
      return response.data.data ?? null;
    } catch (error) {
      console.error("Failed to get timeline:", error);
      return null;
    }
  }

  public async getPositions(): Promise<PositionsResponse | null> {
    if (!this.client) {
      console.warn(
        "Backend API client not initialized. Skipping getPositions."
      );
      return null;
    }

    try {
      const response = await this.client.get<ApiResponse<PositionsResponse>>(
        API_ENDPOINTS.social.positions
      );
      return response.data.data ?? null;
    } catch (error) {
      console.error("Failed to get positions:", error);
      return null;
    }
  }

  public async getCompetitions(params?: {
    status?: string;
    search?: string;
  }): Promise<CompetitionsResponse | null> {
    if (!this.client) {
      console.warn(
        "Backend API client not initialized. Skipping getCompetitions."
      );
      return null;
    }

    try {
      // Build query parameters
      const queryParams: Record<string, string> = {};
      if (params?.status && params.status !== "All") {
        queryParams.status = params.status;
      }
      if (params?.search && params.search.trim()) {
        queryParams.search = params.search.trim();
      }

      const response = await this.client.get<ApiResponse<CompetitionsResponse>>(
        API_ENDPOINTS.competitions.list,
        { params: queryParams }
      );
      return response.data.data ?? null;
    } catch (error) {
      console.error("Failed to get competitions:", error);
      return null;
    }
  }

  public async getCompetitionById(
    id: string
  ): Promise<CompetitionDetailResponse | null> {
    if (!this.client) {
      console.warn(
        "Backend API client not initialized. Skipping getCompetitionById."
      );
      return null;
    }

    try {
      const response = await this.client.get<
        ApiResponse<CompetitionDetailResponse>
      >(API_ENDPOINTS.competitions.getById(id));
      return response.data.data ?? null;
    } catch (error) {
      console.error("Failed to get competition by id:", error);
      return null;
    }
  }

  public async getLatestCompetition(): Promise<CompetitionApiResponse | null> {
    if (!this.client) {
      console.warn(
        "Backend API client not initialized. Skipping getLatestCompetition."
      );
      return null;
    }

    try {
      const response = await this.client.get<
        ApiResponse<CompetitionApiResponse>
      >(API_ENDPOINTS.competitions.latest);

      return response.data.data ?? null;
    } catch (error) {
      console.error("Failed to get latest competition:", error);
      return null;
    }
  }

  public async joinCompetition(
    id: string
  ): Promise<JoinCompetitionResponse | null> {
    if (!this.client) {
      console.warn(
        "Backend API client not initialized. Skipping joinCompetition."
      );
      return null;
    }

    try {
      const response = await this.client.post<
        ApiResponse<JoinCompetitionResponse>
      >(API_ENDPOINTS.competitions.join(id));
      return response.data.data ?? null;
    } catch (error) {
      if (error instanceof AxiosError) {
        const errorData = error.response?.data as
          | { error?: { code?: string; message?: string } }
          | undefined;
        const errorMessage =
          errorData?.error?.message || "Failed to join competition";
        throw new Error(errorMessage);
      }
      throw error;
    }
  }

  async trackDefi(params: DefiTradeRequest): Promise<DefiTradeResponse | null> {
    if (!this.client) {
      console.warn("Backend API client not initialized. Skipping trackDefi.");
      return null;
    }

    try {
      const response = await this.client.post<DefiTradeResponse>(
        API_ENDPOINTS.defi.track,
        params
      );
      return response.data;
    } catch (error) {
      console.error("[DeFi] Error tracking trade:", error);
      return null;
    }
  }
}

export const dexBackendApi = new DexBackendApiService();
