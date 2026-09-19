import type { GoalType, PlayerGoal } from "./player-goal";
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
  goalOptions?: GoalType[];
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
  /** Internal replay evidence retained for canonical history projection. */
  evidenceRevision?: string;
  observedAt?: string | null;
  factOccurredAt?: Partial<Record<GrowthEventFact["type"], string>>;
};
export type GrowthDailyProgress = {
  calendarDay: string;
  dataMode: GrowthDataMode;
  attendance: "played" | "not_played" | "unknown";
  uniqueCharts: number | null;
  events: GrowthDailyEvent[];
};

export type PlayerGrowthOverview = {
  profileId?: string;
  scoreRevision?: string;
  sourceGeneratedAt?: string;
  recentCompletedGoal?: PlayerGoal | null;
  activeGoal?: PlayerGoal | null;
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

export type GrowthFactType =
  | "played"
  | "score-pb"
  | "ng-reduced"
  | "combo-improved"
  | "clear"
  | "fc"
  | "df"
  | "rank-upgrade"
  | "goal-completed";

export type GrowthTemporalPrecision = "instant" | "day" | "observation" | "unknown";

export type GrowthFact = {
  id: string;
  factKey: string;
  ownerId: string;
  bindingId: string;
  type: GrowthFactType;
  title?: string;
  songId?: number;
  difficultyType?: number;
  before?: number | null;
  after?: number | null;
  delta?: number | null;
  goalId?: string | null;
  goalType?: GoalType | null;
  evidence: {
    source: "score-history" | "goal";
    sourceRevision?: string;
    evidenceVersion: number;
    provenance?: unknown;
  };
  temporal: {
    attributedDay?: string | null;
    occurredAt?: string | null;
    observedAt?: string | null;
    confirmedAt?: string | null;
    precision: GrowthTemporalPrecision;
  };
};

export type GrowthMeasurementDimensions = Record<RatingDimensionKey, number | null>;

export type GrowthMeasurement = {
  id: string;
  ownerId: string;
  bindingId: string;
  capturedAt: string;
  scoreRevision: string;
  measurementVersion: number;
  algorithmVersion: string;
  modelRevision: string | null;
  rating: number | null;
  dimensions: GrowthMeasurementDimensions;
  focus: RatingDimensionKey | "balanced" | "limited" | "insufficient-data";
  sampleCount: number;
  availabilityState: GrowthDataSufficiency;
};

export type GrowthCoverageState = "complete" | "partial" | "truncated" | "unknown";

export type GrowthHistoryResponse = {
  profileId: string;
  range: { from: string; to: string; timezone: "Asia/Shanghai"; maxDays: number };
  facts: GrowthFact[];
  measurements: GrowthMeasurement[];
  coverage: {
    scoreHistoryFrom: string | null;
    scoreHistoryTo: string | null;
    scoreHistoryState: GrowthCoverageState;
    measurementFrom: string | null;
    measurementTo: string | null;
    measurementState: GrowthCoverageState;
  };
};

export type WeeklyGrowthThemeType =
  | "stability"
  | "score-breakthrough"
  | "new-crown"
  | "rank-breakthrough"
  | "goal-follow-through"
  | "mixed-growth"
  | "broad-activity"
  | "focus-change"
  | "balanced"
  | "quiet"
  | "no-play"
  | "limited-coverage";

export type WeeklyGrowthTheme = {
  type: WeeklyGrowthThemeType;
  evidenceFactKeys: string[];
  evidenceMeasurementIds: string[];
  confidence: "low" | "medium" | "high";
};

export type WeeklyGrowthHighlight = {
  id: string;
  primaryType: Exclude<GrowthFactType, "played" | "goal-completed"> | "played";
  factKeys: string[];
  songId: number;
  difficultyType: number;
  title: string;
  before: number | null;
  after: number | null;
  delta: number | null;
  goalCompleted: boolean;
};

export type WeeklyMeasurementChangeReason =
  | "compatible"
  | "insufficient"
  | "limited"
  | "algorithm-mismatch"
  | "model-mismatch"
  | "measurement-version-mismatch";

export type WeeklyMeasurementPoint = Pick<GrowthMeasurement,
  "id" | "capturedAt" | "scoreRevision" | "measurementVersion" | "algorithmVersion" | "modelRevision" | "rating" | "dimensions" | "focus" | "sampleCount" | "availabilityState"
>;

export type WeeklyMeasurementChange = {
  start: WeeklyMeasurementPoint | null;
  end: WeeklyMeasurementPoint | null;
  compatible: boolean;
  reason: WeeklyMeasurementChangeReason;
  ratingDelta: number | null;
  dimensionDeltas: GrowthMeasurementDimensions | null;
  primaryDimension: {
    key: RatingDimensionKey;
    before: number;
    after: number;
    delta: number;
  } | null;
  focusFrom: GrowthMeasurement["focus"] | null;
  focusTo: GrowthMeasurement["focus"] | null;
};

export type WeeklyGrowthResponse = {
  profileId: string;
  week: {
    from: string;
    to: string;
    timezone: "Asia/Shanghai";
    isCompleteWeek: boolean;
  };
  coverage: GrowthHistoryResponse["coverage"];
  theme: WeeklyGrowthTheme;
  highlights: WeeklyGrowthHighlight[];
  measurementChange: WeeklyMeasurementChange;
  totals: {
    distinctCharts: number;
    pb: number;
    fc: number;
    df: number;
    rankUpgrade: number;
    completedGoals: number;
  };
  currentNextAction: {
    focus: GrowthMeasurement["focus"];
    todayPlan: PlayerGrowthOverview["todayPlan"];
  } | null;
};
