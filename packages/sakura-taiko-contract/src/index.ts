// Generated from schema/contract-v1.json. Run tools/generate_bindings.py.
export const CONTRACT_VERSION = "1.0" as const;
export type ExternalIdentity = {
  namespace: "wahlap" | "hiroba" | "qq" | "onebot" | "manual" | "legacy-content";
  id: string;
};
export type User = {
  id: string;
  namespace: "viewer";
  displayName: string | null;
};
export type Binding = {
  id: string;
  userId: string;
  externalIdentity: ExternalIdentity;
  isCurrent: boolean;
  verifiedAt: string | null;
};
export type DeveloperIdentity = {
  id: string;
  ownerUserId: string;
  scopes: Array<string>;
};
export type Song = {
  songId: string;
  title: string | null;
  catalogRevision: string | null;
};
export type Chart = {
  songId: string;
  chartId: string;
  difficulty: number;
  level: number | null;
  type: "single" | "double" | "unknown";
  variant: string | null;
  catalogRevision: string | null;
};
export type ScoreCounts = {
  clear: number | null;
  fullCombo: number | null;
  dondafulCombo: number | null;
  stage: number | null;
  roll: number | null;
};
export type Score = {
  song: Song;
  chart: Chart;
  score: number | null;
  good: number | null;
  ok: number | null;
  ng: number | null;
  combo: number | null;
  clear: boolean | null;
  fullCombo: boolean | null;
  dondafulCombo: boolean | null;
  rank: number | null;
  capturedAt: string | null;
  source: string;
  counts: ScoreCounts;
  highscoreAt: string | null;
  updatedAt: string | null;
  legacy?: Record<string, unknown>;
};
export type GrowthObservation = {
  token: string;
  orderKey: string;
  revision: string;
  contentRevision: string | null;
  observedAt: string;
  source: string;
  eventDays: Array<string>;
  evidenceLevel: "L0" | "L1";
  excludedReason: null | "import" | "manual" | "repair" | "content-edit" | "dispatcher-transfer" | "counter-regression" | "unknown-source" | "source-switch" | "discontinuity-baseline";
};
export type GrowthTemporal = {
  attributedDay?: string | null;
  occurredAt?: string | null;
  observedAt?: string | null;
  confirmedAt?: string | null;
  precision: "instant" | "day" | "observation" | "unknown";
};
export type GrowthEvidence = {
  source: "score-history" | "goal";
  sourceRevision?: string;
  evidenceVersion: number;
  provenance?: unknown;
};
export type CanonicalFact = {
  id: string;
  factKey: string;
  ownerId: string;
  bindingId: string;
  type: "played" | "score-pb" | "ng-reduced" | "combo-improved" | "clear" | "fc" | "df" | "rank-upgrade" | "goal-completed";
  title?: string;
  songId?: number | null;
  difficultyType?: number | null;
  before?: number | null;
  after?: number | null;
  delta?: number | null;
  goalId?: string | null;
  goalType?: string | null;
  evidence: GrowthEvidence;
  temporal: GrowthTemporal;
};
export type GrowthProjection = {
  ownerId: string;
  bindingId: string;
  timezone: "Asia/Shanghai";
  facts: Array<CanonicalFact>;
  projectionVersion: string;
};
export type CalculationProfile = {
  algorithmVersion: "v1-great-only" | "v1-comprehensive" | "v2-center-20261010" | "v2-client-20261010";
  modelRevision: string;
  catalogRevision: string;
  topN: number;
  availabilityRevision: string;
};
export { fromLegacyScore, toLegacyScore } from "./legacy.mjs";
export { legacyScoreReader, legacyScoreValue, legacyCrown, legacyJudgmentTotal, legacyScoreInstant, hasLegacyScoreEvidence } from "./read-values.mjs";
