import { reactive, watch, computed } from 'vue'

// 原型状态：主题 / 语言 / 登录态。写入 localStorage，iframe 手机预览通过 storage 事件与外层保持一致。
const KEY = 'tv-design-v1'
const saved = (() => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}')
  } catch {
    return {}
  }
})()

export const store = reactive({
  theme: saved.theme || 'system', // system | light | dark
  locale: saved.locale || 'zh', // zh | ja
  auth: saved.auth || 'ready', // guest | unbound | empty | ready
  paletteOpen: false,
  syncing: false,
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
export const resolvedTheme = computed(() => (store.theme === 'system' ? (mqDark.value ? 'dark' : 'light') : store.theme))
const mqDark = reactive({ value: mq.matches })
mq.addEventListener('change', (e) => (mqDark.value = e.matches))

function apply() {
  document.documentElement.dataset.theme = resolvedTheme.value
  document.documentElement.lang = store.locale === 'ja' ? 'ja' : 'zh-CN'
}
watch([() => store.theme, () => store.locale, () => mqDark.value], apply, { immediate: true })
watch(
  () => [store.theme, store.locale, store.auth],
  () => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ theme: store.theme, locale: store.locale, auth: store.auth }))
    } catch {
      /* 隐私模式下忽略 */
    }
  },
)
window.addEventListener('storage', (e) => {
  if (e.key !== KEY || !e.newValue) return
  try {
    const v = JSON.parse(e.newValue)
    store.theme = v.theme
    store.locale = v.locale
    store.auth = v.auth
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

export function runSync() {
  if (store.syncing) return
  store.syncing = true
  setTimeout(() => {
    store.syncing = false
    toast(L('同步完成：4 条新进展，1 个新全良', '同期完了：新しい記録 4 件、全良 1 件'))
  }, 2200)
}

export function songTitle(song) {
  return store.locale === 'ja' ? song.ja : song.zh
}
export function songSub(song) {
  const sub = store.locale === 'ja' ? song.zh : song.ja
  return sub === songTitle(song) ? '' : sub
}

// 副标题是「另一种语言」的曲名：给它标上正确的 lang，让浏览器选对字形（直 / 骨 / 角 等汉字在中日文里写法不同）。
export const subLang = computed(() => (store.locale === 'ja' ? 'zh-CN' : 'ja'))
