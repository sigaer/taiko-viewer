/** B4 offline/1 priority classification of validated outputs; no reachability prediction. */
import type { MultiObjectiveCandidate, PriorityGate, PriorityGroup, SlateCard } from './contracts.ts';
import { SLATE_SCHEMA } from './contracts.ts';
import { hash, same, unique } from './common.ts';

export function createSlateCardId(card: SlateCard): string {
  return hash({ schemaVersion: SLATE_SCHEMA, ...card, cardId: null });
}

/** Best permissible group. B is the composer's capacity/preference fallback from A. */
export function classifyPriorityGroup(c: MultiObjectiveCandidate): PriorityGroup {
  if (c.subtype === 'interest_discovery') return 'D';
  if (c.target.horizon === 'long_term') return 'C';
  return c.readiness === 'not_actionable' ? 'D' : 'A';
}

/** Validates a presentation plan only. Candidate ingress/evaluator validation is a prerequisite. */
export function validatePrioritySlate(cards: readonly SlateCard[], candidates: readonly MultiObjectiveCandidate[]): PriorityGate {
  const violations: string[] = [], byId = new Map<string, MultiObjectiveCandidate>();
  for (const c of candidates) {
    const previous = byId.get(c.candidateId);
    if (previous && !same(previous, c)) violations.push('CANDIDATE_ID_CONFLICT');
    else byId.set(c.candidateId, c);
  }
  const songs = new Set<string>(), charts = new Set<string>(), cardIds = new Set<string>();
  let N = 0, R = 0, S = 0;
  for (const card of cards) {
    if (card.cardId !== createSlateCardId(card)) violations.push('CARD_ID_MISMATCH');
    if (songs.has(card.identityGroup) || charts.has(card.chartId) || cardIds.has(card.cardId)) violations.push('SLATE_DUPLICATE');
    songs.add(card.identityGroup); charts.add(card.chartId); cardIds.add(card.cardId);
    if (card.priorityGroup === 'A') N++;
    const c = byId.get(card.primaryCandidateId);
    if (!c) { violations.push('PRIMARY_CANDIDATE_MISSING'); continue; }
    if (card.chartId !== c.chartId || card.identityGroup !== c.identityGroup || card.decisionId !== c.decisionId || card.primaryReadiness !== c.readiness || !card.candidateIds.includes(c.candidateId)) violations.push('PRIMARY_PROJECTION_MISMATCH');
    if (!same(card.candidateIds, unique(card.candidateIds)) || !same(card.supplementalCandidateIds, card.candidateIds.filter(id => id !== c.candidateId))) violations.push('CARD_CANDIDATE_PROJECTION_MISMATCH');
    for (const id of card.candidateIds) {
      const related = byId.get(id);
      if (!related || related.chartId !== card.chartId || related.identityGroup !== card.identityGroup || related.decisionId !== card.decisionId) violations.push('CARD_CANDIDATE_SCOPE_MISMATCH');
    }
    const links = new Map(card.candidateIds.flatMap(id => (byId.get(id)?.goalLinks ?? []).map(link => [link.goalId, link] as const)));
    if (new Set(card.goalLinks.map(link => link.goalId)).size !== card.goalLinks.length || !same(unique(card.goalLinks.map(link => link.goalId)), unique([...links.keys()])) || card.goalLinks.some(link => !links.has(link.goalId) || !same(link, links.get(link.goalId)))) violations.push('CARD_GOAL_PROJECTION_MISMATCH');
    const best = classifyPriorityGroup(c);
    if (card.priorityGroup !== best && !(best === 'A' && card.priorityGroup === 'B')) violations.push('PRIORITY_GROUP_INELIGIBLE');
    if (card.priorityGroup === 'A') {
      if (c.readiness === 'ready_now') R++;
      else if (c.readiness === 'reasonable_stretch') S++;
      else violations.push('A_NOT_ACTIONABLE');
      if (c.target.horizon !== 'near_term') violations.push('A_LONG_TERM');
      if (c.subtype === 'interest_discovery') violations.push('INTEREST_DISCOVERY_D_ONLY');
    }
    if ((card.priorityGroup === 'A' || card.priorityGroup === 'B') && c.readiness === 'not_actionable') violations.push('AB_NOT_ACTIONABLE');
  }
  if (R < Math.ceil(N / 2) || R + S !== N) violations.push('A_ACTIONABILITY_GATE_FAILED');
  const errors = unique(violations);
  return { scope: 'planned_slate', actualExposureVerified: false, N, R, S, minReady: Math.ceil(N / 2), rate: N ? R / N : null,
    hardGatePassed: errors.length === 0, optimizationTargetMet: N ? R / N >= .7 : null,
    emptyReason: N ? null : 'NO_SELECTED_PRIORITY_CARDS', violations: errors };
}
