// One system Chromium (Chrome, else Edge) via playwright-core; contexts carry prototype state.
import { chromium } from 'playwright-core'
import { VIEWPORTS } from '../matrix.mjs'
import { log, clip } from './util.mjs'

export async function launchBrowser() {
  const errors = []
  for (const channel of ['chrome', 'msedge']) {
    try {
      const browser = await chromium.launch({ channel, headless: true, args: ['--disable-extensions', '--no-first-run', '--disable-background-networking'] })
      log(`browser: ${channel} ${browser.version()} (headless)`)
      return { browser, channel }
    } catch (e) {
      errors.push(`${channel}: ${clip(e.message, 200)}`)
    }
  }
  throw new Error('no system Chromium could be launched: ' + errors.join(' ; '))
}

// Full prototype state object written to localStorage key tv-design-v1 before any page script runs.
export function stateFor(c) {
  return {
    theme: c.theme || 'light',
    locale: c.locale || 'zh',
    auth: c.auth || 'ready',
    dataset: c.dataset || 'full',
    syncOutcome: c.syncOutcome || 'success',
    motion: c.motion || 'system',
    density: c.density || 'comfortable',
  }
}

export async function newContext(browser, { vp = '1440x900', state = {}, colorScheme, reducedMotion = 'no-preference', extraInit } = {}) {
  const v = VIEWPORTS[vp] || VIEWPORTS['1440x900']
  const st = stateFor(state)
  const ctx = await browser.newContext({
    viewport: { width: v.width, height: v.height },
    deviceScaleFactor: v.deviceScaleFactor || 1,
    isMobile: !!v.isMobile,
    hasTouch: !!v.hasTouch,
    colorScheme: colorScheme || (st.theme === 'dark' ? 'dark' : 'light'),
    reducedMotion,
    locale: st.locale === 'ja' ? 'ja-JP' : 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    serviceWorkers: 'block',
  })
  await ctx.addInitScript(
    ({ st }) => {
      try {
        // Only seed once per context so in-app changes (theme toggle etc.) survive reloads.
        if (!sessionStorage.getItem('__qa_seeded')) {
          localStorage.setItem('tv-design-v1', JSON.stringify(st))
          sessionStorage.setItem('__qa_seeded', '1')
        }
      } catch {}
    },
    { st },
  )
  if (extraInit) await ctx.addInitScript(extraInit.fn, extraInit.arg)
  ctx.setDefaultTimeout(8000)
  ctx.setDefaultNavigationTimeout(20000)
  return ctx
}

// Attach console / pageerror / failed-request collectors to a page.
export function collectErrors(page) {
  const errs = []
  const push = (e) => {
    if (errs.length < 50) errs.push(e)
  }
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const u = m.location()?.url || ''
    // the browser's implicit favicon request is not an app error
    if (/favicon\.ico$/.test(u)) return push({ kind: 'favicon', text: clip(`${m.text()} ${u}`, 300) })
    push({ kind: 'console', text: clip(`${m.text()}${u ? ' @ ' + u : ''}`, 300) })
  })
  page.on('pageerror', (e) => push({ kind: 'pageerror', text: clip(e.message, 300) }))
  page.on('requestfailed', (r) => {
    const f = r.failure()?.errorText || ''
    if (/ERR_ABORTED/.test(f)) return // navigation-cancelled chunk/img loads are not failures
    push({ kind: 'requestfailed', text: clip(`${r.method()} ${r.url()} ${f}`, 300) })
  })
  page.on('response', (r) => {
    if (r.status() >= 400) push({ kind: 'http', text: clip(`${r.status()} ${r.url()}`, 300) })
  })
  return errs
}

export function urlFor(base, route) {
  return base.replace(/\/?$/, '/') + '#' + route
}

export async function gotoRoute(page, base, route) {
  await page.goto(urlFor(base, route), { waitUntil: 'load' })
  await settle(page)
}

export async function settle(page, { idle = 3000 } = {}) {
  try {
    await page.waitForLoadState('networkidle', { timeout: idle })
  } catch {}
  try {
    await page.evaluate(() => Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 3000))]))
  } catch {}
  // let route transitions finish
  await page.waitForTimeout(350)
}
