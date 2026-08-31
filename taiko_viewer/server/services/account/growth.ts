import { access, constants as fsConstants, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createError } from "h3";
import type { GrowthDailyProgress, GrowthDataMode, GrowthPlanItem, PlayerGrowthOverview } from "~/types/player-growth";
import { buildPlayerGrowthState, growthCalendarDay } from "~/utils/playerGrowth";
import { resolveDifficultyPresentation } from "~/utils/difficulty";
import { getSongCatalog } from "~/server/services/content";
import { getCurrentBindingRow, getRuntimePaths, getUserdataPath, readUserdata, type UserdataPayload, type UserdataSong } from "~/server/internal/account/shared";
import { runGrowthPythonJson } from "./personal";

const TIMEZONE = "Asia/Shanghai" as const;

const numberValue = (value: unknown) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const chartKey = (song: Pick<UserdataSong, "song_no" | "level">) => `${numberValue(song.song_no)}:${numberValue(song.level)}`;
const scoreValue = (song?: UserdataSong) => numberValue(song?.high_score);
const crownValue = (song?: UserdataSong) => {
  if (!song) return null;
  if (numberValue(song.dondaful_combo_cnt) > 0) return 2;
  if (numberValue(song.full_combo_cnt) > 0) return 1;
  if (numberValue(song.clear_cnt) > 0) return 0;
  return -1;
};
const reliableTimestamp = (song?: UserdataSong) => String(song?.highscore_datetime || song?.update_datetime || "").trim();

type Snapshot = { full: boolean; timestamp: string; songs: UserdataSong[] };

const isFullPayload = (payload: UserdataPayload) => payload._meta?.full === true || (!payload._meta && Boolean(payload.profile && payload.achievement && Array.isArray(payload.songs)));

const loadHistory = async (taikoId: string): Promise<Snapshot[]> => {
  const { userdataDir } = getRuntimePaths();
  const directory = resolve(userdataDir, taikoId);
  const names = (await readdir(directory).catch(() => [] as string[])).filter((name) => name.startsWith("data_") && name.endsWith(".json")).sort();
  const snapshots: Snapshot[] = [];
  for (const name of names.slice(-2000)) {
    try {
      const payload = JSON.parse(await readFile(resolve(directory, name), "utf-8")) as UserdataPayload;
      if (!Array.isArray(payload.songs)) continue;
      snapshots.push({ full: isFullPayload(payload), timestamp: String(payload._meta?.ts || name), songs: payload.songs });
    } catch {
      continue;
    }
  }
  return snapshots;
};

const changedSongs = (before: Map<string, UserdataSong>, after: Map<string, UserdataSong>, incoming: UserdataSong[]) => {
  const changes: Array<{ before?: UserdataSong; after: UserdataSong }> = [];
  for (const song of incoming) {
    const previous = before.get(chartKey(song));
    const current = after.get(chartKey(song));
    if (current && JSON.stringify(previous || null) !== JSON.stringify(current)) changes.push({ before: previous, after: current });
  }
  return changes;
};

const buildDailyProgress = async (current: UserdataPayload, catalog: Awaited<ReturnType<typeof getSongCatalog>>, history: Snapshot[]): Promise<GrowthDailyProgress> => {
  const calendarDay = growthCalendarDay(new Date(), TIMEZONE);
  const mode: GrowthDataMode = history.length && history.some((item) => item.full) ? "FULL_HISTORY" : current.songs?.some((song) => growthCalendarDay(reliableTimestamp(song), TIMEZONE) === calendarDay) ? "SNAPSHOT_LIMITED" : "INSUFFICIENT";
  const events: Array<{ before?: UserdataSong; after: UserdataSong }> = [];
  let state = new Map<string, UserdataSong>();
  for (const snapshot of history) {
    const next = snapshot.full ? new Map(snapshot.songs.map((song) => [chartKey(song), song])) : new Map(state);
    const changes = changedSongs(state, next, snapshot.full ? snapshot.songs : snapshot.songs);
    if (state.size) events.push(...changes);
    state = next;
  }
  if (!history.length) {
    for (const song of current.songs || []) if (growthCalendarDay(reliableTimestamp(song), TIMEZONE) === calendarDay) events.push({ after: song });
  }
  const todayEvents = events.filter((event) => growthCalendarDay(reliableTimestamp(event.after), TIMEZONE) === calendarDay);
  if (!todayEvents.length) {
    for (const song of current.songs || []) {
      if (growthCalendarDay(reliableTimestamp(song), TIMEZONE) === calendarDay) todayEvents.push({ after: song });
    }
  }
  const unique = new Map(todayEvents.map((event) => [chartKey(event.after), event]));
  const comparableTodayEvents = todayEvents.filter((event) => event.before);
  const scoreImprovements = comparableTodayEvents.filter((event) => scoreValue(event.after) > scoreValue(event.before)).length;
  const newBestCount = comparableTodayEvents.filter((event) => scoreValue(event.after) > 0 && scoreValue(event.after) > scoreValue(event.before)).length;
  const crownChanges = comparableTodayEvents.filter((event) => crownValue(event.after) !== crownValue(event.before) && crownValue(event.after) !== null).length;
  const breakthroughs = comparableTodayEvents.map((event) => {
    const scoreDelta = scoreValue(event.after) - scoreValue(event.before);
    const beforeCrown = crownValue(event.before);
    const afterCrown = crownValue(event.after);
    const kind = !event.before ? "first-play" as const : afterCrown !== beforeCrown && afterCrown !== null ? "crown" as const : "score" as const;
    return { event, kind, scoreDelta, beforeCrown, afterCrown };
  }).filter((item) => item.kind === "crown" || item.scoreDelta > 0).sort((left, right) => (left.kind === "crown" ? 2 : 1) - (right.kind === "crown" ? 2 : 1) || right.scoreDelta - left.scoreDelta || chartKey(left.event.after).localeCompare(chartKey(right.event.after)));
  const breakthrough = breakthroughs[0] ? {
    songId: numberValue(breakthroughs[0].event.after.song_no),
    title: catalog.find((song) => Number(song.id) === numberValue(breakthroughs[0].event.after.song_no))?.song_name || String(breakthroughs[0].event.after.song_name || `#${breakthroughs[0].event.after.song_no}`),
    level: numberValue(breakthroughs[0].event.after.level),
    kind: breakthroughs[0].kind,
    scoreBefore: breakthroughs[0].event.before ? scoreValue(breakthroughs[0].event.before) : null,
    scoreAfter: scoreValue(breakthroughs[0].event.after) || null,
    scoreDelta: breakthroughs[0].scoreDelta || null,
    crownBefore: breakthroughs[0].beforeCrown,
    crownAfter: breakthroughs[0].afterCrown
  } : null;
  const attendance = unique.size ? "played" : mode === "INSUFFICIENT" ? "unknown" : "not_played";
  return { calendarDay, dataMode: mode, attendance, uniqueCharts: mode === "INSUFFICIENT" ? null : unique.size, scoreImprovements: mode === "FULL_HISTORY" ? scoreImprovements : null, newBestCount: mode === "FULL_HISTORY" ? newBestCount : null, crownChanges: mode === "FULL_HISTORY" ? crownChanges : null, breakthrough: mode === "FULL_HISTORY" ? breakthrough : null };
};

export const getPlayerGrowthOverview = async (userId: number): Promise<PlayerGrowthOverview> => {
  const requestStartedAt = performance.now();
  const authStartedAt = performance.now();
  const binding = await getCurrentBindingRow(userId);
  const authDurationMs = performance.now() - authStartedAt;
  if (!binding) throw createError({ statusCode: 400, statusMessage: "请先绑定鼓众 ID" });
  try { await access(getUserdataPath(binding.taiko_id), fsConstants.R_OK); } catch { throw createError({ statusCode: 404, statusMessage: "未找到本地成绩数据，请先在「多端同步」更新数据" }); }
  const scoreStartedAt = performance.now();
  const [current, catalog, history] = await Promise.all([readUserdata(binding.taiko_id), getSongCatalog(), loadHistory(binding.taiko_id)]);
  const scoreDurationMs = performance.now() - scoreStartedAt;
  const mode: GrowthDataMode = history.some((item) => item.full) ? "FULL_HISTORY" : current.songs?.length ? "SNAPSHOT_LIMITED" : "INSUFFICIENT";
  const computePromise = runGrowthPythonJson(binding.taiko_id, mode, 3);
  const computed = await computePromise;
  const stateAggregationStartedAt = performance.now();
  const playerState = buildPlayerGrowthState(computed.playerState.dimensions, computed.playerState.sampleCount, mode, computed.playerState.overallRating);
  const stateAggregationDurationMs = performance.now() - stateAggregationStartedAt;
  const stateDurationMs = stateAggregationDurationMs;
  const progressStartedAt = performance.now();
  const dailyProgressPromise = Promise.resolve().then(() => buildDailyProgress(current, catalog, history));
  const planStartedAt = performance.now();
  const recommendations = computed.todayPlan.items;
  const usedFallback = Boolean(computed.todayPlan.usedFallback);
  const scoreMap = new Map((current.songs || []).map((song) => [chartKey(song), song]));
  const items = recommendations.slice(0, 3).map((item) => {
    const song = scoreMap.get(`${item.songId}:${item.level}`);
    const catalogSong = catalog.find((entry) => Number(entry.id) === item.songId) || null;
    const difficulty = resolveDifficultyPresentation(catalogSong, item.level);
    if (!difficulty.difficultyType) return null;
    return { songId: item.songId, difficultyType: difficulty.difficultyType, starLevel: difficulty.starLevel, title: item.title, isUnplayed: item.isUnplayed, targetDimension: playerState.dataSufficiency === "ready" ? playerState.priorityDimension : null, reason: usedFallback ? "general-fallback" as const : "target-dimension" as const, currentBestScore: song ? scoreValue(song) || null : null, currentBestRank: song ? numberValue(song.best_score_rank) || null : null };
  }).filter(Boolean) as GrowthPlanItem[];
  const planDurationMs = performance.now() - planStartedAt;
  const dailyProgress = await dailyProgressPromise;
  const progressDurationMs = performance.now() - progressStartedAt;
  console.info("[player-growth] overview timing", {
    userId,
    authDurationMs: Math.round(authDurationMs),
    scoreDurationMs: Math.round(scoreDurationMs),
    stateDurationMs: Math.round(stateDurationMs),
    planDurationMs: Math.round(planDurationMs),
    pythonDurationMs: Number(computed.timing?.totalPythonMs || 0),
    pythonTiming: computed.timing || null,
    stateAggregationDurationMs: Math.round(stateAggregationDurationMs),
    progressDurationMs: Math.round(progressDurationMs),
    totalDurationMs: Math.round(performance.now() - requestStartedAt),
    recommendationCount: items.length,
    historyFileCount: history.length,
    dataMode: mode,
    recommendationFallback: usedFallback
  });
  return { playerState, todayPlan: { targetDimension: playerState.dataSufficiency === "ready" ? playerState.priorityDimension : null, items, usedFallback }, dailyProgress, dataStatus: { mode, timezone: TIMEZONE } };
};
