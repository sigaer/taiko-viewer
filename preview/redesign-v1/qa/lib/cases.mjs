// Visual + per-page checks for one matrix case (one context, one page; closed in finally).
import path from 'node:path'
import { newContext, collectErrors, gotoRoute } from './browser.mjs'
import { installQA } from './inpage.mjs'
import { isPhone, VIEWPORTS } from '../matrix.mjs'
import { SHOTS_DIR, withTimeout, debug } from './util.mjs'

const FULLPAGE_CAP = 6000

export async function runCase(browser, base, c, { visual = true, checks = true, findings }) {
  const t0 = Date.now()
  const add = (check, severity, selector, detail, extra) => findings.push({ check, severity, route: c.route, case: c.id, selector: selector || null, detail, ...(extra || {}) })
  const result = { id: c.id, route: c.route, vp: c.vp, status: 'ok', shots: [], ms: 0 }
  const ctx = await newContext(browser, { vp: c.vp, state: c })
  try {
    const page = await ctx.newPage()
    const errs = collectErrors(page)
    await gotoRoute(page, base, c.route)
    await page.evaluate(installQA)
    const phone = isPhone(c.vp)

    if (visual) {
      const vpFile = path.join(SHOTS_DIR, `${c.id}.jpg`)
      await page.screenshot({ path: vpFile, type: 'jpeg', quality: 80, scale: 'css' })
      result.shots.push(path.relative(SHOTS_DIR, vpFile))
      if (c.core) {
        const h = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight))
        const fpFile = path.join(SHOTS_DIR, `${c.id}__full.jpg`)
        const w = VIEWPORTS[c.vp].width
        await page.screenshot({ path: fpFile, type: 'jpeg', quality: 72, scale: 'css', fullPage: true, clip: { x: 0, y: 0, width: w, height: Math.min(h, FULLPAGE_CAP) } })
        result.shots.push(path.relative(SHOTS_DIR, fpFile))
        result.pageHeight = h
      }
    }

    if (checks) {
      const ov = await page.evaluate(() => window.__QA.overflow())
      if (ov.overflow) {
        add('overflow', 'error', 'html', `document scrollWidth ${ov.scrollWidth} > clientWidth ${ov.clientWidth}`)
        for (const o of ov.offenders) add('overflow', 'warn', o.selector, `right edge ${o.right}px (w ${o.width}) "${o.text}"`)
      }

      const occ = await page.evaluate(() => window.__QA.occlusion(60))
      for (const o of occ.occluded)
        add('occlusion', o.coverProto ? 'info' : o.coverFixed ? 'error' : 'warn', o.selector, `"${o.text}" covered by ${o.cover}${o.coverFixed ? ' (fixed/sticky)' : ''}${o.coverProto ? ' (prototype control)' : ''}`)
      result.occlusionChecked = occ.checked

      const tr = await page.evaluate(() => window.__QA.truncation())
      for (const t of tr.undeclared) add('truncation', t.clipped ? 'warn' : 'info', t.selector, `${t.clipped ? 'clipped' : 'spills'} without ellipsis (${t.sw}>${t.cw}) "${t.text}"`)
      if (tr.ellipsisNoTitleCount) add('truncation-title', 'info', tr.ellipsisNoTitle[0]?.selector, `${tr.ellipsisNoTitleCount} truncated element(s) without title, e.g. ${tr.ellipsisNoTitle.slice(0, 3).map((x) => `"${x.text}"`).join(', ')}`)

      // C14: intersecting text boxes and one-character-per-line wrapping (whole page, scrollY 0)
      const tc = await page.evaluate(() => window.__QA.textCollide())
      for (const x of tc.collisions) add('text-collision', 'error', x.a, `"${x.ta}" overlaps "${x.tb}" (${x.b}) by ${x.ix}×${x.iy}px at y≈${x.y}`)
      for (const x of tc.wraps) add('char-wrap', 'error', x.selector, `"${x.text}" wraps one character per line (${x.width}px wide, ${x.lines} lines)`)

      if (phone) {
        const tt = await page.evaluate(() => window.__QA.tapTargets())
        if (tt.count) {
          add('tap-target', 'warn', null, `${tt.count} of ${tt.checked} interactive elements below 44×44`, { count: tt.count })
          for (const w of tt.worst.slice(0, 6)) add('tap-target', 'info', w.selector, `${w.w}×${w.h}${w.inline ? ' (inline link, needs ≥24 high)' : ''} "${w.text}"`)
        }
      }

      const ct = await page.evaluate(() => window.__QA.contrast(400))
      // B/C direction concept mocks on /review/directions use their own palettes (exempt from D1/D11) → info
      for (const f of ct.fails) add('contrast', f.concept ? 'info' : f.ratio < f.need - 1 ? 'error' : 'warn', f.selector, `${f.concept ? '[concept mock] ' : ''}${f.ratio}:1 < ${f.need} fg ${f.fg} on ${f.bg} (${f.size}px) "${f.text}"${f.count > 1 ? ` ×${f.count}` : ''}`, { fg: f.fg, bg: f.bg, ratio: f.ratio })
      if (ct.unknownCount) add('contrast-unknown-bg', 'info', ct.unknown[0]?.selector, `${ct.unknownCount} text element(s) over gradient/image backgrounds not evaluated`)
      result.contrastChecked = ct.checked

      const lang = c.locale === 'ja' ? 'ja' : 'zh'
      for (const i of await page.evaluate((l) => window.__QA.a11y(l), lang)) add(i.check, i.check === 'a11y-dup-id' || i.check === 'a11y-label' ? 'warn' : 'error', i.selector, i.detail)

      // Focus visibility only at the two main viewports (keyboard users).
      if (c.vp === '1440x900' || c.vp === '390x844') {
        const fr = await focusWalk(page, 20)
        // C11: pages without navigation (login, bind, review) have nothing to skip
        if (!fr.sawSkipLink && fr.hasNav) add('focus', 'info', null, 'first Tab stops did not reach a skip link (跳到主要内容)')
        for (const f of fr.invisible) add('focus', 'warn', f.selector, `focus not visible${f.inView ? '' : ' (out of viewport)'} "${f.text}"`)
        result.focusStops = fr.stops
      }

      // errors last so late async errors are included
      await page.waitForTimeout(150)
      for (const e of errs) {
        if (e.kind === 'favicon') add('network', 'info', null, 'favicon.ico 404 (no <link rel=icon>)')
        else if (e.kind === 'http' && /favicon\.ico/.test(e.text)) continue
        else add(e.kind === 'console' || e.kind === 'pageerror' ? 'console' : 'network', 'error', null, `${e.kind}: ${e.text}`)
      }
    }
    await page.close()
  } catch (e) {
    result.status = 'crashed'
    result.error = String(e.message || e).slice(0, 400)
    add('harness', 'error', null, 'case crashed: ' + result.error)
    debug(c.id, e.stack)
  } finally {
    await withTimeout(ctx.close(), 10_000, 'ctx.close').catch(() => {})
    result.ms = Date.now() - t0
  }
  return result
}

export async function focusWalk(page, n = 20) {
  await page.evaluate(() => {
    window.scrollTo(0, 0)
    document.activeElement?.blur?.()
    // computed styles mid-transition would make focused and blurred snapshots look identical
    const st = document.createElement('style')
    st.id = '__qa_no_transition'
    st.textContent = '*,*::before,*::after{transition:none!important}'
    document.head.appendChild(st)
    // "from the top": Chrome keeps the sequential-navigation starting point where earlier checks
    // left it, so anchor it at the start of <body> with a temporary focus target
    const a = document.createElement('span')
    a.id = '__qa_start'
    a.tabIndex = -1
    document.body.prepend(a)
    a.focus({ preventScroll: true })
  })
  const invisible = []
  let stops = 0
  let sawSkipLink = false
  const seen = new Set()
  for (let i = 0; i < n; i++) {
    await page.keyboard.press('Tab')
    if (i === 0) await page.evaluate(() => document.getElementById('__qa_start')?.remove())
    await page.waitForTimeout(40)
    const r = await page.evaluate(() => window.__QA.focusCheck())
    if (r.none || r.iframe) continue
    stops++
    if (i < 3 && r.skip) sawSkipLink = true
    if (seen.has(r.selector + r.text)) continue
    seen.add(r.selector + r.text)
    if (r.proto) continue // prototype-only control, not product UI
    if (!r.changed || !r.inView) invisible.push(r)
  }
  await page.evaluate(() => document.getElementById('__qa_no_transition')?.remove())
  const hasNav = await page.evaluate(() => !!document.querySelector('nav'))
  return { invisible, stops, sawSkipLink, hasNav }
}
