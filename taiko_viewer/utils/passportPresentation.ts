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

export function passportRangeChoices(span: number): { days: SkillPassportRangeDays; all: boolean }[] {
  if (span < 30) return [];
  const ranges: SkillPassportRangeDays[] = [30, 90, 180, 365];
  if (span >= 365) return ranges.map(days => ({ days, all: false }));
  const last = ranges.findIndex(days => days > span);
  return ranges.slice(0, last + 1).map((days, index) => ({ days, all: index === last }));
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
