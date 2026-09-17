import type { PlayerRatingDimension, RatingDimensionKey } from "./recommendation-intelligence";

export type GrowthDataMode = "FULL_HISTORY" | "SNAPSHOT_LIMITED" | "INSUFFICIENT";
export type GrowthDataSufficiency = "ready" | "limited" | "insufficient";

export type PlayerGrowthState = {
  overallRating: number | null;
  skills: PlayerRatingDimension[];
  priorityDimension: RatingDimensionKey | null;
  tiedDimensions: RatingDimensionKey[];
  dataSufficiency: GrowthDataSufficiency;
  basis: "lowest-valid-dimension" | "insufficient-evidence";
  sampleCount: number;
};

export type GrowthPlanItem = {
  songId: number;
  difficultyType: 1 | 2 | 3 | 4 | 5;
  starLevel: number | null;
  title: string;
  isUnplayed: boolean;
  targetDimension: RatingDimensionKey | null;
  reason: "target-dimension" | "general-fallback";
  currentBestScore: number | null;
  currentBestRank: number | null;
};

export type GrowthEventFact = {
  type: "played" | "score-pb" | "ng-reduced" | "combo-improved" | "clear-upgrade" | "fc" | "df" | "rank-upgrade";
  before: number | null;
  after: number | null;
  delta: number | null;
};
export type GrowthDailyEvent = {
  songId: number;
  level: number;
  title: string;
  occurredAt: string;
  evidence: "history" | "delta-snapshot" | "full-snapshot";
  importance: number;
  facts: GrowthEventFact[];
};
export type GrowthDailyProgress = {
  calendarDay: string;
  dataMode: GrowthDataMode;
  attendance: "played" | "not_played" | "unknown";
  uniqueCharts: number | null;
  events: GrowthDailyEvent[];
};

export type PlayerGrowthOverview = {
  playerState: PlayerGrowthState;
  todayPlan: {
    targetDimension: RatingDimensionKey | null;
    items: GrowthPlanItem[];
    usedFallback: boolean;
  };
  dailyProgress: GrowthDailyProgress;
  dataStatus: {
    mode: GrowthDataMode;
    timezone: "Asia/Shanghai";
  };
};
