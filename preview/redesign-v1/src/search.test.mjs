// node src/search.test.mjs —— 命令面板纯逻辑测试（P1–P6）与每次按键耗时（1,500 首）。
// 数据模块若依赖浏览器对象，这里给最小的 shim。
const mem = new Map()
globalThis.localStorage ??= { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) }
globalThis.window ??= globalThis
globalThis.location ??= { search: process.env.DATA ? '?data=' + process.env.DATA : '', hash: '', href: 'http://localhost/' }
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {} })

const S = await import('./search.js')
const gen = await import('./mock/generate.js')
const mock = await import('./mock/data.js')

let pass = 0
let fail = 0
function ok(cond, name, extra = '') {
  if (cond) pass++
  else fail++
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`)
}

const DATA = { songs: mock.songs, threads: mock.threads, sections: mock.sections, users: mock.users, normalize: mock.normalize, parseConfig: mock.parseConfig, findByConfig: mock.findByConfig, findByNotes: mock.findByNotes }
let t0 = performance.now()
S.setData(DATA)
const tBuildReal = performance.now() - t0
console.log(`dataset=${mock.datasetInfo?.name} songs=${mock.songs.length} threads=${mock.threads.length} generatedMs=${mock.datasetInfo?.generatedMs}`)
const top = (q, opts) => S.searchSongs(q, 8, opts).items[0]
const ids = (q) => S.searchSongs(q, 8).items.map((x) => x.song.id)

// normalize
ok(S.normalize('センボン ザクラ！') === 'せんぼんざくら', 'normalize: 片假名→平假名、去空格与标点')
ok(S.normalize('ＬｉＳＡ') === 'lisa', 'normalize: 全角→半角、小写')

// 歌曲（Phase B：精选曲换成真实曲号与曲名后，用真实曲目做用例）
ok(ids('天狗').includes(615) && top('天狗').matched.kind === 'title', '天狗 → 天狗配乐（标题前缀）', JSON.stringify(top('天狗')?.matched))
ok(top('天狗配乐')?.song.id === 615 && top('天狗配乐').matched.kind === 'title', '天狗配乐 → 615（中文标题完全相同）')
ok(top('天狗囃子')?.song.id === 615 && top('天狗囃子').matched.kind === 'otherLang', '天狗囃子（zh 界面）→ 命中另一种语言')
ok(top('天狗囃子', { locale: 'ja' })?.matched.kind === 'title', '天狗囃子（ja 界面）→ 命中标题')
ok(top('てんぐばやし')?.song.id === 615, 'てんぐばやし → 天狗囃子（读音）', JSON.stringify(top('てんぐばやし')?.matched))
ok(top('テングバヤシ')?.song.id === 615, 'テングバヤシ → 天狗囃子（片假名）')
ok(top('tengubayashi')?.song.id === 615, 'tengubayashi → 天狗囃子')
const kien = top('kien')
ok(kien?.song.id === 851 && kien.matched.kind === 'alias' && /kien/i.test(kien.matched.text), 'kien → 気焔万丈神楽（别名）', JSON.stringify(kien?.matched))
// 拉丁查询词只在词首命中
const holic = S.searchSongs('holic').items
ok(holic[0]?.song.id === 851 && holic[0].matched.kind === 'artist', 'holic → 気焔万丈神楽第一（艺术家 SOUND HOLIC）', holic.map((x) => x.song.id).join(','))
ok(!S.searchSongs('auna').items.some((x) => x.song.id === 138), 'auna 不命中 Scars of FAUNA（词中间）')
ok(S.searchSongs('fauna').items.some((x) => x.song.id === 138), 'fauna → Scars of FAUNA（词首）')
ok(S.searchSongs('scar').items.some((x) => x.song.id === 138), 'scar → Scars of FAUNA（前缀）')
if (mock.songById[751]) ok(S.searchSongs('abracadabra').items.some((x) => x.song.id === 751), 'abracadabra → SHINING☆ABRACADABRA（☆ 后算词首）')
ok(S.searchSongs('daybyday').items[0]?.song.id === 106, 'daybyday → Day by Day!（跨词连写）')
ok(S.searchSongs('2000').items.some((x) => x.song.id === 179), '2000 → はたラク2000（拉丁与假名之间算词首）')
ok(S.normalizeWords('Scars of FAUNA') === 'scars of fauna' && S.normalizeWords('はたラク2000') === 'はたらく 2000', 'normalizeWords 保留词边界')
ok(top('615')?.song.id === 615 && top('615').matched.kind === 'id', '615 → 天狗囃子（曲目 ID）')
ok(top('bad apple 里')?.d === 5 && S.searchSongs('bad apple 里').wantUra, 'bad apple 里 → 默认进里谱')
ok(top('bad apple')?.d === 4, 'bad apple → 默认进魔王')
ok(S.searchSongs('zzzqqxx 不存在的歌').items.length === 0, '无结果查询 → 0 首')
// 排序：标题完全相同 > 前缀 > 别名 > 包含 > 艺术家
const order = S.searchSongs('星', 8).items.map((x) => x.matched.kind)
ok(order.length > 0, '「星」有结果', order.join(','))

// 配置串
const p = S.parseConfig('16 oxxo 180 鬼10')
ok(p.isConfig && p.division === 16 && p.pattern === 'oxxo' && p.bpm === 180 && p.d === 4 && p.star === 10, '16 oxxo 180 鬼10 → 解析', JSON.stringify(p))
const cfg = S.findConfig(p, 5)
ok(cfg.items.length >= 1 && cfg.items.every((x) => x.chart.d === 4 && x.chart.star === 10 && x.measure >= 1), '16 oxxo 180 鬼10 → ≥ 1 张谱', `${cfg.items.length} / ${cfg.total}`)
const cfgAll = S.findConfig(p, 50)
ok(cfg.items.every((x, i) => cfgAll.items[i].song.id === x.song.id && cfgAll.items[i].measure === x.measure), '配置结果：面板前 5 条 = 工具页前 5 条')
ok(!S.parseConfig('天狗囃子').isConfig && !S.parseConfig('xo').isConfig && !S.parseConfig('oxxo').isConfig, '普通查询 / 缺分音不是配置串')
const anyOrder = S.parseConfig('oxxo 16 鬼10 180')
ok(anyOrder.isConfig && anyOrder.division === 16 && anyOrder.pattern === 'oxxo' && anyOrder.star === 10, '宽松补充：词序任意也能解析（数据模块的 parseConfig 拒绝）', JSON.stringify(anyOrder))
const emptyCfg = S.findConfig(S.parseConfig('48 oxoxoxoxoxoxoxox 400 鬼1'), 5)
ok(emptyCfg.items.length === 0, '无命中的配置串 → 空结果（不回退到本地假数据）')

// 物量
ok(S.parseNotes('765') === 765 && S.parseNotes('1') === null && S.parseNotes('12345') === null, '纯数字 2–4 位 → 物量')
const nt = S.findNotes(765, 5)
const nt6 = S.findNotes(765, 6)
ok(nt.length === 5 && nt.every((x, i) => i === 0 || Math.abs(x.delta) >= Math.abs(nt[i - 1].delta)), '765 → 5 张物量最接近的谱', nt.map((x) => `${x.song.id}/${x.chart.d}:${x.delta}`).join(' '))
ok(nt.every((x, i) => nt6[i].song.id === x.song.id && nt6[i].chart.d === x.chart.d), '物量结果：前 k 条与 limit 无关')

// 帖子 / 操作 / 页面
const th = S.searchThreads('全良')
ok(th.items.length >= 1 && th.items.length <= 4, '全良 → 帖子', `${th.items.length} / ${th.total}`)
ok(S.searchThreads('疾风连打').items.some((t) => t.author === 'hayate'), '作者名 → 帖子')
const ac = S.searchActions('同步', { canSync: true })
ok(ac.some((a) => a.key === 'sync'), '同步 → 同步成绩操作')
ok(!S.searchActions('同步', { canSync: false }).some((a) => a.key === 'sync'), '不能同步时不出同步操作')
const rt = S.searchActions('天狗', { song: mock.songById[615], d: 4 }).find((a) => a.key === 'rt')
ok(rt && rt.to === '/tools/rt?song=615&d=4', '命中歌曲时 RT 计算器带上歌曲', rt?.to)
ok(S.searchPages('定数')[0]?.path === '/songs/constants', '定数 → 定数表页面')
ok(S.EXAMPLES.every((q) => S.searchSongs(q).items.length || S.findConfig(S.parseConfig(q)).items.length || S.findNotes(S.parseNotes(q)).length), '每个示例查询都有结果')

// 性能：真实数据集
const typed = ['天', '天狗', '天狗囃子', 't', 'te', 'ten', 'tengu', 'tengubayashi', 'k', 'ki', 'kien', 'h', 'ho', 'holic', '7', '76', '765', '16 oxxo 180 鬼10', '星', '星夜', 'Night', 'ドン', 'zzzz']
function timeAll() {
  let w = 0
  let sum = 0
  for (const q of typed) {
    const a = performance.now()
    S.searchSongs(q, 8)
    const pc = S.parseConfig(q)
    if (pc.isConfig) S.findConfig(pc, 5)
    const n = S.parseNotes(q)
    if (n) S.findNotes(n, 5)
    S.searchThreads(q)
    S.searchActions(q, { canSync: true })
    S.searchPages(q)
    const dt = performance.now() - a
    w = Math.max(w, dt)
    sum += dt
  }
  return [w, sum]
}
const [realWorst, realSum] = timeAll()
// 性能：合成 1,500 首
const synth = []
const words = ['星', '夜', '桜', '風', '雷', '鼓', 'ドン', 'カッ', 'Night', 'Dream', 'Fire', '光', '花', '海', '空']
for (let i = 0; i < 1500; i++) {
  const base = mock.songs[i % mock.songs.length]
  const w = (k) => words[(i * 7 + k * 3) % words.length]
  synth.push({ ...base, id: 200000 + i, ja: `${w(0)}${w(1)}の${w(2)} ${i}`, zh: `${w(1)}${w(2)}之${w(0)} ${i}`, artist: `Artist ${i % 97}`, aliases: [`alias${i}`, `${w(2)}${w(0)}`], generated: true })
}
synth.push(...mock.songs)
t0 = performance.now()
S.setData({ songs: synth, ...gen.makeFinders(synth) })
const tBuild = performance.now() - t0
const [worst, sum] = timeAll()
ok(realWorst <= 50, `真实数据每次按键 ≤ 50ms（${mock.songs.length} 首）`, `建索引 ${tBuildReal.toFixed(1)}ms，平均 ${(realSum / typed.length).toFixed(2)}ms，最慢 ${realWorst.toFixed(2)}ms`)
ok(worst <= 50, `合成数据每次按键 ≤ 50ms（${synth.length} 首）`, `建索引 ${tBuild.toFixed(1)}ms，平均 ${(sum / typed.length).toFixed(2)}ms，最慢 ${worst.toFixed(2)}ms`)
ok(S.searchSongs('alias1499').items[0]?.song.id === 201499, '合成数据：别名命中')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
