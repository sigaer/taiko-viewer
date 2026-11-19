// Intercepted responses for the slice A self-check: the parts of the song detail page that need the database or a
// signed-in user. Typed against the real response types (checked with tsc, see stage-1-progress.md "切片 A"), so a
// field the page reads cannot drift from what the API returns. Only used by detail-scenarios.mjs; never served.
import type { AccountAuthUser } from "../../composables/useAccountAuthStatus";
import type { AccountSongScoresPayload } from "../../types/account-song";
import type { ForumThreadCard } from "../../types/forum";
import type { ChartUgcSummary, ViewerChartUgcState } from "../../types/ugc";

export const fixtureUser = {
  id: 9001,
  username: "selfcheck",
  email: "selfcheck@example.invalid",
  emailVerified: true,
  avatarUrl: "",
  createdAt: "2026-01-01T00:00:00.000Z",
  titles: [],
  annualSummaryAccess: false,
  myTaikoReadModelAccess: false,
  developerApiV1Access: false
} satisfies AccountAuthUser;

/** /api/account/songs/1: oni (dondaful, rank 8), ura (full combo, rank 6), hard (played only, rank 0) */
export const fixtureScores = {
  items: [
    { songNo: 1, level: 4, levelLabel: "oni", starLevel: 9, maxCombo: 787, highScore: 1003210, bestScoreRank: 8, goodCnt: 787, okCnt: 0, ngCnt: 0, poundCnt: 41, stageCnt: 23, clearCnt: 20, fullComboCnt: 12, dondafulComboCnt: 3, comboCnt: 787, updateDatetime: "2026-11-10 21:04:00", highscoreDatetime: "2026-11-09 20:31:00" },
    { songNo: 1, level: 5, levelLabel: "edit", starLevel: 10, maxCombo: 907, highScore: 912345, bestScoreRank: 6, goodCnt: 840, okCnt: 64, ngCnt: 0, poundCnt: 12, stageCnt: 9, clearCnt: 5, fullComboCnt: 2, dondafulComboCnt: 0, comboCnt: 907, updateDatetime: "2026-11-01 19:00:00", highscoreDatetime: "" },
    { songNo: 1, level: 3, levelLabel: "hard", starLevel: 7, maxCombo: 667, highScore: 401000, bestScoreRank: 0, goodCnt: 300, okCnt: 200, ngCnt: 167, poundCnt: 3, stageCnt: 1, clearCnt: 0, fullComboCnt: 0, dondafulComboCnt: 0, comboCnt: 120, updateDatetime: "2026-10-01 10:00:00", highscoreDatetime: "2026-10-01 10:00:00" }
  ]
} satisfies AccountSongScoresPayload;

const tags = [
  { slug: "rhythmTricky", labelKey: "ugc.tags.rhythmTricky", groupKey: "rhythm", sortOrder: 1 },
  { slug: "evenPatterns", labelKey: "ugc.tags.evenPatterns", groupKey: "technique", sortOrder: 2 },
  { slug: "tempoChanges", labelKey: "ugc.tags.tempoChanges", groupKey: "readability_speed", sortOrder: 3 }
];

export const fixtureUgc = (songId: number, difficulty: 1 | 2 | 3 | 4 | 5) =>
  ({
    chart: { chartId: `${songId}-${difficulty}`, songId, difficultyCode: difficulty },
    difficulty: { count: 12, verifiedCount: 9, distribution: { "-2": 0, "-1": 1, "0": 3, "1": 6, "2": 2 }, mean: 0.75, summary: "hard" },
    tags: [
      { slug: "rhythmTricky", labelKey: "ugc.tags.rhythmTricky", groupKey: "rhythm", count: 7, percentage: 58 },
      { slug: "tempoChanges", labelKey: "ugc.tags.tempoChanges", groupKey: "readability_speed", count: 3, percentage: 25 }
    ],
    availableTags: tags,
    tips: [
      { tipId: "tip-1", body: "合成提示：第 40 小节开始的十六分音符要提前准备。", helpfulCount: 5, verifiedPlay: true, author: { displayName: "合成玩家", avatarUrl: "", isDeleted: false }, createdAt: "2026-11-01T00:00:00.000Z" },
      { tipId: "tip-2", body: "テスト：後半の BPM 変化に注意。", helpfulCount: 1, verifiedPlay: false, author: { displayName: "", avatarUrl: "", isDeleted: true }, createdAt: "2026-11-02T00:00:00.000Z" }
    ]
  }) satisfies ChartUgcSummary;

export const fixtureViewerUgc = (songId: number, difficulty: 1 | 2 | 3 | 4 | 5, vote: -2 | -1 | 0 | 1 | 2 | null = null) =>
  ({
    chart: { chartId: `${songId}-${difficulty}`, songId, difficultyCode: difficulty },
    difficultyVote: vote,
    tagSlugs: ["rhythmTricky"],
    tagSelections: [{ ...tags[0]!, status: "active" }],
    tip: null,
    helpfulTipIds: []
  }) satisfies ViewerChartUgcState;

export const fixtureThreads = (songId: number, difficulty: number) => ({
  items: [1, 2].map(
    (n) =>
      ({
        id: 700 + n,
        section: { id: 1, slug: "general", name: "综合", icon: "", accentColor: "" },
        author: { id: 1, username: "合成作者", avatarUrl: "", role: "user", roleLabel: "", taikoIdMasked: "", verifiedTitle: null, verifiedTitleplateId: null },
        threadType: "discussion",
        title: `合成讨论 ${n}：这张谱的后半段怎么练`,
        summary: "",
        coverImageUrl: "",
        tags: [],
        song: { id: songId, title: "合成曲目", titleJp: "", coverUrl: "", category: "", difficultyType: difficulty, difficultyLabel: "魔王", level: 9 },
        status: "published",
        isPinned: false,
        isFeatured: false,
        isLocked: false,
        likeCount: 0,
        replyCount: n * 3,
        viewCount: 10,
        createdAt: "2026-11-01T00:00:00.000Z",
        updatedAt: "2026-11-01T00:00:00.000Z",
        latestPostAt: "2026-11-01T00:00:00.000Z",
        viewerHasLiked: false,
        viewerHasFavorited: false
      }) satisfies ForumThreadCard
  )
});
