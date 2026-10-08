import type { GrowthFact, GrowthFactType, SkillPassportMilestone } from '../../../types/player-growth.ts';
import { growthCalendarDay } from '../../../utils/playerGrowth.ts';
import { matchGoalFactToScoreFact } from '../growth-weekly/composer.ts';

const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const priorities: Partial<Record<GrowthFactType, number>> = { df: 100, fc: 90, clear: 80, 'rank-upgrade': 76, 'ng-reduced': 62, 'score-pb': 54, 'combo-improved': 44 };
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const chartKey = (fact: GrowthFact) => `${fact.ownerId}:${fact.bindingId}:${fact.songId}:${fact.difficultyType}`;
const groupKey = (fact: GrowthFact) => `${chartKey(fact)}:${fact.temporal.attributedDay}:${fact.temporal.precision}`;
const relativeMagnitude = (fact: GrowthFact) => finite(fact.delta) ? Math.abs(fact.delta) / Math.max(1, Math.abs(fact.before || 0)) : 0;
export const passportMilestoneDay = (node: SkillPassportMilestone) => node.day || (node.observedAt ? growthCalendarDay(node.observedAt) : '');
type Candidate = { node: SkillPassportMilestone; chart: string; day: string; importance: number; magnitude: number };
const qualityOrder = (a: Candidate, b: Candidate) => b.importance - a.importance || b.magnitude - a.magnitude || compare(a.day, b.day) || compare(a.chart, b.chart) || compare(a.node.factKeys[0] || '', b.node.factKeys[0] || '');
const timeOrder = (a: SkillPassportMilestone, b: SkillPassportMilestone) => compare(passportMilestoneDay(b), passportMilestoneDay(a)) || compare(a.id, b.id);

// This projection keeps canonical facts untouched. Precision and ownership are
// part of the grouping key; observed Goals never acquire an invented play day.
function candidatesFromFacts(facts: GrowthFact[]): Candidate[] {
  const unique = [...new Map(facts.map(fact => [fact.factKey, fact])).values()].sort((a, b) => compare(a.factKey, b.factKey));
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
      delta: primary.delta ?? null, goalCompleted: goals.length > 0, observationOnly: false,
      improvements: group.map(fact => ({ type: fact.type as SkillPassportMilestone['primaryType'], before: fact.before ?? null, after: fact.after ?? null, delta: fact.delta ?? null, factKey: fact.factKey })),
      evidenceRefs: support.map(fact => ({ factKey: fact.factKey, source: fact.evidence.source, sourceRevision: fact.evidence.sourceRevision, evidenceVersion: fact.evidence.evidenceVersion }))
    };
    candidates.push({ node, chart: chartKey(primary), day: node.day!, importance: priorities[primary.type]! + (goals.length ? 12 : 0), magnitude: Math.max(...group.map(relativeMagnitude)) });
  }
  for (const goal of observations) {
    const node: SkillPassportMilestone = {
      id: `milestone:goal:${goal.ownerId}:${goal.bindingId}:${goal.factKey}`, primaryType: 'goal-completed', factKeys: [goal.factKey], day: null,
      observedAt: goal.temporal.observedAt || goal.temporal.confirmedAt || null, timeSemantics: 'observed', title: goal.title || `#${goal.songId || 'goal'}`,
      songId: goal.songId || null, difficultyType: goal.difficultyType || null, before: goal.before ?? null, after: goal.after ?? null, delta: goal.delta ?? null,
      goalCompleted: true, observationOnly: true,
      evidenceRefs: [{ factKey: goal.factKey, source: goal.evidence.source, sourceRevision: goal.evidence.sourceRevision, evidenceVersion: goal.evidence.evidenceVersion }]
    };
    candidates.push({ node, chart: goal.songId && goal.difficultyType ? chartKey(goal) : node.id, day: passportMilestoneDay(node), importance: 76, magnitude: relativeMagnitude(goal) });
  }
  return candidates;
}

export function curateSkillPassportMilestones(facts: GrowthFact[], period: { from: string; to: string }, limit = 24, initialLimit = 8) {
  const candidates = candidatesFromFacts(facts).filter(item => item.day >= period.from && item.day <= period.to).sort(qualityOrder);
  const days = Math.max(1, Math.round((Date.parse(period.to) - Date.parse(period.from)) / 86400000) + 1);
  const bucketFor = (item: Candidate) => Math.min(2, Math.floor((Date.parse(item.day) - Date.parse(period.from)) / 86400000 * 3 / days));
  const dayCounts = new Map<string, number>(), typeCounts = new Map<string, number>(), charts = new Set<string>(), selected = new Set<string>();
  const chosen: Candidate[] = [];
  const singleType = new Set(candidates.map(item => item.node.primaryType)).size <= 1;
  const canSelect = (item: Candidate) => !selected.has(item.node.id) && !charts.has(item.chart)
    && (dayCounts.get(item.day) || 0) < 2 && (singleType || (typeCounts.get(item.node.primaryType) || 0) < 3);
  const take = (item: Candidate) => {
    chosen.push(item); selected.add(item.node.id); charts.add(item.chart);
    dayCounts.set(item.day, (dayCounts.get(item.day) || 0) + 1);
    typeCounts.set(item.node.primaryType, (typeCounts.get(item.node.primaryType) || 0) + 1);
  };
  const cap = Math.min(24, Math.max(0, limit));
  // Reserve a representative for each nonempty temporal bucket before filling
  // remaining seats by importance. The expanded set continues the same pass.
  for (let bucket = 0; bucket < 3 && chosen.length < cap; bucket++) {
    const candidate = candidates.find(item => bucketFor(item) === bucket && canSelect(item));
    if (candidate) take(candidate);
  }
  // Admit an unrepresented kind before another node of a kind already shown.
  // This also makes the initial eight diverse when many old crowns exist.
  for (const candidate of candidates) {
    if (chosen.length >= cap) break;
    if (!typeCounts.has(candidate.node.primaryType) && canSelect(candidate)) take(candidate);
  }
  for (const candidate of candidates) {
    if (chosen.length >= cap) break;
    if (canSelect(candidate)) take(candidate);
  }
  return { milestones: chosen.map(item => item.node).sort(timeOrder), initialIds: chosen.slice(0, initialLimit).map(item => item.node).sort(timeOrder).map(item => item.id) };
}

export function buildSkillPassportMilestones(facts: GrowthFact[], period?: { from: string; to: string }): SkillPassportMilestone[] {
  const days = facts.map(fact => fact.temporal.attributedDay || (fact.temporal.observedAt ? growthCalendarDay(fact.temporal.observedAt) : '')).filter(Boolean).sort(compare);
  return curateSkillPassportMilestones(facts, period || { from: days[0] || '', to: days.at(-1) || '' }).milestones;
}
