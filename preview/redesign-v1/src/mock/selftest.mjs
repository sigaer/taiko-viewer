// Mock 数据自检：node src/mock/selftest.mjs
// 在 Node 中以两种数据集导入 data.js，检查数量、边界桶、索引一致性、确定性与生成耗时。
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const target = process.argv[2] || 'data.js'
let failures = 0
const ok = (cond, msg) => {
  if (!cond) {
    failures++
    console.error('  FAIL', msg)
  }
}

let n = 0
async function load(dataset) {
  globalThis.location = { search: `?data=${dataset}`, hash: '' }
  globalThis.localStorage = { getItem: () => null, setItem() {} }
  const url = pathToFileURL(join(here, target)).href + `?i=${n++}`
  return import(url)
}
const sha = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16)

/* ---------- full ---------- */
const A = await load('full')
console.log('full:', A.datasetInfo)
ok(A.datasetName === 'full', 'datasetName full')
ok(A.songs.length >= 1500, `songs ≥ 1500 (${A.songs.length})`)
ok(A.scores.length >= 800, `scores ≥ 800 (${A.scores.length})`)
ok(A.threads.length >= 240, `threads ≥ 240 (${A.threads.length})`)
ok(A.weeklies.length === 12, 'weeklies = 12')
ok(A.weekly === A.weeklies[0], 'weekly = weeklies[0]')
ok(A.laneDays.length === 120, 'laneDays = 120')
ok(A.laneDays[119].daysAgo === 0, 'laneDays today last')
ok(A.ratingHistory.length === 400, 'ratingHistory = 400')
ok(A.ratingHistory.at(-1).v === A.player.rating, 'ratingHistory ends at player.rating')
ok(A.ratingHistory.every((p, i, a) => i === 0 || p.v >= a[i - 1].v), 'ratingHistory monotone')
ok(Object.values(A.dimHistory).every((a) => a.length === 60), 'dimHistory 60 points')
ok(A.DIMS.every((d) => A.dimHistory[d.key][59] === A.player.dims[d.key]), 'dimHistory ends at dims')
ok(A.goals.filter((g) => g.status === 'active').length === 1, '1 active goal')
ok(A.goals.filter((g) => g.status !== 'active').length === 24, '24 goal history')
ok(A.goals.filter((g) => g.status !== 'active').every((g) => g.evidence), 'history goals have evidence')
ok(A.milestones.length >= 12 && A.milestones.length <= 16, `milestones ~14 (${A.milestones.length})`)
ok(A.notifications.length === 60, 'notifications = 60')
ok(A.notifications.slice(0, 3).every((x) => x.unread) && A.notifications.slice(3).every((x) => !x.unread), 'first 3 unread')
ok(A.threadPosts.length === 60, 'thread 4017 has 60 floors')
ok(A.threadPosts.some((p) => (p.replies?.length || 0) >= 8), 'a floor with 8+ nested replies')
const longFloor = A.threadPosts.find((p) => p.blocks.reduce((a, b) => a + (b.p?.length || 0) + (b.list?.join('').length || 0), 0) >= 2000)
ok(longFloor && longFloor.blocks.some((b) => b.list) && longFloor.blocks.some((b) => b.img), '2000+ char floor with list + image')
ok(A.postsOf(4017) === A.threadPosts, 'postsOf(4017)')
ok(A.postsOf(4012).length >= 3 && JSON.stringify(A.postsOf(4012)) === JSON.stringify(A.postsOf(4012)), 'postsOf other thread')
ok(A.threads.filter((t) => t.title.length >= 120).length >= 3, 'three 120-char titles')
ok(A.threads.some((t) => t.summary.length >= 280), '280-char summary')
ok(A.threads.some((t) => !t.song), 'threads without song')
ok(A.threads.some((t) => t.tags.length === 5), 'thread with 5 tags')
ok(A.threads.some((t) => t.pinned) && A.threads.some((t) => t.featured) && A.threads.some((t) => t.locked), 'pinned/featured/locked')
ok(new Set(A.threads.map((t) => t.author)).size >= 30, `distinct authors (${new Set(A.threads.map((t) => t.author)).size})`)
ok(Object.keys(A.users).length >= 40, 'users ≥ 40')
ok(['mochidon', 'hayate', 'sakura', 'kumo', 'rin', 'tako', 'nagi', 'uta'].every((k) => A.users[k]), 'original user keys')
ok(A.leaderboard.length === 20 && A.leaderboard.every((u, i, a) => i === 0 || a[i - 1].rating >= u.rating), 'leaderboard top 20')
ok(A.threads.every((t) => A.users[t.author] && A.sectionBySlug[t.section] && A.THREAD_TYPES[t.type]), 'thread refs valid')
ok(A.threads.every((t) => !t.song || A.chartOf(t.song.id, t.song.d)), 'thread song refs valid')
ok(A.notifications.every((x) => A.users[x.who] && (!x.thread || A.threadById[x.thread])), 'notification refs valid')
ok(A.threadPosts.every((p) => A.users[p.author] && (p.replies || []).every((r) => A.users[r.author])), 'post authors valid')
ok(new Set(A.threads.map((t) => t.id)).size === A.threads.length, 'thread ids unique')
ok(A.threads.slice(0, 9).map((t) => t.id).join() === '4021,4017,4012,4009,4006,4001,3996,3990,3984', 'hand threads first')

// 边界桶
const has = (s, re) => re.test(s)
const checks = {
  longJa: (s) => [...s.ja].length >= 40,
  longZh: (s) => [...s.zh].length >= 28,
  special: (s) => has(s.ja, /[＊～↑♡!?！？（）]/),
  sameTitle: (s) => s.zh === s.ja,
  noUra: (s) => s.levels[4] == null && !s.charts.some((c) => c.d === 5),
  oniOnly: (s) => s.levels.slice(0, 3).every((x) => x == null) && s.charts.every((c) => c.d >= 4),
  noConstant: (s) => s.charts.some((c) => c.d >= 4 && c.constant == null),
  noChartImage: (s) => s.hasChartImage === false,
  noAudio: (s) => s.hasAudio === false,
  noArtist: (s) => s.artist === '',
  unlisted: (s) => s.shelf === 1,
  otherPlatform: (s) => s.shelf === 2,
  manyAliases: (s) => s.aliases.length === 6,
  bpmRange: (s) => s.bpm.includes('-'),
}
for (const [k, fn] of Object.entries(checks)) {
  const ids = A.EDGE[k]
  ok(ids && ids.length > 0, `EDGE.${k} non-empty`)
  ok(ids.every((id) => A.songById[id] && fn(A.songById[id])), `EDGE.${k} exhibits property (${ids})`)
}
ok(A.EDGE.bpmRange.some((id) => A.songById[id].bpm === '44.5-178'), 'bpm 44.5-178 exists')
const pct = (fn) => A.songs.filter(fn).length / A.songs.length
console.log('  shares: noConst %s noImg %s shelf1 %s shelf2 %s', pct((s) => s.charts.some((c) => c.d === 4 && c.constant == null)).toFixed(3), pct((s) => !s.hasChartImage).toFixed(3), pct((s) => s.shelf === 1).toFixed(3), pct((s) => s.shelf === 2).toFixed(3))
ok(A.songs.every((s) => Array.isArray(s.aliases) && typeof s.hasChartImage === 'boolean' && typeof s.hasAudio === 'boolean'), 'song new fields')
ok(new Set(A.songs.map((s) => s.id)).size === A.songs.length, 'song ids unique')
ok(new Set(A.songs.map((s) => s.genre)).size === 8, 'all 8 genres')
const nNew = A.songs.filter((s) => !s.generated && s.openDay >= '2025').length
const newest = [...A.songs].sort((a, b) => b.openDay.localeCompare(a.openDay)).slice(0, nNew)
ok(newest.every((s) => !s.generated), 'curated 2025–2026 songs are newest')

// 成绩与索引
ok(A.scores.every((x) => A.chartOf(x.songId, x.d)), 'every score references a chart')
ok(A.scores.every((x) => A.scoreOf(x.songId, x.d) === x), 'scoreOf consistent')
ok(A.songs.every((s) => s.charts.every((c) => A.chartOf(s.id, c.d) === c)), 'chartOf consistent')
ok(A.chartOf('615', '4') === A.chartOf(615, 4), 'chartOf coerces string ids')
// Phase B：V1.2 的 233 / 278 已换成真实曲号 413（Bad Apple!! feat.nomico）/ 1104（Aragami）
ok(A.scoreOf(615, 4).score === 968440 && A.scoreOf(413, 5).crown === 2 && A.scoreOf(1104, 5).locked, 'fixed demo rows')
ok(A.player.crownCounts.dfc === A.scores.filter((x) => x.crown === 2).length, 'crownCounts derived')
ok(A.player.rankCounts.reduce((a, b) => a + b, 0) === A.scores.filter((x) => x.rank >= 2).length, 'rankCounts derived')
ok(A.player.scoredCharts === A.scores.length, 'scoredCharts')
ok(A.bestList.length === 30, 'bestList 30')
ok(Math.abs(A.datasetInfo.top20Rt - A.player.rating) < 0.6, `top-20 rt close to rating (${A.datasetInfo.top20Rt})`)
ok(A.chartOf(615, 4).density.length === 64 && A.chartOf(615, 4).density === A.chartOf(615, 4).density, 'lazy density memoized')

// 搜索 / 查谱
ok(A.normalize('センボンザクラ') === A.normalize('せんぼんざくら'), 'kana normalize')
ok(A.normalize('ＡＢＣ　Def!') === 'abcdef', 'width/case/punct normalize')
ok(A.searchDocs.length === A.songs.length && A.searchDocs.find((d) => d.id === 615).norm.aliases.includes('tengu'), 'searchDocs')
const q = A.parseConfig('16 oxxo 180 鬼10')
const canon = A.findByConfig(q)
console.log('  findByConfig canonical:', canon.length, 'zero-case:', A.findByConfig({ division: 48, pattern: 'oooooooooooo', d: 1 }).length)
ok(canon.length >= 5, 'canonical config ≥ 5')
ok(canon.every((m) => m.d === 4 && A.chartOf(m.songId, 4).star === 10), 'canonical matches oni ★10')
ok(JSON.stringify(canon) === JSON.stringify(A.findByConfig(q)), 'findByConfig deterministic')
ok(A.findByConfig({ division: 48, pattern: 'oooooooooooo', d: 1 }).length === 0, 'findByConfig zero case')
const fn = A.findByNotes(1000)
ok(fn.length === 6 && fn.every((x, i, a) => i === 0 || Math.abs(x.diff) >= Math.abs(a[i - 1].diff)), 'findByNotes')
ok(A.RECENT_DEFAULT.every((id) => A.songById[id]), 'RECENT_DEFAULT')

/* ---------- 确定性 ---------- */
const B = await load('full')
ok(sha(A.songs) === sha(B.songs), 'songs deterministic')
ok(sha(A.scores) === sha(B.scores), 'scores deterministic')
ok(sha(A.threads) === sha(B.threads) && sha(A.laneDays) === sha(B.laneDays) && sha(A.weeklies) === sha(B.weeklies), 'community/growth deterministic')
console.log('  hashes songs=%s scores=%s', sha(A.songs), sha(A.scores))

/* ---------- demo ---------- */
const D = await load('demo')
console.log('demo:', D.datasetInfo)
ok(D.datasetName === 'demo' && D.songs.length === 30, 'demo = 30 songs')
ok(D.songs.every((s) => !s.generated), 'demo curated only')
ok(D.scores.every((x) => D.chartOf(x.songId, x.d)), 'demo scores valid')
ok(D.threads.every((t) => !t.song || D.songById[t.song.id]), 'demo thread songs valid')
ok(D.goals.every((g) => D.chartOf(g.songId, g.d)), 'demo goals valid')
ok(D.laneDays.every((d) => d.facts.every((f) => D.songById[f.songId])), 'demo lane facts valid')
ok(Object.values(D.EDGE).flat().every((id) => D.songById[id]), 'demo EDGE ids exist')
ok(sha(D.songs) === sha(A.songs.slice(0, 30)), 'curated songs identical across datasets')

/* ---------- 视图使用的导出名 ---------- */
const src = join(here, '..')
const files = []
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f)
    if (statSync(p).isDirectory()) {
      if (f !== 'mock') walk(p)
    } else if (/\.(vue|js)$/.test(f)) files.push(p)
  }
}
walk(src)
const names = new Set()
for (const f of files) {
  for (const m of readFileSync(f, 'utf8').matchAll(/import\s*\{([^}]+)\}\s*from\s*['"][./]+mock\/data(?:\.js)?['"]/g)) {
    for (const part of m[1].split(',')) names.add(part.trim().split(/\s+as\s+/)[0])
  }
}
names.delete('')
const missing = [...names].filter((x) => !(x in A))
ok(missing.length === 0, `view imports exist (missing: ${missing})`)
console.log('  view imports checked:', names.size)

console.log(failures ? `\n${failures} check(s) FAILED` : '\nALL CHECKS PASSED')
process.exit(failures ? 1 : 0)
