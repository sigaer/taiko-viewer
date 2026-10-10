import type { GoalType, PlayerGoal } from "./player-goal";
import type { PlayerRatingDimension, RatingDimensionKey } from "./recommendation-intelligence";
import type { CanonicalFact, GrowthTemporal } from "../../packages/sakura-taiko-contract/src/index";

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

export type GrowthFactType = CanonicalFact["type"];
export type GrowthTemporalPrecision = GrowthTemporal["precision"];

/** Viewer product refinements of Contract v1.0; evidence and time have one definition. */
export type GrowthFact = Omit<CanonicalFact, "songId" | "difficultyType" | "goalType"> & {
  songId?: number;
  difficultyType?: number;
  goalType?: GoalType | null;
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

export type RecentGrowthState = "new" | "caught-up" | "unavailable";

export type RecentGrowthResponse = {
  profileId: string;
  state: RecentGrowthState;
  observedAt: string | null;
  facts: GrowthFact[];
  totalFacts: number;
  boundary: {
    acknowledgedToken: string | null;
    currentToken: string | null;
    acknowledgeRequired: boolean;
    recovered: boolean;
  };
};

export type RecentGrowthAcknowledgeResponse = {
  profileId: string;
  acknowledgedToken: string;
  acknowledgedAt: string;
  unchanged: boolean;
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

export type SkillPassportRangeDays = 30 | 90 | 180 | 365;
export type SkillPassportTrendDimension = "rating" | RatingDimensionKey;

export type SkillPassportPoint = WeeklyMeasurementPoint & {
  day: string;
};

export type SkillPassportSegment = {
  id: string;
  measurementVersion: number;
  algorithmVersion: string;
  modelRevision: string | null;
  from: string;
  to: string;
  points: SkillPassportPoint[];
};

export type SkillPassportSegmentChange = {
  start: SkillPassportPoint | null;
  end: SkillPassportPoint | null;
  compatible: boolean;
  reason: "compatible" | "insufficient" | "limited";
  ratingDelta: number | null;
  dimensionDeltas: GrowthMeasurementDimensions | null;
  primaryDimensionChange: {
    key: RatingDimensionKey;
    before: number;
    after: number;
    delta: number;
  } | null;
  focusFrom: GrowthMeasurement["focus"] | null;
  focusTo: GrowthMeasurement["focus"] | null;
};

export type SkillPassportFocusRun = {
  id: string;
  segmentId: string;
  focus: GrowthMeasurement["focus"];
  startedAt: string;
  endedAt: string;
  current: boolean;
};

export type SkillPassportMilestone = {
  id: string;
  primaryType: Exclude<GrowthFactType, "played">;
  factKeys: string[];
  day: string | null;
  observedAt: string | null;
  timeSemantics: "played" | "observed";
  title: string;
  songId: number | null;
  difficultyType: number | null;
  before: number | null;
  after: number | null;
  delta: number | null;
  goalCompleted: boolean;
  observationOnly: boolean;
  improvements?: { type: Exclude<GrowthFactType, "played">; before: number | null; after: number | null; delta: number | null; factKey: string }[];
  evidenceRefs?: { factKey: string; source: GrowthFact["evidence"]["source"]; sourceRevision?: string; evidenceVersion: number }[];
};

export type SkillPassportPeriodView = {
  range: SkillPassportResponse["range"];
  recentFactsFrom: string;
  recentFactsTo: string;
  pointIds: string[];
  milestoneIds: string[];
  initialMilestoneIds: string[];
  currentSegmentChange: SkillPassportSegmentChange;
  focusTimeline: SkillPassportFocusRun[];
};

export type SkillPassportResponse = {
  profileId: string;
  coverage: {
    measurementFrom: string | null;
    measurementTo: string | null;
    measurementDays: number;
    recentFactsFrom: string;
    recentFactsTo: string;
    recentFactsState: GrowthCoverageState;
  };
  current: {
    rating: number | null;
    dimensions: GrowthMeasurementDimensions;
    focus: GrowthMeasurement["focus"];
    readiness: GrowthDataSufficiency;
  } | null;
  range: {
    requestedDays: SkillPassportRangeDays;
    actualFrom: string | null;
    actualTo: string | null;
    timezone: "Asia/Shanghai";
    selectedDimension: SkillPassportTrendDimension;
    from?: string;
    to?: string;
    measurementDays?: number;
    factDays?: 30 | 90;
  };
  segments: SkillPassportSegment[];
  currentSegmentChange: SkillPassportSegmentChange;
  focusTimeline: SkillPassportFocusRun[];
  milestones: SkillPassportMilestone[];
  initialMilestoneIds?: string[];
  shared?: {
    segments: SkillPassportSegment[];
    milestones: SkillPassportMilestone[];
    views: Record<SkillPassportRangeDays, SkillPassportPeriodView>;
  };
  activeGoal: PlayerGoal | null;
  recentCompletedGoal: PlayerGoal | null;
  currentNextAction: {
    focus: GrowthMeasurement["focus"];
    todayPlan: PlayerGrowthOverview["todayPlan"];
  } | null;
};
