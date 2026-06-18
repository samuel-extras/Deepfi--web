/**
 * The live Predict trading competition, derived from on-chain indexer data.
 * Replaces the off-chain DEX-backend competition service. One season, ranked by
 * trading volume (cumulative mint premium) straight from the Predict indexer.
 */
import type {
  CompetitionApiResponse,
  CompetitionDetailResponse,
  CompetitionParticipant,
} from "@/types/competition";
import { computeTraderBoard, type TraderRow } from "@/lib/leaderboard";

const SEASON = {
  id: "predict-season-1",
  name: "Predict Trading — Season 1",
  type: "TRADING_VOLUME",
  description:
    "Trade DeepBook Predict — every dUSDC of premium you put up counts toward your rank. " +
    "Top traders by volume split the pool. Ranked live from the on-chain Predict indexer.",
  rules:
    "Rank by total premium traded (mint volume) across all Predict markets.;" +
    "Only on-chain DeepBook Predict trades count — no off-chain volume.;" +
    "Ranking updates live from the public indexer.;" +
    "Testnet only — prize amounts are illustrative.",
  startDate: "2026-06-01T00:00:00.000Z",
  endDate: "2026-07-01T00:00:00.000Z",
  prizePool: "10000",
  prizeDistributions: [
    { id: "predict-season-1-p1", competitionId: "predict-season-1", place: 1, percentage: 50 },
    { id: "predict-season-1-p2", competitionId: "predict-season-1", place: 2, percentage: 30 },
    { id: "predict-season-1-p3", competitionId: "predict-season-1", place: 3, percentage: 20 },
  ],
};

export const SEASON_ID = SEASON.id;

function seasonStatus(): string {
  const now = Date.now();
  if (now < Date.parse(SEASON.startDate)) return "UPCOMING";
  if (now > Date.parse(SEASON.endDate)) return "ENDED";
  return "ACTIVE";
}

function base() {
  return {
    id: SEASON.id,
    name: SEASON.name,
    type: SEASON.type,
    description: SEASON.description,
    rules: SEASON.rules,
    startDate: SEASON.startDate,
    endDate: SEASON.endDate,
    prizePool: SEASON.prizePool,
    status: seasonStatus(),
    createdAt: SEASON.startDate,
    updatedAt: SEASON.startDate,
    prizeDistributions: SEASON.prizeDistributions.map((p) => ({ ...p })),
  };
}

/** Map trader rows to competition participants, ranked by trading volume. */
function toParticipants(rows: TraderRow[]): CompetitionParticipant[] {
  return rows
    .slice()
    .sort((a, b) => b.entrySize - a.entrySize)
    .map((r) => ({
      id: `${SEASON.id}-${r.owner}`,
      competitionId: SEASON.id,
      userId: r.owner,
      walletAddress: r.owner,
      tradedVolume: r.entrySize.toFixed(6),
      numberOfTrades: r.tradeCount,
      createdAt: SEASON.startDate,
    }));
}

/** List view — one season, with a live participant count. */
export async function buildCompetitionList(): Promise<CompetitionApiResponse[]> {
  let total = 0;
  try {
    total = (await computeTraderBoard()).total;
  } catch {
    /* indexer unavailable — still show the season shell */
  }
  return [{ ...base(), _count: { participants: total } }];
}

/** Detail view — full participant leaderboard from the indexer. */
export async function buildCompetitionDetail(owner?: string): Promise<CompetitionDetailResponse> {
  let rows: TraderRow[] = [];
  try {
    rows = (await computeTraderBoard()).rows;
  } catch {
    /* indexer unavailable — return the shell with no participants */
  }
  const participants = toParticipants(rows);
  const userRank = owner
    ? participants.findIndex((p) => p.walletAddress.toLowerCase() === owner.toLowerCase()) + 1
    : 0;
  return { ...base(), participants, userRank, isParticipating: userRank > 0 };
}

/** Lightweight meta (no indexer call) — for RSC metadata generation. */
export function buildCompetitionMeta(): CompetitionDetailResponse {
  return { ...base(), participants: [], userRank: 0, isParticipating: false };
}
