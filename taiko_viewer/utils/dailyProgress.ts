import type { GrowthDailyEvent, GrowthDailyProgress, GrowthEventFact } from "../types/player-growth";
import type { UserdataSong } from "../server/internal/account/shared";
import { growthCalendarDay } from "./playerGrowth.ts";

export type GrowthSnapshot = { full: boolean; timestamp: string; songs: UserdataSong[]; revision?: string; source?: string };
const num = (v: unknown): number | null => v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : null;
const key = (s: UserdataSong) => `${s.song_no}:${s.level}`;
const epoch = (v: unknown) => {
  const s = String(v || "");
  return Date.parse(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(s) ? s.replace(" ", "T") + "+08:00" : s);
};
const crown = (s: UserdataSong): number | null => {
  const values = [s.clear_cnt, s.full_combo_cnt, s.dondaful_combo_cnt].map(num);
  if (values.some(v => v === null)) return null;
  return values[2]! > 0 ? 2 : values[1]! > 0 ? 1 : values[0]! > 0 ? 0 : -1;
};
const judgments = (s: UserdataSong) => {
  const values = [s.good_cnt, s.ok_cnt, s.ng_cnt].map(num);
  return values.some(v => v === null) ? null : values.reduce<number>((sum, v) => sum + v!, 0);
};
const importance: Record<GrowthEventFact['type'], number> = { df: 100, fc: 90, 'clear-upgrade': 80, 'rank-upgrade': 70, 'score-pb': 60, 'ng-reduced': 50, 'combo-improved': 40, played: 0 };

const dayEpoch = (day: string) => Date.parse(`${day}T00:00:00Z`);
const daysBetween = (fromDay: string, toDay: string) => {
  const days: string[] = [];
  for (let cursor = dayEpoch(fromDay), end = dayEpoch(toDay); Number.isFinite(cursor) && cursor <= end; cursor += 86_400_000) days.push(new Date(cursor).toISOString().slice(0, 10));
  return days;
};
const normalizedInstant = (value: unknown) => {
  const text = String(value || '').trim();
  if (!text) return '';
  const parsed = Date.parse(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(text) ? text.replace(' ', 'T') + '+08:00' : text);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : '';
};

export function deriveProgressForRange(current: UserdataSong[], history: GrowthSnapshot[], fromDay: string, toDay: string, title: (s: UserdataSong) => string, currentRevision = ''): GrowthDailyProgress[] {
  const charts = new Map<string, GrowthDailyEvent>();
  const bestScores = new Map<string, number>();
  let state = new Map<string, UserdataSong>();
  let observed = new Map<string, string>();
  const inRange = (day: string) => Boolean(day) && day >= fromDay && day <= toDay;
  const visit = (after: UserdataSong, before: UserdataSong | undefined, evidence: GrowthDailyEvent['evidence'], observedBefore: string | undefined, snapshot: GrowthSnapshot) => {
    const scoreDay = growthCalendarDay(after.highscore_datetime);
    const playDay = growthCalendarDay(after.update_datetime);
    const candidateDays = [...new Set([scoreDay, playDay].filter(inRange))];
    if (!candidateDays.length) return;
    const getChart = (day: string) => {
      const mapKey = `${day}:${key(after)}`;
      const chart = charts.get(mapKey) || { songId: after.song_no, level: after.level, title: title(after), evidence, occurredAt: String(after.update_datetime || after.highscore_datetime || ''), importance: 0, facts: [], evidenceRevision: snapshot.revision || snapshot.timestamp || undefined, observedAt: normalizedInstant(snapshot.timestamp) || null, factOccurredAt: {} };
      chart.evidence = evidence;
      chart.evidenceRevision = snapshot.revision || snapshot.timestamp || chart.evidenceRevision;
      chart.observedAt = normalizedInstant(snapshot.timestamp) || chart.observedAt;
      charts.set(mapKey, chart);
      return chart;
    };
    for (const day of candidateDays) getChart(day);
    const add = (day: string, type: GrowthEventFact['type'], a: number | null, b: number | null, occurredAt: unknown, decreased = false) => {
      if (a === null || b === null || (decreased ? b >= a : b <= a)) return;
      const chart = getChart(day);
      const old = chart.facts.find(f => f.type === type);
      if (old) { old.after = decreased ? Math.min(old.after!, b) : Math.max(old.after!, b); old.delta = old.after! - old.before!; }
      else chart.facts.push({ type, before: a, after: b, delta: b - a });
      chart.importance = Math.max(chart.importance, importance[type]);
      chart.evidence = evidence;
      const instant = normalizedInstant(occurredAt);
      if (instant) chart.factOccurredAt![type] = instant;
    };
    if (before) {
      const scoreTime = inRange(scoreDay) && epoch(after.highscore_datetime) > epoch(before.highscore_datetime);
      const playTime = inRange(playDay) && epoch(after.update_datetime) > epoch(before.update_datetime);
      if (scoreTime) {
        add(scoreDay, 'score-pb', num(before.high_score) === null ? null : bestScores.get(key(after)) ?? num(before.high_score), num(after.high_score), after.highscore_datetime);
        const total = judgments(before);
        if (total !== null && total > 0 && total === judgments(after)) {
          add(scoreDay, 'ng-reduced', num(before.ng_cnt), num(after.ng_cnt), after.highscore_datetime, true);
          add(scoreDay, 'combo-improved', num(before.combo_cnt), num(after.combo_cnt), after.highscore_datetime);
        }
      }
      if (playTime && (growthCalendarDay(before.update_datetime) === playDay || (growthCalendarDay(observedBefore) === playDay && epoch(observedBefore) < epoch(after.update_datetime)))) {
        const a = crown(before), b = crown(after);
        if (a !== null && b !== null && b > a) add(playDay, b === 2 ? 'df' : b === 1 ? 'fc' : 'clear-upgrade', a, b, after.update_datetime);
        const aRank = num(before.best_score_rank), bRank = num(after.best_score_rank);
        if (aRank !== null && bRank !== null && aRank >= 1 && bRank <= 8) add(playDay, 'rank-upgrade', aRank, bRank, after.update_datetime);
      }
    }
  };
  for (const snapshot of history) {
    const next = snapshot.full ? new Map<string, UserdataSong>() : new Map(state);
    const nextObserved = snapshot.full ? new Map<string, string>() : new Map(observed);
    for (const song of snapshot.songs) {
      const before = state.get(key(song));
      // Delta rows are chart records, not field patches: absent evidence stays absent.
      visit(song, before, snapshot.full ? 'full-snapshot' : 'delta-snapshot', observed.get(key(song)), snapshot);
      const score = num(song.high_score);
      if (score !== null) bestScores.set(key(song), Math.max(bestScores.get(key(song)) ?? score, score));
      next.set(key(song), song);
      nextObserved.set(key(song), snapshot.timestamp);
    }
    state = next;
    observed = nextObserved;
  }
  // Current data proves attendance only; it is not an additional historical transition.
  const currentSnapshot: GrowthSnapshot = { full: true, timestamp: '', songs: current, revision: currentRevision };
  for (const song of current) visit(song, undefined, 'full-snapshot', undefined, currentSnapshot);
  const dataMode = history.some(s => s.full) ? 'FULL_HISTORY' : current.length || history.length ? 'SNAPSHOT_LIMITED' : 'INSUFFICIENT';
  const known = current.some(s => s.update_datetime || s.highscore_datetime) || history.some(s => s.songs.some(row => row.update_datetime || row.highscore_datetime));
  return daysBetween(fromDay, toDay).map(calendarDay => {
    const events = [...charts.entries()].filter(([mapKey]) => mapKey.startsWith(`${calendarDay}:`)).map(([, chart]) => {
      if (!chart.facts.length) {
        chart.facts.push({ type: 'played', before: null, after: null, delta: null });
        const instant = normalizedInstant(chart.occurredAt);
        if (instant) chart.factOccurredAt!.played = instant;
      }
      chart.facts.sort((a, b) => importance[b.type] - importance[a.type] || a.type.localeCompare(b.type));
      return chart;
    }).sort((a, b) => b.importance - a.importance || a.songId - b.songId || a.level - b.level);
    return { calendarDay, dataMode, attendance: events.length ? 'played' as const : known ? 'not_played' as const : 'unknown' as const, uniqueCharts: known || events.length ? events.length : null, events };
  });
}

export function deriveDailyProgress(current: UserdataSong[], history: GrowthSnapshot[], calendarDay: string, title: (s: UserdataSong) => string): GrowthDailyProgress {
  const derived = deriveProgressForRange(current, history, calendarDay, calendarDay, title)[0];
  const events = derived.events.map(source => {
    const chart: GrowthDailyEvent = { ...source, facts: source.facts.map(fact => ({ ...fact })) };
    if (!chart.facts.length) chart.facts.push({ type: 'played', before: null, after: null, delta: null });
    chart.facts.sort((a, b) => importance[b.type] - importance[a.type]);
    // A later DF subsumes earlier FC/clear headlines on the same chart.
    const crownTypes = ['df', 'fc', 'clear-upgrade'];
    const bestCrown = chart.facts.find(f => crownTypes.includes(f.type));
    chart.facts = chart.facts.filter(f => !crownTypes.includes(f.type) || f === bestCrown).slice(0, 3);
    return chart;
  }).sort((a, b) => b.importance - a.importance || a.songId - b.songId || a.level - b.level).slice(0, 3);
  return { ...derived, events };
}
