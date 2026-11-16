// Design V1.1 原型 Mock 数据 · 装配与导出。
// 精选内容在 catalog.js（手写），生成器在 generate.js（确定性，无 Math.random / Date.now，「今天」= 2026-11-16）。
// 数据集（M1）：full（默认）= 30 首精选 + 生成曲，共 ≥ 1,500 首；demo = 只有 30 首精选。
//   解析顺序：地址 ?data=full|demo（location.search 或 hash 中 ? 之后）→ localStorage['tv-design-v1'].dataset → 'full'。
//
// 原型字段 → 真实模型字段（taiko_viewer/types/*）
// | 原型                         | 真实模型                                                    |
// |------------------------------|-------------------------------------------------------------|
// | song.id / legacyIds          | SongCatalogItem.id / legacy_ids                             |
// | song.ja / song.zh            | song_name_jp / song_name                                    |
// | song.genre                   | SongCatalogItem.type                                        |
// | song.bpm / version / artist  | bpm / version[] / artists[]                                 |
// | song.levels[0..4]            | level_1 … level_5（星级）                                   |
// | song.shelf (0/1/2)           | shelf_status（国行实装 / 国行未上架 / 其他平台）            |
// | song.openDay                 | open_day                                                    |
// | song.hasAudio / hasChartImage| audio_path 存在 / 谱面图资源存在（tja_path）                |
// | chart.constant / c75 / c99   | V2ConstantsItem.mainConstant / subConstant1 / subConstant2  |
// | chart.notes                  | V2ConstantsItem.totalNotes · max_combo[d]                   |
// | chart.abilities.*            | V2ConstantsItem.stamina / handspeed / burst / complex / rhythm |
// | score.songId / d / star      | AccountSongScore.songNo / level / starLevel                 |
// | score.score / good / ok / ng | highScore / goodCnt / okCnt / ngCnt                         |
// | score.combo / roll / plays   | comboCnt / poundCnt / stageCnt                              |
// | score.crown                  | 由 clearCnt / fullComboCnt / dondafulComboCnt 推出          |
// | score.rank                   | bestScoreRank                                               |
// | score.daysAgo                | highscoreDatetime（相对「今天」）                           |
// | ratingHistory[].v            | GrowthMeasurement.rating                                    |
// | dimHistory[key][]            | GrowthMeasurement.dimensions[key]                           |
// | laneDays[].facts[].type      | GrowthFact.type（df/fc/score-pb/…）                         |
// | weeklies[].theme.type        | WeeklyGrowthTheme.type                                      |
// | goal.type/status/baseline    | PlayerGoal.goalType / status / baseline                     |
// | goal.target / evidence       | PlayerGoal.targetData / completionEvidence                  |
// | thread.section / type        | ForumThreadCard.section.slug / threadType                   |
// | thread.pinned / likes / replies / views | isPinned / likeCount / replyCount / viewCount    |

import {
  GENRES, DIFFS, RANKS, CROWNS, DIMS, CHART_AXES, UGC_TAGS, FACT, GOAL_TYPES, THREAD_TYPES,
  SONG_ROWS, CURATED_ALIASES, PLAYER_BASE, GOALS_BASE, WEEKLY_BASE, USERS_BASE, THREADS_BASE,
  POSTS_4017_BASE, NOTIFICATIONS_BASE, sections, recommendations, chartUgc, danGrades, danCourse, events, devApps,
} from './catalog.js'
import {
  buildCuratedSongs, genSongs, curatedScores, generatedScores, genRatingHistory, genDimHistory, genLaneDays,
  genWeeklies, genGoalHistory, genUsers, genThreads, genLongThreadPosts, genShortPosts, genNotifications,
  makeFinders, normalize, parseConfig, round,
} from './generate.js'

export { GENRES, DIFFS, RANKS, CROWNS, DIMS, CHART_AXES, UGC_TAGS, FACT, GOAL_TYPES, THREAD_TYPES, sections, recommendations, chartUgc, danGrades, danCourse, events, devApps }
export { normalize, parseConfig }

const now = () => (typeof performance !== 'undefined' ? performance.now() : 0)
const T0 = now()

/* ---------------- 数据集 ---------------- */
function resolveDataset() {
  const ok = (v) => (v === 'full' || v === 'demo' ? v : null)
  try {
    if (typeof location !== 'undefined' && location) {
      const parts = [location.search || '', (location.hash || '').split('?')[1] || '']
      for (const q of parts) {
        const v = ok(new URLSearchParams(q).get('data'))
        if (v) return v
      }
    }
  } catch {
    /* 非浏览器环境 */
  }
  try {
    if (typeof localStorage !== 'undefined' && localStorage) {
      const v = ok(JSON.parse(localStorage.getItem('tv-design-v1') || '{}').dataset)
      if (v) return v
    }
  } catch {
    /* 存储不可用 */
  }
  return 'full'
}

export const datasetName = resolveDataset()
const FULL = datasetName === 'full'
const GENERATED_SONGS = 1490
const SCORE_TARGET = 880

export const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('en-US'))
export const fx = (n, d = 2) => (n == null ? '—' : Number(n).toFixed(d))

/* ---------------- 曲库 ---------------- */
const curated = buildCuratedSongs(SONG_ROWS, CURATED_ALIASES)
const generated = FULL ? genSongs(GENERATED_SONGS, curated.map((s) => s.id)) : { songs: [], edge: null }

export const songs = [...curated, ...generated.songs]
export const songById = Object.fromEntries(songs.map((s) => [s.id, s]))

const chartMap = new Map()
for (const s of songs) for (const c of s.charts) chartMap.set(s.id * 8 + c.d, c)
/** O(1)；找不到返回 undefined（与 V1 的 .find 行为一致）。 */
export const chartOf = (songId, d) => chartMap.get(Number(songId) * 8 + Number(d))
export const densityOf = (chart) => chart?.density ?? []

export const songsByShelf = { 0: [], 1: [], 2: [] }
for (const s of songs) (songsByShelf[s.shelf] ||= []).push(s)

// M2 边界桶：精选曲中天然存在的 + 生成曲中按序号落位的。
const CURATED_EDGE = {
  special: [100136, 100052, 88],
  sameTitle: [100138, 100136, 100120],
  noUra: [851, 816],
  unlisted: [438],
  otherPlatform: [1290],
  bpmRange: [100140, 1412],
}
export const EDGE = Object.fromEntries(
  ['longJa', 'longZh', 'special', 'sameTitle', 'noUra', 'oniOnly', 'noConstant', 'noChartImage', 'noAudio', 'noArtist', 'unlisted', 'otherPlatform', 'manyAliases', 'bpmRange'].map((k) => [
    k,
    [...(CURATED_EDGE[k] || []), ...(generated.edge?.[k] || [])].filter((id) => songById[id]),
  ]),
)

/** 每首歌一条搜索文档；norm 字段已按 P1 规范化。 */
export const searchDocs = songs.map((s) => ({
  id: s.id,
  title: { zh: s.zh, ja: s.ja },
  norm: { zh: normalize(s.zh), ja: normalize(s.ja), aliases: s.aliases.map(normalize), artist: normalize(s.artist) },
}))

/* ---------------- 成绩（M3） ---------------- */
const cScores = curatedScores(curated, RANKS)
const fix = (songId, d, patch) => {
  const s = cScores.find((x) => x.songId === songId && x.d === d)
  if (s) Object.assign(s, patch)
}
fix(615, 4, { ng: 3, ok: 41, good: 688, crown: 0, score: 968440, rank: 7, acc: 96.79, combo: 402, daysAgo: 1, plays: 23 })
fix(233, 5, { ng: 0, ok: 0, good: chartOf(233, 5).notes, crown: 2, score: 1004290, rank: 8, acc: 100, combo: chartOf(233, 5).notes, daysAgo: 0, plays: 31 })
fix(278, 5, { locked: true })

export const scores = FULL ? [...cScores, ...generatedScores(generated.songs, SCORE_TARGET - cScores.length, RANKS)] : cScores
const scoreMap = new Map(scores.map((x) => [x.songId * 8 + x.d, x]))
/** O(1)；找不到返回 undefined。 */
export const scoreOf = (songId, d) => scoreMap.get(Number(songId) * 8 + Number(d))
export const bestList = [...scores].sort((a, b) => b.rt - a.rt).slice(0, 30)

/* ---------------- 玩家 ---------------- */
const crownCounts = { clear: 0, fc: 0, dfc: 0 }
const rankCounts = [0, 0, 0, 0, 0, 0, 0] // RANKS[2..8]：白粹 … 极
let plays = 0
for (const x of scores) {
  if (x.crown >= 0) crownCounts.clear++
  if (x.crown >= 1) crownCounts.fc++
  if (x.crown === 2) crownCounts.dfc++
  if (x.rank >= 2) rankCounts[x.rank - 2]++
  plays += x.plays
}
const top20 = [...scores].sort((a, b) => b.rt - a.rt).slice(0, 20)
const top20Rt = top20.length ? round(top20.reduce((a, b) => a + b.rt, 0) / top20.length) : 0

export const player = {
  ...PLAYER_BASE,
  dims: { ...PLAYER_BASE.dims },
  dimsPrev: { ...PLAYER_BASE.dimsPrev },
  bindings: PLAYER_BASE.bindings.map((b) => ({ ...b })),
  // 展示值固定为 11.97（与历史曲线末点、各页文案一致）；按成绩算出的 top-20 平均见 datasetInfo.top20Rt。
  rating: PLAYER_BASE.rating,
  crownCounts, // 累计：clear ⊇ fc ⊇ dfc
  rankCounts,
  plays,
  scoredCharts: scores.length,
}

/* ---------------- 成长（M4） ---------------- */
export const ratingHistory = genRatingHistory(player.rating)
const DIM_KEYS = DIMS.map((d) => d.key)
export const dimHistory = genDimHistory(player.dims, WEEKLY_BASE.dimDeltas, DIM_KEYS)

const laneSongs = [615, 233, 278, 512, 88, 345, 179, 100126, 971, 1351, 1412, 702, 1053, 816]
export const laneDays = (() => {
  const days = genLaneDays(songById, laneSongs, 120)
  const set = (ago, facts) => {
    const d = days.find((x) => x.daysAgo === ago)
    d.played = true
    d.charts = Math.max(d.charts, 9)
    d.facts = facts
  }
  set(0, [
    { type: 'df', songId: 233, d: 5, before: 998120, after: 1004290, time: '20:41' },
    { type: 'score-pb', songId: 512, d: 4, before: 962300, after: 971840, time: '20:18' },
    { type: 'rank-upgrade', songId: 88, d: 4, before: 948900, after: 953120, time: '19:52', rankFrom: 6, rankTo: 7 },
    { type: 'ng-reduced', songId: 615, d: 4, before: 7, after: 3, time: '19:37' },
  ])
  set(4, [
    { type: 'fc', songId: 345, d: 4, before: 955210, after: 967480, time: '21:05' },
    { type: 'score-pb', songId: 179, d: 4, before: 921400, after: 934020, time: '20:30' },
  ])
  set(9, [
    { type: 'goal-completed', songId: 278, d: 5, before: 5, after: 2, time: '20:02' },
    { type: 'score-pb', songId: 278, d: 5, before: 941000, after: 958660, time: '20:02' },
  ])
  return days
})()

const goalSongPool = curated.filter((s) => s.charts.some((c) => c.d === 4 && c.constant != null)).map((s) => s.id)
export const goals = genGoalHistory(
  GOALS_BASE.map((g) => JSON.parse(JSON.stringify(g))),
  goalSongPool,
  chartOf,
  RANKS,
  25, // 1 个进行中 + 24 条历史
)

export const weeklies = genWeeklies({ base: WEEKLY_BASE, laneDays, ratingHistory, dimHistory, goals, songById, FACT, DIFFS, keys: DIM_KEYS })
export const weekly = weeklies[0]

const crossAgo = (th) => ratingHistory.find((p) => p.v >= th)?.daysAgo
export const milestones = [
  { ago: 0, type: 'df', songId: 233, d: 5, text: '千本桜（里）全良', textJa: '千本桜（裏）全良' },
  { ago: crossAgo(11.8), type: 'rating', text: 'Rating 越过 11.8', textJa: 'Rating 11.8 到達' },
  { ago: 36, type: 'fc', songId: 179, d: 4, text: 'はたラク2000 全连', textJa: 'はたラク2000 フルコンボ' },
  { ago: 74, type: 'dan', text: '通过九段', textJa: '九段合格' },
  { ago: crossAgo(11.5), type: 'rating', text: 'Rating 越过 11.5', textJa: 'Rating 11.5 到達' },
  { ago: 104, type: 'fc', songId: 1351, d: 4, text: '蛇鉄 全连', textJa: '蛇鉄 フルコンボ' },
  { ago: crossAgo(11.0), type: 'rating', text: 'Rating 越过 11.0', textJa: 'Rating 11.0 到達' },
  { ago: 158, type: 'df', songId: 278, d: 4, text: '花漾 全良', textJa: '花漾 全良' },
  { ago: 196, type: 'fc', songId: 512, d: 4, text: 'ナイト・オブ・ナイツ 全连', textJa: 'ナイト・オブ・ナイツ フルコンボ' },
  { ago: 212, type: 'dan', text: '通过八段', textJa: '八段合格' },
  { ago: crossAgo(10.5), type: 'rating', text: 'Rating 越过 10.5', textJa: 'Rating 10.5 到達' },
  { ago: 288, type: 'df', songId: 41, d: 4, text: 'アンパンマンのマーチ 全良', textJa: 'アンパンマンのマーチ 全良' },
  { ago: crossAgo(10.0), type: 'rating', text: 'Rating 越过 10.0', textJa: 'Rating 10.0 到達' },
  { ago: 336, type: 'dan', text: '通过七段', textJa: '七段合格' },
  { ago: 391, type: 'fc', songId: 233, d: 4, text: '千本桜 全连', textJa: '千本桜 フルコンボ' },
].sort((a, b) => a.ago - b.ago)

/* ---------------- 社区（M5） ---------------- */
export const sectionBySlug = Object.fromEntries(sections.map((s) => [s.slug, s]))
export const users = genUsers(USERS_BASE, danGrades, player.rating)
const userKeys = Object.keys(users)
export const leaderboard = Object.entries(users)
  .filter(([, u]) => u.rating != null)
  .sort((a, b) => b[1].rating - a[1].rating || (a[0] < b[0] ? -1 : 1)) // 不用 localeCompare：避免载入时初始化 ICU
  .slice(0, 20)
  .map(([key, u], i) => ({ rank: i + 1, key, ...u }))

const threadSongPool = curated.map((s) => s.id)
export const threads = genThreads(THREADS_BASE, 240, { userKeys, songPool: threadSongPool, songById, DIFFS, danGrades })
export const threadById = Object.fromEntries(threads.map((t) => [t.id, t]))

export const threadPosts = genLongThreadPosts(POSTS_4017_BASE, userKeys, 'hayate')
// 与楼层数保持一致：回复数 = 楼层（除 1 楼）+ 楼中楼
threadById[4017].replies = threadPosts.length - 1 + threadPosts.reduce((a, p) => a + (p.replies?.length || 0), 0)

const postsMemo = new Map([[4017, threadPosts]])
/** 4017 返回长帖；其他 id 返回确定性生成的短楼层；不存在的帖子返回 []。 */
export function postsOf(threadId) {
  const id = Number(threadId)
  if (postsMemo.has(id)) return postsMemo.get(id)
  const t = threadById[id]
  const posts = t ? genShortPosts(t, userKeys) : []
  postsMemo.set(id, posts)
  return posts
}

export const notifications = genNotifications(NOTIFICATIONS_BASE, 60, threads, userKeys)

/* ---------------- 查谱（P3 / P4）与最近看过（P10） ---------------- */
export const { findByConfig, findByNotes } = makeFinders(songs)
export const RECENT_DEFAULT = [615, 233, 100140, 512]

/* ---------------- 数据集信息 ---------------- */
export const datasetInfo = {
  name: datasetName,
  songs: songs.length,
  charts: chartMap.size,
  scores: scores.length,
  threads: threads.length,
  top20Rt,
  generatedMs: round(now() - T0, 1),
}
