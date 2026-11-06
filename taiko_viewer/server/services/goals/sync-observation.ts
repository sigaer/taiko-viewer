import type { GoalProvenance } from '../../../utils/goalEvaluation.ts';

export type SyncObservation = { revision: string; provenance: GoalProvenance | null };
// A live sync is only a trigger. Completion still requires the frozen Goal's
// independent provenance and V1 evidence checks inside the existing evaluator.
export function hasNewSyncObservation(before: SyncObservation | null, after: SyncObservation): boolean {
  const a = before?.provenance, b = after.provenance;
  return !!a && !!b && before!.revision !== after.revision && a.contentHash !== b.contentHash &&
    a.source === b.source && a.account === b.account && a.topology === b.topology &&
    b.marker > a.marker && Date.parse(b.observedAt) > Date.parse(a.observedAt);
}
