// Design V1 原型 Mock 数据。
// 字段名与取值范围参照仓库真实契约（SongCatalogItem / AccountSongScore / PlayerGrowthOverview / forum types），
// 曲名取自仓库内已跟踪的数据与测试夹具；具体数值为演示用途，不代表真实定数或真实玩家成绩。

function rng(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)]
const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d

/* ---------------- 字典 ---------------- */
export const GENRES = {
  namco: { zh: '南梦宫原创', ja: 'ナムコオリジナル', color: 'var(--genre-namco)' },
  pops: { zh: '流行音乐', ja: 'ポップス', color: 'var(--genre-pops)' },
  anime: { zh: '动漫音乐', ja: 'アニメ', color: 'var(--genre-anime)' },
  vocaloid: { zh: '博歌乐', ja: 'ボーカロイド', color: 'var(--genre-vocaloid)' },
  game: { zh: '游戏音乐', ja: 'ゲームミュージック', color: 'var(--genre-game)' },
  variety: { zh: '综合音乐', ja: 'バラエティ', color: 'var(--genre-variety)' },
  classic: { zh: '古典音乐', ja: 'クラシック', color: 'var(--genre-classic)' },
  kids: { zh: '儿童音乐', ja: 'キッズ', color: 'var(--genre-kids)' },
}

export const DIFFS = [
  null,
  { key: 'easy', zh: '简单', ja: 'かんたん', short: '简', shortJa: '易' },
  { key: 'normal', zh: '普通', ja: 'ふつう', short: '普', shortJa: '普' },
  { key: 'hard', zh: '困难', ja: 'むずかしい', short: '难', shortJa: '難' },
  { key: 'oni', zh: '魔王', ja: 'おに', short: '鬼', shortJa: '鬼' },
  { key: 'ura', zh: '魔王（里）', ja: 'おに（裏）', short: '里', shortJa: '裏' },
]

export const RANKS = [
  { v: 0, zh: '—', ja: '—', key: 'none' },
  { v: 1, zh: '未取得', ja: '未取得', key: 'none' },
  { v: 2, zh: '白粹', ja: '白粋', key: 'iki1', glyph: '粹', glyphJa: '粋', min: 500000 },
  { v: 3, zh: '铜粹', ja: '銅粋', key: 'iki2', glyph: '粹', glyphJa: '粋', min: 600000 },
  { v: 4, zh: '银粹', ja: '銀粋', key: 'iki3', glyph: '粹', glyphJa: '粋', min: 700000 },
  { v: 5, zh: '金雅', ja: '金雅', key: 'miyabi1', glyph: '雅', glyphJa: '雅', min: 800000 },
  { v: 6, zh: '粉雅', ja: '桃雅', key: 'miyabi2', glyph: '雅', glyphJa: '雅', min: 900000 },
  { v: 7, zh: '紫雅', ja: '紫雅', key: 'miyabi3', glyph: '雅', glyphJa: '雅', min: 950000 },
  { v: 8, zh: '极', ja: '極', key: 'kiwami', glyph: '极', glyphJa: '極', min: 1000000 },
]

export const CROWNS = {
  '-1': { key: 'played', zh: '已游玩', ja: 'プレイ済み' },
  0: { key: 'clear', zh: '通关', ja: 'クリア' },
  1: { key: 'fc', zh: '全连', ja: 'フルコンボ' },
  2: { key: 'dfc', zh: '全良', ja: '全良' },
}

export const DIMS = [
  { key: 'big_song', zh: '大歌力', ja: '大曲力', short: '大歌' },
  { key: 'stamina', zh: '体力', ja: '体力', short: '体力' },
  { key: 'speed', zh: '高速处理', ja: '高速処理', short: '高速' },
  { key: 'accuracy_power', zh: '精度力', ja: '精度力', short: '精度' },
  { key: 'rhythm', zh: '节奏处理', ja: 'リズム処理', short: '节奏' },
  { key: 'complex', zh: '复合处理', ja: '複合処理', short: '复合' },
]

export const CHART_AXES = [
  { key: 'stamina', zh: '体力', ja: '体力' },
  { key: 'handspeed', zh: '手速', ja: '手速' },
  { key: 'burst', zh: '爆发', ja: '爆発' },
  { key: 'complex', zh: '复合', ja: '複合' },
  { key: 'rhythm', zh: '节奏', ja: 'リズム' },
]

export const UGC_TAGS = ['节奏难', '偶数', '24 分', '变速', '复合', '长复合', '滚奏', '连打', '大音符', '体力', '耐力', '高速', '低速', '视认', '后半难', '局部难']

/* ---------------- 曲库 ---------------- */
// [id, ja, zh, genre, bpm, [easy, normal, hard, oni, ura], oniConst, uraConst, oniNotes, shelf, version, artist, openDay]
const SONG_ROWS = [
  [100140, '銀の黎明か、黒の晶華か。', '银之黎明，抑或黑之晶华。', 'namco', '120-305', [5, 7, 8, 10, 10], 13.92, 14.61, 1053, 0, '虹 2026', 'Tatsh', '2026-03-18'],
  [100138, 'Nivalis*Anima', 'Nivalis*Anima', 'namco', '32-274', [4, 6, 8, 10, 10], 11.95, 14.28, 1079, 0, '虹 2026', 'BlackY', '2026-03-18'],
  [100136, '＊Our story, saving the world.', '＊Our story, saving the world.', 'namco', '210', [4, 6, 7, 10, null], 12.03, null, 1060, 0, '虹 2026', 'Yooh', '2026-01-22'],
  [100130, '不死鳥と成りて', '化作不死鸟', 'namco', '268', [5, 7, 8, 10, null], 11.64, null, 1015, 0, '虹 2025', 'かねこちはる', '2025-11-06'],
  [100120, 'Stepping On The Accelerator', 'Stepping On The Accelerator', 'namco', '190', [4, 6, 8, 10, null], 11.42, null, 779, 0, '虹 2025', 'xi', '2025-09-11'],
  [851, '気焔万丈神楽', '气焰万丈神乐', 'namco', '200', [5, 7, 8, 10, null], 12.86, null, 1024, 0, '虹 2023', 'SOUND HOLIC', '2023-06-14'],
  [1255, '電脳幻夜の星言詠', '电脑幻夜之星言咏唱', 'namco', '225', [5, 7, 8, 10, 10], 12.41, 13.35, 987, 0, '虹 2024', 'Sound Souler', '2024-08-07'],
  [816, '星屑ストラック', 'Struck Stardust', 'namco', '288', [4, 6, 8, 10, null], 12.17, null, 965, 0, '虹 2023', 'D-D-Dice', '2023-03-15'],
  [1351, '蛇鉄', '蛇铁', 'namco', '185', [5, 7, 8, 10, null], 11.88, null, 902, 0, '虹 2025', 'かゆき', '2025-04-23'],
  [1412, '案山子姫 -Princess Scarecrow-', 'Kakashi-Hime: Princess Scarecrow', 'namco', '160-240', [4, 6, 7, 9, 10], 9.72, 12.68, 811, 0, '虹 2025', 'Morrigan', '2025-07-30'],
  [971, '星河一天', '星河一天', 'namco', '200', [4, 6, 8, 10, null], 11.21, null, 888, 0, '虹 2024', 'cosMo@暴走P', '2024-02-21'],
  [179, 'はたラク2000', '工作2000', 'namco', '200', [5, 7, 8, 10, null], 10.74, null, 800, 0, '太鼓 11', 'LindaAI-CUE', '2008-03-18'],
  [615, '天狗囃子', '天狗配乐', 'namco', '165', [4, 6, 7, 9, null], 9.36, null, 732, 0, '新筐体', 'Mint', '2014-07-16'],
  [1053, '平等院鳳凰ドン vs 鳥獣戯カッ', '平等院凤凰咚 vs 鸟兽戏咔', 'namco', '158', [3, 5, 6, 7, null], 6.92, null, 604, 0, '虹 2024', 'Kanade', '2024-05-15'],
  [100126, 'JIKUCHO 3-CHOME', 'JIKUCHO 3-CHOME', 'namco', '175', [4, 5, 7, 8, null], 8.54, null, 698, 0, '虹 2025', 'Zeami', '2025-08-06'],
  [100128, 'ドンバルディアの踊り子', '咚巴尔迪亚的舞者', 'namco', '142', [3, 5, 6, 8, null], 5.52, null, 583, 0, '虹 2025', 'Masubuchi', '2025-08-06'],
  [278, '花漾', '花漾', 'namco', '156', [3, 4, 6, 8, 10], 7.05, 9.3, 541, 0, '虹 2021', 'Taku Inoue', '2021-04-21'],
  [345, 'ラーメン de Yo‐Men!!', '拉面 德 呦-面!!', 'namco', '180', [4, 5, 7, 9, null], 8.91, null, 677, 0, '太鼓 14', 'Yuji Masubuchi', '2010-11-17'],
  [100039, 'そばかす', '雀斑', 'pops', '153', [3, 4, 5, 6, null], 4.08, null, 301, 0, '虹 2025', 'JUDY AND MARY', '2025-02-12'],
  [100052, '気分上々↑↑', '心情超好↑↑', 'pops', '130', [3, 4, 6, 7, null], 1.95, null, 620, 0, '虹 2025', 'mihimaru GT', '2025-03-19'],
  [100066, 'ありがとう', '谢谢', 'pops', '76', [2, 3, 3, 4, null], 0.24, null, 229, 0, '虹 2025', 'いきものがかり', '2025-05-14'],
  [1188, '逆戦 NI ZHAN', '逆战', 'pops', '170', [3, 5, 6, 7, null], 5.76, null, 512, 0, '国行限定', '张杰', '2024-09-26'],
  [438, 'ウルトラマンギンガの歌', '银河奥特曼之歌', 'anime', '148', [3, 4, 7, 9, null], 8.12, null, 590, 1, '新筐体', 'ボイジャー', '2013-11-06'],
  [702, '紅蓮華', '红莲华', 'anime', '135', [3, 4, 6, 8, null], 6.31, null, 566, 0, '虹 2020', 'LiSA', '2020-03-24'],
  [233, '千本桜', '千本樱', 'vocaloid', '154', [4, 5, 6, 7, 10], 5.98, 10.42, 612, 0, '新筐体', '黒うさP feat. 初音ミク', '2012-12-13'],
  [512, 'ナイト・オブ・ナイツ', 'Night of Knights', 'variety', '180', [4, 6, 7, 9, 10], 9.18, 11.06, 783, 0, '新筐体', 'ビートまりお', '2013-03-13'],
  [88, '白鳥の湖 ～still a duckling～', '天鹅湖 ～still a duckling～', 'classic', '140-210', [3, 5, 7, 9, null], 8.77, null, 705, 0, '太鼓 12', 'チャイコフスキー', '2008-12-11'],
  [1290, 'Calamity Fortune', 'Calamity Fortune', 'game', '200', [4, 6, 8, 10, null], 11.03, null, 899, 2, '家用机', 'LeaF', '2024-11-21'],
  [41, 'アンパンマンのマーチ', '面包超人进行曲', 'kids', '152', [1, 2, 3, 3, null], 0.38, null, 187, 0, '太鼓 1', 'ドリーミング', '2001-02-21'],
  [960, '幽玄ノ乱', '幽玄之乱', 'namco', '300', [5, 7, 9, 10, null], 13.41, null, 1262, 0, '新筐体', '世阿弥', '2015-07-15'],
]

const sr = rng(20261116)

export const songs = SONG_ROWS.map((r) => {
  const [id, ja, zh, genre, bpm, levels, oniConst, uraConst, oniNotes, shelf, version, artist, openDay] = r
  const charts = []
  levels.forEach((star, i) => {
    if (star == null) return
    const d = i + 1
    let c = null
    let notes
    if (d === 4) {
      c = oniConst
      notes = oniNotes
    } else if (d === 5) {
      c = uraConst
      notes = Math.round(oniNotes * (1.12 + sr() * 0.25))
    } else {
      notes = Math.round(oniNotes * [0.22, 0.36, 0.6][i] * (0.9 + sr() * 0.2))
      if (d === 3) c = round(Math.max(0.1, oniConst * 0.42 + sr() * 0.6))
    }
    const base = c ?? 1
    const ab = () => round(Math.max(0.2, Math.min(15.5, base + (sr() - 0.5) * 3.2)))
    charts.push({
      d,
      star,
      constant: c,
      c75: c != null ? round(c + (sr() - 0.35) * 0.5) : null,
      c99: c != null ? round(c - (sr() - 0.3) * 0.4) : null,
      notes,
      roll: round(1 + sr() * 6, 1),
      balloon: Math.floor(sr() * 4),
      branch: id === 615 && d === 4,
      abilities: { stamina: ab(), handspeed: ab(), burst: ab(), complex: ab(), rhythm: ab() },
      // 每小节音符密度（用于密度条）
      density: Array.from({ length: 64 }, (_, k) => {
        const env = 0.35 + 0.65 * Math.sin((k / 64) * Math.PI * (1.1 + (id % 3) * 0.3)) ** 2
        const late = k > 44 ? 1.25 : 1
        return Math.max(0.04, Math.min(1, env * late * (0.55 + sr() * 0.6) * (0.35 + star / 14)))
      }),
    })
  })
  return { id, ja, zh, genre, bpm, levels, charts, shelf, version, artist, openDay }
})

export const songById = Object.fromEntries(songs.map((s) => [s.id, s]))
export const chartOf = (songId, d) => songById[songId]?.charts.find((c) => c.d === d)

/* ---------------- 玩家 ---------------- */
export const player = {
  username: 'mochidon',
  nickname: '年糕咚',
  taikoId: '482917350662',
  taikoIdMasked: '4829••••0662',
  source: 'wahlap',
  title: '精度调律师',
  dan: '九段',
  province: '上海',
  joined: '2024-03-02',
  rating: 11.97,
  ratingDelta30: 0.31,
  percentile: 'Top 5%',
  dims: { big_song: 12.3, stamina: 11.77, speed: 11.68, accuracy_power: 12.7, rhythm: 12.33, complex: 12.49 },
  dimsPrev: { big_song: 12.02, stamina: 11.7, speed: 11.31, accuracy_power: 12.52, rhythm: 12.2, complex: 12.05 },
  focus: 'speed',
  lastSync: '2 小时前',
  lastSyncJa: '2 時間前',
  crownCounts: { clear: 628, fc: 524, dfc: 156 },
  rankCounts: [12, 31, 64, 118, 173, 141, 335],
  plays: 5012,
  bindings: [
    { id: 1, source: 'wahlap', region: 'CN', taikoId: '4829••••0662', name: '年糕咚', current: true, title: '精度调律师', sync: true },
    { id: 2, source: 'hiroba', region: 'JP', taikoId: '1077••••2291', name: 'もちドン', current: false, title: '太鼓好き', sync: false },
    { id: 3, source: 'manual', region: '手动', taikoId: '98••••••••••4410', name: '家用机记录', current: false, title: '—', sync: false },
  ],
}

/* ---------------- 成绩 ---------------- */
function accToRt(constant, acc) {
  // 演示用近似：75% 以下不计，越接近 100% 越逼近定数上限
  if (constant == null || acc < 0.75) return 0
  const k = Math.pow((acc - 0.75) / 0.25, 1.6)
  return round(constant * (0.62 + 0.38 * k) + (acc > 0.985 ? 0.25 : 0))
}

const pr = rng(7741)
export const scores = []
for (const s of songs) {
  for (const c of s.charts) {
    if (c.d < 4) continue
    const hard = c.constant ?? c.star
    const skill = 12.1
    const gap = hard - skill
    if (gap > 1.9 && pr() < 0.7) continue // 没打过
    const acc = Math.max(0.74, Math.min(1, 0.992 - Math.max(0, gap + 1.6) * 0.035 - pr() * 0.02))
    const ng = acc > 0.995 ? 0 : Math.max(0, Math.round((1 - acc) * c.notes * (0.12 + pr() * 0.3) - (gap < -3 ? 2 : 0)))
    const ok = Math.max(0, Math.round((1 - acc) * c.notes * 2 - ng * 2))
    const good = c.notes - ok - ng
    const realAcc = (good + ok * 0.5) / c.notes
    const crown = ng === 0 ? (ok === 0 ? 2 : 1) : realAcc > 0.8 ? 0 : -1
    const score = Math.round((1000000 * (good + ok * 0.5)) / c.notes / 10) * 10 + (crown === 2 ? Math.round(pr() * 900) * 10 : 0)
    let rank = 1
    for (const rk of RANKS) if (rk.min && score >= rk.min) rank = rk.v
    const daysAgo = Math.floor(pr() * 120)
    scores.push({
      songId: s.id,
      d: c.d,
      star: c.star,
      constant: c.constant,
      score,
      good,
      ok,
      ng,
      combo: ng === 0 ? c.notes : Math.round(c.notes * (0.3 + pr() * 0.5)),
      roll: Math.round(c.roll * (12 + pr() * 8)),
      crown,
      rank,
      plays: 2 + Math.floor(pr() * 46),
      acc: round(realAcc * 100, 2),
      rt: accToRt(c.constant, realAcc),
      daysAgo,
      locked: false,
      manual: false,
    })
  }
}
// 手动补几条固定演示成绩
const fix = (songId, d, patch) => {
  const s = scores.find((x) => x.songId === songId && x.d === d)
  if (s) Object.assign(s, patch)
}
fix(615, 4, { ng: 3, ok: 41, good: 688, crown: 0, score: 968440, rank: 7, acc: 96.79, combo: 402, daysAgo: 1, plays: 23 })
fix(233, 5, { ng: 0, ok: 0, good: chartOf(233, 5).notes, crown: 2, score: 1004290, rank: 8, acc: 100, combo: chartOf(233, 5).notes, daysAgo: 0, plays: 31 })
fix(278, 5, { locked: true })

export const scoreOf = (songId, d) => scores.find((x) => x.songId === songId && x.d === d)
export const bestList = [...scores].sort((a, b) => b.rt - a.rt).slice(0, 30)

/* ---------------- Rating 历史 ---------------- */
const hr = rng(99)
export const ratingHistory = (() => {
  const out = []
  let v = 10.62
  for (let i = 179; i >= 0; i--) {
    const bump = hr() < 0.16 ? hr() * 0.045 : 0
    const big = i === 131 || i === 74 || i === 22 ? 0.12 : 0
    v = v + bump + big
    out.push({ daysAgo: i, v: round(v, 3) })
  }
  // 线性校准到当前 Rating，避免末尾出现跳变
  const end = out[out.length - 1].v
  for (const p of out) p.v = round(10.62 + ((p.v - 10.62) * (11.97 - 10.62)) / (end - 10.62), 3)
  return out
})()

export const dimHistory = Object.fromEntries(
  DIMS.map((dm, idx) => {
    const r = rng(300 + idx)
    const end = player.dims[dm.key]
    let v = end - 0.9 - r() * 0.5
    const arr = []
    for (let i = 0; i < 26; i++) {
      v = Math.min(end, v + (r() < 0.5 ? r() * 0.09 : 0))
      arr.push(round(v))
    }
    arr[arr.length - 1] = end
    return [dm.key, arr]
  }),
)

/* ---------------- 最近 21 天：譜面レーン ---------------- */
// fact.type 与仓库 PlayerGrowth facts 一致
export const FACT = {
  df: { zh: '新全良', ja: '全良達成', note: 'dfc', weight: 6 },
  fc: { zh: '新全连', ja: 'フルコンボ', note: 'fc', weight: 5 },
  'goal-completed': { zh: '练成了目标', ja: '目標達成', note: 'goal', weight: 4.5 },
  'rank-upgrade': { zh: '评价升级', ja: '評価アップ', note: 'ka', weight: 4 },
  'score-pb': { zh: '刷新最好成绩', ja: '自己ベスト', note: 'don', weight: 3 },
  'clear-upgrade': { zh: '首次通关', ja: '初クリア', note: 'don', weight: 3 },
  'ng-reduced': { zh: '不可变少了', ja: '不可が減った', note: 'ka', weight: 2 },
  'combo-improved': { zh: '连击更长了', ja: 'コンボ更新', note: 'ka', weight: 2 },
  played: { zh: '打了一次', ja: 'プレイ', note: 'ghost', weight: 1 },
}

const lr = rng(424242)
const laneSongs = [615, 233, 278, 512, 88, 345, 179, 100126, 971, 1351, 1412, 702, 1053, 816]
export const laneDays = (() => {
  const days = []
  const today = new Date(2026, 10, 16)
  const played = [1, 1, 0, 1, 1, 1, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1]
  for (let i = 20; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(today.getDate() - i)
    const idx = 20 - i
    const facts = []
    if (played[idx]) {
      const n = 1 + Math.floor(lr() * 4)
      for (let k = 0; k < n; k++) {
        const sid = pick(lr, laneSongs)
        const s = songById[sid]
        const d = s.levels[4] != null && lr() < 0.3 ? 5 : 4
        const roll = lr()
        const type = roll < 0.08 ? 'fc' : roll < 0.5 ? 'score-pb' : roll < 0.68 ? 'rank-upgrade' : roll < 0.84 ? 'ng-reduced' : 'combo-improved'
        let before = 900000 + Math.floor(lr() * 80000)
        let after = before + 2000 + Math.floor(lr() * 16000)
        const extra = {}
        if (type === 'ng-reduced') {
          before = 4 + Math.floor(lr() * 9)
          after = Math.max(0, before - 1 - Math.floor(lr() * 4))
        } else if (type === 'combo-improved') {
          before = 180 + Math.floor(lr() * 300)
          after = before + 40 + Math.floor(lr() * 200)
        } else if (type === 'rank-upgrade') {
          extra.rankFrom = 5 + Math.floor(lr() * 2)
          extra.rankTo = extra.rankFrom + 1
        }
        facts.push({ type, songId: sid, d, before, after, ...extra, time: `${19 + Math.floor(lr() * 3)}:${String(Math.floor(lr() * 60)).padStart(2, '0')}` })
      }
    }
    days.push({ date, daysAgo: i, played: !!played[idx], charts: played[idx] ? 4 + Math.floor(lr() * 14) : 0, facts })
  }
  // 固定几个演示用高光
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

/* ---------------- 目标 ---------------- */
export const GOAL_TYPES = {
  'score-pb': { zh: '刷新最好成绩', ja: '自己ベスト更新' },
  'ng-reduced': { zh: '把不可再压低一点', ja: '不可を減らす' },
  clear: { zh: '试试通关', ja: 'クリアに挑戦' },
  fc: { zh: '试试全连', ja: 'フルコンボに挑戦' },
  df: { zh: '试试全良', ja: '全良に挑戦' },
  'rank-upgrade': { zh: '把评价再提一级', ja: '評価を一段上げる' },
  played: { zh: '打一次看看', ja: 'まず一回プレイ' },
}

export const goals = [
  {
    id: 'g7',
    status: 'active',
    type: 'fc',
    songId: 615,
    d: 4,
    createdAgo: 3,
    source: 'today-plan',
    dim: 'speed',
    baseline: { score: 961200, ng: 7, combo: 311 },
    latest: { score: 968440, ng: 3, combo: 402 },
    target: { field: 'ng', comparison: 'less', value: 1, label: '不可 0' },
    progress: 0.57,
    attempts: [
      { ago: 3, ng: 7, score: 961200 },
      { ago: 2, ng: 6, score: 962910 },
      { ago: 1, ng: 3, score: 968440 },
    ],
  },
  { id: 'g6', status: 'completed', type: 'ng-reduced', songId: 278, d: 5, createdAgo: 12, doneAgo: 9, dim: 'accuracy_power', baseline: { ng: 5 }, latest: { ng: 2 }, evidence: '不可 5 → 2' },
  { id: 'g5', status: 'completed', type: 'rank-upgrade', songId: 512, d: 4, createdAgo: 20, doneAgo: 16, dim: 'rhythm', baseline: { rank: 6 }, latest: { rank: 7 }, evidence: '粉雅 → 紫雅' },
  { id: 'g4', status: 'cancelled', type: 'df', songId: 702, d: 4, createdAgo: 31, doneAgo: 27, dim: 'accuracy_power', baseline: { ok: 9 }, latest: { ok: 6 }, evidence: '可 9 → 6 后换了目标' },
  { id: 'g3', status: 'completed', type: 'score-pb', songId: 179, d: 4, createdAgo: 40, doneAgo: 36, dim: 'stamina', baseline: { score: 902000 }, latest: { score: 921400 }, evidence: '+19,400' },
]

export const recommendations = [
  { songId: 100126, d: 4, dim: 'speed', reason: '高速处理 8.9，贴近你现在的手速区间', unplayed: false, fit: 98, options: ['fc', 'score-pb'] },
  { songId: 1351, d: 4, dim: 'speed', reason: '定数 11.88，是下一档的入门曲', unplayed: false, fit: 103, options: ['rank-upgrade', 'ng-reduced'] },
  { songId: 100120, d: 4, dim: 'rhythm', reason: '还没打过，节奏型和你拿手的曲子接近', unplayed: true, fit: 96, options: ['played', 'clear'] },
  { songId: 971, d: 4, dim: 'stamina', reason: '距离紫雅还差 4,280 分', unplayed: false, fit: 94, options: ['rank-upgrade', 'score-pb'] },
  { songId: 88, d: 4, dim: 'accuracy_power', reason: '只差 6 个可就能全良', unplayed: false, fit: 92, options: ['df'] },
]

/* ---------------- 每周 ---------------- */
export const weekly = {
  range: '11 月 10 日 – 11 月 16 日',
  theme: { type: 'new-crown', zh: '这一周，新的王冠落了下来。', ja: '今週、新しい王冠が増えました。' },
  totals: { distinctCharts: 42, pb: 9, fc: 1, df: 1, rankUpgrade: 4, completedGoals: 1 },
  ratingDelta: 0.08,
  focusFrom: 'complex',
  focusTo: 'speed',
  dimDeltas: { big_song: 0.04, stamina: 0.02, speed: 0.11, accuracy_power: 0.05, rhythm: 0.03, complex: 0.09 },
  activeDays: [1, 1, 0, 1, 0, 1, 1],
  highlights: [
    { type: 'df', songId: 233, d: 5, text: '千本桜（里）第一次全良，31 次游玩之后。' },
    { type: 'rank-upgrade', songId: 88, d: 4, text: '白鳥の湖 从粉雅升到了紫雅。' },
    { type: 'goal-completed', songId: 278, d: 5, text: '自己选下的练习有了结果：花漾（里）不可 5 → 2。' },
  ],
}

export const milestones = [
  { ago: 0, type: 'df', songId: 233, d: 5, text: '千本桜（里）全良' },
  { ago: 22, type: 'rating', text: 'Rating 越过 11.9' },
  { ago: 36, type: 'fc', songId: 179, d: 4, text: 'はたラク2000 全连' },
  { ago: 74, type: 'dan', text: '通过九段' },
  { ago: 131, type: 'rating', text: 'Rating 越过 11.0' },
]

/* ---------------- 社区 ---------------- */
export const sections = [
  { slug: 'official', zh: '官方公告', ja: '公式のお知らせ', color: '#d84a34', count: 48 },
  { slug: 'events', zh: '活动赛事', ja: 'イベント・大会', color: '#f08a24', count: 126 },
  { slug: 'beginner-help', zh: '新手问答', ja: '初心者Q&A', color: '#3f97d1', count: 1284 },
  { slug: 'score-guides', zh: '谱面攻略', ja: '譜面攻略', color: '#eb5d3c', count: 932 },
  { slug: 'dojo', zh: '段位道场', ja: '段位道場', color: '#d19b2f', count: 571 },
  { slug: 'achievements', zh: '晒分战报', ja: 'リザルト報告', color: '#dc5432', count: 2210 },
  { slug: 'arcade', zh: '同城机厅', ja: 'ゲーセン情報', color: '#3b7ca8', count: 403 },
  { slug: 'general', zh: '闲聊杂谈', ja: '雑談', color: '#3f97d1', count: 3155 },
  { slug: 'creative', zh: '同名二创', ja: '二次創作', color: '#c75d88', count: 217 },
]
export const sectionBySlug = Object.fromEntries(sections.map((s) => [s.slug, s]))

export const THREAD_TYPES = {
  discussion: { zh: '讨论', ja: '雑談' },
  guide: { zh: '攻略', ja: '攻略' },
  achievement: { zh: '战报', ja: 'リザルト' },
  official: { zh: '公告', ja: 'お知らせ' },
}

export const users = {
  mochidon: { name: '年糕咚', role: 'user', title: '精度调律师', dan: '九段', hue: 12 },
  hayate: { name: '疾风连打', role: 'moderator', title: '连打之鬼', dan: '达人', hue: 205 },
  sakura: { name: 'Sakura 站务', role: 'admin', title: 'Viewer 站务', dan: '—', hue: 335 },
  kumo: { name: '云上小咔', role: 'user', title: '节奏旅人', dan: '七段', hue: 180 },
  rin: { name: '凛冬十段', role: 'user', title: '体力怪兽', dan: '十段', hue: 265 },
  tako: { name: '章鱼烧不加葱', role: 'user', title: '太鼓新人', dan: '三级', hue: 40 },
  nagi: { name: 'nagi_', role: 'user', title: '全良猎人', dan: '名人', hue: 150 },
  uta: { name: '歌姬的鼓棒', role: 'user', title: '博歌乐爱好者', dan: '八段', hue: 300 },
}

export const threads = [
  {
    id: 4021, section: 'official', type: 'official', pinned: true, featured: false, author: 'sakura', ago: '3 小时前',
    title: '虹 2026 第三期新曲已加入曲库，定数与谱面图同步上线',
    summary: '本次共 6 首新曲。V2 定数已完成补算，谱面图支持双人谱切换；如果发现数据问题，欢迎在本帖回复。',
    tags: ['新曲', '定数'], likes: 214, replies: 37, views: 5820, song: { id: 100140, d: 5 },
  },
  {
    id: 4017, section: 'score-guides', type: 'guide', pinned: false, featured: true, author: 'hayate', ago: '昨天',
    title: '天狗囃子 鬼 ★9：第 41 小节之后的 24 分，三种手法对比',
    summary: '全连卡在后半的人很多。这篇把交互、顺手和「左起」三种打法各录了一遍，附上每种手法适合的手速区间。',
    tags: ['24 分', '后半难', '手法'], likes: 386, replies: 52, views: 9034, song: { id: 615, d: 4 }, cover: true,
  },
  {
    id: 4012, section: 'achievements', type: 'achievement', pinned: false, featured: false, author: 'nagi', ago: '昨天',
    title: '幽玄ノ乱 全良达成，历时 14 个月',
    summary: '1262 combo，最后 8 小节手是抖的。感谢机厅老板没有在我第 300 次投币的时候把我请出去。',
    tags: ['全良', '★10'], likes: 1204, replies: 168, views: 22410, song: { id: 960, d: 4 }, cover: true,
  },
  {
    id: 4009, section: 'beginner-help', type: 'discussion', pinned: false, featured: false, author: 'tako', ago: '2 天前',
    title: '鬼 ★7 能过但是 ★8 完全过不去，应该先练什么？',
    summary: '现在千本桜鬼能稳定通关，但红莲华一到副歌就乱。是该先练手速还是先练读谱？',
    tags: ['新手', '读谱'], likes: 48, replies: 31, views: 1876, song: { id: 702, d: 4 },
  },
  {
    id: 4006, section: 'dojo', type: 'guide', pinned: false, featured: true, author: 'rin', ago: '3 天前',
    title: '虹 2026 十段课题曲逐首分析：第三首才是真正的门槛',
    summary: '很多人把精力放在第一首，但条件线其实卡在第三首的不可数。附每首的建议可数上限。',
    tags: ['十段', '段位道场'], likes: 302, replies: 44, views: 7120,
  },
  {
    id: 4001, section: 'arcade', type: 'discussion', pinned: false, featured: false, author: 'kumo', ago: '3 天前',
    title: '上海｜人民广场附近机厅鼓面情况汇总（11 月）',
    summary: '更新了三家店的鼓面灵敏度和排队情况。大悦城那台右咔已经修好了。',
    tags: ['上海', '机厅'], likes: 96, replies: 27, views: 3312,
  },
  {
    id: 3996, section: 'general', type: 'discussion', pinned: false, featured: false, author: 'uta', ago: '4 天前',
    title: '你们的「本命曲」是哪首？说说打了多少次',
    summary: '我先来：千本桜里，318 次，至今没有全良。',
    tags: ['闲聊'], likes: 173, replies: 221, views: 6045, song: { id: 233, d: 5 },
  },
  {
    id: 3990, section: 'events', type: 'official', pinned: false, featured: false, author: 'sakura', ago: '5 天前',
    title: '2026 秋季线上段位挑战赛报名开始，截止 11 月 30 日',
    summary: '按段位分组，使用 Viewer 同步的成绩自动计分。报名需要已绑定鼓众广场 ID。',
    tags: ['比赛', '报名'], likes: 268, replies: 73, views: 11200,
  },
  {
    id: 3984, section: 'creative', type: 'discussion', pinned: false, featured: false, author: 'kumo', ago: '6 天前',
    title: '自制谱分享：星河一天 里谱（附 TJA 与定数测算）',
    summary: '用站内 TJA 工具算出来主定数 12.9，欢迎试打提意见。',
    tags: ['自制谱', 'TJA'], likes: 87, replies: 19, views: 2440, song: { id: 971, d: 4 },
  },
]
export const threadById = Object.fromEntries(threads.map((t) => [t.id, t]))

export const threadPosts = [
  {
    floor: 1, author: 'hayate', ago: '昨天 21:14', likes: 386,
    blocks: [
      { p: '天狗囃子 鬼的前 40 小节基本是 16 分的常规配置，手速 9 级左右就能稳住。真正让全连断掉的是第 41 小节开始的 24 分段落：两小节一组，一共四组，中间只有一拍休息。' },
      { p: '我把三种常见手法各录了一遍，结论先放在前面：' },
      { list: ['交互：最稳，但要求 BPM 165 下 24 分的纯手速，适合高速处理 10 以上。', '顺手（右起 RRL）：对手速要求最低，第三组容易因为重心偏移漏咔。', '左起：只在第二组用，可以让第三组的起手回到右手。我自己全连用的是这个。'] },
      { img: '第 41–48 小节谱面截图（三种手法标注）' },
      { p: '练习建议：先用练习模式把 41–44 小节单独循环，速度降到 0.8 倍。能连续十次不漏之后再接上 45–48。不要一上来就打整首，后半失误会让你怀疑前面本来没问题的部分。' },
    ],
  },
  {
    floor: 2, author: 'mochidon', ago: '昨天 21:40', likes: 24,
    blocks: [{ p: '太及时了，我现在就卡在这里，不可从 7 压到 3 之后一直下不去。回去试试左起。' }],
    replies: [
      { author: 'hayate', ago: '昨天 21:52', text: '不可 3 的话基本就是第三组起手的问题，左起应该能直接解决。' },
      { author: 'mochidon', ago: '昨天 22:03', text: '好，周末去机厅试，成功了回来报告。' },
    ],
  },
  {
    floor: 3, author: 'rin', ago: '昨天 22:31', likes: 57,
    blocks: [{ p: '补充一点：如果用的是自带鼓棒，24 分段落握短一点会轻松很多。机厅的公用棒太重，交互打到第四组手腕会跟不上。' }],
    replies: [{ author: 'kumo', ago: '今天 08:12', text: '确实，换了轻棒之后我这段直接少了两个不可。' }],
  },
  {
    floor: 4, author: 'tako', ago: '今天 09:47', likes: 6,
    blocks: [{ p: '请问 24 分是什么意思……是一小节 24 个音符吗？' }],
    replies: [{ author: 'hayate', ago: '今天 10:05', text: '对，一小节等分成 24 份，比 16 分密一半。攻略区置顶有一篇节奏入门可以先看。' }],
  },
]

export const notifications = [
  { id: 1, type: 'reply', unread: true, who: 'hayate', ago: '18 分钟前', text: '回复了你在「天狗囃子 鬼 ★9：第 41 小节之后的 24 分」中的楼层', thread: 4017 },
  { id: 2, type: 'like', unread: true, who: 'rin', ago: '1 小时前', text: '赞了你的回复', thread: 4017 },
  { id: 3, type: 'system', unread: true, who: 'sakura', ago: '2 小时前', text: '同步完成：新增 4 条成长记录，其中 1 个新全良' },
  { id: 4, type: 'mention', unread: false, who: 'kumo', ago: '昨天', text: '在「上海｜人民广场附近机厅鼓面情况汇总」中提到了你', thread: 4001 },
  { id: 5, type: 'like', unread: false, who: 'uta', ago: '3 天前', text: '等 12 人赞了你的帖子「千本桜里终于紫雅了」' },
]

/* ---------------- 谱面 UGC ---------------- */
export const chartUgc = {
  votes: [3, 11, 46, 28, 9], // 明显偏易 … 明显偏难
  summary: 'hard',
  tags: [
    { name: '24 分', n: 61 },
    { name: '后半难', n: 54 },
    { name: '高速', n: 37 },
    { name: '局部难', n: 22 },
    { name: '体力', n: 9 },
  ],
  tips: [
    { author: 'hayate', verified: true, text: '41 小节开始的 24 分建议第二组左起，第三组的起手会顺很多。', helpful: 128, ago: '2 周前' },
    { author: 'rin', verified: true, text: '前半别用力，体力留给最后 8 小节。', helpful: 74, ago: '1 个月前' },
    { author: 'kumo', verified: false, text: '流速开 1.5 倍以上更容易看清 24 分的间距。', helpful: 31, ago: '1 个月前' },
  ],
}

/* ---------------- 段位 ---------------- */
export const danGrades = ['五级', '四级', '三级', '二级', '一级', '初段', '二段', '三段', '四段', '五段', '六段', '七段', '八段', '九段', '十段', '玄人', '名人', '超人', '达人']
export const danCourse = {
  grade: '十段',
  songs: [
    { songId: 851, d: 4, combo: 1024 },
    { songId: 816, d: 4, combo: 965 },
    { songId: 1255, d: 5, combo: 1180 },
  ],
  conditions: [
    { k: '魂量表', pass: '100%', gold: '100%' },
    { k: '良', pass: '2,760 以上', gold: '2,900 以上' },
    { k: '不可', pass: '少于 30', gold: '少于 10' },
    { k: '连打数', pass: '160 以上', gold: '200 以上' },
  ],
  mine: { state: '红合格', good: 2812, ng: 21, roll: 177 },
}

/* ---------------- 活动 ---------------- */
export const events = [
  { title: '2026 秋季线上段位挑战赛', range: '11/01 – 11/30', tag: '报名中' },
  { title: '虹 2026 第三期新曲', range: '11/13 起', tag: '已上线' },
  { title: '虹 2026 太鼓回顾 封闭测试', range: '12/01 起', tag: '即将开始' },
]

/* ---------------- 开发者 ---------------- */
export const devApps = [
  { name: 'OurTaiko', scopes: ['profile:read', 'scores:read'], granted: '2026-08-12', expires: '2027-08-12', lastUsed: '今天' },
  { name: 'Donder Stats Bot', scopes: ['scores:read', 'growth:read'], granted: '2026-10-03', expires: '2027-01-03', lastUsed: '4 天前' },
]

export const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('en-US'))
export const fx = (n, d = 2) => (n == null ? '—' : Number(n).toFixed(d))
