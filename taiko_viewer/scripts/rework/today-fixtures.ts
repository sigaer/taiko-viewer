// Intercepted responses for the slice C self-check (今日 signed in, /my/growth, /my/weekly, goals). These pages need
// the database and a signed-in user. Typed against the real response types (checked with tsc, see
// stage-2-progress.md "切片 C"), so a field a page reads cannot drift from what the API returns. Only used by
// today-scenarios.mjs; never served. Song ids 1–60 exist in the synthetic catalog of detail-data.mjs.
import type { AccountAuthUser } from "../../composables/useAccountAuthStatus";
import type { BilibiliDynamicResponse } from "../../types/bilibili";
import type { GoalBaseline, GoalType, PlayerGoal } from "../../types/player-goal";
import type {
  GrowthDailyProgress,
  GrowthFact,
  GrowthPlanItem,
  PlayerGrowthOverview,
  RecentGrowthResponse,
  SkillPassportMilestone,
  SkillPassportPoint,
  SkillPassportResponse,
  WeeklyGrowthResponse
} from "../../types/player-growth";

export const fixtureUser = {
  id: 9003,
  username: "今日自检账号 selfcheck",
  email: "today-selfcheck@example.invalid",
  emailVerified: true,
  avatarUrl: "",
  createdAt: "2026-01-01T00:00:00.000Z",
  titles: [],
  annualSummaryAccess: false,
  myTaikoReadModelAccess: false,
  developerApiV1Access: false
} satisfies AccountAuthUser;

/** /api/account/songs as the home state resolver reads it (page 1, size 1, scoreOnly). */
export const fixtureScorePresence = (has: boolean) => ({ total: has ? 1 : 0, items: has ? [{ highScore: 912345, clearCnt: 1 }] : [] });

const baseline = (over: Partial<GoalBaseline> = {}): GoalBaseline => ({
  provenance: null,
  recordPresent: true,
  highScore: 905120,
  goodCnt: 640,
  okCnt: 31,
  ngCnt: 4,
  comboCnt: 512,
  clearCnt: 3,
  fullComboCnt: 0,
  dondafulComboCnt: 0,
  bestScoreRank: 5,
  highscoreDatetime: "2026-11-10T12:00:00.000Z",
  updateDatetime: "2026-11-10T12:00:00.000Z",
  scoreObservedAt: "2026-11-10T12:00:00.000Z",
  capturedAt: "2026-11-12T08:00:00.000Z",
  sourceRevision: "rev-1",
  sourceCompleteness: "complete",
  ...over
});

export function fixtureGoal(goalType: GoalType = "fc", over: Partial<PlayerGoal> = {}): PlayerGoal {
  return {
    id: `goal-${goalType}`,
    profileId: "1",
    songId: 12,
    difficultyType: 4,
    title: "合成曲目 12",
    starLevel: 8,
    goalType,
    baselineVersion: 1,
    baseline: baseline(),
    source: "today-plan",
    sourceBasis: "speed",
    sourceMode: "dimension",
    sourceRank: 1,
    sourceRevision: "rev-1",
    sourceGeneratedAt: "2026-11-12T08:00:00.000Z",
    targetData: { comparison: "greater", field: "fullComboCnt", value: 0 },
    status: "active",
    createdAt: "2026-11-12T08:00:00.000Z",
    cancelledAt: null,
    unavailable: false,
    ...over
  };
}

/** A completed goal with its evaluation evidence: before → after of the goal type. */
export function fixtureCompletedGoal(goalType: GoalType, before: number, after: number): PlayerGoal {
  return fixtureGoal(goalType, {
    id: `done-${goalType}`,
    status: "completed",
    completedAt: "2026-11-17T09:00:00.000Z",
    completionEvidence: {
      evaluationVersion: 1,
      evaluatedAt: "2026-11-17T09:00:00.000Z",
      observationCapturedAt: "2026-11-17T08:59:00.000Z",
      observationRevision: "rev-2",
      baselineRevision: "rev-1",
      source: "wahlap",
      provenance: { source: "wahlap", account: "1", topology: "t", marker: "m", observedAt: "2026-11-17T08:59:00.000Z", contentHash: "h" },
      result: { goalType, before, after, delta: after - before, facts: {} }
    }
  });
}

export function fixturePlan(count = 6): GrowthPlanItem[] {
  return Array.from({ length: count }, (_, i) => ({
    goalOptions: i === 2 ? [] : (["fc", "score-pb", "ng-reduced"] as GoalType[]),
    songId: 10 + i * 3,
    difficultyType: (i % 3 === 0 ? 5 : 4) as 4 | 5,
    starLevel: 8 + (i % 3),
    title: i === 1 ? "合成曲目 13 · 一个特别长的曲名用来检查在手机宽度下的截断与换行是否正常" : `合成曲目 ${10 + i * 3}`,
    isUnplayed: i === 4,
    targetDimension: "speed",
    reason: "target-dimension",
    currentBestScore: i === 4 ? null : 880000 + i * 9137,
    currentBestRank: i === 4 ? null : 3 + (i % 5)
  }));
}

export function fixtureDaily(kind: "played" | "not_played" | "unknown" | "quiet" = "played"): GrowthDailyProgress {
  const day = "2026-11-18";
  if (kind === "not_played" || kind === "unknown") return { calendarDay: day, dataMode: "FULL_HISTORY", attendance: kind, uniqueCharts: null, events: [] };
  const played = { songId: 21, level: 4, title: "合成曲目 21", occurredAt: `${day}T06:00:00Z`, evidence: "history" as const, importance: 0, evidenceRevision: "r2", facts: [{ type: "played" as const, before: null, after: null, delta: null }] };
  if (kind === "quiet") return { calendarDay: day, dataMode: "FULL_HISTORY", attendance: "played", uniqueCharts: 1, events: [played] };
  return {
    calendarDay: day,
    dataMode: "FULL_HISTORY",
    attendance: "played",
    uniqueCharts: 7,
    events: [
      { songId: 15, level: 4, title: "合成曲目 15", occurredAt: `${day}T05:00:00Z`, evidence: "history", importance: 80, evidenceRevision: "r2", facts: [{ type: "score-pb", before: 951020, after: 968310, delta: 17290 }, { type: "fc", before: null, after: null, delta: null }] },
      { songId: 18, level: 5, title: "合成曲目 18", occurredAt: `${day}T05:20:00Z`, evidence: "history", importance: 70, evidenceRevision: "r2", facts: [{ type: "rank-upgrade", before: 5, after: 6, delta: 1 }, { type: "ng-reduced", before: 9, after: 4, delta: -5 }] },
      { songId: 24, level: 4, title: "合成曲目 24", occurredAt: `${day}T05:40:00Z`, evidence: "history", importance: 90, evidenceRevision: "r2", facts: [{ type: "df", before: null, after: null, delta: null }] },
      played
    ]
  };
}

const SKILLS = { big_song: 9.42, stamina: 8.85, speed: 7.96, accuracy_power: 9.88, rhythm: 9.12, complex: 8.4 } as const;

export function fixtureOverview(
  options: { goal?: "active" | "unavailable" | "completed-score" | "completed-fc" | "completed-rank" | "none"; plan?: number; daily?: Parameters<typeof fixtureDaily>[0]; sufficiency?: "ready" | "limited" | "insufficient" } = {}
): PlayerGrowthOverview {
  const goal = options.goal ?? "active";
  const sufficiency = options.sufficiency ?? "ready";
  const skills = sufficiency === "insufficient" ? [] : Object.entries(SKILLS).map(([key, value]) => ({ key: key as keyof typeof SKILLS, value }));
  return {
    profileId: "1",
    scoreRevision: "rev-2",
    sourceGeneratedAt: "2026-11-18T08:00:00.000Z",
    activeGoal: goal === "active" ? fixtureGoal("fc") : goal === "unavailable" ? fixtureGoal("score-pb", { id: "goal-gone", unavailable: true }) : null,
    recentCompletedGoal:
      goal === "completed-score" ? fixtureCompletedGoal("score-pb", 905120, 931870) : goal === "completed-fc" ? fixtureCompletedGoal("fc", 0, 1) : goal === "completed-rank" ? fixtureCompletedGoal("rank-upgrade", 5, 6) : null,
    playerState: {
      overallRating: sufficiency === "insufficient" ? null : 9.27,
      skills,
      priorityDimension: sufficiency === "insufficient" ? null : "speed",
      tiedDimensions: sufficiency === "insufficient" ? [] : ["speed"],
      dataSufficiency: sufficiency,
      basis: sufficiency === "insufficient" ? "insufficient-evidence" : "lowest-valid-dimension",
      sampleCount: sufficiency === "insufficient" ? 0 : 120
    },
    todayPlan: { targetDimension: "speed", items: fixturePlan(options.plan ?? 6), usedFallback: false },
    dailyProgress: fixtureDaily(options.daily ?? "played"),
    dataStatus: { mode: "FULL_HISTORY", timezone: "Asia/Shanghai" }
  };
}

const fact = (i: number, type: GrowthFact["type"], before: number | null, after: number | null, songId: number | undefined, difficultyType = 4): GrowthFact => ({
  id: `fact-${i}`,
  factKey: `fact-${i}-${type}`,
  ownerId: "9003",
  bindingId: "1",
  type,
  title: songId === undefined ? "" : `合成曲目 ${songId}`,
  ...(songId === undefined ? {} : { songId, difficultyType }),
  before,
  after,
  delta: before !== null && after !== null ? after - before : null,
  goalType: type === "goal-completed" ? "fc" : null,
  temporal: { occurredAt: "2026-11-18T05:00:00Z", observedAt: "2026-11-18T08:00:00Z", attributedDay: "2026-11-18", precision: "instant" },
  evidence: { source: "score-history", sourceRevision: "rev-2", evidenceVersion: 1 }
});

export function fixtureRecent(state: "new" | "caught-up" | "unavailable" = "new"): RecentGrowthResponse {
  const facts =
    state === "new"
      ? [fact(1, "score-pb", 951020, 968310, 15), fact(2, "fc", null, null, 15), fact(3, "df", null, null, 24), fact(4, "rank-upgrade", 5, 6, 18, 5), fact(5, "ng-reduced", 9, 4, 18, 5), fact(6, "clear", null, null, 27)]
      : [];
  return {
    profileId: "1",
    state,
    observedAt: "2026-11-18T08:00:00Z",
    facts: facts.slice(0, 5),
    totalFacts: facts.length,
    boundary: { acknowledgedToken: state === "new" ? null : "tok-0", currentToken: state === "unavailable" ? null : "tok-1", acknowledgeRequired: state === "new", recovered: false }
  };
}

const days = (from: string, n: number, step: number) =>
  Array.from({ length: n }, (_, i) => new Date(Date.parse(`${from}T00:00:00Z`) + i * step * 86400000).toISOString().slice(0, 10));

function point(day: string, i: number, segment: number): SkillPassportPoint {
  const g = i * 0.03 + segment * 0.2;
  return {
    id: `m-${segment}-${day}`,
    day,
    capturedAt: `${day}T08:00:00.000Z`,
    scoreRevision: `rev-${segment}-${i}`,
    measurementVersion: segment + 1,
    algorithmVersion: `a${segment + 1}`,
    modelRevision: null,
    rating: Math.round((8.6 + g) * 100) / 100,
    dimensions: {
      big_song: Math.round((8.9 + g) * 100) / 100,
      stamina: Math.round((8.4 + g * 0.8) * 100) / 100,
      speed: Math.round((7.4 + g * 1.2) * 100) / 100,
      accuracy_power: Math.round((9.3 + g * 0.6) * 100) / 100,
      rhythm: Math.round((8.7 + g) * 100) / 100,
      complex: i === 3 && segment === 1 ? null : Math.round((8.0 + g * 0.9) * 100) / 100
    },
    focus: "speed",
    sampleCount: 100 + i,
    availabilityState: "ready"
  };
}

function milestones(count: number): SkillPassportMilestone[] {
  const types = ["df", "fc", "rank-upgrade", "score-pb", "ng-reduced", "clear", "combo-improved", "goal-completed"] as const;
  return Array.from({ length: count }, (_, i) => {
    const type = types[i % types.length];
    const numeric = type === "score-pb" ? [930000, 951020] : type === "ng-reduced" ? [9, 4] : type === "rank-upgrade" ? [5, 6] : type === "combo-improved" ? [480, 512] : [null, null];
    return {
      id: `ms-${i}`,
      primaryType: type,
      factKeys: [`f-${i}`],
      day: i === 5 ? null : days("2026-08-20", 90, 1)[89 - i * 4],
      observedAt: i === 5 ? "2026-10-02T08:00:00.000Z" : null,
      timeSemantics: i === 5 ? "observed" : "played",
      title: `合成曲目 ${15 + i}`,
      songId: type === "goal-completed" ? null : 15 + i,
      difficultyType: type === "goal-completed" ? null : 4,
      before: numeric[0],
      after: numeric[1],
      delta: numeric[0] !== null && numeric[1] !== null ? numeric[1] - numeric[0] : null,
      goalCompleted: i === 1,
      observationOnly: i === 5
    };
  });
}

/**
 * /api/account/growth/passport as the service composes it: the requested period plus `shared` (all measurement
 * segments, the curated milestones and one view per range), from which the page selects the range client side.
 */
export function fixturePassport(range: 30 | 90 | 180 | 365 = 90, options: { current?: boolean; milestones?: number } = {}): SkillPassportResponse {
  const seg0 = days("2026-08-25", 6, 7).map((d, i) => point(d, i, 0));
  const seg1 = days("2026-10-10", 10, 4).map((d, i) => point(d, i, 1));
  const segments = [
    { id: "s0", measurementVersion: 1, algorithmVersion: "a1", modelRevision: null, from: seg0[0].day, to: seg0.at(-1)!.day, points: seg0 },
    { id: "s1", measurementVersion: 2, algorithmVersion: "a2", modelRevision: null, from: seg1[0].day, to: seg1.at(-1)!.day, points: seg1 }
  ];
  const last = seg1.at(-1)!;
  const nodes = milestones(options.milestones ?? 11);
  const withCurrent = options.current !== false;
  const currentSegmentChange: SkillPassportResponse["currentSegmentChange"] = {
    start: seg1[0],
    end: last,
    compatible: true,
    reason: "compatible",
    ratingDelta: Math.round(((last.rating ?? 0) - (seg1[0].rating ?? 0)) * 100) / 100,
    dimensionDeltas: null,
    primaryDimensionChange: { key: "speed", before: seg1[0].dimensions.speed!, after: last.dimensions.speed!, delta: Math.round((last.dimensions.speed! - seg1[0].dimensions.speed!) * 100) / 100 },
    focusFrom: "accuracy_power",
    focusTo: "speed"
  };
  const focusTimeline: SkillPassportResponse["focusTimeline"] = [
    { id: "f0", segmentId: "s0", focus: "accuracy_power", startedAt: seg0[0].day, endedAt: seg0.at(-1)!.day, current: false },
    { id: "f1", segmentId: "s1", focus: "stamina", startedAt: seg1[0].day, endedAt: seg1[4].day, current: false },
    { id: "f2", segmentId: "s1", focus: "speed", startedAt: seg1[5].day, endedAt: last.day, current: true }
  ];
  const to = "2026-11-17";
  const view = (d: 30 | 90 | 180 | 365) => {
    const from = new Date(Date.parse(`${to}T00:00:00Z`) - (d - 1) * 86400000).toISOString().slice(0, 10);
    const pts = [...seg0, ...seg1].filter((p) => p.day >= from);
    const factFrom = d <= 30 ? from : "2026-08-20";
    const ms = nodes.filter((n) => (n.day ?? "2026-10-02") >= factFrom);
    return {
      range: { requestedDays: d, actualFrom: pts[0]?.day ?? null, actualTo: pts.at(-1)?.day ?? null, timezone: "Asia/Shanghai" as const, selectedDimension: "rating" as const, from, to, measurementDays: pts.length, factDays: (d <= 30 ? 30 : 90) as 30 | 90 },
      recentFactsFrom: factFrom,
      recentFactsTo: to,
      pointIds: pts.map((p) => p.id),
      milestoneIds: ms.map((n) => n.id),
      initialMilestoneIds: ms.slice(0, 8).map((n) => n.id),
      currentSegmentChange,
      focusTimeline: d <= 30 ? focusTimeline.slice(1) : focusTimeline
    };
  };
  const views = { 30: view(30), 90: view(90), 180: view(180), 365: view(365) };
  const selected = views[range];
  return {
    profileId: "1",
    coverage: { measurementFrom: "2026-08-25T08:00:00.000Z", measurementTo: `${last.day}T08:00:00.000Z`, measurementDays: 16, recentFactsFrom: selected.recentFactsFrom, recentFactsTo: to, recentFactsState: "partial" },
    current: withCurrent ? { rating: last.rating, dimensions: last.dimensions, focus: "speed", readiness: "ready" } : null,
    range: selected.range,
    segments: segments.map((s) => ({ ...s, points: s.points.filter((p) => selected.pointIds.includes(p.id)) })).filter((s) => s.points.length),
    currentSegmentChange,
    focusTimeline: selected.focusTimeline,
    milestones: nodes.filter((n) => selected.milestoneIds.includes(n.id)),
    initialMilestoneIds: selected.initialMilestoneIds,
    shared: { segments, milestones: nodes, views },
    activeGoal: fixtureGoal("fc"),
    recentCompletedGoal: fixtureCompletedGoal("score-pb", 905120, 931870),
    currentNextAction: { focus: "speed", todayPlan: { targetDimension: "speed", items: fixturePlan(3), usedFallback: false } }
  };
}

export function fixtureWeekly(kind: "full" | "quiet" | "method" = "full", week = "2026-11-16"): WeeklyGrowthResponse {
  const complete = week < "2026-11-16";
  const from = week >= "2026-11-16" ? "2026-11-16" : week;
  const to = complete ? new Date(Date.parse(`${from}T00:00:00Z`) + 6 * 86400000).toISOString().slice(0, 10) : "2026-11-18";
  const p0 = point(from, 0, 1);
  const p1 = point(to, 6, 1);
  const deltas = Object.fromEntries(Object.entries(p1.dimensions).map(([k, v]) => [k, v === null || p0.dimensions[k as keyof typeof p0.dimensions] === null ? null : Math.round((v - p0.dimensions[k as keyof typeof p0.dimensions]!) * 100) / 100])) as WeeklyGrowthResponse["measurementChange"]["dimensionDeltas"];
  if (deltas) deltas.stamina = -0.04;
  return {
    profileId: "1",
    week: { from, to, timezone: "Asia/Shanghai", isCompleteWeek: complete },
    coverage: { scoreHistoryFrom: `${from}T00:00:00Z`, scoreHistoryTo: `${to}T23:59:59Z`, scoreHistoryState: kind === "full" ? "complete" : "partial", measurementFrom: null, measurementTo: null, measurementState: "complete" },
    theme: { type: kind === "quiet" ? "quiet" : "score-breakthrough", evidenceFactKeys: [], evidenceMeasurementIds: [], confidence: "high" },
    highlights:
      kind === "quiet"
        ? []
        : [
            { id: "h1", primaryType: "score-pb", factKeys: ["a"], songId: 15, difficultyType: 4, title: "合成曲目 15", before: 951020, after: 968310, delta: 17290, goalCompleted: false },
            { id: "h2", primaryType: "fc", factKeys: ["b"], songId: 12, difficultyType: 4, title: "合成曲目 12", before: null, after: null, delta: null, goalCompleted: true },
            { id: "h3", primaryType: "df", factKeys: ["c"], songId: 24, difficultyType: 4, title: "合成曲目 24", before: null, after: null, delta: null, goalCompleted: false },
            { id: "h4", primaryType: "rank-upgrade", factKeys: ["d"], songId: 18, difficultyType: 5, title: "合成曲目 18", before: 5, after: 6, delta: 1, goalCompleted: false }
          ],
    measurementChange:
      kind === "full"
        ? { start: p0, end: p1, compatible: true, reason: "compatible", ratingDelta: 0.18, dimensionDeltas: deltas, primaryDimension: { key: "speed", before: p0.dimensions.speed!, after: p1.dimensions.speed!, delta: deltas!.speed! }, focusFrom: "stamina", focusTo: "speed" }
        : kind === "method"
          ? { start: p0, end: p1, compatible: false, reason: "algorithm-mismatch", ratingDelta: null, dimensionDeltas: null, primaryDimension: null, focusFrom: null, focusTo: null }
          : { start: null, end: null, compatible: false, reason: "insufficient", ratingDelta: null, dimensionDeltas: null, primaryDimension: null, focusFrom: null, focusTo: null },
    totals: kind === "quiet" ? { distinctCharts: 0, pb: 0, fc: 0, df: 0, rankUpgrade: 0, completedGoals: 0 } : { distinctCharts: 23, pb: 7, fc: 2, df: 1, rankUpgrade: 3, completedGoals: 1 },
    currentNextAction: kind === "quiet" ? null : { focus: "speed", todayPlan: { targetDimension: "speed", items: fixturePlan(3), usedFallback: false } }
  };
}

/** /api/bilibili/dynamic/:uid (third-party feed through the server proxy): a draw post and a video post. */
export function fixtureFeed(kind: "items" | "empty" | "error" = "items"): BilibiliDynamicResponse {
  if (kind === "error") return { code: -352, message: "selfcheck: upstream refused" };
  if (kind === "empty") return { code: 0, message: "0", data: { items: [] } };
  const author = { mid: 1, name: "合成运营账号", face: "https://i0.hdslb.com/bfs/face/selfcheck.jpg", pub_time: "11-17", pub_action: "" };
  const stat = { comment: { count: 12, forbidden: false }, forward: { count: 3, forbidden: false }, like: { count: 12345, forbidden: false, status: false } };
  const long = Array.from({ length: 6 }, (_, i) => `第 ${i + 1} 行：合成的长动态文字，用来检查折叠与展开。`).join("\n");
  return {
    code: 0,
    message: "0",
    data: {
      items: [
        {
          id_str: "900000000000000001",
          type: "DYNAMIC_TYPE_DRAW",
          modules: {
            module_author: author,
            module_dynamic: { desc: { text: long }, major: { type: "MAJOR_TYPE_DRAW", draw: { items: [1, 2, 3, 4].map((n) => ({ src: `https://i0.hdslb.com/bfs/new_dyn/selfcheck-${n}.jpg`, width: 800, height: 800 })) } } },
            module_stat: stat
          },
          basic: { jump_url: "//t.bilibili.com/900000000000000001" }
        },
        {
          id_str: "900000000000000002",
          type: "DYNAMIC_TYPE_AV",
          modules: {
            module_author: { ...author, pub_action: "投稿了视频" },
            module_dynamic: {
              major: {
                type: "MAJOR_TYPE_ARCHIVE",
                archive: { aid: "1", bvid: "BV1selfcheck", cover: "https://i0.hdslb.com/bfs/archive/selfcheck.jpg", title: "合成视频标题", desc: "合成视频简介", duration_text: "03:21", jump_url: "//www.bilibili.com/video/BV1selfcheck", stat: { play: "1.2万", danmaku: "88" } }
              }
            },
            module_stat: stat
          },
          basic: { jump_url: "" }
        }
      ]
    }
  };
}
