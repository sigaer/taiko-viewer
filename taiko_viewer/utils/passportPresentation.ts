import type { SkillPassportResponse, SkillPassportRangeDays, SkillPassportTrendDimension } from '../types/player-growth';

const calendarDay = (value: string) => {
  const time = Date.parse(value);
  return Number.isFinite(time) ? Math.floor((time + 8 * 3_600_000) / 86_400_000) : null;
};

// Span makes periods useful even for sparse records; measurementDays remains
// the honest count of days with a record, never the elapsed calendar duration.
export function passportCoverageSpan(coverage: SkillPassportResponse['coverage'] | undefined) {
  const from = coverage?.measurementFrom ? calendarDay(coverage.measurementFrom) : null;
  const to = coverage?.measurementTo ? calendarDay(coverage.measurementTo) : null;
  return from === null || to === null ? 0 : Math.max(0, to - from + 1);
}

export function passportRangeChoices(_span?: number): { days: SkillPassportRangeDays; all: boolean }[] {
  return ([30, 90, 180, 365] as const).map(days => ({ days, all: false }));
}

export function selectPassportPeriod(payload: SkillPassportResponse | null, days: SkillPassportRangeDays): SkillPassportResponse | null {
  if (!payload?.shared) return payload;
  const view = payload.shared.views[days];
  if (!view) return null;
  const points = new Set(view.pointIds), nodes = new Map(payload.shared.milestones.map(node => [node.id, node]));
  return {
    ...payload,
    range: view.range,
    coverage: { ...payload.coverage, recentFactsFrom: view.recentFactsFrom, recentFactsTo: view.recentFactsTo },
    segments: payload.shared.segments.flatMap(segment => {
      const rows = segment.points.filter(point => points.has(point.id));
      return rows.length ? [{ ...segment, from: rows[0]!.day, to: rows.at(-1)!.day, points: rows }] : [];
    }),
    milestones: view.milestoneIds.flatMap(id => nodes.has(id) ? [nodes.get(id)!] : []),
    initialMilestoneIds: view.initialMilestoneIds,
    currentSegmentChange: view.currentSegmentChange,
    focusTimeline: view.focusTimeline
  };
}

export function passportTrendStory(passport: SkillPassportResponse | null, dimension: SkillPassportTrendDimension) {
  const points = (passport?.segments.at(-1)?.points || []).flatMap(point => {
    const value = dimension === 'rating' ? point.rating : point.dimensions[dimension];
    return typeof value === 'number' && Number.isFinite(value) ? [{ day: point.day, value }] : [];
  });
  if (passport?.current?.readiness !== 'ready' || passport.currentSegmentChange.reason === 'limited') return { state: 'limited' as const };
  if (!passport.currentSegmentChange.compatible || points.length < 2) return { state: 'accumulating' as const };
  const first = points[0]!, last = points.at(-1)!;
  return { state: points.every(point => point.value.toFixed(2) === last.value.toFixed(2)) ? 'stable' as const : 'changed' as const, first, last };
}
