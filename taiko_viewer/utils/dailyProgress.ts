import type { GrowthDailyEvent, GrowthDailyProgress, GrowthEventFact } from "../types/player-growth";
import type { UserdataSong } from "../server/internal/account/shared";
import { growthCalendarDay } from "./playerGrowth.ts";

export type GrowthSnapshot = { full: boolean; timestamp: string; songs: UserdataSong[] };
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

export function deriveDailyProgress(current: UserdataSong[], history: GrowthSnapshot[], calendarDay: string, title: (s: UserdataSong) => string): GrowthDailyProgress {
  const charts = new Map<string, GrowthDailyEvent>();
  const bestScores = new Map<string, number>();
  let state = new Map<string, UserdataSong>();
  let observed = new Map<string, string>();
  const today = (v: unknown) => growthCalendarDay(v) === calendarDay;
  const visit = (after: UserdataSong, before: UserdataSong | undefined, evidence: GrowthDailyEvent['evidence'], observedBefore?: string) => {
    if (!today(after.update_datetime) && !today(after.highscore_datetime)) return;
    const chart = charts.get(key(after)) || { songId: after.song_no, level: after.level, title: title(after), evidence, occurredAt: String(after.update_datetime || after.highscore_datetime), importance: 0, facts: [] };
    const add = (type: GrowthEventFact['type'], a: number | null, b: number | null, decreased = false) => {
      if (a === null || b === null || (decreased ? b >= a : b <= a)) return;
      const old = chart.facts.find(f => f.type === type);
      if (old) { old.after = decreased ? Math.min(old.after!, b) : Math.max(old.after!, b); old.delta = old.after! - old.before!; }
      else chart.facts.push({ type, before: a, after: b, delta: b - a });
      chart.importance = Math.max(chart.importance, importance[type]);
      chart.evidence = evidence;
    };
    if (before) {
      const scoreTime = today(after.highscore_datetime) && epoch(after.highscore_datetime) > epoch(before.highscore_datetime);
      const playTime = today(after.update_datetime) && epoch(after.update_datetime) > epoch(before.update_datetime);
      if (scoreTime) {
        add('score-pb', num(before.high_score) === null ? null : bestScores.get(key(after)) ?? num(before.high_score), num(after.high_score));
        const total = judgments(before);
        if (total !== null && total > 0 && total === judgments(after)) {
          add('ng-reduced', num(before.ng_cnt), num(after.ng_cnt), true);
          add('combo-improved', num(before.combo_cnt), num(after.combo_cnt));
        }
      }
      if (playTime && (today(before.update_datetime) || (today(observedBefore) && epoch(observedBefore) < epoch(after.update_datetime)))) {
        const a = crown(before), b = crown(after);
        if (a !== null && b !== null && b > a) add(b === 2 ? 'df' : b === 1 ? 'fc' : 'clear-upgrade', a, b);
        const aRank = num(before.best_score_rank), bRank = num(after.best_score_rank);
        if (aRank !== null && bRank !== null && aRank >= 1 && bRank <= 8) add('rank-upgrade', aRank, bRank);
      }
    }
    charts.set(key(after), chart);
  };
  for (const snapshot of history) {
    const next = snapshot.full ? new Map<string, UserdataSong>() : new Map(state);
    const nextObserved = snapshot.full ? new Map<string, string>() : new Map(observed);
    for (const song of snapshot.songs) {
      const before = state.get(key(song));
      // Delta rows are chart records, not field patches: absent evidence stays absent.
      visit(song, before, snapshot.full ? 'full-snapshot' : 'delta-snapshot', observed.get(key(song)));
      const score = num(song.high_score);
      if (score !== null) bestScores.set(key(song), Math.max(bestScores.get(key(song)) ?? score, score));
      next.set(key(song), song);
      nextObserved.set(key(song), snapshot.timestamp);
    }
    state = next;
    observed = nextObserved;
  }
  // Current data proves attendance only; it is not an additional historical transition.
  for (const song of current) visit(song, undefined, 'full-snapshot');
  const events = [...charts.values()].map(chart => {
    if (!chart.facts.length) chart.facts.push({ type: 'played', before: null, after: null, delta: null });
    chart.facts.sort((a, b) => importance[b.type] - importance[a.type]);
    // A later DF subsumes earlier FC/clear headlines on the same chart.
    const crownTypes = ['df', 'fc', 'clear-upgrade'];
    const bestCrown = chart.facts.find(f => crownTypes.includes(f.type));
    chart.facts = chart.facts.filter(f => !crownTypes.includes(f.type) || f === bestCrown).slice(0, 3);
    return chart;
  }).sort((a, b) => b.importance - a.importance || a.songId - b.songId || a.level - b.level).slice(0, 3);
  const dataMode = history.some(s => s.full) ? 'FULL_HISTORY' : current.length || history.length ? 'SNAPSHOT_LIMITED' : 'INSUFFICIENT';
  // No dated record is absence of evidence, not proof the player did not play offline.
  const known = current.some(s => s.update_datetime || s.highscore_datetime) || history.some(s => s.songs.some(row => row.update_datetime || row.highscore_datetime));
  return { calendarDay, dataMode, attendance: charts.size ? 'played' : known ? 'not_played' : 'unknown', uniqueCharts: known || charts.size ? charts.size : null, events };
}
