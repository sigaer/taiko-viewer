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
  },
}
