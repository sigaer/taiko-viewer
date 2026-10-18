// Generated from schema/contract-v1.json. Run tools/generate_bindings.py.
export const CONTRACT_VERSION = "1.1" as const;
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
  song_name: string | null;
  song_name_jp: string | null;
  aliases: Array<string>;
  catalogRevision: string | null;
  availability?: CatalogAvailability;
};
export type Chart = {
  songId: string;
  chartId: string;
  difficulty: number;
  level: number | null;
  type: "single" | "double" | "unknown";
  variant: string | null;
  catalogRevision: string | null;
  availability?: CatalogAvailability;
  tjaCourse?: number;
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
export type CatalogAvailability = {
  region: "CN" | "JP" | "UNKNOWN";
  status: "active" | "removed" | "unknown";
};
export type ResourceGrant = {
  grantId: string;
  ownerUserId: string;
  bindingId: string;
  playerId: string;
  clientId: string;
  audience: "viewer:developer-api:v1";
  scopes: Array<"profile:read" | "scores:read" | "history:read" | "growth:read" | "account:read">;
  consentVersion: string;
  consentedAt: string;
  issuedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  revision: string;
};
export type DeveloperClient = {
  clientId: string;
  displayName: string;
  status: "active" | "disabled";
};
export type DeveloperPlayerProfile = {
  playerId: string;
  bindingId: string;
  displayName: string | null;
  source: string;
  taikoId?: string;
  title?: string | null;
  dan?: DeveloperDan;
};
export type ApiReadVersions = {
  contractVersion: "1.1";
  schemaRevision: string;
  catalogRevision: string;
  scoreRevision: string | null;
  calculationProfile: null;
  observationSource: string | null;
  capturedAt: string | null;
};
export type DeveloperScoresResponse = {
  versions: ApiReadVersions;
  playerId: string;
  items: Array<Score>;
};
export type DeveloperProfileResponse = {
  versions: ApiReadVersions;
  profile: DeveloperPlayerProfile;
};
export type CatalogSongsResponse = {
  versions: ApiReadVersions;
  items: Array<Song>;
};
export type CatalogChartsResponse = {
  versions: ApiReadVersions;
  items: Array<Chart>;
};
export type ApiError = {
  code: string;
  message: string;
  requestId: string;
};
export type DeveloperDan = {
  equippedGrade: number | null;
  equippedLevel: number | null;
  highestPassedGrade: number | null;
};
export type CatalogSongWithCharts = {
  songId: string;
  song_name: string | null;
  song_name_jp: string | null;
  aliases: Array<string>;
  catalogRevision: string | null;
  availability?: CatalogAvailability;
  charts: Array<Chart>;
};
export type CatalogSongsWithChartsResponse = {
  versions: ApiReadVersions;
  items: Array<CatalogSongWithCharts>;
};
export { fromLegacyScore, toLegacyScore } from "./legacy.mjs";
export { legacyScoreReader, legacyScoreValue, legacyCrown, legacyJudgmentTotal, legacyScoreInstant, hasLegacyScoreEvidence } from "./read-values.mjs";
