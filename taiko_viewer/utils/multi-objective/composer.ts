/** B4 offline/1 deterministic, read-only recommendation composition. Never records exposure. */
import type { ComposeOptions, GoalLink, IntentType, MultiObjectiveCandidate, PriorityGroup, Slate, SlateCard, SuppressionDiagnostic, ValidationContext, ValidationResult } from './contracts.ts';
import { B4_SCHEMA, SLATE_SCHEMA } from './contracts.ts';
import { canonicalJSON, compare, DAY, hash, result, same, unique } from './common.ts';
import { prepareValidationContext } from './context.ts';
import { validateCandidate } from './candidate.ts';
import { associateCandidatesWithPortfolio } from './goals.ts';
import { classifyPriorityGroup, createSlateCardId, validatePrioritySlate } from './priority.ts';
import { INTENTS, SUBTYPES } from './registries.ts';
import * as s from './shape.ts';

const GROUPS = ['A', 'B', 'C', 'D'] as const;
const readinessOrder = { ready_now: 0, reasonable_stretch: 1, not_actionable: 2 } as const;
const groupOrder = { A: 0, B: 1, C: 2, D: 3 } as const;
const optionsShape = s.object({
  capacities: s.object({ A: s.integer(0, 50), B: s.integer(0, 50), C: s.integer(0, 50), D: s.integer(0, 50) }), maxTotal: s.integer(0, 50),
  typePreferences: (value, path, issues) => {
    s.dictionary(s.number(-100, 100), 5)(value, path, issues);
    if (value && typeof value === 'object') for (const key of Object.keys(value)) if (!INTENTS.includes(key as IntentType)) issues.push({ path: `${path}.${key}`, code: 'INTENT_PREFERENCE_UNSUPPORTED' });
  },
  history: s.object({ completeFrom: s.nullable(s.time), through: s.nullable(s.time), items: s.array(s.object({ profileId: s.str, chartId: s.str, identityGroup: s.str, at: s.time, targetHash: s.hex }), 10000) }),
  primaryActionByChart: s.dictionary(s.object({ intentType: s.one(...INTENTS), subtype: s.one(...Object.keys(SUBTYPES)), targetHash: s.hex }), 5000),
});

/** Array order of actual exposure records is not a preference or a ranking signal. */
export function createComposeInputsHash(options: ComposeOptions): string {
  return hash({ ...options, history: { ...options.history, items: [...options.history.items].sort((a, b) => compare(canonicalJSON(a), canonicalJSON(b))) } });
}

function goalRank(links: readonly GoalLink[]): { priority: number; order: number } {
  let priority = 0, order = Number.POSITIVE_INFINITY;
  for (const g of links) if (g.lifecycleStatus === 'active' && g.availability === 'available') {
    if (g.userPriority > priority) { priority = g.userPriority; order = g.userOrder; }
    else if (g.userPriority === priority) order = Math.min(order, g.userOrder);
  }
  return { priority, order };
}
const numericCompare = (a: number, b: number): number => a < b ? -1 : a > b ? 1 : 0;
type Choice = { candidate: MultiObjectiveCandidate; card: SlateCard; repeated: boolean };

export function composeRecommendationSlate(input: readonly unknown[], context: ValidationContext, options: ComposeOptions): ValidationResult<Slate> {
  const issues = s.inspect(optionsShape, options);
  if (!Array.isArray(input) || input.length > 5000) issues.push({ path: 'candidates', code: 'CANDIDATE_BUDGET_OR_TYPE' });
  if (issues.length) return { ok: false, issues };
  for (const chartId of Object.keys(options.primaryActionByChart).sort(compare)) {
    const selector = options.primaryActionByChart[chartId]!;
    if (SUBTYPES[selector.subtype as keyof typeof SUBTYPES] !== selector.intentType) issues.push({ path: `options.primaryActionByChart.${chartId}`, code: 'PRIMARY_OVERRIDE_INTENT_SUBTYPE_MISMATCH' });
  }
  const prepared = prepareValidationContext(context);
  issues.push(...prepared.issues);
  try { if (createComposeInputsHash(options) !== context.decisionInputsHash) issues.push({ path: 'options', code: 'DECISION_INPUTS_HASH_MISMATCH' }); }
  catch { issues.push({ path: 'options', code: 'OPTIONS_NOT_CANONICAL_JSON' }); }
  const history = options.history;
  if ((history.completeFrom !== null && history.completeFrom > context.asOf) || (history.through !== null && history.through > context.asOf) || (history.completeFrom !== null && history.through !== null && history.completeFrom > history.through)) issues.push({ path: 'history', code: 'HISTORY_TIME_INVALID' });
  if (history.items.some(h => h.at > context.asOf || h.profileId !== context.profileId || (history.through !== null && h.at > history.through))) issues.push({ path: 'history.items', code: 'HISTORY_SCOPE_OR_TIME_INVALID' });
  if (issues.length) return { ok: false, issues };
  const diagnostics: SuppressionDiagnostic[] = [];
  const diagnostic = (candidateId: string | null, reasonCode: string, details: string[] = []) => diagnostics.push({ candidateId, goalId: null, reasonCode, details: unique(details) });
  const accepted: MultiObjectiveCandidate[] = [], rejectedIds = new Set<string>();
  for (const value of input) {
    const checked = validateCandidate(value, context, prepared);
    if (checked.ok) accepted.push(checked.value);
    else {
      const id = value !== null && typeof value === 'object' && 'candidateId' in value && typeof value.candidateId === 'string' && /^[a-f0-9]{64}$/.test(value.candidateId) ? value.candidateId : null;
      if (id) rejectedIds.add(id);
      diagnostic(id, 'CANDIDATE_REJECTED', checked.issues.map(i => i.code));
    }
  }
  // An ID collision must not choose whichever source happened to arrive first.
  const idGroups = new Map<string, MultiObjectiveCandidate[]>();
  for (const c of accepted) idGroups.set(c.candidateId, [...idGroups.get(c.candidateId) ?? [], c]);
  const uniqueCandidates: MultiObjectiveCandidate[] = [];
  for (const id of [...idGroups.keys()].sort(compare)) {
    if (rejectedIds.has(id)) { diagnostic(id, 'CANDIDATE_ID_CONFLICT'); continue; }
    const entries = idGroups.get(id)!.sort((a, b) => compare(canonicalJSON(a), canonicalJSON(b)));
    const representative = entries[0]!;
    const semantic = (c: MultiObjectiveCandidate) => {
      const { sourceNamespace: _namespace, identityMappingRef: _mapping, legacyChartKey: _legacy, source: _source, evidenceRefs: _refs, ...rest } = c;
      return rest;
    };
    if (entries.some(c => !same(semantic(c), semantic(representative)))) { diagnostic(id, 'CANDIDATE_ID_CONFLICT'); continue; }
    if (entries.length > 1) {
      const identical = entries.every(c => same(c, representative));
      representative.source.evidenceRefs = unique(entries.flatMap(c => c.source.evidenceRefs));
      representative.evidenceRefs = unique(entries.flatMap(c => c.evidenceRefs));
      const ranks = entries.flatMap(c => c.source.baselineRank === null ? [] : [c.source.baselineRank]);
      representative.source.baselineRank = ranks.length ? Math.min(...ranks) : null;
      diagnostic(id, identical ? 'DUPLICATE_CANDIDATE_COLLAPSED' : 'CANONICAL_SOURCE_ALIASES_MERGED', entries.map(c => c.identityMappingRef));
    }
    uniqueCandidates.push(representative);
  }
  const association = associateCandidatesWithPortfolio(uniqueCandidates, context, prepared);
  diagnostics.push(...association.diagnostics);
  const candidates: MultiObjectiveCandidate[] = [];
  for (const c of association.candidates) {
    const checked = validateCandidate(c, context, prepared);
    if (checked.ok) candidates.push(checked.value);
    else diagnostic(c.candidateId, 'ASSOCIATED_CANDIDATE_REJECTED', checked.issues.map(i => i.code));
  }
  const chartIdentity = new Map<string, string | null>();
  for (const row of Object.values(context.catalog.charts)) chartIdentity.set(row.chartId, chartIdentity.has(row.chartId) && chartIdentity.get(row.chartId) !== row.songId ? null : row.songId);
  const unresolvedHistory = history.items.filter(h => chartIdentity.get(h.chartId) !== h.identityGroup);
  const cutoff = Date.parse(context.asOf) - 14 * DAY;
  const historyComplete = unresolvedHistory.length === 0 && history.completeFrom !== null && Date.parse(history.completeFrom) <= cutoff && history.through === context.asOf;
  if (!historyComplete) diagnostic(null, 'REPEAT_HISTORY_UNKNOWN', unresolvedHistory.length ? ['HISTORICAL_CANONICAL_IDENTITY_UNRESOLVED'] : ['HISTORY_COVERAGE_INCOMPLETE']);
  const recent = history.items.filter(h => chartIdentity.get(h.chartId) === h.identityGroup && Date.parse(h.at) >= cutoff);
  const recentBySong = new Map<string, typeof recent>();
  for (const h of recent) recentBySong.set(h.identityGroup, [...recentBySong.get(h.identityGroup) ?? [], h]);
  const byChart = new Map<string, MultiObjectiveCandidate[]>();
  for (const c of candidates) byChart.set(c.chartId, [...byChart.get(c.chartId) ?? [], c]);
  const explicitlySelected = (c: MultiObjectiveCandidate): boolean => {
    const selector = options.primaryActionByChart[c.chartId];
    return selector !== undefined && selector.intentType === c.intentType && selector.subtype === c.subtype && selector.targetHash === c.targetHash;
  };
  for (const chartId of Object.keys(options.primaryActionByChart).sort(compare)) if (!byChart.get(chartId)?.some(explicitlySelected)) diagnostic(null, 'PRIMARY_OVERRIDE_UNAVAILABLE', [chartId, canonicalJSON(options.primaryActionByChart[chartId])]);
  const compareCandidates = (a: MultiObjectiveCandidate, b: MultiObjectiveCandidate, covered: ReadonlySet<IntentType>): number => {
    const ga = goalRank(a.goalLinks), gb = goalRank(b.goalLinks);
    return groupOrder[classifyPriorityGroup(a)] - groupOrder[classifyPriorityGroup(b)]
      || readinessOrder[a.readiness] - readinessOrder[b.readiness]
      || gb.priority - ga.priority || numericCompare(ga.order, gb.order)
      || (options.typePreferences[b.intentType] ?? 0) - (options.typePreferences[a.intentType] ?? 0)
      || Number(recentBySong.has(a.identityGroup)) - Number(recentBySong.has(b.identityGroup))
      || Number(covered.has(a.intentType)) - Number(covered.has(b.intentType))
      || numericCompare(a.source.baselineRank ?? Infinity, b.source.baselineRank ?? Infinity)
      || compare(a.candidateId, b.candidateId);
  };
  const choices: Choice[] = [];
  for (const chartId of [...byChart.keys()].sort(compare)) {
    const related = byChart.get(chartId)!.sort((a, b) => compareCandidates(a, b, new Set()));
    const explicit = related.find(explicitlySelected);
    const primary = explicit ?? related[0]!;
    const goalLinks = new Map<string, GoalLink>();
    for (const c of related) for (const link of c.goalLinks) goalLinks.set(link.goalId, link);
    const candidateIds = unique(related.map(c => c.candidateId));
    const repeat = recentBySong.get(primary.identityGroup) ?? [];
    const repeatReasonCode = repeat.length === 0 ? null : primary.goalLinks.some(g => g.lifecycleStatus === 'active' && g.availability === 'available') ? 'USER_GOAL_REQUEST'
      : repeat.some(h => h.chartId === primary.chartId) && repeat.filter(h => h.chartId === primary.chartId).every(h => h.targetHash !== primary.targetHash) ? 'EVIDENCE_CHANGED' : 'QUALIFIED_SHORTAGE';
    const card: SlateCard = { cardId: '', decisionId: context.decisionId, chartId, identityGroup: primary.identityGroup, candidateIds,
      primaryCandidateId: primary.candidateId, priorityGroup: classifyPriorityGroup(primary), primaryReadiness: primary.readiness,
      goalLinks: [...goalLinks.values()].sort((a, b) => compare(a.goalId, b.goalId)), supplementalCandidateIds: candidateIds.filter(id => id !== primary.candidateId), dedupSuppressedCandidateIds: [], repeatReasonCode };
    for (const c of related) if (c !== primary) diagnostic(c.candidateId, 'CHART_AGGREGATED', [primary.candidateId]);
    if (explicit && primary !== related[0]) diagnostic(primary.candidateId, 'USER_PRIMARY_OVERRIDE', [classifyPriorityGroup(primary)]);
    choices.push({ candidate: primary, card, repeated: repeat.length > 0 });
  }
  const groups: Record<PriorityGroup, SlateCard[]> = { A: [], B: [], C: [], D: [] };
  const selectedSongs = new Set<string>(), selectedCharts = new Set<string>(), covered = new Set<IntentType>();
  let count = 0;
  const select = (group: PriorityGroup, readiness?: MultiObjectiveCandidate['readiness']) => {
    while (count < options.maxTotal && groups[group].length < options.capacities[group]) {
      let eligible = choices.filter(choice => !selectedSongs.has(choice.card.identityGroup) && !selectedCharts.has(choice.card.chartId)
        && (classifyPriorityGroup(choice.candidate) === group || (group === 'B' && classifyPriorityGroup(choice.candidate) === 'A'))
        && (readiness === undefined || choice.candidate.readiness === readiness));
      if (!eligible.length) break;
      // A repeat without an explicit Goal request or a changed target is only
      // admitted after every equally ready, otherwise eligible fresh choice.
      const bestReadiness = Math.min(...eligible.map(c => readinessOrder[c.candidate.readiness]));
      if (eligible.some(c => !c.repeated && readinessOrder[c.candidate.readiness] === bestReadiness)) eligible = eligible.filter(c => c.card.repeatReasonCode !== 'QUALIFIED_SHORTAGE' || readinessOrder[c.candidate.readiness] !== bestReadiness);
      eligible.sort((a, b) => compareCandidates(a.candidate, b.candidate, covered));
      const next = eligible[0]!;
      if (group === 'A' && next.candidate.readiness === 'reasonable_stretch' && groups.A.filter(c => c.primaryReadiness === 'reasonable_stretch').length >= groups.A.filter(c => c.primaryReadiness === 'ready_now').length) break;
      next.card.priorityGroup = group;
      groups[group].push(next.card); count++;
      selectedSongs.add(next.card.identityGroup); selectedCharts.add(next.card.chartId); covered.add(next.candidate.intentType);
    }
  };
  select('A', 'ready_now'); select('A', 'reasonable_stretch'); select('B'); select('C'); select('D');
  const selected = GROUPS.flatMap(g => groups[g]);
  const cardBySong = new Map(selected.map(card => [card.identityGroup, card]));
  for (const choice of choices) if (!selectedCharts.has(choice.card.chartId)) {
    const winner = cardBySong.get(choice.card.identityGroup);
    const reason = winner ? 'SONG_DEDUP' : count >= options.maxTotal ? 'SLATE_CAPACITY' : classifyPriorityGroup(choice.candidate) === 'A' && choice.candidate.readiness === 'reasonable_stretch' && groups.A.length < options.capacities.A ? 'A_GATE_OR_B_CAPACITY' : 'GROUP_CAPACITY';
    for (const id of choice.card.candidateIds) diagnostic(id, reason, winner ? [winner.primaryCandidateId] : []);
    if (winner) winner.dedupSuppressedCandidateIds = unique([...winner.dedupSuppressedCandidateIds, ...choice.card.candidateIds]);
  }
  for (const card of selected) card.cardId = createSlateCardId(card);
  const gate = validatePrioritySlate(selected, candidates);
  if (!gate.hardGatePassed) return { ok: false, issues: gate.violations.map(code => ({ path: 'slate', code })) };
  if (gate.N === 0) gate.emptyReason = options.capacities.A === 0 || options.maxTotal === 0 ? 'PRIORITY_CAPACITY_ZERO' : 'NO_ELIGIBLE_READY_PRIMARY';
  for (const intent of INTENTS) {
    const source = candidates.filter(c => c.intentType === intent), chosen = choices.filter(c => selectedCharts.has(c.card.chartId) && c.candidate.intentType === intent);
    diagnostic(null, 'INTENT_COVERAGE', [intent, `validated=${source.length}`, `actionable=${source.filter(c => classifyPriorityGroup(c) === 'A').length}`, `selected_primary=${chosen.length}`]);
  }
  diagnostics.sort((a, b) => compare(a.candidateId ?? '', b.candidateId ?? '') || compare(a.goalId ?? '', b.goalId ?? '') || compare(a.reasonCode, b.reasonCode) || compare(canonicalJSON(a.details), canonicalJSON(b.details)));
  const requestedCounts = { ...options.capacities };
  const displayableCounts = Object.fromEntries(GROUPS.map(g => [g, groups[g].length])) as Record<PriorityGroup, number>;
  const shortage = Object.fromEntries(GROUPS.map(g => [g, Math.max(0, requestedCounts[g] - displayableCounts[g])])) as Record<PriorityGroup, number>;
  const body = { schemaVersion: SLATE_SCHEMA, kernelVersion: B4_SCHEMA, decisionId: context.decisionId, policyVersion: context.policyVersion, asOf: context.asOf,
    portfolioRevision: context.portfolioRevision, groups, requestedCounts, displayableCounts, qualityGate: gate, diagnostics, shortage, repeatHistory: historyComplete ? 'complete' as const : 'unknown' as const };
  return result({ ...body, slateId: hash(body) }, []);
}
