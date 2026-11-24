import type { WeeklyMeasurementChange } from '../types/player-growth';

/** Model provenance annotates a comparison without changing its arithmetic. */
export function weeklyModelNotice(change: WeeklyMeasurementChange | null): 'changed' | 'unverified' | null {
  const start = change?.start, end = change?.end;
  if (!start || !end) return null;
  if (start.measurementVersion !== end.measurementVersion || start.algorithmVersion !== end.algorithmVersion ||
      (start.modelRevision && end.modelRevision && start.modelRevision !== end.modelRevision)) return 'changed';
  return !start.modelRevision || !end.modelRevision ? 'unverified' : null;
}
