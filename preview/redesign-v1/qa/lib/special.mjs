// Once-per-run checks that need their own context setup: theme flash (D10) and reduced motion (D13).
import { newContext, collectErrors, gotoRoute, urlFor } from './browser.mjs'
import { installQA } from './inpage.mjs'
import { withTimeout } from './util.mjs'

function lumOf(rgb) {
  const m = /(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)/.exec(rgb || '')
  if (!m) return null
  return (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255
}

export async function themeFlash(browser, base, findings, verified) {
  const scenarios = [
    { label: 'stored theme=dark, system light', state: { theme: 'dark' }, colorScheme: 'light' },
    { label: 'stored theme=system, system dark', state: { theme: 'system' }, colorScheme: 'dark' },
  ]
  const results = []
  for (const s of scenarios) {
    for (const route of ['/', '/songs/615']) {
      const ctx = await newContext(browser, {
        vp: '1440x900',
        state: s.state,
        colorScheme: s.colorScheme,
        extraInit: {
          fn: () => {
            document.addEventListener(
              'DOMContentLoaded',
              () => {
                const de = document.documentElement
                window.__qaDcl = { theme: de.dataset.theme || null, brand: de.dataset.brand || null, bg: getComputedStyle(de).backgroundColor, bodyBg: document.body ? getComputedStyle(document.body).backgroundColor : null, scheme: getComputedStyle(de).colorScheme }
              },
              { capture: true, once: true },
            )
          },
        },
      })
      try {
        const page = await ctx.newPage()
        await page.goto(urlFor(base, route), { waitUntil: 'load' })
        const r = await page.evaluate(() => window.__qaDcl || null)
        const l = r ? lumOf(r.bg) : null
        const bodyL = r ? lumOf(r.bodyBg) : null
        // transparent html bg (rgba(0,0,0,0)) renders as the canvas colour → white in light scheme
        const transparent = /rgba\(0, 0, 0, 0\)/.test(r?.bg || '')
        // Phase B：默认是 C+（teal）；首屏脚本必须已写入 data-brand=teal，html 底色就是 C+ 深色 --bg #0c2023（不先闪 Phase A 的 #10282b 或藍墨）
        const okBrand = r && r.brand === 'teal' && r.bg === 'rgb(12, 32, 35)'
        const ok = r && r.theme === 'dark' && !transparent && l != null && l < 0.25 && okBrand
        results.push({ scenario: s.label, route, ...r, ok })
        if (!ok)
          findings.push({ check: 'theme-flash', severity: 'error', route, case: `theme-flash:${s.label}`, selector: 'html', detail: `at DOMContentLoaded data-theme=${r?.theme} data-brand=${r?.brand} html bg=${r?.bg} body bg=${r?.bodyBg} color-scheme=${r?.scheme} — not dark yet` })
        await page.close()
      } finally {
        await withTimeout(ctx.close(), 10_000, 'ctx.close').catch(() => {})
      }
    }
  }
  verified.push(`theme flash: data-theme + html background at DOMContentLoaded (${results.length} loads)`)
  return results
}

export async function reducedMotion(browser, base, findings, verified) {
  const out = []
  for (const variant of [
    { label: 'media prefers-reduced-motion', reducedMotion: 'reduce', state: {} },
    { label: 'prototype motion=reduce', reducedMotion: 'no-preference', state: { motion: 'reduce' } },
  ]) {
    for (const route of ['/', '/states', '/songs/615']) {
      const ctx = await newContext(browser, { vp: '1440x900', state: variant.state, reducedMotion: variant.reducedMotion })
      try {
        const page = await ctx.newPage()
        const errs = collectErrors(page)
        await gotoRoute(page, base, route)
        await page.waitForTimeout(800)
        await page.evaluate(installQA)
        const anims = await page.evaluate(() => window.__QA.infiniteAnimations())
        const dm = await page.evaluate(() => document.documentElement.dataset.motion || null)
        out.push({ variant: variant.label, route, infinite: anims.length, dataMotion: dm })
        for (const a of anims.slice(0, 10)) findings.push({ check: 'reduced-motion', severity: 'error', route, case: `reduced-motion:${variant.label}`, selector: a.selector, detail: `infinite animation running: ${a.name}` })
        if (variant.state.motion === 'reduce' && dm !== 'reduce') findings.push({ check: 'reduced-motion', severity: 'warn', route, case: `reduced-motion:${variant.label}`, selector: 'html', detail: `prototype motion=reduce but html[data-motion]=${dm}` })
        for (const e of errs) findings.push({ check: 'console', severity: 'error', route, case: `reduced-motion:${variant.label}`, selector: null, detail: `${e.kind}: ${e.text}` })
        await page.close()
      } finally {
        await withTimeout(ctx.close(), 10_000, 'ctx.close').catch(() => {})
      }
    }
  }
  verified.push(`reduced motion: document.getAnimations() for infinite running animations (${out.length} loads)`)
  return out
}
