import { reactive, watch, computed, ref } from 'vue'
import { sync, startSync, openSyncPanel, configureSync, reset as resetSync } from './sync'
import { setData as setSearchData } from './search'
import * as mock from './mock/data'

// 原型状态：主题 / 语言 / 登录态 / 数据规模 / 下一次同步结果 / 减少动效 / 对照版本。
// 写入 localStorage（同一个 JSON 对象），iframe 手机预览通过 storage 事件与外层保持一致。
const KEY = 'tv-design-v1'
const PERSISTED = ['theme', 'locale', 'auth', 'dataset', 'syncOutcome', 'motion', 'density', 'variant']
const saved = (() => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') || {}
  } catch {
    return {}
  }
})()

const oneOf = (v, list, def) => (list.includes(v) ? v : def)

// 地址参数（# 之前）：?variant=a|b|c、?theme=light|dark、?data=full|demo|real。
// 只作用于这一次页面载入，不写入本地设置（对照页的 iframe 靠它固定版本，不影响外层与别的标签页）。
// ?data= 也接受 hash 里 ? 之后的写法（V1.2 的旧链接）。
const urlOverride = (() => {
  const out = {}
  try {
    const q = new URLSearchParams(location.search)
    const hq = location.hash.includes('?') ? new URLSearchParams(location.hash.slice(location.hash.indexOf('?') + 1)) : new URLSearchParams()
    const v = q.get('variant')
    if (['a', 'b', 'c'].includes(v)) out.variant = v
    const t = q.get('theme')
    if (t === 'light' || t === 'dark') out.theme = t
    const d = q.get('data') || hq.get('data')
    if (['full', 'demo', 'real'].includes(d)) out.dataset = d
  } catch {
    /* ignore */
  }
  return out
})()
const URL_PARAM = { variant: 'variant', theme: 'theme', dataset: 'data' }

export const store = reactive({
  theme: urlOverride.theme || oneOf(saved.theme, ['system', 'light', 'dark'], 'system'),
  locale: oneOf(saved.locale, ['zh', 'ja'], 'zh'),
  auth: oneOf(saved.auth, ['guest', 'unbound', 'empty', 'ready'], 'ready'),
  dataset: urlOverride.dataset || oneOf(saved.dataset, ['full', 'demo', 'real'], 'full'),
  syncOutcome: oneOf(saved.syncOutcome, ['success', 'partial', 'failed'], 'success'),
  motion: oneOf(saved.motion, ['system', 'reduce'], 'system'),
  density: oneOf(saved.density, ['comfortable', 'compact'], 'comfortable'), // 列表密度（V11），设置页绑定
  // 对照版本（V1.3）：a = 生成式素材 + Fumen 配色（默认，即 V1.2）；b = 真实素材 + Fumen；c = 真实素材 + Viewer Teal
  variant: urlOverride.variant || oneOf(saved.variant, ['a', 'b', 'c'], 'a'),
  paletteOpen: false,
  syncing: false, // 兼容旧页面：等于 sync.state === 'running'
  toasts: [],
})

export const embedded = (() => {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
})()

const mq = window.matchMedia('(prefers-color-scheme: dark)')
const mqDark = reactive({ value: mq.matches })
mq.addEventListener('change', (e) => (mqDark.value = e.matches))
export const resolvedTheme = computed(() => (store.theme === 'system' ? (mqDark.value ? 'dark' : 'light') : store.theme))

const mqMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
const mqReduce = reactive({ value: mqMotion.matches })
mqMotion.addEventListener('change', (e) => (mqReduce.value = e.matches))
/** 减少动效：系统设置或原型开关（根元素 data-motion="reduce"） */
export const reducedMotion = computed(() => mqReduce.value || store.motion === 'reduce')

/** 真实素材（版本 B、C）：组件按这个值切换画法；版本 A 保持 V1.2 的生成式画法。 */
export const authentic = computed(() => store.variant !== 'a')
/** 品牌配色：版本 C 为 teal，其余为 fumen */
export const brand = computed(() => (store.variant === 'c' ? 'teal' : 'fumen'))

function apply() {
  const root = document.documentElement
  root.dataset.theme = resolvedTheme.value
  root.lang = store.locale === 'ja' ? 'ja' : 'zh-CN'
  if (store.motion === 'reduce') root.dataset.motion = 'reduce'
  else delete root.dataset.motion
  root.dataset.density = store.density
  // 只在值变化时写：根元素属性的每次写入都会让整页重新计算样式
  const assets = authentic.value ? 'authentic' : 'generated'
  if (root.dataset.assets !== assets) root.dataset.assets = assets
  if (root.dataset.brand !== brand.value) root.dataset.brand = brand.value
}
watch([() => store.theme, () => store.locale, () => store.motion, () => store.density, () => store.variant, () => mqDark.value], apply, { immediate: true })

/** 这个键当前的值是否只来自地址参数（还没被原型面板改过）。 */
const fromUrl = (k) => k in urlOverride && store[k] === urlOverride[k]

function persist() {
  try {
    const prev = JSON.parse(localStorage.getItem(KEY) || '{}') || {}
    const next = { ...prev }
    for (const k of PERSISTED) if (!fromUrl(k)) next[k] = store[k]
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* 隐私模式下忽略 */
  }
}
watch(() => PERSISTED.map((k) => store[k]), persist)

// 在原型面板里改了被地址参数固定的值：去掉那个参数，之后刷新以本地设置为准
watch(
  () => [store.variant, store.theme],
  () => {
    for (const k of ['variant', 'theme']) {
      if (!(k in urlOverride) || store[k] === urlOverride[k]) continue
      delete urlOverride[k]
      try {
        const url = new URL(location.href)
        url.searchParams.delete(URL_PARAM[k])
        if (url.href !== location.href) history.replaceState(history.state, '', url.href)
      } catch {
        /* ignore */
      }
    }
  },
)

// 切换数据规模：写入后刷新（数据在模块加载时生成）。地址里的 ?data= 一并去掉，避免刷新后又被改回。
watch(
  () => store.dataset,
  () => {
    persist()
    try {
      const url = new URL(location.href)
      url.searchParams.delete('data')
      if (url.hash.includes('?')) {
        const [h, qs] = url.hash.split('?')
        const p = new URLSearchParams(qs)
        p.delete('data')
        url.hash = p.toString() ? `${h}?${p}` : h
      }
      if (url.href !== location.href) location.replace(url.href)
      else location.reload()
    } catch {
      location.reload()
    }
  },
)

window.addEventListener('storage', (e) => {
  if (e.key !== KEY || !e.newValue) return
  try {
    const v = JSON.parse(e.newValue) || {}
    for (const k of PERSISTED) if (!fromUrl(k) && v[k] != null && v[k] !== store[k]) store[k] = v[k]
  } catch {
    /* ignore */
  }
})

// 行内双语：L('曲库', '楽曲')。原型阶段不引入完整 i18n 包；正式实施时对应 locales/*.json 的 key。
export function L(zh, ja) {
  return store.locale === 'ja' && ja != null ? ja : zh
}
export const isJa = computed(() => store.locale === 'ja')
export const isAuthed = computed(() => store.auth !== 'guest')
export const isReady = computed(() => store.auth === 'ready')

let tid = 0
export function toast(text, kind = 'ok') {
  const id = ++tid
  store.toasts.push({ id, text, kind })
  setTimeout(() => {
    const i = store.toasts.findIndex((t) => t.id === id)
    if (i >= 0) store.toasts.splice(i, 1)
  }, 3200)
}

/* ---------------- 同步（状态机在 src/sync.js） ---------------- */
// mock 的读取都包在 try 里：数据模块在重构中，循环引用时绑定可能尚未初始化
try {
  if (mock.player?.lastSync) sync.lastSyncLabel = { zh: mock.player.lastSync, ja: mock.player.lastSyncJa || mock.player.lastSync }
} catch {
  /* 用 sync.js 的默认文案 */
}
configureSync({
  getOutcome: () => store.syncOutcome,
  onDone(outcome) {
    // 第一次同步：成功或部分成功（成绩已写入 Viewer）→ 有了成绩；失败保持「无成绩」
    if (outcome !== 'failed' && store.auth === 'empty') store.auth = 'ready'
    // S5：成功且面板没有打开时才出 Toast
    if (outcome === 'success' && !sync.panelOpen) toast(L('同步完成：4 条新进展，1 个新全良', '同期完了：新しい記録 4 件、全良 1 件'))
  },
})
watch(
  () => sync.state === 'running',
  (v) => (store.syncing = v),
  { immediate: true },
)
// 原型切换到游客 / 未绑定时，进行中的同步与结果作废
watch(
  () => store.auth,
  (a) => {
    if (a === 'guest' || a === 'unbound') resetSync()
  },
)

const phoneMq = window.matchMedia('(max-width: 767px)')
/** 视口：手机 ≤ 767px（应用级单个监听，不需要清理） */
export const viewport = reactive({ phone: phoneMq.matches })
phoneMq.addEventListener('change', (e) => (viewport.phone = e.matches))
/**
 * 旧入口（目标卡「练后同步」、各页面按钮）：调用同一个状态机；手机上同时打开同步面板（裁决 S5）。
 * 部分成功时重试失败的目标；失败时整次重试。
 */
export function runSync() {
  if (store.auth === 'guest' || store.auth === 'unbound') {
    openSyncPanel()
    return
  }
  startSync({ retryTargets: sync.state === 'partial' })
  if (viewport.phone) openSyncPanel()
}

/**
 * 同步入口的状态（S2 / S4）：kind 决定图标与角标，label 是按钮的可访问名称，chip 是桌面状态条文案。
 * kind: need（游客 / 未绑定 / 从未同步）| running | fresh（刚刚成功）| done（成功，已过对勾时间）| partial | failed | idle
 */
export const syncStatus = computed(() => {
  const s = sync.state
  const last = L(sync.lastSyncLabel.zh, sync.lastSyncLabel.ja)
  const records = sync.result?.records ?? 0
  if (s === 'running') {
    const step = sync.phase + 1
    return { kind: 'running', label: L(`同步：正在同步，第 ${step} 步，共 3 步`, `同期：同期中（${step}/3）`), chip: L(`正在同步… ${step}/3`, `同期中… ${step}/3`) }
  }
  if (store.auth === 'guest') return { kind: 'need', label: L('同步：登录后才能同步成绩', '同期：ログインすると成績を同期できます'), chip: '' }
  if (store.auth === 'unbound') return { kind: 'need', label: L('同步：还没有绑定鼓众广场 ID', '同期：鼓衆広場 ID が未連携です'), chip: L('绑定鼓众广场 ID', 'アカウント連携') }
  if (s === 'failed') return { kind: 'failed', label: L('同步：上次同步失败', '同期：前回の同期に失敗しました'), chip: L('同步失败', '同期失敗') }
  if (s === 'partial') return { kind: 'partial', label: L(`同步：部分同步，${failedTargetCount()} 个同步目标没有成功`, `同期：一部の連携先に失敗（${failedTargetCount()} 件）`), chip: L('部分同步', '一部同期') }
  if (s === 'success')
    return {
      kind: sync.fresh ? 'fresh' : 'done',
      label: L(`同步：刚刚同步，${records} 条新进展`, `同期：たった今同期、新しい記録 ${records} 件`),
      chip: L(`刚刚同步 · ${records} 条新进展`, `たった今同期 · ${records} 件`),
    }
  if (store.auth === 'empty') return { kind: 'need', label: L('同步：还没有同步过', '同期：まだ同期していません'), chip: L('同步第一份成绩', '最初の同期') }
  return { kind: 'idle', label: L(`同步：${last}同步`, `同期：${last}に同期`), chip: L(`${last}同步`, `${last}に同期`) }
})
function failedTargetCount() {
  return sync.result?.targets?.filter((t) => t.ok === false).length || 1
}

/* ---------------- 搜索索引（命令面板与工具页共用，只建一次） ---------------- */
let searchReady = false
export function ensureSearch() {
  if (searchReady) return
  searchReady = true
  const pick = (fn) => {
    try {
      return fn()
    } catch {
      return undefined
    }
  }
  const fbc = pick(() => mock.findByConfig)
  const fbn = pick(() => mock.findByNotes)
  setSearchData({
    songs: pick(() => mock.songs) || [],
    threads: pick(() => mock.threads) || [],
    sections: pick(() => mock.sections) || [],
    users: pick(() => mock.users) || {},
    // 数据模块是唯一来源：规范化、配置串解析、按配置 / 物量查谱
    normalize: pick(() => mock.normalize),
    parseConfig: pick(() => mock.parseConfig),
    findByConfig: typeof fbc === 'function' ? fbc : null,
    findByNotes: typeof fbn === 'function' ? fbn : null,
  })
}

/* ---------------- 最近看过（P10） ---------------- */
const RECENT_KEY = 'tv-design-v1-recent'
const RECENT_MAX = 5
const recentSeed = () => {
  try {
    if (Array.isArray(mock.RECENT_DEFAULT)) return mock.RECENT_DEFAULT.slice(0, RECENT_MAX)
  } catch {
    /* ignore */
  }
  return [615, 233, 100140, 512]
}
export const recentIds = ref(
  (() => {
    try {
      const v = JSON.parse(localStorage.getItem(RECENT_KEY))
      if (Array.isArray(v)) return v.slice(0, RECENT_MAX)
    } catch {
      /* ignore */
    }
    return recentSeed()
  })(),
)
function saveRecent() {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recentIds.value))
  } catch {
    /* ignore */
  }
}
/** 歌曲详情打开时调用：记录最近看过的歌（最多 5 首，最新在前）。 */
export function recordRecent(id) {
  const n = Number(id)
  if (!Number.isFinite(n)) return
  const next = [n, ...recentIds.value.filter((x) => x !== n)].slice(0, RECENT_MAX)
  if (next.join() === recentIds.value.join()) return
  recentIds.value = next
  saveRecent()
}
export function clearRecent() {
  recentIds.value = []
  saveRecent()
}
window.addEventListener('storage', (e) => {
  if (e.key !== RECENT_KEY) return
  try {
    const v = JSON.parse(e.newValue)
    recentIds.value = Array.isArray(v) ? v.slice(0, RECENT_MAX) : []
  } catch {
    /* ignore */
  }
})

export function songTitle(song) {
  return store.locale === 'ja' ? song.ja : song.zh
}
export function songSub(song) {
  const sub = store.locale === 'ja' ? song.zh : song.ja
  return sub === songTitle(song) ? '' : sub
}

// 副标题是「另一种语言」的曲名：给它标上正确的 lang，让浏览器选对字形（直 / 骨 / 角 等汉字在中日文里写法不同）。
export const subLang = computed(() => (store.locale === 'ja' ? 'zh-CN' : 'ja'))
