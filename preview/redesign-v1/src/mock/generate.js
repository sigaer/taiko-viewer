// Design V1.1 原型 · 确定性生成器。
// 规则：不用 Math.random、不用 Date.now；原型的「今天」固定为 2026-11-16。
// 所有函数都是纯函数（输入相同 → 输出相同），不持有模块级可变状态，供 data.js 装配。

/* ================= 基础工具 ================= */
const STEP = 0x6d2b79f5

/** mulberry32；附带 state()/skip()，用于在不生成数据的前提下「跳过」若干次调用（懒生成密度时复现原序列）。 */
export function rng(seed) {
  let a = seed >>> 0
  const r = () => {
    a |= 0
    a = (a + STEP) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  r.state = () => a
  r.skip = (n) => {
    a = (a + Math.imul(n, STEP)) | 0
  }
  return r
}

export function hash(...xs) {
  let h = 0x811c9dc5
  for (const x of xs) {
    h = Math.imul(h ^ (x | 0), 0x01000193)
    h ^= h >>> 13
    h = Math.imul(h, 0x5bd1e995)
    h ^= h >>> 15
  }
  return h >>> 0
}

export const pick = (r, arr) => arr[Math.floor(r() * arr.length)]
export const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d
/** 千分位（不走 Intl：首次调用 toLocaleString 会初始化 ICU，约 15ms）。 */
export const thousands = (n) => (n == null ? '—' : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','))
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
function weighted(r, pairs) {
  let t = 0
  for (const p of pairs) t += p[1]
  let x = r() * t
  for (const p of pairs) if ((x -= p[1]) < 0) return p[0]
  return pairs[pairs.length - 1][0]
}
const strHash = (s) => {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0
  return h
}

/* ================= 规范化（P1） ================= */
const PUNCT = /[\s\p{P}\p{S}]/gu
const KATA = /[ァ-ヶ]/g
/** NFKC → 小写 → 片假名转平假名 → 去掉空白 / 标点 / 符号。全角半角由 NFKC 统一。 */
export function normalize(str) {
  if (str == null) return ''
  return String(str)
    .normalize('NFKC')
    .toLowerCase()
    .replace(KATA, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
    .replace(PUNCT, '')
}

export function parseBpm(bpm) {
  const nums = String(bpm || '')
    .split('-')
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0)
  if (!nums.length) return [0, 0]
  return [Math.min(...nums), Math.max(...nums)]
}

/* ================= 谱面密度（懒生成） ================= */
/** 与 V1 的密度公式一致；seedState 是生成该谱面时 rng 的状态快照。 */
export function densityFrom(seedState, id, star) {
  const r = rng(seedState)
  const out = new Array(64)
  for (let k = 0; k < 64; k++) {
    const env = 0.35 + 0.65 * Math.sin((k / 64) * Math.PI * (1.1 + (id % 3) * 0.3)) ** 2
    const late = k > 44 ? 1.25 : 1
    out[k] = Math.max(0.04, Math.min(1, env * late * (0.55 + r() * 0.6) * (0.35 + star / 14)))
  }
  return out
}

/** chart.density 定义为懒加载 + 记忆化的 getter：4,000+ 张谱在载入时不分配密度数组。 */
function attachDensity(chart, seedState, id) {
  let memo = null
  Object.defineProperty(chart, 'density', {
    enumerable: true,
    configurable: true,
    get() {
      return memo || (memo = densityFrom(seedState, id, chart.star))
    },
  })
  return chart
}

/* ================= 精选曲（与 V1 数值逐位一致） ================= */
export function buildCuratedSongs(rows, aliases) {
  const sr = rng(20261116)
  return rows.map((row) => {
    const [id, ja, zh, genre, bpm, levels, oniConst, uraConst, oniNotes, shelf, version, artist, openDay] = row
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
      const chart = {
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
      }
      attachDensity(chart, sr.state(), id)
      sr.skip(64) // V1 在这里同步生成 64 个密度值；跳过它们，后续谱面的数值保持不变
      charts.push(chart)
    })
    return {
      id, ja, zh, genre, bpm, levels, charts, shelf, version, artist, openDay,
      aliases: aliases[id] || [],
      hasChartImage: true,
      hasAudio: true,
      generated: false,
    }
  })
}

/* ================= 生成曲（M1 / M2） ================= */
const KANJI_A = [
  ['春雷', '春雷'], ['夜明け', '黎明'], ['星屑', '星尘'], ['桜吹雪', '樱吹雪'], ['雷鳴', '雷鸣'], ['月影', '月影'],
  ['花火', '烟花'], ['白銀', '白银'], ['蒼穹', '苍穹'], ['鼓動', '鼓动'], ['万華鏡', '万花筒'], ['雪月花', '雪月花'],
  ['疾風', '疾风'], ['朱雀', '朱雀'], ['夢幻', '梦幻'], ['電光', '电光'], ['迷宮', '迷宫'], ['陽炎', '阳炎'],
  ['極光', '极光'], ['千年', '千年'], ['流星', '流星'], ['祭囃子', '祭囃子'], ['紅葉', '红叶'], ['天竜', '天龙'],
  ['風神', '风神'], ['水鏡', '水镜'], ['鉄扇', '铁扇'], ['宵宮', '宵宫'],
]
const KANJI_B = [
  ['行進曲', '进行曲'], ['ラプソディ', '狂想曲'], ['ワルツ', '圆舞曲'], ['ファンファーレ', '号角'], ['囃子', '囃子'],
  ['協奏曲', '协奏曲'], ['ノクターン', '夜曲'], ['まつり', '祭'], ['ステップ', '舞步'], ['シグナル', '信号'],
  ['ドライブ', '疾驰'], ['カーニバル', '狂欢节'], ['物語', '物语'], ['音頭', '音头'], ['ビート', '节拍'],
  ['の詩', '之诗'], ['乱舞', '乱舞'], ['絵巻', '绘卷'],
]
const LATIN_A = ['Crimson', 'Silver', 'Neon', 'Hyper', 'Midnight', 'Solar', 'Lunar', 'Electric', 'Infinite', 'Velvet', 'Phantom', 'Turbo', 'Crystal', 'Rapid', 'Scarlet', 'Cosmic', 'Paper', 'Golden']
const LATIN_B = ['Drive', 'Signal', 'Parade', 'Rhapsody', 'Overture', 'Engine', 'Garden', 'Horizon', 'Circuit', 'Festival', 'Breaker', 'Tempest', 'Mirage', 'Voyage', 'Pulse', 'Labyrinth', 'Lantern', 'Rocket']
const KANA_A = [['どんどん', '咚咚'], ['かっかっ', '咔咔'], ['ぽんぽこ', '砰砰'], ['わくわく', '兴冲冲'], ['ぐるぐる', '转转'], ['きらきら', '闪闪'], ['ふわふわ', '软绵绵'], ['てくてく', '慢慢走']]
const KANA_B = [['パレード', '游行'], ['たいそう', '体操'], ['マーチ', '进行曲'], ['ダンス', '舞'], ['のうた', '之歌'], ['ぼうけん', '冒险'], ['えんそく', '远足']]
// 公有领域古典曲目（不是真实太鼓收录曲表）
const CLASSIC = [
  ['カノン', '卡农', 'パッヘルベル'], ['トルコ行進曲', '土耳其进行曲', 'モーツァルト'], ['威風堂々', '威风凛凛', 'エルガー'],
  ['運命', '命运', 'ベートーヴェン'], ['ボレロ', '波莱罗', 'ラヴェル'], ['新世界より', '自新大陆', 'ドヴォルザーク'],
  ['ハンガリー舞曲第5番', '匈牙利舞曲第5号', 'ブラームス'], ['天国と地獄', '天堂与地狱', 'オッフェンバック'],
  ['花のワルツ', '花之圆舞曲', 'チャイコフスキー'], ['G線上のアリア', 'G弦上的咏叹调', 'バッハ'], ['春の声', '春之声', 'J.シュトラウス2世'],
  ['剣の舞', '马刀舞曲', 'ハチャトゥリアン'], ['ラデツキー行進曲', '拉德茨基进行曲', 'J.シュトラウス1世'], ['熊蜂の飛行', '野蜂飞舞', 'リムスキー＝コルサコフ'],
  ['月光', '月光', 'ベートーヴェン'], ['ウィリアム・テル序曲', '威廉·退尔序曲', 'ロッシーニ'], ['ペール・ギュント', '培尔·金特', 'グリーグ'],
]
const CLASSIC_SUFFIX = [['', ''], [' ～太鼓アレンジ～', ' ～太鼓改编～'], [' -Remix-', ' -Remix-'], [' 第2楽章', ' 第二乐章'], [' 2000', ' 2000']]
const ARTISTS = [
  'Sound Team DON', '鼓動楽団', 'KAGURA Project', 'Studio Hanabi', 'Taiko Sample Unit', 'Rhythm Lab 07', '月見ヶ丘音楽部',
  'Nami & Kaze', 'ぽんぽこ合唱団', 'Neon Kitchen', 'Akatsuki Sound', 'DJ Sample', '黒猫楽団', 'Blue Signal', 'Team Hayabusa',
  'Sakuraba Strings', 'Ichigo Beats', 'Tsubame', 'ヨミ', 'Kuroshio', '宵宮サウンズ', 'Paper Lantern', 'Mono & Poly',
]
const P_NAMES = ['ゆきみ', 'かもめ', 'Neko', 'ほたる', 'Rook', 'つばき', 'Lumen', 'もずく']
const GENRE_MIX = [['namco', 28], ['pops', 15], ['anime', 14], ['game', 13], ['vocaloid', 12], ['variety', 8], ['classic', 6], ['kids', 4]]
const ONI_STARS = [[5, 4], [6, 10], [7, 18], [8, 24], [9, 22], [10, 18]]
const CONST_TABLE = { 1: [0.05, 0.3], 2: [0.1, 0.4], 3: [0.2, 0.6], 4: [0.3, 1.0], 5: [1.0, 1.5], 6: [2.6, 2.0], 7: [4.4, 2.4], 8: [6.0, 2.8], 9: [8.0, 2.4], 10: [10.2, 4.5] }
const constFor = (star, r) => {
  const [b, w] = CONST_TABLE[star]
  return round(Math.min(14.8, b + w * (star === 10 ? r() ** 1.7 : r())))
}

function genTitle(r, genre) {
  if (genre === 'classic') {
    const [ja, zh] = pick(r, CLASSIC)
    const [sj, sz] = pick(r, CLASSIC_SUFFIX)
    return { ja: ja + sj, zh: zh + sz }
  }
  if (genre === 'kids') {
    const a = pick(r, KANA_A)
    const b = pick(r, KANA_B)
    return { ja: a[0] + b[0], zh: a[1] + b[1] }
  }
  const x = r()
  if (x < 0.45) {
    const a = pick(r, KANJI_A)
    const b = pick(r, KANJI_B)
    return { ja: a[0] + b[0], zh: a[1] + b[1] }
  }
  if (x < 0.8) {
    const t = `${pick(r, LATIN_A)} ${pick(r, LATIN_B)}`
    return { ja: t, zh: t }
  }
  const a = pick(r, KANJI_A)
  const n = pick(r, LATIN_B)
  return { ja: `${a[0]}・${n}`, zh: `${a[1]}・${n}` }
}

function genArtist(r, genre) {
  if (genre === 'vocaloid') return `${pick(r, P_NAMES)}P feat. ${r() < 0.6 ? '初音ミク' : '鏡音リン'}`
  return pick(r, ARTISTS)
}

function versionOf(year, shelf) {
  if (shelf === 2) return '家用机'
  if (year <= 2011) return `太鼓 ${clamp(Math.round((year - 2001) * 1.35) + 1, 1, 14)}`
  if (year <= 2019) return '新筐体'
  return `虹 ${year}`
}

// M2 边界情况：按生成序号落位（同一序号永远是同一首）。
const EDGE_SPECS = {
  11: { edge: 'longJa', ja: 'はるかなる星空の下でいつまでも太鼓を叩き続けるすべての人たちへ贈る長い長い行進曲', zh: '献给在遥远星空之下一直敲着太鼓的所有人的漫长而又漫长的进行曲' },
  97: { edge: 'longJa', ja: '夜明け前の商店街で偶然出会った二人が朝まで踊り明かすまでの物語（太鼓の達人アレンジ）', zh: '黎明前的商店街上偶然相遇的两个人一直跳舞到天亮为止的故事（太鼓达人改编）' },
  203: { edge: 'longJa', ja: '週末のゲームセンターで百回目のコインを入れる前にもう一度だけ深呼吸をするためのワルツ第二番', zh: '周末在机厅投下第一百枚硬币之前再深呼吸一次用的第二号圆舞曲' },
  318: { edge: 'longZh', ja: 'ドンカツ大行進', zh: '咚咔大游行：献给每一位在周末傍晚准时出现在机厅门口排队的太鼓玩家' },
  424: { edge: 'longZh', ja: 'ばちさばき入門', zh: '鼓棒操控入门：从握法、起手、交互到顺手，一首曲子讲清楚的完整练习课' },
  537: { edge: 'longZh', ja: 'Midnight Lantern Parade', zh: '午夜灯笼游行（Midnight Lantern Parade）——夏日祭典限定的长长队伍' },
  641: { edge: 'special', ja: 'ドン♡カツ!?パラダイス', zh: '咚♡咔!?乐园' },
  755: { edge: 'special', ja: '（仮）タイトル未定＊ＭＩＸ', zh: '（暂定）标题未定＊MIX' },
  862: { edge: 'special', ja: '↑↑アゲアゲ↑↑ Don-Chan Remix', zh: '↑↑嗨起来↑↑ Don-Chan Remix' },
  978: { edge: 'special', ja: '～夢と現の狭間で～ Dream×Reality', zh: '～梦与现实的夹缝之间～ Dream×Reality' },
  1084: { edge: 'special', ja: 'Hello, 世界!? ～Version 2.0～', zh: 'Hello, 世界!? ～Version 2.0～' },
  57: { edge: 'oniOnly' },
  151: { edge: 'oniOnly', ura: true },
  263: { edge: 'oniOnly' },
  377: { edge: 'noArtist', artist: '' },
  489: { edge: 'noArtist', artist: '' },
  599: { edge: 'noArtist', artist: '' },
  1190: { edge: 'bpmRange', bpm: '44.5-178' },
  1296: { edge: 'bpmRange', bpm: '60-240' },
  1402: { edge: 'bpmRange', bpm: '95.5-191.5' },
  707: { edge: 'manyAliases', aliases: ['dkp', '咚咔派对', 'donkatsu', '派对', 'party', '咚咔'] },
  811: { edge: 'manyAliases', aliases: ['ssd', '星尘疾驰', 'stardust', 'hoshi', '疾驰', 'drive'] },
  919: { edge: 'manyAliases', aliases: ['hnb', '烟花之舞', 'hanabi', '夏祭', 'summer', '花火'] },
}

function genCharts(r, id, levels, oniConst, uraConst, oniNotes, branchy) {
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
      notes = Math.round(oniNotes * (1.12 + r() * 0.25))
    } else {
      notes = Math.round(oniNotes * [0.22, 0.36, 0.6][i] * (0.9 + r() * 0.2))
      if (d === 3 && oniConst != null) c = round(Math.max(0.1, oniConst * 0.42 + r() * 0.6))
    }
    const base = c ?? star * 1.1
    const ab = () => round(clamp(base + (r() - 0.5) * 3.2, 0.2, 15.5))
    const chart = {
      d,
      star,
      constant: c,
      c75: c != null ? round(c + (r() - 0.35) * 0.5) : null,
      c99: c != null ? round(c - (r() - 0.3) * 0.4) : null,
      notes,
      roll: round(1 + r() * 6, 1),
      balloon: Math.floor(r() * 4),
      branch: branchy && d >= 3,
      abilities: { stamina: ab(), handspeed: ab(), burst: ab(), complex: ab(), rhythm: ab() },
    }
    attachDensity(chart, hash(id, d, 4242), id)
    charts.push(chart)
  })
  return charts
}

/** 生成 count 首示例曲。返回 { songs, edge }，edge 为 M2 边界桶（song id 数组）。 */
export function genSongs(count, usedIds) {
  const used = new Set(usedIds)
  const ids = []
  for (let id = 1; ids.length < count; id++) if (!used.has(id)) ids.push(id)
  const START = Date.UTC(2001, 1, 21)
  const END = Date.UTC(2025, 0, 22) // 生成曲早于所有 2025–2026 精选新曲
  const span = (END - START) / 86400000
  const batches = Math.ceil(count / 9)
  const seenTitle = new Map()
  const edge = { longJa: [], longZh: [], special: [], sameTitle: [], noUra: [], oniOnly: [], noConstant: [], noChartImage: [], noAudio: [], noArtist: [], unlisted: [], otherPlatform: [], manyAliases: [], bpmRange: [] }
  const push = (k, id) => edge[k].length < 6 && edge[k].push(id)

  const songs = ids.map((id, idx) => {
    const r = rng(hash(id, 1))
    const spec = EDGE_SPECS[idx] || null
    const genre = weighted(r, GENRE_MIX)
    let { ja, zh } = genTitle(r, genre)
    if (spec?.ja) ({ ja, zh } = spec)
    const n = (seenTitle.get(ja) || 0) + 1
    seenTitle.set(ja, n)
    if (n > 1) {
      const suf = n === 2 ? ' II' : n === 3 ? ' III' : ` (ver.${n})`
      ja += suf
      zh += suf
    }
    // BPM
    let bpm
    const [lo, hi] = genre === 'kids' ? [96, 160] : genre === 'classic' ? [110, 210] : genre === 'namco' ? [140, 280] : [110, 230]
    const main = Math.round(lo + (hi - lo) * r())
    if (r() < 0.12) bpm = `${Math.round(main * (0.45 + r() * 0.35))}-${main}`
    else bpm = String(main)
    if (spec?.bpm) bpm = spec.bpm
    // 星级
    let oni = genre === 'kids' ? 4 + Math.floor(r() * 4) : weighted(r, ONI_STARS)
    const easy = clamp(oni - 5 + Math.floor(r() * 2), 1, 5)
    const normal = clamp(oni - 3 + Math.floor(r() * 2), 2, 7)
    const hard = clamp(oni - 2 + Math.floor(r() * 2), 3, 8)
    const hasUra = genre !== 'kids' && (r() < 0.18 || spec?.ura)
    const ura = hasUra ? clamp(oni + Math.floor(r() * 3), Math.max(oni, 7), 10) : null
    const levels = spec?.edge === 'oniOnly' ? [null, null, null, oni, ura] : [easy, normal, hard, oni, ura]
    // 定数（约 8% 的谱缺定数）
    const noConst = r() < 0.08
    const oniConst = noConst ? null : constFor(oni, r)
    const uraConst = ura == null || noConst ? null : constFor(ura, r)
    const oniNotes = Math.round((180 + oni * 62) * (0.85 + r() * 0.35) * Math.pow(main / 170, 0.4))
    const charts = genCharts(r, id, levels, oniConst, uraConst, oniNotes, r() < 0.07)
    // 上架、资源
    const sx = r()
    const shelf = sx < 0.06 ? 1 : sx < 0.1 ? 2 : 0
    const hasChartImage = r() >= 0.05
    const hasAudio = r() >= 0.07
    // 上架日期：按批次（同一批若干首同日上线）
    const batch = Math.floor((idx / count) * batches)
    const day = Math.floor((batch / batches) * span)
    const openDay = new Date(START + day * 86400000).toISOString().slice(0, 10)
    const year = Number(openDay.slice(0, 4))
    const version = versionOf(year, shelf)
    let artist = genArtist(r, genre)
    if (genre === 'classic') artist = CLASSIC.find((c) => ja.startsWith(c[0]))?.[2] ?? artist
    if (spec && 'artist' in spec) artist = spec.artist
    // 别名
    let aliases = []
    const na = weighted(r, [[0, 35], [1, 30], [2, 20], [3, 10], [4, 5]])
    const cands = []
    if (/^[A-Za-z]/.test(ja)) cands.push(ja.split(/\s+/).map((w) => w[0]).join('').toLowerCase())
    if (zh !== ja) cands.push(zh.slice(0, 2))
    cands.push(ja.slice(0, 2), `${genre}${id}`)
    aliases = [...new Set(cands)].slice(0, na)
    if (spec?.aliases) aliases = spec.aliases
    const song = { id, ja, zh, genre, bpm, levels, charts, shelf, version, artist, openDay, aliases, hasChartImage, hasAudio, generated: true }
    if (r() < 0.03) song.legacyIds = [id + 3000]

    if (spec?.edge) push(spec.edge, id)
    if (spec?.edge === 'longJa') push('longZh', id)
    if (ja === zh && !spec) push('sameTitle', id)
    if (ura == null && spec?.edge !== 'oniOnly') push('noUra', id)
    if (noConst) push('noConstant', id)
    if (!hasChartImage) push('noChartImage', id)
    if (!hasAudio) push('noAudio', id)
    if (shelf === 1) push('unlisted', id)
    if (shelf === 2) push('otherPlatform', id)
    if (spec?.edge !== 'bpmRange' && /\./.test(bpm) && bpm.includes('-')) push('bpmRange', id)
    return song
  })
  return { songs, edge }
}

/* ================= 成绩（M3） ================= */
function rankOf(score, ranks) {
  let rank = 1
  for (const rk of ranks) if (rk.min && score >= rk.min) rank = rk.v
  return rank
}

export function accToRt(constant, acc) {
  // 演示用近似：75% 以下不计，越接近 100% 越逼近定数上限
  if (constant == null || acc < 0.75) return 0
  const k = Math.pow((acc - 0.75) / 0.25, 1.6)
  return round(constant * (0.62 + 0.38 * k) + (acc > 0.985 ? 0.25 : 0))
}

/** V1 的精选曲成绩算法，原样保留（演示行的数值不变）。 */
export function curatedScores(songs, ranks) {
  const pr = rng(7741)
  const out = []
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
      const rank = rankOf(score, ranks)
      const daysAgo = Math.floor(pr() * 120)
      out.push({
        songId: s.id, d: c.d, star: c.star, constant: c.constant, score, good, ok, ng,
        combo: ng === 0 ? c.notes : Math.round(c.notes * (0.3 + pr() * 0.5)),
        roll: Math.round(c.roll * (12 + pr() * 8)),
        crown, rank,
        plays: 2 + Math.floor(pr() * 46),
        acc: round(realAcc * 100, 2),
        rt: accToRt(c.constant, realAcc),
        daysAgo, locked: false, manual: false,
      })
    }
  }
  return out
}

/** 生成曲的成绩：按「玩家能力 ≈ 12.1」加权抽取 target 张魔王 / 里谱，再按难度给出精度。 */
export function generatedScores(songs, target, ranks, skill = 12.1) {
  const cand = []
  for (const s of songs) {
    for (const c of s.charts) {
      if (c.d < 4) continue
      const r = rng(hash(s.id, c.d, 77))
      const h = c.constant ?? c.star * 1.25
      const gap = h - skill
      let w = gap > 2.2 ? 0.1 : gap > 1.2 ? 0.45 : h < 3 ? 0.12 : h < 6 ? 0.3 : 0.9
      if (c.d === 5) w *= 1.1
      cand.push({ s, c, r, h, key: r() ** (1 / w) })
    }
  }
  cand.sort((a, b) => b.key - a.key || a.s.id - b.s.id || a.c.d - b.c.d)
  const out = []
  for (const { s, c, r, h } of cand.slice(0, Math.max(0, target))) {
    // 能力以内：越难精度越低；超过能力 0.5 以上急剧下降；约 22% 的谱只是「打过几次」，精度明显更低。
    // 另有约 15% 是「拿手曲」，精度额外高一截（它们决定 Rating 的前 20）。
    const x = r()
    const casual = x < 0.32 ? 0.03 + r() * 0.17 : 0
    const strong = x > 0.85 ? 0.03 : 0
    const acc = clamp(0.999 - 0.0036 * Math.max(0, h - 7.5) ** 1.45 - 0.06 * Math.max(0, h - skill - 0.8) ** 1.2 + (r() - 0.7) * 0.05 - casual + strong, 0.6, 1)
    const ng = acc > 0.996 ? 0 : Math.max(0, Math.round((1 - acc) * c.notes * (0.1 + r() * 0.3) - (h < 7 ? 2 : 0)))
    const ok = Math.max(0, Math.round((1 - acc) * c.notes * 2 - ng * 2))
    const good = c.notes - ok - ng
    const realAcc = (good + ok * 0.5) / c.notes
    const crown = ng === 0 ? (ok === 0 ? 2 : 1) : realAcc > 0.8 ? 0 : -1
    const score = Math.min(1009990, Math.round((1000000 * (good + ok * 0.5)) / c.notes / 10) * 10 + (crown === 2 ? Math.round(r() * 900) * 10 : 0))
    out.push({
      songId: s.id, d: c.d, star: c.star, constant: c.constant, score, good, ok, ng,
      combo: ng === 0 ? c.notes : Math.round(c.notes * (0.3 + r() * 0.5)),
      roll: Math.round(c.roll * (12 + r() * 8)),
      crown, rank: rankOf(score, ranks),
      plays: 1 + Math.floor(r() ** 2 * 60),
      acc: round(realAcc * 100, 2),
      rt: accToRt(c.constant, realAcc),
      daysAgo: Math.floor(r() ** 1.5 * 400),
      locked: false, manual: false,
    })
  }
  return out
}

/* ================= 成长（M4） ================= */
/** 400 天 Rating：锚点之间分段单调上升，带平台期与台阶；末点恰好等于 end。 */
export function genRatingHistory(end) {
  const anchors = [[399, 9.42], [300, 10.05], [250, 10.31], [200, 10.62], [132, 10.97], [131, 11.03], [75, 11.52], [74, 11.6], [30, end - 0.31], [23, 11.78], [22, 11.82], [7, end - 0.08], [0, end]]
  const plateaus = [[290, 268], [188, 160], [56, 40]]
  const flat = (i) => plateaus.some(([a, b]) => i <= a && i >= b)
  const r = rng(99)
  const vals = new Map()
  vals.set(399, anchors[0][1])
  for (let k = 1; k < anchors.length; k++) {
    const [fromAgo, fromV] = anchors[k - 1]
    const [toAgo, toV] = anchors[k]
    const days = []
    for (let i = fromAgo - 1; i >= toAgo; i--) days.push(i)
    const pr = toAgo === 0 ? 0.6 : 0.18
    const w = days.map((i) => (!flat(i) && r() < pr ? 0.3 + r() : 0))
    if (!w.some((x) => x > 0)) w[w.length - 1] = 1
    const tw = w.reduce((a, b) => a + b, 0)
    let v = fromV
    days.forEach((i, j) => {
      v += ((toV - fromV) * w[j]) / tw
      vals.set(i, v)
    })
    vals.set(toAgo, toV)
  }
  const out = []
  for (let i = 399; i >= 0; i--) out.push({ daysAgo: i, v: round(vals.get(i), 3) })
  out[out.length - 1].v = end
  return out
}

/** 60 周六维：每周增量非负；最后一周的增量等于第 0 周回顾的 dimDeltas；末点等于当前六维。 */
export function genDimHistory(dims, lastDeltas, keys) {
  const out = {}
  keys.forEach((key, idx) => {
    const r = rng(300 + idx)
    const inc = new Array(60).fill(0)
    for (let w = 1; w < 59; w++) inc[w] = r() < 0.55 ? r() * 0.05 : (w + idx) % 6 === 0 ? 0.03 : 0
    inc[59] = lastDeltas[key] ?? 0
    const arr = new Array(60)
    arr[59] = dims[key]
    for (let w = 58; w >= 0; w--) arr[w] = arr[w + 1] - inc[w + 1]
    out[key] = arr.map((v, i) => (i === 59 ? dims[key] : round(v)))
  })
  return out
}

/** 120 天每日进展；最后 21 天的游玩节奏与 V1 相同，三个手写高光日由调用方覆盖。 */
export function genLaneDays(songById, laneSongs, n = 120) {
  const lr = rng(424242)
  const days = []
  const tail = [1, 1, 0, 1, 1, 1, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1]
  for (let i = n - 1; i >= 0; i--) {
    const date = new Date(2026, 10, 16 - i)
    const played = i < tail.length ? tail[tail.length - 1 - i] : lr() < 0.62 ? 1 : 0
    const facts = []
    if (played) {
      const k = 1 + Math.floor(lr() * 4)
      for (let j = 0; j < k; j++) {
        const sid = pick(lr, laneSongs)
        const s = songById[sid]
        const d = s.levels[4] != null && lr() < 0.3 ? 5 : 4
        const roll = lr()
        const type = roll < 0.05 ? 'fc' : roll < 0.07 ? 'df' : roll < 0.5 ? 'score-pb' : roll < 0.68 ? 'rank-upgrade' : roll < 0.84 ? 'ng-reduced' : 'combo-improved'
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
    days.push({ date, daysAgo: i, played: !!played, charts: played ? 4 + Math.floor(lr() * 14) : 0, facts })
  }
  return days
}

const WEEK_THEMES = {
  'new-crown': { zh: '这一周，新的王冠落了下来。', ja: '今週、新しい王冠が増えました。' },
  'goal-follow-through': { zh: '这一周，选下的练习有了结果。', ja: '今週、決めた練習が実を結びました。' },
  'rank-breakthrough': { zh: '这一周，评价往上走了一级。', ja: '今週、評価が一段上がりました。' },
  'score-breakthrough': { zh: '这一周，最好成绩一次次被刷新。', ja: '今週は自己ベストが何度も更新されました。' },
  quiet: { zh: '这一周打得不多，节奏还在。', ja: '今週は控えめ。でもリズムは続いています。' },
  'mixed-growth': { zh: '这一周，几处小进步一起出现。', ja: '今週は小さな前進がいくつも。' },
}

const md = (date) => `${date.getMonth() + 1} 月 ${date.getDate()} 日`
const mdJa = (date) => `${date.getMonth() + 1}月${date.getDate()}日`

/** 12 周回顾（新 → 旧）；第 0 周是手写的 base，其余由 laneDays / ratingHistory / dimHistory / goals 推导。 */
export function genWeeklies({ base, laneDays, ratingHistory, dimHistory, goals, songById, FACT, DIFFS, keys }) {
  const rAt = (ago) => ratingHistory[ratingHistory.length - 1 - ago]?.v ?? ratingHistory[0].v
  const out = [{ ...base, week: 0, rangeJa: '11月10日 – 11月16日', startAgo: 6, endAgo: 0 }]
  for (let w = 1; w < 12; w++) {
    const endAgo = w * 7
    const startAgo = endAgo + 6
    const days = laneDays.filter((d) => d.daysAgo >= endAgo && d.daysAgo <= startAgo)
    const facts = days.flatMap((d) => d.facts)
    const cnt = (t) => facts.filter((f) => f.type === t).length
    const completedGoals = goals.filter((g) => g.status === 'completed' && g.doneAgo >= endAgo && g.doneAgo <= startAgo).length
    const totals = {
      distinctCharts: Math.round(days.reduce((a, d) => a + d.charts, 0) * 0.8),
      pb: cnt('score-pb'),
      fc: cnt('fc'),
      df: cnt('df'),
      rankUpgrade: cnt('rank-upgrade'),
      completedGoals,
    }
    const activeDays = days.map((d) => (d.played ? 1 : 0))
    const dimDeltas = {}
    for (const k of keys) {
      const arr = dimHistory[k]
      dimDeltas[k] = round(Math.max(0, arr[59 - w] - arr[58 - w]))
    }
    const sortedDims = [...keys].sort((a, b) => dimDeltas[b] - dimDeltas[a])
    if (dimDeltas[sortedDims[0]] === 0) dimDeltas[sortedDims[0]] = 0.01 // 视图用最大值做分母
    const prevDims = keys.map((k) => [k, dimHistory[k][58 - w] - dimHistory[k][57 - w]]).sort((a, b) => b[1] - a[1])
    const active = activeDays.reduce((a, b) => a + b, 0)
    const type = totals.df || totals.fc ? 'new-crown' : totals.rankUpgrade >= 3 ? 'rank-breakthrough' : totals.pb >= 5 ? 'score-breakthrough' : active <= 2 ? 'quiet' : completedGoals ? 'goal-follow-through' : 'mixed-growth'
    const top = [...facts].sort((a, b) => FACT[b.type].weight - FACT[a.type].weight).slice(0, 3)
    const highlights = top.map((f) => {
      const s = songById[f.songId]
      const dz = DIFFS[f.d].zh
      const dj = DIFFS[f.d].ja
      const t = FACT[f.type]
      const tail =
        f.type === 'ng-reduced' ? `不可 ${f.before} → ${f.after}` : f.type === 'combo-improved' ? `连击 ${f.before} → ${f.after}` : f.type === 'rank-upgrade' ? `评价升级` : `${thousands(f.before)} → ${thousands(f.after)}`
      return { type: f.type, songId: f.songId, d: f.d, text: `${s.ja}（${dz}）${t.zh}：${tail}。`, textJa: `${s.ja}（${dj}）${t.ja}：${tail.replace('连击', 'コンボ').replace('评价升级', '評価アップ')}。` }
    })
    const end = new Date(2026, 10, 16 - endAgo)
    const start = new Date(2026, 10, 16 - startAgo)
    out.push({
      week: w,
      range: `${md(start)} – ${md(end)}`,
      rangeJa: `${mdJa(start)} – ${mdJa(end)}`,
      startAgo,
      endAgo,
      theme: { type, ...WEEK_THEMES[type] },
      totals,
      ratingDelta: round(rAt(endAgo) - rAt(startAgo + 1)),
      focusFrom: prevDims[0][0],
      focusTo: sortedDims[0],
      dimDeltas,
      activeDays,
      highlights,
    })
  }
  return out
}

/** 24 条历史目标：base 里已有的手写条目 + 生成补足，分布在约 10 个月内，每条都有 evidence。 */
export function genGoalHistory(base, songPool, chartOf, RANKS, total = 24) {
  const r = rng(5150)
  const types = ['score-pb', 'ng-reduced', 'clear', 'fc', 'df', 'rank-upgrade', 'played']
  const dims = ['big_song', 'stamina', 'speed', 'accuracy_power', 'rhythm', 'complex']
  const out = [...base]
  let ago = Math.max(...base.map((g) => g.createdAgo)) + 4
  let n = 1
  while (out.length < total) {
    ago += 5 + Math.floor(r() * 12)
    const songId = pick(r, songPool)
    const d = chartOf(songId, 5) && r() < 0.35 ? 5 : 4
    const type = types[Math.floor(r() * types.length)]
    const cancelled = r() < 0.25
    const doneAgo = ago - 2 - Math.floor(r() * 10)
    let baseline
    let latest
    let evidence
    if (type === 'score-pb') {
      const s0 = 900000 + Math.floor(r() * 60000)
      const s1 = s0 + (cancelled ? 900 : 4000 + Math.floor(r() * 15000))
      baseline = { score: s0 }
      latest = { score: s1 }
      evidence = `+${thousands(s1 - s0)}`
    } else if (type === 'ng-reduced' || type === 'fc') {
      const a = 3 + Math.floor(r() * 9)
      const b = type === 'fc' && !cancelled ? 0 : Math.max(0, a - 1 - Math.floor(r() * 4))
      baseline = { ng: a }
      latest = { ng: b }
      evidence = `不可 ${a} → ${b}`
    } else if (type === 'df') {
      const a = 4 + Math.floor(r() * 12)
      const b = cancelled ? Math.max(1, a - 3) : 0
      baseline = { ok: a }
      latest = { ok: b }
      evidence = `可 ${a} → ${b}`
    } else if (type === 'rank-upgrade') {
      const a = 5 + Math.floor(r() * 2)
      baseline = { rank: a }
      latest = { rank: cancelled ? a : a + 1 }
      evidence = cancelled ? `${RANKS[a].zh} 未变` : `${RANKS[a].zh} → ${RANKS[a + 1].zh}`
    } else if (type === 'clear') {
      baseline = { crown: -1 }
      latest = { crown: cancelled ? -1 : 0 }
      evidence = cancelled ? '魂量表差 4%' : '第一次通关'
    } else {
      baseline = { plays: 0 }
      latest = { plays: 1 }
      evidence = '打了第一次'
    }
    if (cancelled) evidence += ' 后换了目标'
    out.push({ id: `gh${String(n++).padStart(2, '0')}`, status: cancelled ? 'cancelled' : 'completed', type, songId, d, createdAgo: ago, doneAgo, dim: pick(r, dims), baseline, latest, evidence })
  }
  return out
}

/* ================= 社区（M5） ================= */
export const EXTRA_USERS = [
  ['dondon', '咚咚小王子'], ['bachi', '鼓棒不离手'], ['kaka', 'KaKa'], ['urahunter', '里谱收藏家'], ['yakin', '夜班打鼓人'],
  ['ura_q', 'Ura_Hunter'], ['kakaka', '咔咔咔'], ['renda', '连打怪'], ['judan', '十段候补'], ['slowpoke', '慢速选手'],
  ['ippaku', '一拍之差'], ['mitsu', 'Don_Mitsu'], ['senbon', 'せんぼん'], ['bachisabaki', 'ばちさばき'], ['buchou', '太鼓部長'],
  ['donchan', '咚酱的鼓'], ['joju', '机厅常驻'], ['rhythmon', '节奏怪物'], ['sakuya', 'Sakuya'], ['rollmaster', 'RollMaster'],
  ['nijuyon', '24分恐惧症'], ['shiroiki', '白粹收集者'], ['fcfail', '全连困难户'], ['tatara', 'たたら'], ['momiji', 'momiji'],
  ['harudon', 'Haru_don'], ['ngzero', '不可清零计划'], ['hidari', '左起派'], ['migi', '右起派'], ['ryoute', '双押党'],
  ['mint_k', 'Mint_K'], ['yosuzume', '夜雀'],
]
const USER_TITLES = ['连打之鬼', '节奏旅人', '体力怪兽', '全良猎人', '太鼓新人', '里谱探索者', '机厅之主', '滚奏达人', '变速克星', '读谱专家', '夜行鼓手', '咚咔平衡者', '后半爆发', '十段挑战者']
const RARE_TITLES = new Set(['全良猎人', '连打之鬼', '机厅之主', '变速克星'])

/** 补足用户：既有 8 个 key 保留并补 rating；新增 32 个。rating 与段位相关。 */
export function genUsers(baseUsers, danGrades, playerRating) {
  const r = rng(8080)
  const ratingOf = (dan) => {
    const i = danGrades.indexOf(dan)
    return i < 0 ? null : round(6.5 + i * 0.42 + (r() - 0.5) * 0.8)
  }
  const out = {}
  for (const [k, u] of Object.entries(baseUsers)) out[k] = { ...u, rating: k === 'mochidon' ? playerRating : ratingOf(u.dan), rare: RARE_TITLES.has(u.title) }
  EXTRA_USERS.forEach(([key, name], i) => {
    const dan = danGrades[Math.min(danGrades.length - 1, Math.floor(r() ** 0.7 * danGrades.length))]
    const title = pick(r, USER_TITLES)
    out[key] = { name, role: i === 4 || i === 17 ? 'moderator' : 'user', title, dan, hue: Math.floor(r() * 360), rating: ratingOf(dan), rare: RARE_TITLES.has(title) }
  })
  return out
}

const CITIES = ['上海', '北京', '广州', '深圳', '成都', '杭州', '南京', '武汉', '西安', '重庆']
const AREAS = ['徐家汇', '五角场', '西单', '天河', '春熙路', '西湖', '新街口', '光谷', '钟楼', '解放碑']
const GEN_TOPICS = {
  official: ['{song} 等 {n} 首新曲已加入曲库', '定数表 V2.{n} 更新说明', 'Viewer 维护公告：本周四凌晨同步暂停', '鼓众广场绑定流程调整说明', '谱面图资源补齐进度（第 {n} 批）'],
  events: ['{city}站线下交流赛报名开始', '第 {n} 届线上段位挑战赛结果公示', '{city}机厅周末擂台赛', '{song} 限时挑战活动说明'],
  'beginner-help': ['鬼 ★{s} 能过，★{s1} 总是在副歌断连怎么办？', '右手比左手慢很多，有什么针对性的练习？', '{song} 鬼的滚奏到底要怎么打？', '新手该先练读谱还是练手速？', '怎么判断自己适合交互还是顺手？', '第一次去机厅，需要带自己的鼓棒吗？'],
  'score-guides': ['{song} {diff} ★{s}：第 {m} 小节的 {div} 分配置拆解', '{song} {diff} 全连路线：哪里可以换手', '{song} {diff} 的变速段怎么看', '{song} {diff}：后半体力分配建议'],
  dojo: ['{dan}课题曲顺序与体力分配', '{dan}红合格到金合格差在哪', '{dan}第三首的不可上限讨论'],
  achievements: ['{song} {diff} 全良！', '{song} {diff} 终于全连，{n} 次游玩', '{song} {diff} 极 达成', '{dan}金合格，纪念一下'],
  arcade: ['{city}｜{area}机厅鼓面情况（{month} 月）', '{city}新开的机厅有两台鼓', '{city}｜哪家店的鼓最灵敏？'],
  general: ['你们打鼓多久了？', '最喜欢的太鼓版本是哪一代？', '鼓棒用什么材质的？', '打完一首长曲手会抖吗？', '周末机厅排队一般要多久？', '有人和我一样只打里谱吗？'],
  creative: ['自制谱：{song} 改编版（附 TJA）', '画了咚酱和咔酱的同人图', '{song} 太鼓风翻奏视频', '自制鼓面贴纸分享'],
}
const SECTION_PLAN = [['achievements', 46], ['general', 45], ['beginner-help', 35], ['score-guides', 30], ['dojo', 20], ['arcade', 18], ['creative', 14], ['events', 12], ['official', 11]]
const TAG_POOL = {
  official: ['新曲', '定数', '公告', '维护', '谱面图'],
  events: ['比赛', '报名', '线下', '结果'],
  'beginner-help': ['新手', '读谱', '手速', '鼓棒', '练习'],
  'score-guides': ['24 分', '后半难', '手法', '变速', '体力', '复合'],
  dojo: ['段位道场', '十段', '九段', '合格'],
  achievements: ['全良', '全连', '★10', '极', '纪念'],
  arcade: ['机厅', '鼓面', '排队'],
  general: ['闲聊', '鼓棒', '版本'],
  creative: ['自制谱', 'TJA', '同人', '视频'],
}
const SUMMARY_BANK = [
  '先说结论：别急着打整首，把卡住的那几个小节单独拿出来循环。',
  '这段配置看起来吓人，拆开之后其实就是两组 16 分加一个半拍休止。',
  '我用的是左起，换手点放在每组的第三个音符，打起来比较顺。',
  '体力不够的话，前半段可以放松一点，保证后半不崩。',
  '附上我这一个月的成绩变化，可以看到不可是一点点压下来的。',
  '机厅的鼓面有点偏硬，右咔需要用力一点才能判定。',
  '欢迎补充不同手法的经验，我会把好的建议整理到一楼。',
  '数据来自 Viewer 同步的成绩，样本不大，仅供参考。',
  '如果你也卡在这里，建议先把流速调高一点，看清间距再说。',
  '这次更新之后，搜索可以直接用别名找到曲子了。',
]
const LONG_TITLE_CLAUSES = [
  '关于鬼 ★10 曲目在后半段连续 24 分配置中如何分配左右手才能既不漏咔又不掉速的一些长期观察', '，以及在不同机厅鼓面灵敏度不同的情况下',
  '是否应该调整握棒位置与力度，附上我连续三个月的练习记录和不可数变化曲线', '，欢迎有经验的玩家一起讨论补充',
]

function agoText(daysAgo) {
  if (daysAgo < 1) return `${Math.max(1, Math.round(daysAgo * 24))} 小时前`
  if (daysAgo < 2) return '昨天'
  if (daysAgo < 14) return `${Math.floor(daysAgo)} 天前`
  if (daysAgo < 60) return `${Math.floor(daysAgo / 7)} 周前`
  const dt = new Date(2026, 10, 16 - Math.floor(daysAgo))
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}
export { agoText }

function longText(minLen, r, bank) {
  let s = ''
  while (s.length < minLen) s += bank[Math.floor(r() * bank.length)]
  return s
}

/** 生成帖子：总数 total（含手写帖），手写帖保持在最前、id 不变。 */
export function genThreads(base, total, { userKeys, songPool, songById, DIFFS, danGrades }) {
  const r = rng(4021)
  const out = base.map((t) => ({ ...t }))
  const need = total - out.length
  const plan = []
  const planTotal = SECTION_PLAN.reduce((a, s) => a + s[1], 0)
  for (const [slug, n] of SECTION_PLAN) for (let i = 0; i < Math.round((n / planTotal) * need); i++) plan.push(slug)
  while (plan.length < need) plan.push('general')
  plan.length = need
  // 打散版块顺序（确定性洗牌）
  for (let i = plan.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[plan[i], plan[j]] = [plan[j], plan[i]]
  }
  const authors = userKeys.filter((k) => k !== 'sakura')
  let id = 3980
  let daysAgo = 6.3
  plan.forEach((section, i) => {
    id -= 1 + Math.floor(r() * 4)
    daysAgo += 0.4 + r() * 1.6
    const songId = pick(r, songPool)
    const s = songById[songId]
    const d = s.levels[4] != null && r() < 0.35 ? 5 : 4
    const ch = s.charts.find((c) => c.d === d)
    const fill = (tpl) =>
      tpl
        .replace('{song}', s.ja)
        .replace('{diff}', DIFFS[d].zh)
        .replace('{s1}', String(Math.min(10, ch.star + 1)))
        .replace('{s}', String(ch.star))
        .replace('{n}', String(2 + Math.floor(r() * 30)))
        .replace('{m}', String(8 + Math.floor(r() * 50)))
        .replace('{div}', pick(r, ['12', '16', '24']))
        .replace('{dan}', pick(r, danGrades.slice(10)))
        .replace('{city}', pick(r, CITIES))
        .replace('{area}', pick(r, AREAS))
        .replace('{month}', String(1 + Math.floor(r() * 12)))
    const tpl = pick(r, GEN_TOPICS[section])
    let title = fill(tpl)
    if (i === 17 || i === 88 || i === 151) title = longText(120, r, LONG_TITLE_CLAUSES).slice(0, 120)
    const usesSong = tpl.includes('{song}')
    const type = section === 'official' || section === 'events' ? (section === 'official' || r() < 0.6 ? 'official' : 'discussion') : section === 'score-guides' || section === 'dojo' ? 'guide' : section === 'achievements' ? 'achievement' : 'discussion'
    const author = type === 'official' ? 'sakura' : pick(r, authors)
    const nSent = 1 + Math.floor(r() * 3)
    let summary = Array.from({ length: nSent }, () => pick(r, SUMMARY_BANK)).join('')
    if (i % 41 === 5) summary = longText(280, r, SUMMARY_BANK)
    const pool = TAG_POOL[section]
    let nTags = 1 + Math.floor(r() * 3)
    if (i % 23 === 3) nTags = 5
    const off = Math.floor(r() * pool.length)
    const tags = [...pool.slice(off), ...pool.slice(0, off), '讨论', '分享', '经验'].slice(0, nTags)
    const heat = r() ** 2.2
    const t = {
      id, section, type,
      pinned: (section === 'official' && i < 60 && r() < 0.35) || i === 40,
      featured: r() < 0.05,
      locked: i % 57 === 9,
      author,
      ago: agoText(daysAgo),
      daysAgo: round(daysAgo, 1),
      title, summary, tags,
      likes: Math.round(3 + heat * 900),
      replies: Math.round(heat * 180 + r() * 6),
      views: Math.round(80 + heat * 15000 + r() * 400),
    }
    if (usesSong || (section !== 'general' && section !== 'official' && r() < 0.25)) {
      t.song = { id: songId, d }
      if ((type === 'achievement' || type === 'guide') && r() < 0.4) t.cover = true
    }
    out.push(t)
  })
  return out
}

const POST_SENTENCES = [
  '第 41 小节开始的 24 分，我的问题是第二组结束后重心没回来。',
  '试了左起之后第三组的起手确实顺了，但第四组又开始漏咔。',
  '握短一点真的有用，手腕的动作幅度小了很多。',
  '倍速练习很关键，0.8 倍能连续十次不漏再回到原速。',
  '我是交互派，觉得只要手速够，交互是最稳的。',
  '顺手打法对我来说更自然，但遇到咔咚交替就会乱。',
  '流速开到 1.5 之后读谱轻松了不少。',
  '昨天去机厅试了一下，不可从 6 降到了 2。',
  '建议先把前 40 小节打到稳定全连，再专门练后半。',
  '这首的滚奏其实可以放一放，判定比较宽松。',
  '体力分配上，前半不要用力打，留着给最后八小节。',
  '我录了视频，手法和楼主说的第三种一样。',
  '感觉 BPM 165 的 24 分比 BPM 200 的 16 分还要难。',
  '有没有人试过用家用机先练，再去机厅打？',
  '换了轻一点的鼓棒以后，交互的速度明显上来了。',
  '新手的话，先别管这段，把其他部分打熟更重要。',
]
const LONG_POST = [
  '这篇写得比较长，是我从卡在不可 9 一路练到全连的完整记录，按时间顺序整理，希望对还在这一段挣扎的人有用。',
  '第一周我做的事情很简单：每次进机厅先打两遍天狗囃子鬼，不管结果，只记录第 41 到 48 小节分别漏了几个音符。七天下来，我发现漏音几乎都集中在第三组的开头和第四组的结尾，前两组反而很少出问题。这说明问题不在手速本身，而在于每组之间那一拍休止之后的重新起手。',
  '第二周开始针对起手练习。我把家用机的练习模式调到 0.8 倍速，只循环第 41 到 44 小节。一开始用的是交互，每次第三组的第一个咔都会慢半拍，因为第二组最后一个音符落在右手，紧接着的休止让我下意识地想用右手再起。后来按照楼主说的改成第二组左起，第三组的起手自然回到了右手，问题一下子少了一半。',
  '第三周回到原速。原速下的感觉和 0.8 倍完全不同，0.8 倍时可以「想」着打，原速只能靠肌肉记忆。这一周的成绩反而退步了，不可从 5 回到了 8。我没有慌，因为退步的原因很明确：原速下我还在用脑子数音符。解决办法是不再数，而是跟着歌里的三味线节奏去打，把 24 分听成一个整体的「滚动」。',
  '第四周开始出现明显的进步。连续三天不可都在 3 以内，其中一次只差 1 个不可就全连。这个阶段最大的敌人变成了紧张：每次打到第 41 小节，手就开始发紧，握棒越来越用力，结果第四组反而容易漏。我的办法是在第 40 小节的休止处故意松一下手指，深呼吸一次，再进入 24 分段落。',
  '这里想单独聊一下「左起」这个手法本身。很多人第一次听到左起会觉得别扭，因为平时习惯了右手起手，突然换成左手，第一个音符的力度和时机都不稳定。我的经验是不要在整首歌里都用左起，只在第二组的开头用一次，目的只有一个：让第三组的起手回到右手。这样左手只需要多承担一个音符，适应起来比想象中快得多。练的时候可以先在家里用桌面或者枕头模拟，左手单独打一个咚，紧接着右手接上剩下的配置，重复到不用想为止。',
  '再说说练习模式的用法。家用机的练习模式可以指定小节循环，也可以调整速度，但我发现很多人只用了调速，没有用好循环。我的做法是把循环范围设成「出错小节的前一小节到后一小节」，这样每次进入难点之前都有一小节的准备时间，和正式打歌时的状态更接近。如果只循环出错的那一小节本身，你会练出一种只在循环里成立的节奏感，一回到整首歌就失效。',
  '关于记录，我用的方法很朴素：手机备忘录里每天一行，写日期、打了几遍、最好的一次不可数、以及当天改了什么。五周下来一共三十多行，回头看的时候能清楚地看到哪一次调整是有效的、哪一次是白费力气。比如第二周我试过把流速从 1.0 调到 2.0，结果那三天不可数反而上升了，于是第四天就改回了 1.5。没有记录的话，这种判断很容易被当天的手感带偏。',
  '还有一个容易被忽略的点：休息。第三周我有两天连续打了一个多小时，第二天手腕明显发酸，成绩也跟着下滑。之后我给自己定了规矩，每次进机厅最多打四十分钟，难点段落最多连续循环十次就换一首别的歌放松一下。看起来练习时间少了，但每一次练习的质量都更高，进步反而更快。',
  '下面是我总结的几点，按重要程度排序：',
  '第五周终于全连。那一把其实打得并不完美，可数是 41，但没有一个不可。打完之后手是抖的，站在鼓前面愣了好几秒。回头看这五周，真正让我进步的不是某一种「神奇手法」，而是把问题拆小、每次只解决一个、并且坚持记录。成绩的变化在 Viewer 的成长页里看得很清楚，每一次刷新最好成绩都对应着一次具体的调整。',
  '最后说一下鼓棒和鼓面。我用的是自带的轻棒，长度比机厅公用棒短大约两厘米。机厅那台鼓的右咔偏硬，需要稍微往鼓缘外侧打才能稳定判定，这个在其他机厅不一定适用。如果你常去的机厅鼓面状态不好，练习时的失误可能并不全是你的问题，可以换一台鼓对比一下再下结论。',
  '补充一个评论区问得最多的问题：全连之后还要不要继续练这首？我的答案是要，但目标要换。全连之前的目标是「不出不可」，全连之后可以换成「把可压下来」，也就是往全良的方向走。这两个目标需要的能力并不一样：前者靠的是稳定性和对配置的熟悉，后者靠的是每一个音符的判定精度。我现在的可数是 41，离全良还差得很远，但至少知道下一阶段该练什么。等哪天真的全良了，再来写一篇续集。',
  '如果你现在也卡在这里，我的建议是：先找出漏音集中的位置，再决定用什么手法，不要一开始就照抄别人的打法。每个人的惯用手、手速、对节奏的感受都不一样，别人的最优解不一定是你的最优解。祝大家早日全连。',
  '（更新）有几位朋友私信问能不能分享练习记录的原始表格，我整理好之后会贴在这一楼的回复里。另外也欢迎大家把自己的练习路线发在楼下，不同手速、不同惯用手的经验放在一起，对后来的人会更有参考价值。',
]

/** 4017 号长帖：手写 4 楼 + 生成到 60 楼；含楼中楼（部分 8 条以上）与一层 2,000+ 字长正文。 */
export function genLongThreadPosts(base, userKeys, opAuthor) {
  const r = rng(4017)
  const out = base.map((p) => ({ ...p, replies: p.replies ? p.replies.map((x) => ({ ...x })) : undefined }))
  const authors = userKeys.filter((k) => k !== 'sakura')
  let minute = 10 * 60 + 10
  for (let floor = out.length + 1; floor <= 60; floor++) {
    minute += 3 + Math.floor(r() * 9)
    const hh = Math.min(23, Math.floor(minute / 60))
    const mm = minute % 60
    const ago = `今天 ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
    const author = floor % 9 === 0 ? opAuthor : pick(r, authors)
    let blocks
    if (floor === 23) {
      const cut = LONG_POST.findIndex((p) => p.startsWith('下面是我总结')) + 1
      blocks = [
        ...LONG_POST.slice(0, cut).map((p) => ({ p })),
        { list: ['先找漏音集中的位置，再决定手法。', '每次只改一个变量：手法、握棒、流速三选一。', '倍速练习只用来建立动作，最终要回到原速。', '紧张时在休止处主动放松手指。', '坚持记录，每次进机厅都写下不可数。'] },
        { img: '五周练习的不可数变化（按天）' },
        ...LONG_POST.slice(cut).map((p) => ({ p })),
      ]
    } else {
      const n = 1 + Math.floor(r() * 3)
      blocks = [{ p: Array.from({ length: n }, () => pick(r, POST_SENTENCES)).join('') }]
    }
    const post = { floor, author, ago, likes: Math.floor(r() ** 2 * 120), blocks }
    const nr = floor === 23 || floor % 11 === 1 ? 8 + Math.floor(r() * 5) : r() < 0.3 ? 1 + Math.floor(r() * 3) : 0
    if (nr) {
      let m2 = minute
      post.replies = Array.from({ length: nr }, () => {
        m2 += 1 + Math.floor(r() * 6)
        return { author: pick(r, authors), ago: `今天 ${String(Math.min(23, Math.floor(m2 / 60))).padStart(2, '0')}:${String(m2 % 60).padStart(2, '0')}`, text: pick(r, POST_SENTENCES) }
      })
    }
    out.push(post)
  }
  return out
}

/** 任意帖子的短楼层（确定性）。 */
export function genShortPosts(thread, userKeys) {
  const r = rng(hash(thread.id, 9))
  const authors = userKeys.filter((k) => k !== 'sakura')
  const n = 3 + Math.floor(r() * 10)
  const posts = [{ floor: 1, author: thread.author, ago: thread.ago, likes: thread.likes, blocks: [{ p: thread.summary }, { p: pick(r, POST_SENTENCES) }] }]
  for (let f = 2; f <= n; f++) {
    const post = { floor: f, author: pick(r, authors), ago: thread.ago, likes: Math.floor(r() ** 2 * 40), blocks: [{ p: pick(r, POST_SENTENCES) }] }
    if (r() < 0.25) post.replies = [{ author: thread.author, ago: thread.ago, text: pick(r, POST_SENTENCES) }]
    posts.push(post)
  }
  return posts
}

/** 通知：手写 5 条在前（前 3 条未读），生成补足到 total，全部已读。 */
export function genNotifications(base, total, threads, userKeys) {
  const r = rng(6060)
  const out = base.map((n) => ({ ...n }))
  const people = userKeys.filter((k) => k !== 'sakura' && k !== 'mochidon')
  let days = 3
  for (let id = out.length + 1; id <= total; id++) {
    days += 0.3 + r() * 2.2
    const type = weighted(r, [['reply', 35], ['like', 35], ['mention', 15], ['system', 15]])
    const t = pick(r, threads)
    const short = t.title.length > 24 ? t.title.slice(0, 24) + '…' : t.title
    let text
    if (type === 'reply') text = `回复了你在「${short}」中的楼层`
    else if (type === 'like') text = r() < 0.5 ? '赞了你的回复' : `等 ${2 + Math.floor(r() * 30)} 人赞了你的帖子「${short}」`
    else if (type === 'mention') text = `在「${short}」中提到了你`
    else text = pick(r, ['同步完成：新增 3 条成长记录', '每周回顾已生成', '你关注的版块有 5 个新帖', '目标已完成，去看看下一步'])
    const n = { id, type, unread: false, who: type === 'system' ? 'sakura' : pick(r, people), ago: agoText(days), text }
    if (type !== 'system') n.thread = t.id
    out.push(n)
  }
  return out
}

/* ================= 配置串 / 物量查谱（P3 / P4） ================= */
const DIV_P = { 4: 0.95, 8: 0.9, 12: 0.55, 16: 0.8, 20: 0.15, 24: 0.35, 32: 0.12, 48: 0.04 }

/** 解析「16 oxxo 180 鬼10」→ { division, pattern, bpm, d, star }；不像配置串时返回 null。 */
export function parseConfig(str) {
  const s = String(str || '').normalize('NFKC').toLowerCase().trim().replace(/[\s,，]+/g, ' ')
  const m = s.match(/^(\d{1,2})\s+([oxdk]{2,16})(?:\s+(\d{2,3}))?(?:\s*(鬼|魔王|おに|oni|里|裏|ura|难|難|hard)\s*(\d{1,2})?)?$/)
  if (!m) return null
  const dmap = { 鬼: 4, 魔王: 4, おに: 4, oni: 4, 里: 5, 裏: 5, ura: 5, 难: 3, 難: 3, hard: 3 }
  return {
    division: Number(m[1]),
    pattern: m[2].replace(/d/g, 'o').replace(/k/g, 'x'),
    bpm: m[3] ? Number(m[3]) : null,
    d: m[4] ? dmap[m[4]] : null,
    star: m[5] ? Number(m[5]) : null,
  }
}

export function makeFinders(songs) {
  // 索引在第一次查询时才建立，不计入模块载入时间。
  let all = null
  let byNotes = null
  const ensure = () => {
    if (all) return
    all = []
    for (const s of songs) {
      const [lo, hi] = parseBpm(s.bpm)
      for (const c of s.charts) all.push({ s, c, lo, hi })
    }
    byNotes = all.slice().sort((a, b) => a.c.notes - b.c.notes || a.s.id - b.s.id || a.c.d - b.c.d)
  }

  function findByConfig({ division, pattern, bpm = null, d = null, star = null } = {}) {
    ensure()
    const div = Number(division)
    const pat = String(pattern || '').toLowerCase().replace(/d/g, 'o').replace(/k/g, 'x').replace(/[^ox]/g, '')
    if (!pat || !DIV_P[div] || pat.length > div) return []
    const ph = strHash(pat)
    const minStar = div >= 24 ? 7 : div >= 16 ? 5 : div >= 12 ? 4 : 1
    const lenF = pat.length <= 4 ? 1 : pat.length <= 8 ? 0.6 : 0.25
    const res = []
    for (const { s, c, lo, hi } of all) {
      if (d != null && c.d !== Number(d)) continue
      if (star != null && c.star !== Number(star)) continue
      if (c.star < minStar) continue
      if (bpm != null && (bpm < lo - 8 || bpm > hi + 8)) continue
      const h = hash(s.id, c.d, div, ph)
      const p = DIV_P[div] * (0.4 + c.star / 16) * lenF
      if ((h % 1000) / 1000 >= p) continue
      const dens = c.density
      const off = 8 + ((h >>> 10) % 48)
      let best = off
      for (let k = off; k < off + 8; k++) if (dens[k] > dens[best]) best = k
      res.push({ songId: s.id, d: c.d, measure: best + 1, count: 1 + ((h >>> 16) % (2 + c.star)) })
    }
    res.sort((a, b) => b.count - a.count || a.songId - b.songId || a.d - b.d)
    return res.slice(0, 20)
  }

  function findByNotes(n, limit = 6) {
    const target = Number(n)
    if (!Number.isFinite(target)) return []
    ensure()
    let lo = 0
    let hi = byNotes.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (byNotes[mid].c.notes < target) lo = mid + 1
      else hi = mid
    }
    let a = lo - 1
    let b = lo
    const out = []
    while (out.length < limit && (a >= 0 || b < byNotes.length)) {
      const da = a >= 0 ? target - byNotes[a].c.notes : Infinity
      const db = b < byNotes.length ? byNotes[b].c.notes - target : Infinity
      const x = db <= da ? byNotes[b++] : byNotes[a--]
      out.push({ songId: x.s.id, d: x.c.d, notes: x.c.notes, star: x.c.star, constant: x.c.constant, diff: x.c.notes - target })
    }
    return out
  }
  return { findByConfig, findByNotes }
}
