import type { SkillPassportMilestone, SkillPassportPoint, SkillPassportSegment, SkillPassportTrendDimension } from '../types/player-growth.ts';

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
export type PassportChartPoint = SkillPassportPoint & { value: number };

// Preserve contiguous server segments and split again at missing/limited values.
// Never reconnect A→B→A, or infer equivalence from equal numeric values.
export function passportMetricRuns(segments: SkillPassportSegment[], dimension: SkillPassportTrendDimension) {
  const runs: { id: string; points: PassportChartPoint[] }[] = [];
  for (const segment of segments) {
    let run: PassportChartPoint[] | null = null;
    for (const point of segment.points) {
      const value = dimension === 'rating' ? point.rating : point.dimensions[dimension];
      if (!finite(value)) { run = null; continue; }
      const comparable = point.availabilityState === 'ready' && Boolean(point.modelRevision);
      if (!comparable) run = null;
      if (!run) { run = []; runs.push({ id: `${segment.id}:${point.id}`, points: run }); }
      run.push({ ...point, value });
      if (!comparable) run = null;
    }
  }
  return runs;
}

type Fact = NonNullable<SkillPassportMilestone['improvements']>[number];
type Line = { key: string; params: Record<string, string | number>; factKeys: string[] };
export function composePassportMilestoneNarrative(node: SkillPassportMilestone, format: (type: Fact['type'], value: number) => string) {
  const facts = node.improvements?.length ? [...node.improvements] : [{ type: node.primaryType, before: node.before, after: node.after, delta: node.delta, factKey: node.factKeys[0] || node.id }];
  // Retain the curator's exact primary values, including multiple facts of one type.
  const isPrimary = (f: Fact) => f.type === node.primaryType && f.before === node.before && f.after === node.after && f.delta === node.delta;
  const importance: Partial<Record<Fact['type'], number>> = { df: 100, fc: 90, clear: 80, 'rank-upgrade': 76, 'ng-reduced': 62, 'score-pb': 54, 'combo-improved': 44 };
  facts.sort((a, b) => Number(isPrimary(b)) - Number(isPrimary(a)) || Number(b.type === node.primaryType) - Number(a.type === node.primaryType) || (importance[b.type] || 0) - (importance[a.type] || 0) || a.factKey.localeCompare(b.factKey, 'en'));
  const primary = facts[0]!;
  let slot = 'updated';
  const params: Line['params'] = {};
  if (finite(primary.after)) params.after = format(primary.type, primary.after);
  if (finite(primary.before)) params.before = format(primary.type, primary.before);
  if (node.observationOnly || primary.type === 'goal-completed') slot = 'goalObserved';
  else if (['df', 'fc', 'clear'].includes(primary.type)) slot = primary.type;
  else if (primary.type === 'rank-upgrade' && finite(primary.after)) slot = finite(primary.before) && primary.after > primary.before ? 'rankUp' : 'rankAt';
  else if (primary.type === 'ng-reduced' && finite(primary.after)) slot = finite(primary.before) && primary.after < primary.before ? 'ngDown' : 'ngAt';
  else if (primary.type === 'score-pb' && finite(primary.after)) {
    slot = finite(primary.before) && primary.after > primary.before ? 'pbGain' : 'pbAt';
    if (slot === 'pbGain') params.delta = format(primary.type, primary.after - primary.before!);
  } else if (primary.type === 'combo-improved' && finite(primary.after)) slot = 'comboAt';
  const evidence = (fact: Fact): Line => ({
    key: `passport.evidence.${['fc', 'df', 'clear'].includes(fact.type) ? 'label' : finite(fact.before) && finite(fact.after) ? 'change' : finite(fact.after) ? 'value' : 'label'}`,
    params: { type: fact.type, before: finite(fact.before) ? format(fact.type, fact.before) : '', after: finite(fact.after) ? format(fact.type, fact.after) : '' },
    factKeys: [fact.factKey]
  });
  const support = facts.slice(1).map(evidence);
  if (slot === 'pbGain') support.unshift(evidence(primary));
  return {
    id: node.id, primaryFactKey: primary.factKey, factKeys: [...node.factKeys],
    headline: { key: `passport.narrative.${slot}`, params, factKeys: [primary.factKey] } as Line,
    support: support.slice(0, 2), detail: support.slice(2),
    timePrecision: node.observationOnly ? 'observation' : node.day ? 'day' : 'unknown'
  };
}
