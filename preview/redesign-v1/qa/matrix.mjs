// Q2 test matrix: viewports × representative state crossings (not a full permutation).
import { loadScreens, loadRouterPaths, BOGUS_ROUTE } from './lib/routes.mjs'
import { slugRoute } from './lib/util.mjs'
import { EDGE } from '../src/mock/data.js'

// Edge-state song pages (M2 / D14 / V2): first id of each EDGE list in the full dataset.
export const EDGE_KEYS = ['longJa', 'special', 'noConstant', 'noChartImage', 'oniOnly', 'unlisted']
export const EDGE_PAGES = [...new Set(EDGE_KEYS.map((k) => EDGE[k]?.[0]).filter((x) => x != null).map((id) => `/songs/${id}`))]

export const VIEWPORTS = {
  '1440x900': { width: 1440, height: 900 },
  '1280x800': { width: 1280, height: 800 },
  '820x1180': { width: 820, height: 1180, hasTouch: true },
  '390x844': { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  '360x740': { width: 360, height: 740, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
}
export const isPhone = (vp) => VIEWPORTS[vp].width <= 767

export const CORE = [
  '/', '/songs', '/songs/615', '/songs/constants', '/play', '/play/scores', '/play/progress',
  '/growth', '/growth/weekly', '/growth/goals', '/community', '/community/t/4017', '/community/new',
  '/u/mochidon', '/me', '/account', '/account/sync', '/login', '/bind', '/tools',
]
export const AUTH_PAGES = ['/', '/songs/615', '/play', '/growth', '/me', '/community/new', '/account']
export const DATA_PAGES = ['/songs', '/songs/615', '/songs/constants', '/play', '/play/scores', '/play/progress', '/growth', '/growth/weekly', '/community', '/community/t/4017', '/titles']
export const AUTHS = ['guest', 'unbound', 'empty', 'ready']
export const EXTRA_PAGES = ['/review', '/review/directions', '/review/system', '/states', BOGUS_ROUTE]

// Auth a page is shown in by default (screens.js `auth`, else ready).
function defaultAuth(screens, p) {
  const s = screens.find((x) => x.path === p && x.auth)
  if (p === '/') return 'ready'
  return s?.auth || 'ready'
}

export function caseId(c) {
  return [slugRoute(c.route), c.vp, c.theme, c.locale, c.auth, c.dataset, ...(c.variant && c.variant !== 'c' ? [c.variant] : [])].join('__')
}

// V1.3 targeted set (--v13). Phase B Stage 1: the four representative pages on C+ (the default variant) ×
// 5 viewports × light / dark, on the default data AND data=real, plus ja once (four pages × 1440 / 390, light, both datasets).
// (Phase A ran the same pages on variants B and C with data=real.)
export const V13_PAGES = ['/', '/songs/615', '/play/scores', '/community']
function v13Matrix() {
  const out = []
  const mk = (route, vp, o) => {
    const c = { route, vp, theme: o.theme || 'light', locale: o.locale || 'zh', auth: 'ready', dataset: o.dataset, variant: 'c', core: false, tags: [o.tag] }
    c.id = caseId(c)
    out.push(c)
  }
  for (const dataset of ['full', 'real'])
    for (const p of V13_PAGES) {
      for (const vp of Object.keys(VIEWPORTS)) for (const theme of ['light', 'dark']) mk(p, vp, { theme, dataset, tag: 'v13' })
      for (const vp of ['1440x900', '390x844']) mk(p, vp, { locale: 'ja', dataset, tag: 'v13-ja' })
    }
  return out
}

// G12 缺失素材用例（--blocked）：今日、曲库、歌曲详情、成绩、社区、个人主页 × 1440 / 390 × 浅 / 深，曲绘域名被屏蔽
export const BLOCKED_PAGES = ['/', '/songs', '/songs/615', '/play/scores', '/community', '/u/mochidon']
function blockedMatrix() {
  const out = []
  for (const p of BLOCKED_PAGES)
    for (const vp of ['1440x900', '390x844'])
      for (const theme of ['light', 'dark']) {
        const c = { route: p, vp, theme, locale: 'zh', auth: 'ready', dataset: 'full', variant: 'c', core: false, tags: ['blocked'] }
        c.id = caseId(c) + '__blocked'
        out.push(c)
      }
  return out
}

export async function buildMatrix({ quick = false, only = null, v13 = false, blocked = false } = {}) {
  if (blocked) return { cases: blockedMatrix(), pages: BLOCKED_PAGES }
  if (v13) {
    let list = v13Matrix()
    if (only) list = list.filter((c) => c.id.includes(only) || c.route.includes(only))
    return { cases: list, pages: V13_PAGES }
  }
  const screens = await loadScreens()
  const routerPaths = loadRouterPaths().map((r) => r.path)
  const pages = [...new Set([...screens.map((s) => s.path), ...EXTRA_PAGES])]
  // routes in the router but missing from screens.js are still covered
  for (const p of routerPaths) if (!pages.includes(p) && !p.startsWith('/review/device')) pages.push(p)

  const cases = new Map()
  const add = (route, vp, o = {}) => {
    const c = {
      route,
      vp,
      theme: o.theme || 'light',
      locale: o.locale || 'zh',
      auth: o.auth || defaultAuth(screens, route),
      dataset: o.dataset || 'full',
      core: CORE.includes(route),
      tags: [],
    }
    c.id = caseId(c)
    const prev = cases.get(c.id)
    if (prev) prev.tags.push(o.tag || 'base')
    else cases.set(c.id, { ...c, tags: [o.tag || 'base'] })
  }

  if (quick) {
    const qp = ['/', '/songs', '/songs/615', '/play/progress', '/community', '/me', '/account', '/states', BOGUS_ROUTE]
    for (const p of qp) add(p, '1440x900', { tag: 'base' })
    for (const p of ['/', '/songs', '/songs/615', '/community/t/4017', '/me', '/account/sync']) add(p, '390x844', { tag: 'base' })
    add('/songs', '820x1180', { tag: 'base' })
    add('/songs/constants', '1280x800', { tag: 'base' })
    add('/', '360x740', { tag: 'base' })
    for (const p of ['/', '/songs/615']) for (const vp of ['1440x900', '390x844']) add(p, vp, { theme: 'dark', tag: 'dark' })
    add('/', '1440x900', { locale: 'ja', tag: 'ja' })
    add('/songs/615', '390x844', { locale: 'ja', tag: 'ja' })
    add('/', '1440x900', { auth: 'guest', tag: 'auth' })
    add('/', '390x844', { auth: 'unbound', tag: 'auth' })
    add('/play', '1440x900', { auth: 'empty', tag: 'auth' })
    add('/songs', '1440x900', { dataset: 'demo', tag: 'demo' })
  } else {
    for (const p of pages) for (const vp of Object.keys(VIEWPORTS)) add(p, vp, { tag: 'base' })
    for (const p of CORE) for (const vp of ['1440x900', '390x844']) add(p, vp, { theme: 'dark', tag: 'dark' })
    for (const p of CORE) for (const vp of ['1440x900', '390x844']) add(p, vp, { locale: 'ja', tag: 'ja' })
    for (const p of AUTH_PAGES) for (const a of AUTHS) for (const vp of ['1440x900', '390x844']) add(p, vp, { auth: a, tag: 'auth' })
    for (const p of DATA_PAGES) for (const vp of ['1440x900', '390x844']) add(p, vp, { dataset: 'demo', tag: 'demo' })
    for (const p of EDGE_PAGES) for (const vp of ['1440x900', '820x1180', '390x844']) add(p, vp, { tag: 'edge' })
  }
  let list = [...cases.values()]
  if (only) list = list.filter((c) => c.id.includes(only) || c.route.includes(only))
  return { cases: list, pages }
}
