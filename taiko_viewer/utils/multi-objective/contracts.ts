/** B4-1 shared contracts. Offline only; no B3 wire types are changed. */
export const B4_SCHEMA = 'b4-offline/1' as const;
export const CANDIDATE_SCHEMA = 'candidate/1' as const;
export const POLICY_VERSION = 'viewer-multi-objective/1' as const;
export const SLATE_SCHEMA = 'viewer-slate/1' as const;
export type IntentType = 'score_improvement' | 'crown_completion' | 'dimension_training' | 'discovery' | 'challenge';
export type Readiness = 'ready_now' | 'reasonable_stretch' | 'not_actionable';
export type PriorityGroup = 'A' | 'B' | 'C' | 'D';
export type Target = { horizon: 'near_term' | 'long_term'; definitionVersion: string } & (
  | { kind: 'score'; threshold: number; comparison: 'gte'; baselineRef: string | null }
  | { kind: 'rank'; threshold: number; comparison: 'gte'; requirementRef: string | null }
  | { kind: 'crown'; crown: 'clear' | 'full_combo' | 'dondaful_combo' }
  | { kind: 'ng_reduction'; baselineRef: string; threshold: number; comparison: 'lte'; total: number }
  | { kind: 'dimension_practice'; dimension: { namespace: string; key: string; schemaVersion: string }; practiceDefinitionRef: string; loadEvidenceRef: string }
  | { kind: 'explore_chart'; discoveryMode: 'interest'; coverageRef: string; relevanceRef: string }
  | { kind: 'explore_chart'; discoveryMode: 'level_matched'; coverageRef: string; relevanceRef: string; loadEvidenceRef: string }
  | { kind: 'task_requirement'; taskId: string; taskVersion: string; requirementId: string; requirementRef: string }
  | { kind: 'task_completion'; taskId: string; taskVersion: string; requirementRefs: string[] }
);
export type EvidenceRef = {
  id: string; kind: 'score_snapshot' | 'estimate' | 'catalog' | 'chart_feature' | 'rating' | 'growth' | 'coverage' | 'attempt' | 'task' | 'goal_baseline' | 'preference';
  source: string; sourceRevision: string; contentHash: string | null;
  profileId: string | null; chartId: string | null; catalogRevision: string | null; modelVersion: string | null;
  occurredAt: string | null; observedAt: string | null; confirmedAt: string | null; knownAt: string; fieldSemanticsVersion: string;
};
export type ActionabilityEvaluation = {
  evaluatorId: string; evaluatorVersion: string; policyVersion: string;
  evaluationScope: 'target_actionability' | 'interest_relevance'; evaluatedAt: string; asOf: string; targetHash: string;
  readiness: Readiness; evidenceRefs: string[];
  confidence: { subject: 'evidence_sufficiency'; level: 'high' | 'medium' | 'low' | 'unknown'; basisRefs: string[];
    sourceReliability: { value: number; scale: '0..1'; modelVersion: string } | null };
  missingEvidence: string[]; limitations: string[]; reasonCodes: string[];
};
export type RatingSampleEvidence = {
  ratingRef: string; scoreRevision: string; modelVersion: string; sampleCount: number;
  unit: 'rating_result_rows'; aggregation: 'per-dimension-top20'; topN: 20; duplicateHandling: 'preserve';
};
export type ChartPredictionSampleEvidence = {
  estimateRef: string; chartId: string; scoreRevision: string; modelVersion: string; featureCutoff: string;
  unit: 'comparable_chart_records'; targetIdentityExcluded: boolean | null;
  poolKind: 'same_difficulty' | 'pooled' | 'unknown'; poolCount: number | null;
  stableNeighborCount: number | null; pbNeighborCount: number | null; dataSufficiency: string; sufficiencyRuleRef: string; evidenceRefs: string[];
};
export type GoalLink = {
  goalId: string; goalRevision: string; baselineRef: string; targetHash: string;
  lifecycleStatus: 'active' | 'paused' | 'completed' | 'cancelled'; availability: 'available' | 'unavailable' | 'unknown';
  userPriority: number; userOrder: number; actionability: ActionabilityEvaluation; evaluationRef: string | null;
};
export type MultiObjectiveCandidate = {
  schemaVersion: typeof CANDIDATE_SCHEMA; candidateId: string; decisionId: string; profileId: string; region: 'CN' | 'JP';
  songId: number; sourceNamespace: string; legacyChartKey: string | null; canonicalSongId: string; chartId: string;
  difficultyType: number; identityGroup: string; identityMappingRef: string;
  catalogRevision: string; sourceHash: string | null; scoreRevision: string | null; portfolioRevision: string | null;
  policyVersion: string; generatedAt: string; asOf: string; intentType: IntentType; subtype: string;
  goalIds: string[]; goalLinks: GoalLink[];
  source: { kind: 'ordinary' | 'legacy_target' | 'catalog' | 'goal_portfolio' | 'task'; sourceRevision: string;
    generatedAt: string; baselineRank: number | null; generatorVersion: string; evidenceRefs: string[] };
  playerEvidence: { snapshotRefs: string[]; ratingRef: string | null; estimateRef: string | null; coverageRef: string | null;
    attemptRefs: string[]; ratingSamples: RatingSampleEvidence | null; predictionSamples: ChartPredictionSampleEvidence | null;
    recordSemantics: 'aggregate_or_unknown' | 'verified_attempt'; recordState: 'unplayed_confirmed' | 'no_score_record' | 'coverage_unknown' | 'played_known' };
  chartEvidence: { availability: 'active' | 'removed' | 'unknown'; catalogRef: string; featureRefs: string[]; verifiedDimensions: string[] };
  target: Target; targetHash: string; readiness: Readiness; actionability: ActionabilityEvaluation; evidenceRefs: string[];
  diagnostics: { reasonCodes: string[]; missingEvidence: string[]; limitations: string[]; canCreateGoal: boolean; unsupportedGoalTypes: string[] };
};
export type SlateCard = {
  cardId: string; decisionId: string; chartId: string; identityGroup: string; candidateIds: string[]; primaryCandidateId: string;
  priorityGroup: PriorityGroup; primaryReadiness: Readiness; goalLinks: GoalLink[]; supplementalCandidateIds: string[];
  dedupSuppressedCandidateIds: string[]; repeatReasonCode: string | null;
};
export type SuppressionDiagnostic = { candidateId: string | null; goalId: string | null; reasonCode: string; details: string[] };
export type PriorityGate = { scope: 'planned_slate'; actualExposureVerified: false; N: number; R: number; S: number;
  minReady: number; rate: number | null; hardGatePassed: boolean; optimizationTargetMet: boolean | null; emptyReason: string | null; violations: string[] };
export type Slate = {
  schemaVersion: typeof SLATE_SCHEMA; kernelVersion: typeof B4_SCHEMA; slateId: string; decisionId: string;
  policyVersion: string; asOf: string; portfolioRevision: string | null; groups: Record<PriorityGroup, SlateCard[]>;
  requestedCounts: Record<PriorityGroup, number>; displayableCounts: Record<PriorityGroup, number>;
  qualityGate: PriorityGate; diagnostics: SuppressionDiagnostic[]; shortage: Record<PriorityGroup, number>;
  repeatHistory: 'complete' | 'unknown';
};
/** B4 read-only projection, not a storage model or a new Goal API. */
export type PortfolioGoalSnapshot = {
  id: string; profileId: string; chartId: string | null; identityMappingRef: string | null; goalType: string;
  goalRevision: string; baselineRef: string; target: Target | null; targetHash: string | null;
  lifecycleStatus: GoalLink['lifecycleStatus']; availability: GoalLink['availability']; userPriority: number; userOrder: number;
  actionability: ActionabilityEvaluation; evaluationRef: string | null;
};
export type GoalPortfolioSnapshot = { schemaVersion: 'goal-portfolio/2'; ownerId: string; profileId: string;
  portfolioRevision: string; updatedAt: string; goals: PortfolioGoalSnapshot[] };
/** Actual Authority row shape, not the legacy chart dictionary key. */
export type AuthorityRow = { chartId: string; songId: string; sourceSongId: number; difficulty: number; exists: boolean;
  policies: Record<string, unknown>; [key: string]: unknown };
export type CatalogAuthoritySnapshot = { schemaVersion: number; policyVersion: string; catalogRevision: string;
  sourceAliases: { namespace: string; key: string; songId: string; evidence: string }[];
  charts: Record<string, AuthorityRow>; [key: string]: unknown };
export type IdentityRequest = { namespace: string; sourceId: string; difficulty: number; catalogRevision: string;
  region: 'CN' | 'JP'; businessPolicy: 'catalog_display' | 'cn_current_playable' | 'recommendation_eligible'; modelProfile: string | null };
export type CanonicalIdentity = { canonicalSongId: string; chartId: string; difficultyType: number; identityGroup: string;
  identityMappingRef: string; catalogRevision: string; sourceSongId: number };
export type IdentityResolution = { status: 'RESOLVED'; value: CanonicalIdentity } |
  { status: 'UNRESOLVED' | 'AMBIGUOUS'; reasonCodes: string[] };
export type ValidationIssue = { path: string; code: string };
export type ValidationResult<T> = { ok: true; value: T; issues: [] } | { ok: false; issues: ValidationIssue[] };

/** Evidence resolver transport: frozen outputs of producers, not new predictors.
 * Detailed payload contracts are validated in evidence.ts; unknown fields fail closed. */
export type EvidenceRecord = { schemaVersion: 'b4-evidence/1'; ref: EvidenceRef; payload: Record<string, unknown> };
export type ValidationContext = { schemaVersion: typeof B4_SCHEMA; decisionId: string; ownerId: string; profileId: string;
  region: 'CN' | 'JP'; catalogRevision: string; scoreRevision: string | null; portfolioRevision: string | null;
  policyVersion: typeof POLICY_VERSION; asOf: string; generatedAt: string; catalog: CatalogAuthoritySnapshot;
  evidence: readonly EvidenceRecord[]; portfolio: GoalPortfolioSnapshot | null; excludedChartIds: readonly string[];
  /** B4 offline transport: hash of frozen ComposeOptions, including preference and exposure history. */
  decisionInputsHash: string };
export type ExposureHistory = { completeFrom: string | null; through: string | null;
  items: { profileId: string; chartId: string; identityGroup: string; at: string; targetHash: string }[] };
export type ComposeOptions = { capacities: Record<PriorityGroup, number>; maxTotal: number;
  typePreferences: Partial<Record<IntentType, number>>; history: ExposureHistory;
  /** Stable action selector avoids hashing a candidateId back into its own decisionId. */
  primaryActionByChart: Record<string, { intentType: IntentType; subtype: string; targetHash: string }> };
