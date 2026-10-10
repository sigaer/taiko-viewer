import type { GrowthDailyEvent, GrowthDailyProgress, GrowthEventFact } from "../types/player-growth";
import type { LegacyScoreRecord as UserdataSong } from "../server/domain/score-read-contract";
import { legacyScoreReader, legacyCrown, legacyJudgmentTotal, legacyScoreInstant } from "@sakura-taiko/contract";
import { growthCalendarDay } from "./playerGrowth.ts";
import { memoizeGrowthString } from "./growthRequestMemo.ts";

export type GrowthSnapshot = { full: boolean; timestamp: string; songs: UserdataSong[]; revision?: string; source?: string };
const num = legacyScoreReader("viewer-daily-v1");
const key = (s: UserdataSong) => `${s.song_no}:${s.level}`;
const epoch = (v: unknown) => {
  const s = String(v || "");
  return Date.parse(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(s) ? s.replace(" ", "T") + "+08:00" : s);
};
const crown = (s: UserdataSong) => legacyCrown(s, "viewer-daily-v1");
const judgments = (s: UserdataSong) => legacyJudgmentTotal(s, "viewer-daily-v1");
const importance: Record<GrowthEventFact['type'], number> = { df: 100, fc: 90, 'clear-upgrade': 80, 'rank-upgrade': 70, 'score-pb': 60, 'ng-reduced': 50, 'combo-improved': 40, played: 0 };

const dayEpoch = (day: string) => Date.parse(`${day}T00:00:00Z`);
const daysBetween = (fromDay: string, toDay: string) => {
  const days: string[] = [];
  for (let cursor = dayEpoch(fromDay), end = dayEpoch(toDay); Number.isFinite(cursor) && cursor <= end; cursor += 86_400_000) days.push(new Date(cursor).toISOString().slice(0, 10));
  return days;
};
const normalizedInstant = (value: unknown) => legacyScoreInstant(value, "viewer-daily-v1") || '';

export function deriveProgressForRange(current: UserdataSong[], history: GrowthSnapshot[], fromDay: string, toDay: string, title: (s: UserdataSong) => string, currentRevision = ''): GrowthDailyProgress[] {
  return deriveProgressForCalendarDays(current, history, daysBetween(fromDay, toDay), title, currentRevision);
}

/** Replays the same canonical transitions as the range API without materializing intervening calendar days. */
export function deriveProgressForCalendarDays(current: UserdataSong[], history: GrowthSnapshot[], requestedDays: string[], title: (s: UserdataSong) => string, currentRevision = ''): GrowthDailyProgress[] {
  const calendarDayFor = memoizeGrowthString(growthCalendarDay);
  const epochFor = memoizeGrowthString(epoch);
  const instantFor = memoizeGrowthString(normalizedInstant);
  const calendarDays = [...new Set(requestedDays.filter(Boolean))].sort();
  const requested = new Set(calendarDays);
  const charts = new Map<string, GrowthDailyEvent>();
  const chartsByDay = new Map<string, GrowthDailyEvent[]>();
  const bestScores = new Map<string, number>();
  let state = new Map<string, UserdataSong>();
  let observed = new Map<string, string>();
  const inRange = (day: string) => requested.has(day);
  const visit = (after: UserdataSong, before: UserdataSong | undefined, evidence: GrowthDailyEvent['evidence'], observedBefore: string | undefined, snapshot: GrowthSnapshot, songKey: string, snapshotInstant: string) => {
    const scoreDay = calendarDayFor(after.highscore_datetime);
    const playDay = calendarDayFor(after.update_datetime);
    const includeScore = inRange(scoreDay), includePlay = inRange(playDay);
    if (!includeScore && !includePlay) return;
    const getChart = (day: string) => {
      const mapKey = `${day}:${songKey}`;
      const existing = charts.get(mapKey);
      const chart = existing || { songId: after.song_no, level: after.level, title: title(after), evidence, occurredAt: String(after.update_datetime || after.highscore_datetime || ''), importance: 0, facts: [], evidenceRevision: snapshot.revision || snapshot.timestamp || undefined, observedAt: snapshotInstant || null, factOccurredAt: {} };
      chart.evidence = evidence;
      chart.evidenceRevision = snapshot.revision || snapshot.timestamp || chart.evidenceRevision;
      chart.observedAt = snapshotInstant || chart.observedAt;
      if (!existing) {
        charts.set(mapKey, chart);
        const dayCharts = chartsByDay.get(day);
        if (dayCharts) dayCharts.push(chart);
        else chartsByDay.set(day, [chart]);
      }
      return chart;
    };
    if (includeScore) getChart(scoreDay);
    if (includePlay && (!includeScore || playDay !== scoreDay)) getChart(playDay);
    const add = (day: string, type: GrowthEventFact['type'], a: number | null, b: number | null, occurredAt: unknown, decreased = false) => {
      if (a === null || b === null || (decreased ? b >= a : b <= a)) return;
      const chart = getChart(day);
      const old = chart.facts.find(f => f.type === type);
      if (old) { old.after = decreased ? Math.min(old.after!, b) : Math.max(old.after!, b); old.delta = old.after! - old.before!; }
      else chart.facts.push({ type, before: a, after: b, delta: b - a });
      chart.importance = Math.max(chart.importance, importance[type]);
      chart.evidence = evidence;
      const instant = instantFor(occurredAt);
      if (instant) chart.factOccurredAt![type] = instant;
    };
    if (before) {
      let bestScoreDf = false;
      const scoreTime = includeScore && after.highscore_datetime !== before.highscore_datetime && epochFor(after.highscore_datetime) > epochFor(before.highscore_datetime);
      const playTime = includePlay && after.update_datetime !== before.update_datetime && epochFor(after.update_datetime) > epochFor(before.update_datetime);
      if (scoreTime) {
        add(scoreDay, 'score-pb', num(before.high_score) === null ? null : bestScores.get(songKey) ?? num(before.high_score), num(after.high_score), after.highscore_datetime);
        const total = judgments(before);
        if (total !== null && total > 0 && total === judgments(after)) {
          add(scoreDay, 'ng-reduced', num(before.ng_cnt), num(after.ng_cnt), after.highscore_datetime, true);
          add(scoreDay, 'combo-improved', num(before.combo_cnt), num(after.combo_cnt), after.highscore_datetime);
          // A complete best-score judgment tuple can date its new DF even
          // when the previous snapshot was on another day. Cumulative crown
          // counters alone still cannot identify a play day across that gap.
          const previousCrown = crown(before), nextCrown = crown(after);
          if (previousCrown !== null && previousCrown < 2 && nextCrown === 2
            && num(after.good_cnt)! > 0 && num(after.ok_cnt) === 0 && num(after.ng_cnt) === 0
            && num(before.high_score) !== null && num(after.high_score) !== null
            && num(after.high_score)! > num(before.high_score)!) {
            add(scoreDay, 'df', previousCrown, 2, after.highscore_datetime);
            bestScoreDf = true;
          }
        }
      }
      if (playTime && (calendarDayFor(before.update_datetime) === playDay || (calendarDayFor(observedBefore) === playDay && epochFor(observedBefore) < epochFor(after.update_datetime)))) {
        const a = crown(before), b = crown(after);
        if (a !== null && b !== null && b > a && !(b === 2 && bestScoreDf)) add(playDay, b === 2 ? 'df' : b === 1 ? 'fc' : 'clear-upgrade', a, b, after.update_datetime);
        const aRank = num(before.best_score_rank), bRank = num(after.best_score_rank);
        if (aRank !== null && bRank !== null && aRank >= 1 && bRank <= 8) add(playDay, 'rank-upgrade', aRank, bRank, after.update_datetime);
      }
    }
  };
  for (const snapshot of history) {
    const snapshotInstant = instantFor(snapshot.timestamp);
    const next = snapshot.full ? new Map<string, UserdataSong>() : new Map(state);
    const nextObserved = snapshot.full ? new Map<string, string>() : new Map(observed);
    for (const song of snapshot.songs) {
      const songKey = key(song);
      const before = state.get(songKey);
      // Delta rows are chart records, not field patches: absent evidence stays absent.
      visit(song, before, snapshot.full ? 'full-snapshot' : 'delta-snapshot', observed.get(songKey), snapshot, songKey, snapshotInstant);
      const score = num(song.high_score);
      if (score !== null) bestScores.set(songKey, Math.max(bestScores.get(songKey) ?? score, score));
      next.set(songKey, song);
      nextObserved.set(songKey, snapshot.timestamp);
    }
    state = next;
    observed = nextObserved;
  }
  // Current data proves attendance only; it is not an additional historical transition.
  const currentSnapshot: GrowthSnapshot = { full: true, timestamp: '', songs: current, revision: currentRevision };
  for (const song of current) visit(song, undefined, 'full-snapshot', undefined, currentSnapshot, key(song), '');
  const dataMode = history.some(s => s.full) ? 'FULL_HISTORY' : current.length || history.length ? 'SNAPSHOT_LIMITED' : 'INSUFFICIENT';
  const known = current.some(s => s.update_datetime || s.highscore_datetime) || history.some(s => s.songs.some(row => row.update_datetime || row.highscore_datetime));
  return calendarDays.map(calendarDay => {
    const events = (chartsByDay.get(calendarDay) || []).map(chart => {
      if (!chart.facts.length) {
        chart.facts.push({ type: 'played', before: null, after: null, delta: null });
        const instant = instantFor(chart.occurredAt);
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
