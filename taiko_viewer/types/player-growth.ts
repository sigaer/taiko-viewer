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

export type GrowthDailyProgress = {
  calendarDay: string;
  dataMode: GrowthDataMode;
  attendance: "played" | "not_played" | "unknown";
  uniqueCharts: number | null;
  scoreImprovements: number | null;
  newBestCount: number | null;
  crownChanges: number | null;
  breakthrough: {
    songId: number;
    title: string;
    level: number;
    kind: "score" | "crown" | "first-play";
    scoreBefore: number | null;
    scoreAfter: number | null;
    scoreDelta: number | null;
    crownBefore: number | null;
    crownAfter: number | null;
  } | null;
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
