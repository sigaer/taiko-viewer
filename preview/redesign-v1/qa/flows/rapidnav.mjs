// Q4 / R6: 60 route changes in ~6 s across the full route list; no console errors, long tasks recorded.
import { expect } from '../lib/flowkit.mjs'
import { loadRouterPaths, BOGUS_ROUTE } from '../lib/routes.mjs'

export const rapidNav = {
  name: 'rapid-nav',
  quick: true,
  timeoutMs: 60_000,
  async run(t) {
    // product routes only: /review* are design-review pages (router: 「不属于产品本身」); they are measured separately
    const routes = [...loadRouterPaths().map((r) => r.path).filter((p) => !p.startsWith('/review')), BOGUS_ROUTE]
    const page = await t.open({ vp: '1440x900', route: '/' })
    await page.evaluate(() => {
      window.__qaLong = []
      try {
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) window.__qaLong.push({ start: Math.round(e.startTime), dur: Math.round(e.duration) })
        }).observe({ type: 'longtask', buffered: false })
      } catch {}
    })
    const errsBefore = t.errors.length
    let run
    await t.step('60 route changes in 6 s', async () => {
      run = await page.evaluate(async (routes) => {
        const t0 = performance.now()
        for (let i = 0; i < 60; i++) {
          location.hash = '#' + routes[(i * 7) % routes.length]
          await new Promise((r) => setTimeout(r, 100))
        }
        return { ms: Math.round(performance.now() - t0) }
      }, routes)
      await page.waitForTimeout(1500)
      return `${run.ms}ms over ${routes.length} distinct routes`
    })
    const long = await page.evaluate(() => window.__qaLong || [])
    t.metrics = { rapidNavMs: run?.ms, longTasks: long, longTasksOver200: long.filter((l) => l.dur > 200).length, maxLongTask: long.reduce((m, l) => Math.max(m, l.dur), 0) }
    await t.step('no console errors during rapid navigation', () => {
      const errs = t.errors.slice(errsBefore).filter((e) => e.kind === 'console' || e.kind === 'pageerror')
      expect(errs.length === 0, `${errs.length} error(s): ${errs.slice(0, 2).map((e) => e.text).join(' | ')}`)
    })
    await t.step('no long task > 200 ms', () => {
      expect(t.metrics.longTasksOver200 === 0, `${t.metrics.longTasksOver200} long task(s) > 200ms, max ${t.metrics.maxLongTask}ms`)
      return `${long.length} long tasks (>50ms), max ${t.metrics.maxLongTask}ms`
    })
    await t.step('app still responsive after the burst', async () => {
      await t.go('/songs')
      expect((await page.locator('main').innerText()).length > 20, '/songs main is empty after burst')
    })
    await t.close()

    // F1: phone list ↔ detail transitions — tab bar toggles must not leave stale padding / dock height
    const ph = await t.open({ vp: '390x844', route: '/songs' })
    const seq = ['/songs', '/songs/615', '/community', '/community/t/4017', '/songs/615', '/u/mochidon', '/community/t/4017', '/tools/rt', '/songs', '/community/t/4017', '/me', '/songs/615']
    const errs0 = t.errors.length
    await t.step('phone: 36 list ↔ detail changes in ~4 s', async () => {
      await ph.evaluate(async (seq) => {
        for (let i = 0; i < 36; i++) {
          location.hash = '#' + seq[i % seq.length]
          await new Promise((r) => setTimeout(r, 110))
        }
      }, seq)
      await ph.waitForTimeout(1200)
    })
    for (const r of ['/songs', '/songs/615', '/community/t/4017', '/u/mochidon']) {
      await t.step(`phone after the burst: ${r} has consistent tab bar / bottom inset`, async () => {
        await t.go(r)
        await ph.waitForTimeout(300)
        const g = await ph.evaluate(() => {
          const de = document.documentElement
          const cs = getComputedStyle(de)
          const shell = document.querySelector('.shell')
          return {
            tabbar: !!document.querySelector('nav.tabbar'),
            attr: de.dataset.tabbar,
            dockVar: cs.getPropertyValue('--dock-h').trim(),
            dockEl: (document.querySelector('.mbar') || document.querySelector('form.composer'))?.getBoundingClientRect().height || 0,
            pad: parseFloat(getComputedStyle(shell).paddingBottom),
          }
        })
        const dock = r === '/songs/615' || r.startsWith('/community/t/')
        expect(g.tabbar === !dock && g.attr === (dock ? 'off' : 'on'), `tab bar ${g.tabbar}, data-tabbar ${g.attr}`)
        expect(dock ? Math.abs(parseFloat(g.dockVar) - g.dockEl) <= 1 : parseFloat(g.dockVar || '0') === 0, `--dock-h ${g.dockVar}, dock ${g.dockEl}`)
        expect(dock ? g.pad <= 1 : g.pad >= 60, `shell padding-bottom ${g.pad}`)
        return JSON.stringify(g)
      })
    }
    await t.step('phone burst: no console errors', () => {
      const errs = t.errors.slice(errs0).filter((e) => e.kind === 'console' || e.kind === 'pageerror')
      expect(errs.length === 0, errs.map((e) => e.text).join(' | '))
    })
  },
}
