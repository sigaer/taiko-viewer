import type { GrowthFact, GrowthFactType, SkillPassportMilestone } from '../../../types/player-growth.ts';
import { growthCalendarDay } from '../../../utils/playerGrowth.ts';
import { matchGoalFactToScoreFact } from '../growth-weekly/composer.ts';

const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const priorities: Partial<Record<GrowthFactType, number>> = { df: 100, fc: 90, clear: 80, 'rank-upgrade': 76, 'ng-reduced': 62, 'score-pb': 54, 'combo-improved': 44 };
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const chartKey = (fact: GrowthFact) => `${fact.ownerId}:${fact.bindingId}:${fact.songId}:${fact.difficultyType}`;
const groupKey = (fact: GrowthFact) => `${chartKey(fact)}:${fact.temporal.attributedDay}:${fact.temporal.precision}`;
const relativeMagnitude = (fact: GrowthFact) => finite(fact.before) && finite(fact.after) ? Math.abs(fact.after - fact.before) / Math.max(1, Math.abs(fact.before)) : 0;
export const passportMilestoneDay = (node: SkillPassportMilestone) => node.day || (node.observedAt ? growthCalendarDay(node.observedAt) : '');
type Candidate = { node: SkillPassportMilestone; facts: GrowthFact[]; chart: string; day: string; importance: number; magnitude: number };
const qualityOrder = (a: Candidate, b: Candidate) => b.importance - a.importance || b.magnitude - a.magnitude || compare(a.day, b.day) || compare(a.chart, b.chart) || compare(a.node.factKeys[0] || '', b.node.factKeys[0] || '');
const timeOrder = (a: SkillPassportMilestone, b: SkillPassportMilestone) => compare(passportMilestoneDay(b), passportMilestoneDay(a)) || compare(a.id, b.id);

// This projection keeps canonical facts untouched. Precision and ownership are
// part of the grouping key; observed Goals never acquire an invented play day.
function candidatesFromFacts(facts: GrowthFact[]): Candidate[] {
  const unique = [...facts].sort((a, b) => compare(a.factKey, b.factKey));
  const scores = unique.filter(fact => fact.evidence.source === 'score-history' && priorities[fact.type] && fact.temporal.attributedDay && fact.songId && fact.difficultyType && ['day', 'instant'].includes(fact.temporal.precision));
  const groups = new Map<string, GrowthFact[]>();
  const byChart = new Map<string, GrowthFact[]>();
  for (const fact of scores) {
    const key = groupKey(fact);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(fact);
    const chart = chartKey(fact);
    if (!byChart.has(chart)) byChart.set(chart, []);
    byChart.get(chart)!.push(fact);
  }
  const links = new Map<string, GrowthFact[]>(), observations: GrowthFact[] = [];
  for (const goal of unique.filter(fact => fact.type === 'goal-completed' && fact.evidence.source === 'goal')) {
    // The shared matcher accepts revision or before/after equality. Require an
    // actual revision or finite values, rather than matching missing fields.
    const eligible = (byChart.get(chartKey(goal)) || []).filter(score => score.ownerId === goal.ownerId && (
      Boolean(goal.evidence.sourceRevision) && score.evidence.sourceRevision === goal.evidence.sourceRevision
      || finite(goal.before) && finite(goal.after) && score.before === goal.before && score.after === goal.after
    ));
    const score = matchGoalFactToScoreFact(goal, eligible);
    if (score) {
      const key = groupKey(score);
      if (!links.has(key)) links.set(key, []);
      links.get(key)!.push(goal);
    } else observations.push(goal);
  }
  const candidates: Candidate[] = [];
  for (const [key, group] of groups) {
    group.sort((a, b) => (priorities[b.type] || 0) - (priorities[a.type] || 0) || relativeMagnitude(b) - relativeMagnitude(a) || compare(a.factKey, b.factKey));
    const primary = group[0]!, goals = links.get(key) || [], support = [...group, ...goals];
    const node: SkillPassportMilestone = {
      id: `milestone:${key}`, primaryType: primary.type as SkillPassportMilestone['primaryType'],
      factKeys: support.map(fact => fact.factKey).sort(compare), day: primary.temporal.attributedDay!,
      observedAt: primary.temporal.observedAt || null, timeSemantics: 'played', title: primary.title || `#${primary.songId}`,
      songId: primary.songId!, difficultyType: primary.difficultyType!, before: primary.before ?? null, after: primary.after ?? null,
      delta: primary.delta ?? null, goalCompleted: goals.length > 0, observationOnly: false
    };
    candidates.push({ node, facts: support, chart: chartKey(primary), day: node.day!, importance: priorities[primary.type]! + (goals.length ? 12 : 0), magnitude: Math.max(...group.map(relativeMagnitude)) });
  }
  for (const goal of observations) {
    const node: SkillPassportMilestone = {
      id: `milestone:goal:${goal.ownerId}:${goal.bindingId}:${goal.factKey}`, primaryType: 'goal-completed', factKeys: [goal.factKey], day: null,
      observedAt: goal.temporal.observedAt || goal.temporal.confirmedAt || null, timeSemantics: 'observed', title: goal.title || `#${goal.songId || 'goal'}`,
      songId: goal.songId || null, difficultyType: goal.difficultyType || null, before: goal.before ?? null, after: goal.after ?? null, delta: goal.delta ?? null,
      goalCompleted: true, observationOnly: true
    };
    candidates.push({ node, facts: [goal], chart: goal.songId && goal.difficultyType ? chartKey(goal) : node.id, day: passportMilestoneDay(node), importance: 76, magnitude: relativeMagnitude(goal) });
  }
  return candidates;
}

// Frozen presentation quality policy; no fact creation or changes to canonical evidence.
// Score intervals come from the existing rank ladder, with a 50k comparison unit
// beyond the final rank (never a new rank or an achievement threshold).
const scoreStep = (before: number) => before >= 900000 ? 50000 : 100000;
const positivePB = (fact: GrowthFact) => fact.type === 'score-pb' && finite(fact.before) && fact.before > 0 && finite(fact.after) && fact.after > fact.before && (!finite(fact.delta) || fact.delta === fact.after - fact.before);
const pbFloor = (fact: GrowthFact) => positivePB(fact) && fact.after! - fact.before! >= fact.before! * .005 && fact.after! - fact.before! >= scoreStep(fact.before!) * .1;
type Quality = { tier: 'A' | 'B' | 'C'; band: number; basis: string; magnitude: number; reliable: boolean };
const rejected = (basis: string, reliable = false): Quality => ({ tier: 'C', band: 0, basis, magnitude: 0, reliable });
const evidenceValid = (fact: GrowthFact) => Boolean(fact.ownerId && fact.bindingId && fact.factKey) && Number.isInteger(fact.evidence.evidenceVersion) && fact.evidence.evidenceVersion > 0;
function factQuality(fact: GrowthFact, upperQuartile: number, audit: boolean): Quality {
  if (!evidenceValid(fact)) return rejected('insufficient-evidence');
  if (fact.type === 'goal-completed') return fact.evidence.source === 'goal' && fact.goalId && fact.goalType && (fact.temporal.observedAt || fact.temporal.confirmedAt)
    ? { tier: 'A', band: 76, basis: 'canonical-completed-goal', magnitude: 0, reliable: true } : rejected('incomplete-goal-evidence');
  if (fact.evidence.source !== 'score-history' || !fact.temporal.attributedDay || !Number.isFinite(Date.parse(fact.temporal.attributedDay)) || !['day', 'instant'].includes(fact.temporal.precision)) return rejected('unreliable-source-or-time');
  const { before, after } = fact;
  if (!finite(before) || !finite(after)) return rejected('missing-finite-baseline');
  if (finite(fact.delta) && fact.delta !== after - before) return rejected('contradictory-delta');
  if (['df', 'fc', 'clear'].includes(fact.type)) {
    const target = fact.type === 'df' ? 2 : fact.type === 'fc' ? 1 : 0;
    // Growth canonical crown is -1 / 0 / 1 / 2, not a play counter.
    return Number.isInteger(before) && before >= -1 && before < target && after === target
      ? { tier: 'A', band: priorities[fact.type]!, basis: 'canonical-new-crown', magnitude: target - before, reliable: true } : rejected('invalid-crown-transition');
  }
  if (fact.type === 'rank-upgrade') return Number.isInteger(before) && Number.isInteger(after) && before >= 1 && after <= 8 && after > before
    ? { tier: 'A', band: 76, basis: audit ? `rank-ladder:${before}->${after}` : 'rank-ladder', magnitude: after - before, reliable: true } : rejected('invalid-rank-transition');
  if (fact.type === 'ng-reduced') {
    if (!Number.isInteger(before) || !Number.isInteger(after) || after < 0 || before <= after) return rejected('invalid-ng-transition');
    const reduction = before - after, ratio = reduction / before;
    if (after === 0) return { tier: 'A', band: 90, basis: audit ? `ng-zero-full-combo:${before}->0` : 'ng-zero-full-combo', magnitude: ratio, reliable: true };
    return reduction >= 2 && ratio >= .3
      ? { tier: 'B', band: ratio >= .75 ? 2 : 1, basis: audit ? `ng:${before}->${after};reduction=${reduction};ratio=${ratio.toFixed(4)}` : 'material-ng', magnitude: ratio, reliable: true }
      : rejected(audit ? `ordinary-ng:reduction=${reduction};ratio=${ratio.toFixed(4)}` : 'ordinary-ng', true);
  }
  if (fact.type === 'score-pb') {
    if (!positivePB(fact)) return rejected('invalid-pb-transition');
    const gain = after - before, ratio = gain / before, ladder = gain / scoreStep(before);
    const basis = audit ? `pb:gain=${gain};baseline=${before};relative=${ratio.toFixed(6)};ladder=${ladder.toFixed(4)};q75=${upperQuartile.toFixed(6)}` : 'material-pb';
    return pbFloor(fact) && (ratio >= .01 || ladder >= .2 || ratio >= upperQuartile)
      ? { tier: 'B', band: ratio >= .03 || ladder >= .5 ? 2 : 1, basis, magnitude: ratio, reliable: true } : rejected(`ordinary-${basis}`, true);
  }
  return rejected('ordinary-combo-or-play', after > before && before >= 0);
}
export type PassportSelectionTrace = {
  candidateId: string; factKeys: string[]; qualityTier: Quality['tier']; materialityBasis: string;
  primaryFact: string; selectionRank: number | null; selected: boolean; reason: string; bucket: number | null;
};
function curate(facts: GrowthFact[], period: { from: string; to: string }, limit: number, initialLimit: number, audit: boolean) {
  const unique = [...new Map(facts.map(fact => [fact.factKey, fact])).values()];
  const eligibleRatios = unique.filter(fact => evidenceValid(fact) && fact.evidence.source === 'score-history' && fact.temporal.attributedDay && ['day','instant'].includes(fact.temporal.precision) && fact.temporal.attributedDay >= period.from && fact.temporal.attributedDay <= period.to && pbFloor(fact)).map(relativeMagnitude).sort((a,b) => a-b);
  const upperQuartile = eligibleRatios.length ? eligibleRatios[Math.ceil(eligibleRatios.length * .75) - 1]! : Infinity;
  const days = Math.max(1, Math.round((Date.parse(period.to) - Date.parse(period.from)) / 86400000) + 1);
  const bucketFor = (day: string) => Math.min(2, Math.max(0, Math.floor((Date.parse(day) - Date.parse(period.from)) / 86400000 * 3 / days)));
  const trace: PassportSelectionTrace[] = [];
  const candidates = candidatesFromFacts(unique).map(candidate => {
    const entries = candidate.facts.map(fact => ({ fact, quality: factQuality(fact, upperQuartile, audit) }));
    entries.sort((a,b) => rankQuality(a.quality,b.quality) || (priorities[b.fact.type] || 0) - (priorities[a.fact.type] || 0) || b.quality.magnitude - a.quality.magnitude || compare(a.fact.factKey,b.fact.factKey));
    let { fact: primary, quality } = entries[0]!;
    if (quality.tier === 'C') {
      const pb = entries.find(e => e.quality.reliable && positivePB(e.fact) && e.fact.after! - e.fact.before! >= e.fact.before! * .0025 && e.fact.after! - e.fact.before! >= scoreStep(e.fact.before!) * .05);
      const ng = entries.find(e => e.quality.reliable && e.fact.type === 'ng-reduced' && e.fact.before! - e.fact.after! >= 2 && relativeMagnitude(e.fact) >= .2);
      if (pb && ng) { primary = ng.fact; quality = { tier: 'B', band: 1, basis: 'corroborated-pb-and-ng-minimums', magnitude: relativeMagnitude(ng.fact), reliable: true }; }
    }
    candidate.node.primaryType = primary.type as SkillPassportMilestone['primaryType'];
    candidate.node.before = primary.before ?? null;
    candidate.node.after = primary.after ?? null;
    candidate.node.delta = primary.delta ?? null;
    candidate.node.goalCompleted = entries.some(entry => entry.fact.type === 'goal-completed' && entry.quality.tier === 'A');
    const row: PassportSelectionTrace | undefined = audit ? {candidateId: candidate.node.id, factKeys: candidate.node.factKeys, qualityTier: quality.tier, materialityBasis: quality.basis, primaryFact: primary.factKey, selectionRank: null, selected: false, reason: quality.tier === 'C' ? 'quality-gate:' + quality.basis : candidate.day < period.from || candidate.day > period.to ? 'outside-window' : 'capacity', bucket: Number.isFinite(Date.parse(candidate.day)) ? bucketFor(candidate.day) : null} : undefined;
    if(row)trace.push(row);
    const kind = primary.type === 'ng-reduced' && primary.after === 0 ? 'fc' : primary.type;
    return {...candidate, entries, primary, kind, quality, bucket: bucketFor(candidate.day), trace: row};
  }).filter(item => item.quality.tier !== 'C' && item.day >= period.from && item.day <= period.to).sort((a,b) => rankQuality(a.quality,b.quality) || b.quality.magnitude - a.quality.magnitude || qualityOrder(a,b));
  const selected = new Set<string>(), charts = new Map<string, Set<string>>(), dayCounts = new Map<string,number>(), typeCounts = new Map<string,number>(), buckets = new Set<number>();
  const chosen: typeof candidates = [];
  const cap = Math.min(24,Math.max(0,Math.floor(limit)));
  const diversityPenalty = (item: typeof candidates[number]) => (charts.has(item.chart) ? 8 : 0) + ((dayCounts.get(item.day) || 0) >= 2 ? 4 : 0) + ((typeCounts.get(item.kind) || 0) >= 3 ? 2 : 0) + (buckets.has(item.bucket) ? 1 : 0);
  while(chosen.length < cap) {
    let best: typeof candidates[number] | undefined;
    let bestPenalty = Infinity;
    for(const item of candidates) {
      if(best && rankQuality(item.quality,best.quality) > 0)break;
      if(selected.has(item.node.id))continue;
      const previous = charts.get(item.chart);
      if(previous && (item.quality.tier !== 'A' || previous.has(item.kind))) { if(item.trace)item.trace.reason='same-chart';continue; }
      const penalty = diversityPenalty(item);
      if(!best || penalty < bestPenalty || penalty === bestPenalty && (item.quality.magnitude > best.quality.magnitude || item.quality.magnitude === best.quality.magnitude && qualityOrder(item,best) < 0)) { best=item; bestPenalty=penalty; }
    }
    if(!best)break;
    const exceptions = [(dayCounts.get(best.day) || 0) >= 2 ? 'soft-day-exception' : '', (typeCounts.get(best.kind) || 0) >= 3 ? 'soft-type-exception' : '', charts.has(best.chart) ? 'distinct-achievement-chart-exception' : ''].filter(Boolean);
    chosen.push(best);selected.add(best.node.id);
    if(best.trace){best.trace.selected=true;best.trace.selectionRank=chosen.length;best.trace.reason=['selected:quality-first',...exceptions].join(';');}
    if(!charts.has(best.chart))charts.set(best.chart,new Set());charts.get(best.chart)!.add(best.kind);
    dayCounts.set(best.day,(dayCounts.get(best.day)||0)+1);typeCounts.set(best.kind,(typeCounts.get(best.kind)||0)+1);buckets.add(best.bucket);
  }
  if(audit) {
    const represented = new Set(trace.flatMap(row => row.factKeys));
    for(const fact of unique.filter(fact => !represented.has(fact.factKey)).sort((a,b) => compare(a.factKey,b.factKey))) trace.push({candidateId:'excluded:'+fact.factKey,factKeys:[fact.factKey],qualityTier:'C',materialityBasis:'unsupported-type-or-missing-chart-time',primaryFact:fact.factKey,selectionRank:null,selected:false,reason:'insufficient-evidence-or-unsupported-type',bucket:null});
    trace.sort((a,b) => compare(a.candidateId,b.candidateId));
  }
  // Materialize detailed DTOs only for at most 24 selected nodes. Rejected and
  // capacity-limited candidates retain compact facts/quality references.
  const nodes = chosen.map(item => {
    const improvements = item.entries.filter(e => e.quality.reliable && e.fact.type !== 'goal-completed').map(({fact}) => ({type: fact.type as SkillPassportMilestone['primaryType'],before:fact.before ?? null,after:fact.after ?? null,delta:fact.delta ?? null,factKey:fact.factKey}));
    if(item.primary.type === 'goal-completed') improvements.unshift({type:'goal-completed',before:item.primary.before ?? null,after:item.primary.after ?? null,delta:item.primary.delta ?? null,factKey:item.primary.factKey});
    return {...item.node, improvements, evidenceRefs:item.facts.map(fact => ({factKey:fact.factKey,source:fact.evidence.source,sourceRevision:fact.evidence.sourceRevision,evidenceVersion:fact.evidence.evidenceVersion}))};
  });
  return { milestones: [...nodes].sort(timeOrder), initialIds: nodes.slice(0,Math.min(8,Math.max(0,initialLimit))).sort(timeOrder).map(node => node.id), trace };
}
function rankQuality(a: Quality,b: Quality) { return (a.tier === 'A' ? 0 : a.tier === 'B' ? 1 : 2) - (b.tier === 'A' ? 0 : b.tier === 'B' ? 1 : 2) || b.band - a.band; }
export function curateSkillPassportMilestones(facts: GrowthFact[], period: {from:string;to:string}, limit=24, initialLimit=8) {
  const {milestones,initialIds}=curate(facts,period,limit,initialLimit,false);return {milestones,initialIds};
}
// Explicit audit only: never serialized into the Passport production DTO.
export function auditSkillPassportMilestones(facts: GrowthFact[], period: {from:string;to:string}, limit=24, initialLimit=8) { return curate(facts,period,limit,initialLimit,true); }

export function buildSkillPassportMilestones(facts: GrowthFact[], period?: { from: string; to: string }): SkillPassportMilestone[] {
  const days = facts.map(fact => fact.temporal.attributedDay || (fact.temporal.observedAt ? growthCalendarDay(fact.temporal.observedAt) : '')).filter(Boolean).sort(compare);
  return curateSkillPassportMilestones(facts, period || { from: days[0] || '', to: days.at(-1) || '' }).milestones;
}
