/**
 * 全局搜索 / 命令面板的纯逻辑（裁决 P1–P6）。不依赖 Vue、DOM 与 store，可在 Node 里直接测试。
 * 数据模块（src/mock/data.js）是唯一来源：曲目与别名、parseConfig、findByConfig、findByNotes 都由 setData 注入。
 *
 *   setData({ songs, threads, sections, users, normalize?, parseConfig?, findByConfig?, findByNotes? })  建一次索引
 *   normalize(s)                       NFKC、小写、去空格标点、片假名→平假名（与数据模块的 normalize 相同）
 *   normalizeWords(s)                  同上，但拉丁文字保留词边界：标点 / 空白变成一个空格，拉丁与非拉丁之间也算边界
 *   searchSongs(query, limit, { locale })  → { items: [{ song, matched: { kind, text }, d }], total, wantUra }
 *   matchSongIds(query)                → Set<songId> | null（null = 查询里没有可搜的词）。与 searchSongs 同一套命中规则、
 *                                        不排序不截断；曲库页用它过滤，保证「在曲库中查看全部 N 首」的 N 与曲库行数一致（I8）
 *   parseConfig(query)                 → { isConfig, division, pattern, bpm, d, star, unknown }
 *   findConfig(parsed, limit)          → { items: [{ song, chart, measure, times }], total }
 *   parseNotes(query)                  → 2–4 位数字 → number，否则 null
 *   findNotes(n, limit)                → [{ song, chart, delta }]
 *   searchThreads / searchActions / searchPages
 *
 * 匹配规则（P1 细化）：拉丁字母 / 数字组成的查询词只在「词首」命中（LiSA 不会命中 Nivalis*Anima 的中间），
 * 可以跨相邻词连写（nightof → Night of Knights）；含汉字 / 假名的查询词仍按子串命中。
 * 命令面板与工具页（/tools?q= 与 /tools?notes=）都调用这里，保证两处结果一致。
 */

/* ---------------- 规范化 ---------------- */
const KATA = /[ァ-ヶ]/g
const STRIP = /[\s\p{P}\p{S}]/gu
function localNormalize(s) {
  if (s == null) return ''
  return String(s)
    .normalize('NFKC')
    .toLowerCase()
    .replace(KATA, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
    .replace(STRIP, '')
}
let NORM = localNormalize
export const normalize = (s) => NORM(s)

/** 保留词边界的规范化：标点、空白 → 空格；拉丁（a-z0-9）与非拉丁相邻处插入空格。 */
export function normalizeWords(s) {
  if (s == null) return ''
  return String(s)
    .normalize('NFKC')
    .toLowerCase()
    .replace(KATA, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
    .replace(STRIP, ' ')
    .replace(/([a-z0-9])(?=[^a-z0-9\s])|([^a-z0-9\s])(?=[a-z0-9])/g, '$1$2 ')
    .replace(/\s+/g, ' ')
    .trim()
}
const LATIN = /^[a-z0-9]+$/

/** 一个可搜字段：n = 全去标点的串（子串匹配用），starts = 从每个词首开始、去掉空格的后缀（词首匹配用）。 */
function field(raw) {
  const n = normalize(raw)
  const words = normalizeWords(raw).split(' ').filter(Boolean)
  const starts = []
  for (let i = 0; i < words.length; i++) {
    if (LATIN.test(words[i][0])) starts.push(words.slice(i).join(''))
  }
  return { raw, n, starts }
}
function hit(f, t, latin) {
  if (!f.n) return false
  if (!latin) return f.n.includes(t)
  for (const s of f.starts) if (s.startsWith(t)) return true
  return false
}

const URA_WORDS = new Set(['里', '裏', '裡', 'ura', 'うら'])

/* ---------------- 假名读音（数据模块的别名没有假名读音，只补这一项） ---------------- */
// Phase B（docs/19 G9）：只给曲号与曲名有依据的真实曲目补读音
export const KANA_READINGS = {
  615: ['てんぐばやし'],
  179: ['はたらく2000'],
  851: ['きえんばんじょうかぐら'],
  1351: ['じゃてつ'],
  816: ['ほしくずすとらっく'],
  413: ['ばっどあっぷる'],
  1308: ['ぎがろどーん'],
  410: ['てんようのまい'],
  504: ['あびすおぶへる'],
  702: ['かいちゅうていえんをもつしょうじょ'],
}

/* ---------------- 索引 ---------------- */
let DATA = { songs: [], threads: [], sections: [], users: {}, parseConfig: null, findByConfig: null, findByNotes: null }
let SONG_INDEX = []
let THREAD_INDEX = []
let SONG_BY_ID = new Map()

export function buildIndex(songs) {
  SONG_BY_ID = new Map()
  SONG_INDEX = songs.map((song) => {
    SONG_BY_ID.set(song.id, song)
    const seen = new Set()
    const aliases = []
    for (const a of [...(Array.isArray(song.aliases) ? song.aliases : []), ...(KANA_READINGS[song.id] || [])]) {
      const f = field(a)
      if (!f.n || seen.has(f.n)) continue
      seen.add(f.n)
      aliases.push(f)
    }
    const zh = field(song.zh)
    const ja = field(song.ja)
    const artist = field(song.artist)
    return { song, id: String(song.id), zh, ja, artist, aliases, all: [zh, ja, artist, ...aliases], len: Math.min(zh.n.length || 99, ja.n.length || 99) }
  })
  return SONG_INDEX
}

export function setData(data) {
  DATA = { ...DATA, ...data }
  NORM = typeof DATA.normalize === 'function' ? DATA.normalize : localNormalize
  if (data.songs) buildIndex(data.songs)
  if (data.threads || data.sections || data.users) {
    const secBy = Object.fromEntries((DATA.sections || []).map((s) => [s.slug, s]))
    THREAD_INDEX = (DATA.threads || []).map((t, order) => {
      const sec = secBy[t.section] || {}
      const u = (DATA.users || {})[t.author] || {}
      return {
        thread: t,
        order,
        title: normalize(t.title),
        tags: normalize((t.tags || []).join(' ')),
        rest: [normalize(sec.zh), normalize(sec.ja), normalize(u.name), normalize(t.author)].join('\u0001'),
      }
    })
  }
}

export const songOf = (id) => SONG_BY_ID.get(Number(id)) || SONG_BY_ID.get(id)

/** 打开一首歌时的默认难度：查询带「里」且有里谱 → 5；否则魔王；没有魔王取最高难度 */
export function defaultDiff(song, wantUra = false) {
  const ds = (song.charts || []).map((c) => c.d)
  if (wantUra && ds.includes(5)) return 5
  if (ds.includes(4)) return 4
  return ds.length ? Math.max(...ds) : 4
}

function tokenize(query) {
  const raw = String(query ?? '').trim().split(/\s+/).filter(Boolean)
  let wantUra = false
  const tokens = []
  for (const r of raw) {
    const n = normalize(r)
    if (!n) continue
    if (URA_WORDS.has(n)) {
      wantUra = true
      continue
    }
    tokens.push(n)
  }
  return { tokens, wantUra }
}

/* ---------------- 歌曲 ---------------- */
function allTokensHit(e, tokens, tLatin) {
  for (let i = 0; i < tokens.length; i++) if (!e.all.some((f) => hit(f, tokens[i], tLatin[i]))) return false
  return true
}

/** 命中的曲目 ID 集合：与 searchSongs 的命中规则完全相同（曲目 ID 全等，或每个词都命中某个字段）。 */
export function matchSongIds(query) {
  const { tokens } = tokenize(query)
  if (!tokens.length) return null
  const qn = tokens.join('')
  const isNum = /^\d+$/.test(qn)
  const tLatin = tokens.map((t) => LATIN.test(t))
  const out = new Set()
  for (const e of SONG_INDEX) if ((isNum && e.id === qn) || allTokensHit(e, tokens, tLatin)) out.add(e.song.id)
  return out
}

/**
 * 排序：标题完全相同（或曲目 ID 相同）> 标题前缀 > 别名 > 标题包含 > 艺术家 > 其他（多词跨字段）。
 * matched.kind: 'title' | 'otherLang' | 'alias' | 'artist' | 'id'；alias 时 matched.text 为命中的别名原文。
 */
export function searchSongs(query, limit = 8, { locale = 'zh' } = {}) {
  const { tokens, wantUra } = tokenize(query)
  if (!tokens.length) return { items: [], total: 0, wantUra }
  const qn = tokens.join('')
  const isNum = /^\d+$/.test(qn)
  const qLatin = tokens.every((t) => LATIN.test(t))
  const tLatin = tokens.map((t) => LATIN.test(t))
  const titleKind = (key) => ((locale === 'ja') === (key === 'ja') ? 'title' : 'otherLang')
  const order = locale === 'ja' ? ['ja', 'zh'] : ['zh', 'ja']
  const hits = []
  for (const e of SONG_INDEX) {
    let rank = 99
    let matched = null
    if (isNum && e.id === qn) {
      rank = 0
      matched = { kind: 'id', text: e.id }
    } else {
      if (!allTokensHit(e, tokens, tLatin)) continue
      for (const key of order) {
        const f = e[key]
        if (!f.n) continue
        const r = f.n === qn ? 0 : f.n.startsWith(qn) ? 10 : hit(f, qn, qLatin) ? 30 : 99
        if (r < rank) {
          rank = r
          matched = { kind: titleKind(key), text: f.raw }
        }
      }
      if (rank > 20) {
        for (const a of e.aliases) {
          const r = a.n === qn ? 20 : a.n.startsWith(qn) ? 21 : hit(a, qn, qLatin) ? 22 : 99
          if (r < rank) {
            rank = r
            matched = { kind: 'alias', text: a.raw }
          }
        }
      }
      if (rank > 40 && hit(e.artist, qn, qLatin)) {
        rank = 40
        matched = { kind: 'artist', text: e.song.artist }
      }
      if (!matched) {
        // 多词跨字段：用第一个词落在哪个字段来说明
        const t = tokens[0]
        const l = tLatin[0]
        rank = 50
        const tf = order.find((k) => hit(e[k], t, l))
        if (tf) matched = { kind: titleKind(tf), text: e[tf].raw }
        else if (hit(e.artist, t, l)) matched = { kind: 'artist', text: e.song.artist }
        else {
          const a = e.aliases.find((x) => hit(x, t, l))
          matched = a ? { kind: 'alias', text: a.raw } : { kind: 'title', text: e.song.zh }
        }
      }
    }
    hits.push({ e, rank, matched })
  }
  hits.sort((a, b) => a.rank - b.rank || a.e.len - b.e.len || a.e.song.id - b.e.song.id)
  return {
    total: hits.length,
    wantUra,
    items: hits.slice(0, limit).map((h) => ({ song: h.e.song, matched: h.matched, d: defaultDiff(h.e.song, wantUra) })),
  }
}

/* ---------------- 按配置查谱（P3） ---------------- */
/*
 * 只有一个解析器：先交给数据模块的 parseConfig（固定顺序「分音 配置 [BPM] [难度星级]」）。
 * 它拒绝的写法再用下面的宽松规则补一次，差别只有两点：
 *   1. 词序任意（如「oxxo 16 鬼10」「鬼10 16 oxxo」）；
 *   2. 认不出的词记进 unknown（工具页据此提示），不让整串失效。
 * 宽松规则仍要求「分音 + 至少 2 个音符」才算配置串，因为 findByConfig 需要分音。
 */
export const DIVISIONS = [4, 6, 8, 12, 16, 24, 32, 48]
const DIFF_WORDS = { 鬼: 4, 魔王: 4, oni: 4, おに: 4, 里: 5, 裏: 5, ura: 5, 难: 3, 難: 3, hard: 3 }
const DIFF_RE = /^(鬼|魔王|oni|おに|里|裏|ura|难|難|hard)[★☆*]?(\d{1,2})?$/i

function lenientConfig(query) {
  const out = { division: null, pattern: '', bpm: null, d: null, star: null, unknown: [] }
  for (const raw of String(query ?? '').normalize('NFKC').trim().split(/[\s,，]+/).filter(Boolean)) {
    const tk = raw.toLowerCase()
    const m = tk.match(DIFF_RE)
    if (/^[oxdk]+$/.test(tk)) out.pattern = (out.pattern + tk.replace(/d/g, 'o').replace(/k/g, 'x')).slice(0, 16)
    else if (m) {
      out.d = DIFF_WORDS[m[1].toLowerCase()]
      out.star = m[2] ? Math.min(10, Math.max(1, Number(m[2]))) : null
    } else if (/^\d+$/.test(tk)) {
      const n = Number(tk)
      if (out.division == null && DIVISIONS.includes(n)) out.division = n
      else if (out.bpm == null && n >= 40 && n <= 400) out.bpm = n
      else out.unknown.push(raw)
    } else out.unknown.push(raw)
  }
  return out
}

export function parseConfig(query) {
  let strict = null
  if (typeof DATA.parseConfig === 'function') {
    try {
      strict = DATA.parseConfig(query)
    } catch {
      strict = null
    }
  }
  if (strict) return { ...strict, unknown: [], isConfig: true }
  const p = lenientConfig(query)
  p.isConfig = !!p.division && p.pattern.length >= 2 && !p.unknown.length
  return p
}

function adapt(list) {
  const items = []
  for (const e of list || []) {
    const song = songOf(e.songId)
    const chart = song?.charts?.find((c) => c.d === e.d)
    if (!song || !chart) continue
    items.push({ song, chart, measure: e.measure, times: e.count, delta: e.diff })
  }
  return items
}

/** 数据模块的 findByConfig 是唯一来源；空结果就是「没有找到」。前 k 条与 limit 无关。 */
export function findConfig(parsed, limit = 5) {
  if (!parsed?.pattern || !parsed.division || typeof DATA.findByConfig !== 'function') return { items: [], total: 0 }
  const all = adapt(DATA.findByConfig({ division: parsed.division, pattern: parsed.pattern, bpm: parsed.bpm, d: parsed.d, star: parsed.star }))
  return { total: all.length, items: all.slice(0, limit).map(({ delta, ...rest }) => rest) }
}

/* ---------------- 按物量查谱（P4） ---------------- */
export function parseNotes(query) {
  const s = String(query ?? '').normalize('NFKC').trim()
  return /^\d{2,4}$/.test(s) ? Number(s) : null
}

/** 数据模块的 findByNotes 是唯一来源（最近邻，前 k 条与 limit 无关）。 */
export function findNotes(n, limit = 5) {
  const v = Number(n)
  if (!Number.isFinite(v) || v <= 0 || typeof DATA.findByNotes !== 'function') return []
  return adapt(DATA.findByNotes(v, limit)).map((x) => ({ song: x.song, chart: x.chart, delta: x.delta ?? x.chart.notes - v }))
}

/* ---------------- 帖子（P5） ---------------- */
export function searchThreads(query, limit = 4) {
  const { tokens } = tokenize(query)
  if (!tokens.length) return { items: [], total: 0 }
  const qn = tokens.join('')
  const hits = []
  for (const e of THREAD_INDEX) {
    const hay = `${e.title}\u0001${e.tags}\u0001${e.rest}`
    if (!tokens.every((t) => hay.includes(t))) continue
    const rank = e.title.includes(qn) ? 0 : e.tags.includes(qn) ? 1 : 2
    hits.push({ e, rank })
  }
  hits.sort((a, b) => a.rank - b.rank || a.e.order - b.e.order)
  return { total: hits.length, items: hits.slice(0, limit).map((h) => h.e.thread) }
}

/* ---------------- 操作（P6） ---------------- */
const ACTIONS = [
  { key: 'sync', icon: 'sync', zh: '同步成绩', ja: '成績を同期', kw: ['同步', 'sync', '同期', '更新成绩', 'tongbu'], run: 'sync', when: 'canSync' },
  { key: 'post', icon: 'edit', zh: '发布新帖', ja: '新規投稿', kw: ['发帖', '帖子', '新帖', 'post', '投稿'], to: '/community/new' },
  { key: 'rt', icon: 'target', zh: '单曲 RT 计算器', ja: '単曲 RT 計算', kw: ['rt', 'rating', '计算', '計算', '单曲'], to: '/tools/rt' },
  { key: 'goal', icon: 'flag', zh: '选一个目标', ja: '練習目標を決める', kw: ['目标', '目標', 'goal', '练习', '練習'], to: '/growth/goals', when: 'ready' },
  { key: 'theme', icon: 'moon', zh: '切换深浅色', ja: 'テーマ切替', kw: ['主题', '深色', '浅色', '暗色', 'dark', 'light', 'theme', 'テーマ', 'ダーク', 'ライト'], run: 'theme' },
  { key: 'lang', icon: 'globe', zh: '切换到日本語', ja: '简体中文に切り替え', kw: ['语言', '日本語', '日语', '中文', 'language', '言語', 'japanese', 'chinese'], run: 'lang' },
]
const ACTION_N = ACTIONS.map((a) => ({ a, hay: [a.zh, a.ja, ...a.kw].map(normalize).join('\u0001') }))

/**
 * ctx: { canSync, ready, song?, d?, locale }
 * 空查询 → 全部可用操作；查询命中歌曲（ctx.song）时 RT 计算器变成「用 RT 计算器算〈曲名〉」并带上歌曲。
 */
export function searchActions(query, ctx = {}) {
  const { tokens } = tokenize(query)
  const out = []
  for (const { a, hay } of ACTION_N) {
    if (a.when && !ctx[a.when]) continue
    const textHit = tokens.length ? tokens.every((t) => hay.includes(t)) : true
    const songRt = a.key === 'rt' && ctx.song
    if (!textHit && !songRt) continue
    if (songRt) {
      const d = ctx.d ?? defaultDiff(ctx.song)
      out.push({ ...a, zh: `用 RT 计算器算〈${ctx.song.zh}〉`, ja: `RT 計算機で〈${ctx.song.ja}〉を計算`, to: `/tools/rt?song=${ctx.song.id}&d=${d}`, songId: ctx.song.id })
    } else out.push({ ...a })
  }
  return out
}

/* ---------------- 页面（P6） ---------------- */
export const PAGES = [
  { path: '/', zh: '今日', ja: '今日', kw: ['首页', 'home', 'today'] },
  { path: '/songs', zh: '曲库', ja: '楽曲', kw: ['歌曲', '曲目', 'songs', 'library'] },
  { path: '/songs/constants', zh: '定数表', ja: '定数表', kw: ['定数', 'constant'] },
  { path: '/dan', zh: '段位道场', ja: '段位道場', kw: ['段位', 'dan'] },
  { path: '/guide', zh: '谱面攻略', ja: '譜面攻略', kw: ['攻略', 'guide'] },
  { path: '/titles', zh: '称号', ja: '称号', kw: ['title'] },
  { path: '/play', zh: 'Rating', ja: 'Rating', kw: ['成绩', 'b30', 'レート'] },
  { path: '/play/scores', zh: '全部成绩', ja: '全成績', kw: ['成绩', 'scores', '成績'] },
  { path: '/play/progress', zh: '点灯进度', ja: '進捗', kw: ['进度', '点灯', 'progress'] },
  { path: '/play/recommend', zh: '推荐', ja: 'おすすめ', kw: ['recommend'] },
  { path: '/growth', zh: '成长档案', ja: '成長記録', kw: ['成长', 'growth'] },
  { path: '/growth/weekly', zh: '这一周', ja: '今週', kw: ['每周', '周报', 'weekly'] },
  { path: '/growth/goals', zh: '目标', ja: '目標', kw: ['goals'] },
  { path: '/annual', zh: '年度回顾', ja: '年間まとめ', kw: ['年度', 'annual', 'poster'] },
  { path: '/community', zh: '社区广场', ja: 'コミュニティ', kw: ['社区', '广场', 'community', '広場'] },
  { path: '/community/me', zh: '我的社区', ja: 'マイ投稿', kw: ['我的帖子'] },
  { path: '/notifications', zh: '通知', ja: '通知', kw: ['消息', 'notifications'] },
  { path: '/tools', zh: '工具', ja: 'ツール', kw: ['查配置', '查物量', 'tools'] },
  { path: '/tools/rt', zh: '单曲 RT 计算器', ja: '単曲 RT 計算機', kw: ['rt'] },
  { path: '/tools/tja', zh: 'TJA 定数与谱面图', ja: 'TJA 定数・譜面画像', kw: ['tja', '谱面图'] },
  { path: '/me', zh: '我的', ja: 'マイページ', kw: ['me'] },
  { path: '/account', zh: '账号与绑定', ja: 'アカウント連携', kw: ['账号', '绑定', 'account'] },
  { path: '/account/sync', zh: '同步设置', ja: '同期設定', kw: ['同步', 'sync', '同期'] },
  { path: '/account/settings', zh: '设置', ja: '設定', kw: ['settings'] },
  { path: '/account/developer', zh: '开发者', ja: '開発者', kw: ['api', 'developer', 'oauth'] },
  { path: '/account/support', zh: '工单', ja: 'サポート', kw: ['反馈', 'support'] },
]
const PAGE_N = PAGES.map((p) => ({ p, title: normalize(p.zh) + '\u0001' + normalize(p.ja), hay: [p.zh, p.ja, ...p.kw].map(normalize).join('\u0001') }))

export function searchPages(query, limit = 6) {
  const { tokens } = tokenize(query)
  if (!tokens.length) return []
  const qn = tokens.join('')
  return PAGE_N.filter((x) => tokens.every((t) => x.hay.includes(t)))
    .map((x) => ({ x, r: x.title.includes(qn) ? 0 : 1 }))
    .sort((a, b) => a.r - b.r)
    .slice(0, limit)
    .map(({ x }) => ({ path: x.p.path, zh: x.p.zh, ja: x.p.ja }))
}

/** 空状态的示例查询：一首歌、一个别名、一个配置串、一个物量（都必须有真实结果）。 */
export const EXAMPLES = ['天狗囃子', 'tengu', '16 oxxo 180 鬼10', '765']
