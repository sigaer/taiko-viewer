// Q5 / M6 performance budgets, production build, full dataset, 1440×900.
import { newContext, collectErrors, gotoRoute, settle } from './browser.mjs'
import { CORE } from '../matrix.mjs'
import { median, pct, round, withTimeout, log } from './util.mjs'
import { paletteParts } from '../flows/palette.mjs'

export const BUDGETS = {
  dataGenMs: { max: 150, label: 'data generation (ms)' },
  paletteFirstP95: { max: 100, label: 'palette first keystroke after open, p95 (ms)' },
  paletteWarmP95: { max: 50, label: 'palette warm keystroke, p95 (ms)' },
  songsFilterP95: { max: 100, label: '/songs filter p95 (ms)' },
  songsSortP95: { max: 100, label: '/songs sort p95 (ms)' },
  routeSwitchP95: { max: 200, label: 'route switch → content p95, warm (ms)' },
  songsRows: { max: 60, label: '/songs mounted rows' },
  scoresRows: { max: 60, label: '/play/scores mounted rows' },
  progressCells: { max: 400, label: '/play/progress mounted lamp cells' },
  longTasksOver200: { max: 0, label: 'long tasks > 200ms during rapid nav' },
}

// in-page: run an action, resolve with ms until first DOM mutation in `root` + next frame
const MEASURE = `
window.__qaMeasure = (root, act, timeout = 1500) => new Promise((resolve) => {
  const t0 = performance.now(); let done = false
  const fin = (mut) => { if (done) return; done = true; mo.disconnect(); requestAnimationFrame(() => resolve({ ms: performance.now() - t0, mut })) }
  const mo = new MutationObserver(() => fin(true))
  mo.observe(root, { subtree: true, childList: true, characterData: true, attributes: true })
  act()
  setTimeout(() => fin(false), timeout)
})
window.__qaSettle = (root, quiet = 120, timeout = 4000) => new Promise((resolve) => {
  const t0 = performance.now(); let last = t0; let n = 0
  const mo = new MutationObserver(() => { last = performance.now(); n++ })
  mo.observe(root, { subtree: true, childList: true, characterData: true, attributes: true })
  const tick = () => {
    const now = performance.now()
    if ((n > 0 && now - last > quiet) || now - t0 > timeout) { mo.disconnect(); requestAnimationFrame(() => resolve({ ms: last - t0, mutations: n })) }
    else setTimeout(tick, 20)
  }
  setTimeout(tick, 20)
})`

export async function runPerf(browser, base, { findings, rapidNavMetrics, verified, dataset = 'full' }) {
  const m = {}
  const notes = []
  const ctx = await newContext(browser, { vp: '1440x900', state: { dataset, auth: 'ready' } })
  try {
    const page = await ctx.newPage()
    const errs = collectErrors(page)
    await gotoRoute(page, base, '/')
    await page.addScriptTag({ content: MEASURE })

    // 1. data generation
    const nav = await page.evaluate(() => {
      const n = performance.getEntriesByType('navigation')[0]
      const fcp = performance.getEntriesByName('first-contentful-paint')[0]
      const tv = window.__TV__ || null
      return { dcl: n?.domContentLoadedEventEnd, load: n?.loadEventEnd, fcp: fcp?.startTime, tv: tv ? { datasetInfo: tv.datasetInfo || null, keys: Object.keys(tv) } : null }
    })
    m.fcpMs = round(nav.fcp)
    m.dclMs = round(nav.dcl)
    if (nav.tv?.datasetInfo?.generatedMs != null) {
      m.dataGenMs = round(nav.tv.datasetInfo.generatedMs)
      m.datasetInfo = nav.tv.datasetInfo
    } else notes.push('window.__TV__.datasetInfo.generatedMs not exposed — dataGenMs unmeasured (FCP reported instead)')

    // 2. palette keystrokes (F3): first keystroke after each open vs. warm keystrokes after it.
    //    20 opens; each open types one query character by character, then closes with Esc.
    try {
      const QUERIES = ['lisa', 'qby', 'oni', 'sakura', 'senbon', 'night', 'tengu', '765', 'drive', 'kaka', 'mirage', 'ura', 'rapid', 'neon', 'gold', 'hime', 'star', 'don', 'ka', 'blue']
      const first = []
      const warm = []
      let missed = 0
      for (const q of QUERIES) {
        await page.keyboard.press('Control+k')
        const { dialog } = await paletteParts(page)
        await dialog.waitFor({ state: 'visible', timeout: 3000 })
        await page.waitForTimeout(120)
        const times = await page.evaluate(async (q) => {
          const inp = [...document.querySelectorAll('[role=dialog] input')].pop()
          const d = inp.closest('[role=dialog]')
          const out = []
          let v = ''
          for (const ch of q.split('')) {
            v += ch
            const r = await window.__qaMeasure(d, () => {
              inp.value = v
              inp.dispatchEvent(new Event('input', { bubbles: true }))
            }, 800)
            out.push(r.mut ? r.ms : null)
            await new Promise((res) => setTimeout(res, 30))
          }
          return out
        }, q)
        times.forEach((t, k) => {
          if (t == null) missed++
          else (k === 0 ? first : warm).push(t)
        })
        await page.keyboard.press('Escape')
        await page.waitForTimeout(150)
      }
      m.paletteFirstP95 = round(pct(first, 95))
      m.paletteFirstMedian = round(median(first))
      m.paletteFirstN = first.length
      m.paletteWarmP95 = round(pct(warm, 95))
      m.paletteWarmMedian = round(median(warm))
      m.paletteWarmN = warm.length
      m.paletteFirstMax = round(Math.max(...first))
      if (missed) notes.push(`palette: ${missed} keystroke(s) produced no DOM change within 800ms (excluded)`)
    } catch (e) {
      notes.push('palette latency not measured: ' + String(e.message).slice(0, 120))
    }

    // 3. /songs filter + sort, mounted rows
    await page.evaluate(() => (location.hash = '#/songs'))
    await settle(page, { idle: 1500 })
    const filt = await page.evaluate(async () => {
      const main = document.querySelector('main')
      const chips = [...main.querySelectorAll('button[aria-pressed]')].filter((b) => /★/.test(b.textContent) && b.getBoundingClientRect().width > 0)
      const out = []
      if (!chips.length) return { none: true }
      for (let i = 0; i < 6; i++) {
        const c = chips[i % Math.min(3, chips.length)]
        const r = await window.__qaMeasure(main, () => c.click(), 1500)
        out.push(r.ms)
        await new Promise((res) => setTimeout(res, 60))
      }
      return { out }
    })
    if (filt.none) notes.push('/songs: no ★ filter chip found for filter latency')
    else {
      m.songsFilterMedian = round(median(filt.out))
      m.songsFilterP95 = round(pct(filt.out, 95))
    }
    // clear filters by reloading the route clean
    await page.evaluate(() => (location.hash = '#/songs'))
    await settle(page, { idle: 1000 })
    const sort = await page.evaluate(async () => {
      const main = document.querySelector('main')
      let ctl = [...main.querySelectorAll('th button, [role=columnheader] button, button[aria-sort], button[data-sort]')].filter((b) => b.getBoundingClientRect().width > 0)
      const out = []
      if (ctl.length) {
        for (let i = 0; i < 4; i++) {
          const r = await window.__qaMeasure(main, () => ctl[i % Math.min(2, ctl.length)].click(), 1500)
          out.push(r.ms)
          await new Promise((res) => setTimeout(res, 60))
        }
        return { out, via: 'header' }
      }
      const s = [...main.querySelectorAll('select')].find((x) => /排序|並び|sort/i.test(x.getAttribute('aria-label') || x.closest('label')?.textContent || '') || x.options.length > 2)
      if (!s) return { none: true }
      for (let i = 0; i < 4; i++) {
        const r = await window.__qaMeasure(main, () => {
          s.selectedIndex = (s.selectedIndex + 1) % s.options.length
          s.dispatchEvent(new Event('change', { bubbles: true }))
        }, 1500)
        out.push(r.ms)
      }
      return { out, via: 'select' }
    })
    if (sort.none) notes.push('/songs: no sort control found (th button / [aria-sort] / select)')
    else {
      m.songsSortMedian = round(median(sort.out))
      m.songsSortP95 = round(pct(sort.out, 95))
    }
    const countRows = () =>
      page.evaluate(() => {
        const main = document.querySelector('main')
        const tr = main.querySelectorAll('tbody tr').length
        const roles = main.querySelectorAll('[role=row]').length
        const links = main.querySelectorAll('a[href*="#/songs/"]').length
        return { tr, roles, links, rows: Math.max(tr, roles) || links }
      })
    await page.evaluate(() => (location.hash = '#/songs'))
    await settle(page, { idle: 1000 })
    const sr = await countRows()
    m.songsRows = sr.rows
    m.songsRowsDetail = sr
    await page.evaluate(() => (location.hash = '#/play/scores'))
    await settle(page, { idle: 1000 })
    const sc = await countRows()
    m.scoresRows = sc.rows
    m.scoresRowsDetail = sc
    await page.evaluate(() => (location.hash = '#/play/progress'))
    await settle(page, { idle: 1000 })
    m.progressCells = await page.evaluate(() => {
      const main = document.querySelector('main')
      const a = main.querySelectorAll('.cells .lamp, .cells .cell, [data-lamp], .lamp-cell').length
      return a || main.querySelectorAll('.cell').length
    })

    // 4. route switch → content visible (cold then warm), DOM size, heap
    const routes = CORE.filter((r) => !['/login', '/bind'].includes(r))
    const cold = []
    const warm = []
    m.domNodes = {}
    for (const pass of ['cold', 'warm']) {
      for (const r of routes) {
        await page.evaluate(() => (location.hash = '#/__qa_blank__'))
        await page.waitForTimeout(120)
        const res = await page.evaluate(async (r) => {
          const p = window.__qaSettle(document.querySelector('#app') || document.body, 120, 4000)
          location.hash = '#' + r
          return p
        }, r)
        ;(pass === 'cold' ? cold : warm).push({ route: r, ms: round(res.ms) })
        if (pass === 'warm') {
          await page.waitForTimeout(150)
          m.domNodes[r] = await page.evaluate(() => document.getElementsByTagName('*').length)
        }
      }
    }
    m.routeSwitchCold = cold
    m.routeSwitchWarm = warm
    m.routeSwitchColdP95 = round(pct(cold.map((x) => x.ms), 95))
    m.routeSwitchP95 = round(pct(warm.map((x) => x.ms), 95))
    m.routeSwitchMedian = round(median(warm.map((x) => x.ms)))
    m.maxDomNodes = Math.max(...Object.values(m.domNodes))
    m.jsHeapMB = await page.evaluate(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null))
    const e = errs.filter((x) => x.kind === 'console' || x.kind === 'pageerror')
    for (const x of e.slice(0, 10)) findings.push({ check: 'console', severity: 'error', route: null, case: 'perf', selector: null, detail: `${x.kind}: ${x.text}` })
    await page.close()
  } finally {
    await withTimeout(ctx.close(), 10_000, 'ctx.close').catch(() => {})
  }
  if (rapidNavMetrics) {
    m.longTasksOver200 = rapidNavMetrics.longTasksOver200
    m.maxLongTaskMs = rapidNavMetrics.maxLongTask
  } else notes.push('rapid-nav flow not run — long tasks unmeasured')

  const table = Object.entries(BUDGETS).map(([k, b]) => {
    const v = m[k]
    const status = v == null ? 'unmeasured' : v <= b.max ? 'pass' : 'fail'
    if (status === 'fail') findings.push({ check: 'perf', severity: 'error', route: null, case: `perf:${dataset}`, selector: null, detail: `[${dataset}] ${b.label}: ${v} > budget ${b.max}` })
    return { metric: k, label: b.label, value: v ?? null, budget: b.max, status }
  })
  if (dataset !== 'full') return { dataset, metrics: m, table, notes }
  verified.push('perf: palette keystroke latency, /songs filter/sort latency, route switch timing, mounted rows/cells, DOM size, heap (1440×900, full dataset)')
  log(`perf[${dataset}]: ${table.map((r) => `${r.metric}=${r.value ?? '—'}(${r.status})`).join(' ')}`)
  return { dataset, metrics: m, table, notes }
}
