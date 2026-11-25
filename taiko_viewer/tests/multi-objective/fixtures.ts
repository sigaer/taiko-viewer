/** Synthetic B4 fixtures only. No player data or production reads. */
import type { CatalogAuthoritySnapshot, ComposeOptions, EvidenceRecord, MultiObjectiveCandidate, ValidationContext, Target, GoalPortfolioSnapshot } from '../../utils/multi-objective/contracts.ts';
import { B4_SCHEMA, POLICY_VERSION } from '../../utils/multi-objective/contracts.ts';
import { hash, candidateId } from '../../utils/multi-objective/common.ts';
import { createDecisionId } from '../../utils/multi-objective/context.ts';
import { prepareEvidence, referencedEvidence } from '../../utils/multi-objective/evidence.ts';
import { prepareAuthority, resolveCanonicalChartIdentity } from '../../utils/multi-objective/identity.ts';
import { evaluatorCapability, PREDICTION_MODEL, PREDICTION_RULE } from '../../utils/multi-objective/registries.ts';
import { createComposeInputsHash } from '../../utils/multi-objective/composer.ts';
export const NOW = '2026-11-24T00:00:00.000Z';
export type Fixture = { context: ValidationContext; candidates: MultiObjectiveCandidate[]; options: ComposeOptions; evidence: EvidenceRecord[] };
export function record(id: string, kind: EvidenceRecord['ref']['kind'], source: string, chartId: string | null, revision: string, payload: Record<string, unknown>, modelVersion: string | null = null): EvidenceRecord {
  return { schemaVersion: 'b4-evidence/1', ref: { id, kind, source, sourceRevision: ['catalog', 'chart_feature'].includes(kind) ? revision : 'scores/1', contentHash: hash(payload), profileId: ['catalog', 'chart_feature'].includes(kind) ? null : 'player-synthetic', chartId, catalogRevision: revision, modelVersion, occurredAt: null, observedAt: NOW, confirmedAt: null, knownAt: NOW, fieldSemanticsVersion: 'b4-evidence/1' }, payload };
}
export function fixture(count = 1): Fixture {
  const revision = hash('synthetic-authority'), sourceHash = hash('synthetic-chart');
  const catalog: CatalogAuthoritySnapshot = { schemaVersion: 1, policyVersion: 'wahlap-cn-1', catalogRevision: revision, sourceAliases: [], charts: {} };
  for (let n = 1; n <= count; n++) {
    const songId = `song:persistent-${n}`;
    catalog.sourceAliases.push({ namespace: 'wahlap', key: String(n), songId, evidence: 'synthetic-explicit-map' });
    catalog.charts[`${n}:4`] = { chartId: `${songId}:course:4`, songId, sourceSongId: n, difficulty: 4, exists: true, sourceHash, policies: { catalog_display: { eligible: true }, cn_current_playable: { eligible: true }, recommendation_eligible: { ordinary: { eligible: true } } } };
  }
  const options: ComposeOptions = { capacities: { A: 5, B: 5, C: 5, D: 5 }, maxTotal: 20, typePreferences: {}, history: { completeFrom: '2026-11-01T00:00:00.000Z', through: NOW, items: [] }, primaryActionByChart: {} };
  const evidence: EvidenceRecord[] = [], candidates: MultiObjectiveCandidate[] = [];
  const context: ValidationContext = { schemaVersion: B4_SCHEMA, decisionId: '', ownerId: 'owner-synthetic', profileId: 'player-synthetic', region: 'CN', catalogRevision: revision, scoreRevision: 'scores/1', portfolioRevision: null, policyVersion: POLICY_VERSION, asOf: NOW, generatedAt: NOW, catalog, evidence, goalBaselineBindings: [], portfolio: null, excludedChartIds: [], decisionInputsHash: hash(options) };
  const ratingSamples = { ratingRef: 'rating', scoreRevision: 'scores/1', modelVersion: 'rating/1', sampleCount: 200, unit: 'rating_result_rows' as const, aggregation: 'per-dimension-top20' as const, topN: 20 as const, duplicateHandling: 'preserve' as const };
  evidence.push(record('rating', 'rating', 'rating-projection', null, revision, { type: 'rating', samples: structuredClone(ratingSamples), dimensions: { big_song: 8, stamina: 9, speed: 8, accuracy_power: 9, rhythm: 10, complex: 7 } }, 'rating/1'));
  const authority = prepareAuthority(catalog);
  for (let n = 1; n <= count; n++) {
    const resolved = resolveCanonicalChartIdentity(authority, { namespace: 'wahlap', sourceId: String(n), difficulty: 4, catalogRevision: revision, region: 'CN', businessPolicy: 'cn_current_playable', modelProfile: null });
    if (resolved.status !== 'RESOLVED') throw Error('fixture identity');
    const identity = resolved.value, chartId = identity.chartId;
    const predictionSamples = { estimateRef: `estimate-${n}`, chartId, scoreRevision: 'scores/1', modelVersion: PREDICTION_MODEL, featureCutoff: NOW, unit: 'comparable_chart_records' as const, targetIdentityExcluded: true, poolKind: 'pooled' as const, poolCount: null, stableNeighborCount: 8, pbNeighborCount: 10, dataSufficiency: 'ok', sufficiencyRuleRef: PREDICTION_RULE, evidenceRefs: [`catalog-${n}`] };
    evidence.push(record(`catalog-${n}`, 'catalog', 'catalog-authority', chartId, revision, { type: 'catalog', sourceHash }));
    evidence.push(record(`estimate-${n}`, 'estimate', 'core-estimator', chartId, revision, { type: 'score_estimate', currentBestScore: 900000, stableScore: 1000000, pbScore: 1020000, scoreUpperBound: 1200000, reliability: .8, samples: structuredClone(predictionSamples) }, PREDICTION_MODEL));
    evidence.push(record(`snapshot-${n}`, 'score_snapshot', 'score-projection', chartId, revision, { type: 'score_snapshot', currentBestScore: 900000, rank: 5, crowns: { clear: false, full_combo: false, dondaful_combo: false }, judgeTotal: 1000, ng: 10, platform: 'synthetic-cabinet', mode: 'normal' }));
    const target: Target = { kind: 'score', threshold: 950000, comparison: 'gte', baselineRef: null, horizon: 'near_term', definitionVersion: 'target/1' };
    const actionability = { evaluatorId: 'b4-contract:score_target', evaluatorVersion: '1', policyVersion: POLICY_VERSION, evaluationScope: 'target_actionability' as const, evaluatedAt: NOW, asOf: NOW, targetHash: hash(target), readiness: 'ready_now' as const, evidenceRefs: ['rating', `estimate-${n}`], confidence: { subject: 'evidence_sufficiency' as const, level: 'high' as const, basisRefs: ['rating', `estimate-${n}`], sourceReliability: { value: .8, scale: '0..1' as const, modelVersion: PREDICTION_MODEL } }, missingEvidence: [], limitations: ['MODEL_ESTIMATE_NOT_ATTEMPT_DISTRIBUTION', 'CONFIDENCE_NOT_SUCCESS_PROBABILITY'], reasonCodes: ['SCORE_STABLE_SUPPORTED'] };
    candidates.push({ schemaVersion: 'candidate/1', candidateId: '', decisionId: '', profileId: context.profileId, region: 'CN', songId: n, sourceNamespace: 'wahlap', legacyChartKey: `${n}:4`, ...identity, catalogRevision: revision, sourceHash, scoreRevision: context.scoreRevision, portfolioRevision: null, policyVersion: POLICY_VERSION, generatedAt: NOW, asOf: NOW, intentType: 'score_improvement', subtype: 'score_target', goalIds: [], goalLinks: [], source: { kind: 'ordinary', sourceRevision: 'source/1', generatedAt: NOW, baselineRank: n, generatorVersion: 'synthetic/1', evidenceRefs: [`catalog-${n}`] }, playerEvidence: { snapshotRefs: [`snapshot-${n}`], ratingRef: 'rating', estimateRef: `estimate-${n}`, coverageRef: null, attemptRefs: [], ratingSamples: structuredClone(ratingSamples), predictionSamples, recordSemantics: 'aggregate_or_unknown', recordState: 'played_known' }, chartEvidence: { availability: 'active', catalogRef: `catalog-${n}`, featureRefs: [], verifiedDimensions: [] }, target, targetHash: hash(target), readiness: 'ready_now', actionability, evidenceRefs: [], diagnostics: { reasonCodes: [...actionability.reasonCodes], missingEvidence: [], limitations: [...actionability.limitations], canCreateGoal: false, unsupportedGoalTypes: [] } });
    // sourceSongId belongs only to IdentityResolution, not Candidate.
    delete (candidates.at(-1)! as unknown as Record<string, unknown>).sourceSongId;
  }
  return seal({ context, candidates, options, evidence });
}
export function seal(f: Fixture): Fixture {
  f.context.evidence = f.evidence;
  for (const r of f.evidence) r.ref.contentHash = hash(r.payload);
  // Synthetic resolver captures each baseline once; subsequent seals never rebind it.
  f.context.goalBaselineBindings = [...f.context.goalBaselineBindings];
  for (const r of f.evidence) if (r.payload.type === 'goal_baseline' && !f.context.goalBaselineBindings.some(b => b.baselineRef === r.ref.id)) {
    f.context.goalBaselineBindings = [...f.context.goalBaselineBindings, { schemaVersion: 'goal-baseline-binding/1', baselineRef: r.ref.id,
      ownerId: f.context.ownerId, profileId: r.ref.profileId!, chartId: r.ref.chartId!, sourceRevision: r.ref.sourceRevision, evidenceHash: hash(r) }];
  }
  f.context.decisionInputsHash = createComposeInputsHash(f.options);
  f.context.decisionId = createDecisionId(f.context);
  const index = prepareEvidence(f.evidence).index;
  for (const c of f.candidates) {
    c.decisionId = f.context.decisionId; c.portfolioRevision = f.context.portfolioRevision;
    c.targetHash = hash(c.target); c.actionability.targetHash = c.targetHash;
    c.actionability.evaluatorId = evaluatorCapability(c.subtype)!.evaluatorId;
    c.actionability.readiness = c.readiness;
    c.diagnostics.reasonCodes = [...c.actionability.reasonCodes]; c.diagnostics.missingEvidence = [...c.actionability.missingEvidence]; c.diagnostics.limitations = [...c.actionability.limitations];
    c.evidenceRefs = referencedEvidence(c, index); c.candidateId = candidateId(c);
  }
  return f;
}
export function stretch(c: MultiObjectiveCandidate) {
  if (c.target.kind !== 'score') throw Error('score only');
  c.target.threshold = 1010000; c.readiness = 'reasonable_stretch'; c.actionability.confidence.level = 'medium'; c.actionability.reasonCodes = ['SCORE_BOUNDED_STRETCH'];
}
export function interest(f: Fixture, index = 0) {
  const c = f.candidates[index]!, id = `interest-${c.songId}`, cov = `coverage-${c.songId}`;
  f.evidence.push(record(id, 'preference', 'user-preference', c.chartId, c.catalogRevision, { type: 'interest', basis: 'explicit_user_interest', reason: 'Synthetic interest' }));
  f.evidence.push(record(cov, 'coverage', 'coverage-projection', c.chartId, c.catalogRevision, { type: 'coverage', region: 'CN', queryExecuted: false, completeness: 'unknown', absenceSemantics: 'unknown', from: null, to: null, difficultyScope: [4], noFilters: null, recordPresent: null }));
  c.intentType = 'discovery'; c.subtype = 'interest_discovery'; c.readiness = 'not_actionable';
  c.target = { kind: 'explore_chart', discoveryMode: 'interest', coverageRef: cov, relevanceRef: id, horizon: 'near_term', definitionVersion: 'target/1' };
  c.playerEvidence = { snapshotRefs: [], ratingRef: null, estimateRef: null, coverageRef: cov, attemptRefs: [], ratingSamples: null, predictionSamples: null, recordSemantics: 'aggregate_or_unknown', recordState: 'coverage_unknown' };
  c.actionability.evaluationScope = 'interest_relevance'; c.actionability.evidenceRefs = [id, cov]; c.actionability.confidence.basisRefs = [id]; c.actionability.confidence.sourceReliability = null;
  c.actionability.reasonCodes = ['DISCOVERY_INTEREST_SUPPORTED', 'LEVEL_MATCH_NOT_ASSESSED']; c.actionability.missingEvidence = ['levelMatch']; c.actionability.limitations = ['INTEREST_NOT_LEVEL_FIT', 'EXPLORE_NOT_PLAYED', 'ABSENCE_SCOPED_TO_SOURCE'];
  return seal(f);
}
export function portfolio(f: Fixture): GoalPortfolioSnapshot {
  const p: GoalPortfolioSnapshot = { schemaVersion: 'goal-portfolio/2', ownerId: f.context.ownerId, profileId: f.context.profileId, portfolioRevision: 'portfolio/1', updatedAt: NOW, goals: [] };
  f.context.portfolio = p; f.context.portfolioRevision = p.portfolioRevision;
  return p;
}
