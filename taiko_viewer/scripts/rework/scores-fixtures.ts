// Intercepted responses for the slice B self-check: the signed-in player's score pages need the database and a
// signed-in user. Typed against the real response types (checked with tsc, see stage-2-progress.md "切片 B"), so a
// field a page reads cannot drift from what the API returns. Only used by scores-scenarios.mjs; never served.
// Song ids 1–60 exist in the synthetic catalog of detail-data.mjs (the score list's real /api/content/songs read).
import type { AccountAuthUser } from "../../composables/useAccountAuthStatus";
import type { ProgressOptions } from "../../composables/useProgressOptions";
import type { RecommendationGoalPreview, RecommendationToolPayload } from "../../types/recommendation-tool";
import type { TargetRecommendationsPayload } from "../../types/recommendation-intelligence";

type ScoreRow = ReturnType<typeof import("../../server/internal/account/shared").toSongRow>;
type BindingSummary = ReturnType<typeof import("../../server/internal/account/shared").sanitizeBinding>;

export const fixtureUser = {
  id: 9002,
  username: "成绩自检账号 selfcheck",
  email: "scores-selfcheck@example.invalid",
  emailVerified: true,
  avatarUrl: "",
  createdAt: "2026-01-01T00:00:00.000Z",
  titles: [],
  annualSummaryAccess: true,
  myTaikoReadModelAccess: false,
  developerApiV1Access: false
} satisfies AccountAuthUser;

const binding = (id: number, source: "wahlap" | "hiroba" | "manual", current: boolean) =>
  ({
    id,
    taikoId: source === "manual" ? `manual-${id}` : `10000000${id}`,
    source,
    displayName: source === "manual" ? "合成手动账号" : `10000000${id}`,
    isManual: source === "manual",
    canExternalSync: source !== "manual",
    isCurrent: current,
    verifiedTitle: null,
    verifiedTitleplateId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  }) satisfies BindingSummary;

/** Two bindings: a synced one (current) and a manual one. */
export const fixtureBindings = (currentId = 1) => {
  const bindings = [binding(1, "wahlap", currentId === 1), binding(2, "manual", currentId === 2)];
  return { bindings, currentBinding: bindings.find((b) => b.isCurrent) ?? null };
};

const pad = (n: number) => String(n).padStart(2, "0");
/**
 * 130 score rows on songs 1–60 (oni / ura / hard), crowns and ranks spread over every state, a removed song, a
 * custom (uncatalogued) title and a locked row. Update times are distinct so the server order is unambiguous.
 */
export function fixtureScoreRows(): ScoreRow[] {
  const rows: ScoreRow[] = [];
  for (let i = 0; i < 130; i++) {
    const songNo = (i % 60) + 1;
    const level = i < 60 ? 4 : i < 100 ? 5 : 3;
    const kind = i % 5; // 0 dondaful, 1 full, 2 clear, 3 played, 4 played (no clear)
    const good = 600 + ((i * 37) % 300);
    const ok = kind === 0 ? 0 : 3 + (i % 40);
    const ng = kind <= 1 ? 0 : 1 + (i % 9);
    const day = new Date(Date.UTC(2026, 10, 15) - i * 3_600_000 * 7);
    const stamp = `${day.getUTCFullYear()}-${pad(day.getUTCMonth() + 1)}-${pad(day.getUTCDate())} ${pad(day.getUTCHours())}:${pad(day.getUTCMinutes())}:00`;
    const custom = i === 7;
    rows.push({
      songNo: custom ? 900001 : songNo,
      level,
      levelLabel: ["", "简单", "普通", "困难", "魔王", "里魔王"][level],
      title: custom ? "合成自定义曲目 Custom Long Title" : `合成曲目 ${songNo}`,
      titleJp: custom ? "" : `テスト楽曲 ${songNo}`,
      subtitle: "",
      category: "",
      bpm: String(120 + songNo),
      version: "",
      artists: "",
      maxCombo: custom ? "" : 300 + songNo * 7 + level * 120,
      starLevel: custom ? "" : level === 3 ? 6 + (songNo % 3) : 8 + (songNo % 3),
      shelfStatus: custom ? null : songNo === 3 ? 1 : 0,
      isCustom: custom,
      isLocked: i === 1 || i === 12,
      highScore: 1_000_000 - i * 3_731 - kind * 9_000,
      bestScoreRank: [8, 7, 6, 5, 4, 3, 2, 0][i % 8],
      goodCnt: good,
      okCnt: ok,
      ngCnt: ng,
      poundCnt: 10 + (i % 30),
      stageCnt: 1 + (i % 25),
      clearCnt: kind <= 2 ? 1 + (i % 6) : 0,
      fullComboCnt: kind <= 1 ? 1 + (i % 3) : 0,
      dondafulComboCnt: kind === 0 ? 1 : 0,
      comboCnt: kind <= 1 ? good + ok : 100 + (i % 200),
      updateDatetime: stamp,
      highscoreDatetime: stamp
    });
  }
  return rows;
}

/** /api/account/songs with the server's rules (server/utils/account/songs.ts listAccountSongs). */
export function serveScores(rows: ScoreRow[], currentBinding: BindingSummary, query: URLSearchParams) {
  const keyword = String(query.get("keyword") || "").trim().toLowerCase();
  const level = Number(query.get("level") || 0);
  const page = Math.max(1, Number(query.get("page") || 1));
  const pageSize = Math.min(100, Math.max(10, Number(query.get("pageSize") || 25)));
  const filtered = rows
    .filter((r) => !(level > 0 && r.level !== level))
    .filter((r) => !keyword || r.title.toLowerCase().includes(keyword) || r.titleJp.toLowerCase().includes(keyword) || String(r.songNo).includes(keyword))
    .sort((a, b) => new Date(b.updateDatetime).getTime() - new Date(a.updateDatetime).getTime() || b.highScore - a.highScore);
  const start = (page - 1) * pageSize;
  return { currentBinding, total: filtered.length, page, pageSize, items: filtered.slice(start, start + pageSize) };
}

export const fixtureProgressOptions = {
  dani: [
    { version: "2025", grades: ["一段", "五段", "十段", "玄人"] },
    { version: "2024", grades: ["一段", "十段"] }
  ],
  constants: { pass: ["10.0", "10.5", "11.0"], comprehensive: ["9.5", "10.0"] },
  stars: [8, 9, 10],
  named: ["合成全良难度 A", "合成全良难度 B"],
  pages: { pass: { "10.0": 2, "10.5": 1, "11.0": 3 }, comprehensive: { "9.5": 1, "10.0": 2 }, star: { "8": 1, "9": 2, "10": 3 }, named: { "合成全良难度 A": 1, "合成全良难度 B": 2 } }
} satisfies ProgressOptions;

export const fixtureRecommendations = (n: number) =>
  ({
    model: "v1",
    basis: "rating",
    profileId: "1",
    scoreRevision: "selfcheck-r1",
    generatedAt: "2026-11-18T00:00:00.000Z",
    items: Array.from({ length: Math.min(n, 12) }, (_, i) => ({
      songId: i + 10,
      level: i % 3 === 0 ? 5 : 4,
      title: `合成曲目 ${i + 10}`,
      isUnplayed: i % 4 === 3,
      candidateIndicator: Math.round((10 + i * 0.07) * 100) / 100,
      referenceIndicator: 10.2,
      deviationRatio: Math.round(((10 + i * 0.07) / 10.2 - 1) * 1000) / 1000,
      inStrictRange: i < 9,
      starLevel: i % 3 === 0 ? 10 : 9,
      recommendationToken: `selfcheck-token-${i}`,
      canCreateGoal: i % 4 !== 3
    })),
    image: null
  }) satisfies RecommendationToolPayload;

export const fixtureGoalPreview = (songId: number, difficultyType: number) =>
  ({
    profileId: "1",
    scoreRevision: "selfcheck-r1",
    songId,
    difficultyType,
    title: `合成曲目 ${songId}`,
    starLevel: 9,
    goalOptions: ["fc", "score-pb"],
    activeGoal: null
  }) satisfies RecommendationGoalPreview;

export const fixtureTargets = (target: TargetRecommendationsPayload["target"]) =>
  ({
    model: "v1",
    target,
    candidateCount: 3,
    requiredCount: 5,
    isEnough: false,
    items: [0, 1, 2].map((i) => ({
      songId: 20 + i,
      level: 4,
      star: String(8 + i),
      title: `合成曲目 ${20 + i}`,
      currentScore: i === 2 ? null : 950_000 - i * 12_000,
      targetScore: i === 2 ? null : 1_000_000,
      targetKey: target,
      gapKind: i === 2 ? "unplayed" : "score",
      gapValue: i === 2 ? null : 50_000 + i * 12_000,
      progressPercent: i === 2 ? 0 : 95 - i * 1.2,
      targetRecommendationIndex: 8.4 - i,
      isUnplayed: i === 2
    }))
  }) satisfies TargetRecommendationsPayload;
