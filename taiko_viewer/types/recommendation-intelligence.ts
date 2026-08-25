export type RecommendationModel = "v1";
export type RatingDimensionKey = "big_song" | "stamina" | "speed" | "accuracy_power" | "rhythm" | "complex";
export type PlayerRatingDimension = { key: RatingDimensionKey; value: number };
export type PlayerRatingIntelligence = {
  model: RecommendationModel;
  aggregation: "per-dimension-top20";
  topN: 20;
  duplicateHandling: "preserve";
  overallRating: number | null;
  sampleCount: number;
  dimensions: PlayerRatingDimension[];
  current: number | null;
  scoreCount: number;
};
export type OrdinaryRecommendationItem = {
  songId: number; level: number; title: string; isUnplayed: boolean;
  candidateIndicator: number; referenceIndicator: number; deviationRatio: number; inStrictRange: boolean;
};
export type OrdinaryRecommendationsPayload = { model: RecommendationModel; basis: "rating"; items: OrdinaryRecommendationItem[] };
export type TargetRecommendationKey = "goku" | "ziya" | "fenya" | "jinya" | "full_combo" | "dondaful";
export type TargetGapKind = "unplayed" | "score" | "bad" | "combo" | "misses";
export type TargetRecommendationItem = {
  songId: number; level: number; star: string; title: string;
  currentScore: number | null; targetScore: number | null; targetKey: TargetRecommendationKey;
  gapKind: TargetGapKind; gapValue: number | null; progressPercent: number;
  targetRecommendationIndex: number; isUnplayed: boolean;
};
export type TargetRecommendationsPayload = {
  model: RecommendationModel; target: TargetRecommendationKey; candidateCount: number;
  requiredCount: number; isEnough: boolean; items: TargetRecommendationItem[];
};
