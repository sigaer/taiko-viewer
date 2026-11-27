// Minimal flow runner: named steps with assertions, screenshots at the end and on failure,
// every context closed in finally. A step failure never crashes the run.
import path from 'node:path'
import { newContext, collectErrors, gotoRoute, urlFor, settle } from './browser.mjs'
import { FLOW_SHOTS_DIR, ensureDir, withTimeout, log, debug, slugRoute } from './util.mjs'

export class StepError extends Error {}
export function expect(cond, msg) {
  if (!cond) throw new StepError(msg)
}

export async function runFlow(browser, base, flow, { findings, quick = false }) {
  ensureDir(FLOW_SHOTS_DIR)
  const t0 = Date.now()
  const res = { name: flow.name, status: 'pass', steps: [], shots: [], ms: 0 }
  const contexts = []
  const t = {
    base,
    quick,
    metrics: null,
    page: null,
    errors: [],
    async open({ vp = '1440x900', state = {}, route = '/', colorScheme, reducedMotion } = {}) {
      const ctx = await newContext(browser, { vp, state, colorScheme, reducedMotion })
      contexts.push(ctx)
      const page = await ctx.newPage()
      t.errors = collectErrors(page)
      t.page = page
      t.vp = vp
      if (route != null) await gotoRoute(page, base, route)
      return page
    },
    async close() {
      const ctx = contexts.pop()
      if (ctx) await withTimeout(ctx.close(), 10_000, 'ctx.close').catch(() => {})
      t.page = null
    },
    async go(route) {
      await t.page.evaluate((h) => (location.hash = h), '#' + route)
      await settle(t.page, { idle: 1500 })
    },
    async reload() {
      await t.page.reload({ waitUntil: 'load' })
      await settle(t.page)
    },
    hash: () => t.page.evaluate(() => location.hash),
    url: (route) => urlFor(base, route),
    async shot(label) {
      if (!t.page) return
      const f = path.join(FLOW_SHOTS_DIR, `${flow.name}__${slugRoute(label)}.jpg`)
      try {
        await t.page.screenshot({ path: f, type: 'jpeg', quality: 75, scale: 'css' })
        res.shots.push(path.basename(f))
      } catch {}
    },
    async step(name, fn, { critical = false } = {}) {
      const s0 = Date.now()
      try {
        const detail = await withTimeout(Promise.resolve().then(fn), flow.stepTimeoutMs || 20_000, name)
        res.steps.push({ name, ok: true, detail: detail == null ? undefined : String(detail).slice(0, 300), ms: Date.now() - s0 })
        return true
      } catch (e) {
        const msg = String(e?.message || e).split('\n')[0].slice(0, 300)
        res.steps.push({ name, ok: false, detail: msg, ms: Date.now() - s0 })
        res.status = 'fail'
        findings.push({ check: 'flow', severity: 'error', route: t.page ? await t.hash().catch(() => null) : null, case: `flow:${flow.name}`, selector: null, detail: `${name}: ${msg}` })
        debug(`flow ${flow.name} / ${name}`, e?.stack || msg)
        await t.shot(`fail-${res.steps.length}-${name}`)
        if (critical) throw new StepError('critical step failed: ' + name)
        return false
      }
    },
    // record console errors gathered so far as a step
    async noConsoleErrors(label = 'no console errors') {
      const errs = t.errors.filter((e) => e.kind === 'console' || e.kind === 'pageerror')
      return t.step(label, () => expect(errs.length === 0, `${errs.length} error(s): ${errs.slice(0, 2).map((e) => e.text).join(' | ')}`))
    },
  }
  try {
    await withTimeout(flow.run(t), flow.timeoutMs || 120_000, `flow ${flow.name}`)
    await t.shot('end')
  } catch (e) {
    if (!(e instanceof StepError)) {
      res.status = 'fail'
      const msg = String(e?.message || e).split('\n')[0].slice(0, 300)
      res.steps.push({ name: '(flow aborted)', ok: false, detail: msg })
      findings.push({ check: 'flow', severity: 'error', route: null, case: `flow:${flow.name}`, selector: null, detail: `aborted: ${msg}` })
      await t.shot('aborted')
    }
  } finally {
    while (contexts.length) await t.close()
    res.ms = Date.now() - t0
    if (t.metrics) res.metrics = t.metrics
  }
  const failed = res.steps.filter((s) => !s.ok).length
  log(`flow ${flow.name}: ${res.status} (${res.steps.length - failed}/${res.steps.length} steps) ${res.ms}ms`)
  return res
}

// ---- locator helpers (role/text-based, tolerant of markup changes) ----
export const RX = {
  sync: /同步|同期|sync/i,
}
export async function firstVisible(locator, timeout = 3000) {
  const n = await locator.count()
  for (let i = 0; i < n; i++) {
    const l = locator.nth(i)
    if (await l.isVisible().catch(() => false)) return l
  }
  try {
    await locator.first().waitFor({ state: 'visible', timeout })
    return locator.first()
  } catch {
    return null
  }
}
export const activeInfo = (page) =>
  page.evaluate(() => {
    const a = document.activeElement
    return a ? { tag: a.tagName, role: a.getAttribute('role'), label: a.getAttribute('aria-label'), text: (a.innerText || a.value || '').slice(0, 40), cls: a.className?.toString?.() || '' } : null
  })
