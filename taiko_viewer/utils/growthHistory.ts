import type { GrowthDailyProgress, GrowthFact, GrowthFactType } from "../types/player-growth";
import type { PlayerGoal } from "../types/player-goal";
import { growthCalendarDay } from "./playerGrowth.ts";

const scoreType = (type: string): GrowthFactType => type === "clear-upgrade" ? "clear" : type as GrowthFactType;
const part = (value: unknown) => encodeURIComponent(value === null || value === undefined || value === "" ? "_" : String(value));

export const scoreFactKey = (bindingId: string, day: string, songId: number, difficultyType: number, type: GrowthFactType, before: number | null, after: number | null) =>
  ["score-history", "v1", bindingId, day, songId, difficultyType, type, before, after].map(part).join(":");

export const goalFactKey = (bindingId: string, goalId: string, revision: string) =>
  ["goal", "v1", bindingId, goalId, revision].map(part).join(":");

export function projectScoreFacts(ownerId: number, bindingId: number, days: GrowthDailyProgress[]): GrowthFact[] {
  const facts: GrowthFact[] = [];
  for (const day of days) {
    for (const event of day.events) {
      for (const sourceFact of event.facts) {
        const type = scoreType(sourceFact.type);
        const occurredAt = event.factOccurredAt?.[sourceFact.type] || null;
        const factKey = scoreFactKey(String(bindingId), day.calendarDay, event.songId, event.level, type, sourceFact.before, sourceFact.after);
        facts.push({
          id: factKey,
          factKey,
          ownerId: String(ownerId),
          bindingId: String(bindingId),
          type,
          songId: event.songId,
          difficultyType: event.level,
          before: sourceFact.before,
          after: sourceFact.after,
          delta: sourceFact.delta,
          goalId: null,
          evidence: {
            source: "score-history",
            sourceRevision: event.evidenceRevision,
            evidenceVersion: 1,
            provenance: { snapshotKind: event.evidence }
          },
          temporal: {
            attributedDay: day.calendarDay,
            occurredAt,
            observedAt: event.observedAt || null,
            confirmedAt: null,
            precision: occurredAt ? "instant" : "day"
          }
        });
      }
    }
  }
  return facts;
}

export function projectGoalFact(ownerId: number, bindingId: number, goal: PlayerGoal): GrowthFact | null {
  if (goal.status !== "completed" || !goal.completedAt || !goal.completionEvidence) return null;
  const evidence = goal.completionEvidence;
  const result = evidence.result;
  const factKey = goalFactKey(String(bindingId), goal.id, evidence.observationRevision);
  return {
    id: factKey,
    factKey,
    ownerId: String(ownerId),
    bindingId: String(bindingId),
    type: "goal-completed",
    songId: goal.songId,
    difficultyType: goal.difficultyType,
    before: result.before,
    after: result.after,
    delta: result.delta,
    goalId: goal.id,
    evidence: {
      source: "goal",
      sourceRevision: evidence.observationRevision,
      evidenceVersion: evidence.evaluationVersion,
      provenance: evidence.provenance
    },
    temporal: {
      attributedDay: null,
      occurredAt: null,
      observedAt: evidence.observationCapturedAt || null,
      confirmedAt: goal.completedAt,
      precision: "observation"
    }
  };
}

const sortTime = (fact: GrowthFact) => fact.temporal.occurredAt || fact.temporal.observedAt || fact.temporal.confirmedAt || "";
const sortDay = (fact: GrowthFact) => fact.temporal.attributedDay || growthCalendarDay(sortTime(fact)) || "9999-99-99";

export const sortGrowthFacts = (facts: GrowthFact[]) => [...facts].sort((left, right) => {
  const day = sortDay(left).localeCompare(sortDay(right));
  if (day) return day;
  const time = sortTime(left).localeCompare(sortTime(right));
  return time || left.factKey.localeCompare(right.factKey);
});
