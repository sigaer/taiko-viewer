import type { GoalBaseline, GoalType } from '../types/player-goal.ts';
export type GoalProvenance = { source: 'wahlap' | 'hiroba'; account: string; topology: string; marker: string; observedAt: string; contentHash: string };
export type GoalObservation = { ownerId: number; profileId: string; songId: number; difficultyType: number; revision: string; capturedAt: string; provenance: GoalProvenance | null; state: GoalBaseline };
export type EvaluationGoal = { ownerId: number; profileId: string; songId: number; difficultyType: number; goalType: GoalType; baseline: GoalBaseline };
export type GoalEvaluation = { outcome: 'completed' | 'active' | 'inconclusive'; reason: string; result?: { goalType: GoalType; before: number; after: number; delta: number; facts: Record<string, number> } };
const valid = (n: unknown): n is number => Number.isSafeInteger(n) && Number(n) >= 0;
export function evaluateGoal(goal: EvaluationGoal, observation: GoalObservation): GoalEvaluation {
  const unknown = (reason: string): GoalEvaluation => ({ outcome: 'inconclusive', reason });
  const b = goal.baseline, f = observation.state, p = b.provenance, q = observation.provenance;
  if (goal.ownerId !== observation.ownerId || goal.profileId !== observation.profileId || goal.songId !== observation.songId || goal.difficultyType !== observation.difficultyType) return unknown('identity');
  if (!/^[a-f0-9]{64}$/.test(b.sourceRevision) || !/^[a-f0-9]{64}$/.test(observation.revision)) return unknown('revision-format');
  if (!p || !q || p.source !== q.source || p.account !== q.account || p.topology !== q.topology) return unknown('provenance');
  if (!(Date.parse(p.observedAt) <= Date.parse(b.capturedAt))) return unknown('baseline-order');
  if (!b.recordPresent || !f.recordPresent || observation.revision === b.sourceRevision || p.contentHash === q.contentHash) return unknown('revision');
  if (!(Date.parse(q.observedAt) > Date.parse(b.capturedAt)) || !(q.marker > p.marker) || !(Date.parse(observation.capturedAt) >= Date.parse(q.observedAt))) return unknown('observation-order');
  for (const key of ['highScore', 'clearCnt', 'fullComboCnt', 'dondafulComboCnt', 'bestScoreRank'] as const) {
    if (valid(b[key]) && valid(f[key]) && f[key] < b[key]) return unknown('reset');
  }
  const done = (before: number, after: number, facts: Record<string, number> = {}): GoalEvaluation => ({outcome: 'completed', reason: 'transition', result: {goalType: goal.goalType, before, after, delta: after-before, facts}});
  const active: GoalEvaluation = {outcome: 'active', reason: 'unchanged'};
  if (goal.goalType === 'score-pb') {
    if (!valid(b.highScore) || !valid(f.highScore)) return unknown('score');
    return f.highScore > b.highScore ? done(b.highScore, f.highScore) : active;
  }
  if (goal.goalType === 'ng-reduced') {
    const a = [b.goodCnt,b.okCnt,b.ngCnt], z = [f.goodCnt,f.okCnt,f.ngCnt];
    if (!a.every(valid) || !z.every(valid)) return unknown('judgements');
    const total = (a as number[]).reduce((x,y)=>x+y,0);
    if (!total || total !== (z as number[]).reduce((x,y)=>x+y,0)) return unknown('note-count');
    return f.ngCnt! < b.ngCnt! ? done(b.ngCnt!,f.ngCnt!,{total}) : active;
  }
  if (goal.goalType === 'rank-upgrade') {
    if (!valid(b.bestScoreRank) || !valid(f.bestScoreRank) || b.bestScoreRank < 1 || b.bestScoreRank >= 8 || f.bestScoreRank < 1 || f.bestScoreRank > 8) return unknown('rank');
    return f.bestScoreRank > b.bestScoreRank ? done(b.bestScoreRank,f.bestScoreRank) : active;
  }
  const keys = {clear:['clearCnt','fullComboCnt','dondafulComboCnt'],fc:['fullComboCnt','dondafulComboCnt'],df:['dondafulComboCnt']} as const;
  if (!(goal.goalType in keys)) return unknown('unsupported');
  const fields = keys[goal.goalType as keyof typeof keys];
  if (fields.some(k=>!valid(b[k]) || b[k] !== 0 || !valid(f[k]))) return unknown('crown');
  const found = fields.find(k=>f[k]! > b[k]!);
  return found ? done(b[found]!,f[found]!,Object.fromEntries(fields.map(k=>[k,f[k]!])) ) : active;
}
