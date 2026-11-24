import { fixture, portfolio, record, seal } from './fixtures.ts';
import { crown } from './type-fixtures.ts';
import { hash } from '../../utils/multi-objective/common.ts';
export function goalFixture() {
  const f = fixture(), score = f.candidates[0]!, dfFixture = crown('dondaful_combo'), df = dfFixture.candidates[0]!;
  score.subtype = 'score_pb'; score.target = { kind: 'score', threshold: 900001, comparison: 'gte', baselineRef: 'baseline-score', definitionVersion: 'target/1', horizon: 'near_term' };
  score.targetHash = hash(score.target); score.actionability.targetHash = score.targetHash; score.actionability.evaluatorId = 'b4-contract:score_pb';
  df.target.horizon = 'long_term'; df.targetHash = hash(df.target); df.actionability.targetHash = df.targetHash;
  df.readiness = 'not_actionable'; df.actionability.readiness = 'not_actionable'; df.actionability.confidence.level = 'unknown'; df.actionability.reasonCodes = ['REGISTERED_EVALUATOR_DECLINED']; df.actionability.missingEvidence = [];
  f.candidates.push(df);
  for (const r of dfFixture.evidence) if (!f.evidence.some(e => e.ref.id === r.ref.id)) f.evidence.push(r);
  f.evidence.push(record('baseline-score', 'goal_baseline', 'goal-portfolio', score.chartId, score.catalogRevision, { type: 'goal_baseline', goalType: 'score-pb', highScore: 900000, total: null, ng: null, mode: null, platform: null }));
  f.evidence.push(record('baseline-df', 'goal_baseline', 'goal-portfolio', score.chartId, score.catalogRevision, { type: 'goal_baseline', goalType: 'df', highScore: null, total: null, ng: null, mode: null, platform: null }));
  const p = portfolio(f);
  for (const [c, id, goalType, baselineRef, priority] of [[score, 'goal-score', 'score-pb', 'baseline-score', 1], [df, 'goal-df', 'df', 'baseline-df', 3]] as const) p.goals.push({ id, profileId: c.profileId, chartId: c.chartId, identityMappingRef: c.identityMappingRef, goalType, goalRevision: `${id}/1`, baselineRef, target: structuredClone(c.target), targetHash: c.targetHash, lifecycleStatus: 'active', availability: 'available', userPriority: priority, userOrder: 0, actionability: structuredClone(c.actionability), evaluationRef: null });
  return seal(f);
}
