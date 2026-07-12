// Generated from ../../schemas/annual-summary-v4.schema.json. Do not edit by hand.

export type AnnualMetricStatusV4 = "exact" | "observed" | "lower_bound" | "proxy" | "unavailable";
export type AnnualDataModeV4 = "version_observed" | "current_archive";
export type AnnualTimePrecisionV4 = "batch_last_play_proxy" | "source_highscore_time" | "interval_only" | "sync_only" | "none";
export type AnnualObservationEventTypeV4 = "play_delta" | "high_score" | "manual_adjustment" | "counter_anomaly";
export type AnnualSectionKeyV4 = "favoriteSong" | "obsessionSong" | "favoriteShift" | "keyword" | "ratingRank" | "monthlyFavorites" | "weekdayActivity" | "calendarActivity" | "timeOfDay" | "lateNight" | "speedProfile" | "nearDondaful" | "challenge" | "pound" | "highScore" | "milestones" | "breakthrough";

export type AnnualMetricV4<T = unknown> = {
  status: AnnualMetricStatusV4;
  data: T | null;
  reason?: string;
};

export type AnnualSourceRefV4 = { file: string; sha256: string };

export type AnnualObservationEventV4 = {
  eventId: string;
  type: AnnualObservationEventTypeV4;
  source: string;
  sourceAccount: string | null;
  mergeTopology: string[];
  songNo: number;
  level: number;
  observedBetween: { from: string; to: string };
  representativeAt: string | null;
  representativeDate: string | null;
  nightDate: string | null;
  timePrecision: AnnualTimePrecisionV4;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  delta: Record<string, unknown>;
  warnings: string[];
  sourceRef: { from: AnnualSourceRefV4; to: AnnualSourceRefV4 };
};

export type AnnualSectionsV4 = { [K in AnnualSectionKeyV4]: AnnualMetricV4 };

export type AnnualSummaryV4Generated = {
  schemaVersion: 4;
  summaryId: string;
  generatedAt: string;
  mode: AnnualDataModeV4;
  version: Record<string, unknown>;
  coverage: Record<string, unknown>;
  profileCard: Record<string, unknown>;
  period: Record<string, unknown>;
  overview: AnnualMetricV4;
  sections: AnnualSectionsV4;
  achievements: unknown;
  finalTitle: Record<string, unknown>;
  poster: Record<string, unknown>;
  provenance: Record<string, unknown>;
};
