#!/usr/bin/env node
// Design V1.3 Phase A tooling.
//   node qa/v13.mjs baseline <dir> [--no-build]     capture the 4 comparison pages (1440/390 × light/dark, default data, variant A) as PNG
//   node qa/v13.mjs pixdiff <dirA> <dirB>           pixel-compare two captures (same file names) in the browser canvas
// More sub-commands are added below for screenshots, analysis and image metrics.
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build, startPreview, stopServer } from './lib/server.mjs'
import { launchBrowser, newContext, settle, collectErrors } from './lib/browser.mjs'
import { ensureDir, log, withTimeout, OUT_DIR, QA_DIR } from './lib/util.mjs'

export const PAGES = [
  { slug: 'today', route: '/' },
  { slug: 'song', route: '/songs/615' },
  { slug: 'scores', route: '/play/scores' },
  { slug: 'community', route: '/community' },
]

export function pageUrl(base, route, q = {}) {
  const qs = new URLSearchParams(q).toString()
  return base.replace(/\/?$/, '/') + (qs ? '?' + qs : '') + '#' + route
}

// Wait until every first-screen image has loaded or failed (bounded): <img> elements, plus authentic covers
// (.cover.acov.real) that have not yet inserted their <img> (lazy, IntersectionObserver) or are still on a fallback step.
export async function waitFirstScreenImages(page, timeout = 15000) {
  const t0 = Date.now()
  const ok = await page
    .waitForFunction(
      () => {
        const vh = innerHeight
        const vis = (el) => {
          const r = el.getBoundingClientRect()
          return r.bottom > 0 && r.top < vh && r.width > 0 && r.right > 0 && r.left < innerWidth
        }
        const imgs = [...document.images].filter(vis)
        if (!imgs.every((i) => i.complete)) return false
        const pending = [...document.querySelectorAll('.cover.acov.real')].filter(vis).filter((c) => {
          const i = c.querySelector('img')
          return !i || !i.complete || !i.classList.contains('on')
        })
        return pending.length === 0
      },
      null,
      { timeout, polling: 100 },
    )
    .then(() => true)
    .catch(() => false)
  await page.waitForTimeout(250)
  return { ok, ms: Date.now() - t0 }
}

// The six V1.3 components (A and B/C class names): used to tell component-internal pixel changes from layout changes.
export const COMPONENT_SEL = '.cover, .diff, .adiff, .crown-wrap, .rank-wrap, .plate, .gtitle, .pavatar, .aavatar, .diff-tab'

// Bounding boxes of every rendered element in document order, rounded to 0.5px, plus the first-screen component rects.
// Used for the B-vs-C layout identity check and the A-vs-B "only inside components" check.
export async function layoutSnapshot(page) {
  return page.evaluate((sel) => {
    const r2 = (n) => Math.round(n * 2) / 2
    const out = []
    for (const el of document.body.querySelectorAll('*')) {
      const r = el.getBoundingClientRect()
      if (!r.width && !r.height) continue
      out.push([el.tagName, r2(r.x), r2(r.y + scrollY), r2(r.width), r2(r.height)])
    }
    const comps = [...document.querySelectorAll(sel)]
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.bottom > 0 && r.top < innerHeight && r.width > 0)
      .map((r) => [Math.floor(r.x), Math.floor(r.y), Math.ceil(r.right), Math.ceil(r.bottom)])
    return { boxes: out, comps, w: innerWidth, h: innerHeight }
  }, COMPONENT_SEL)
}

// First-screen asset census (DOM): real images vs placeholders vs CSS-drawn marks.
export async function assetCensus(page) {
  return page.evaluate(() => {
    const vh = innerHeight
    const vis = (el) => {
      const r = el.getBoundingClientRect()
      return r.bottom > 0 && r.top < vh && r.width > 0 && r.right > 0 && r.left < innerWidth
    }
    const all = (q) => [...document.querySelectorAll(q)].filter(vis)
    const realCovers = all('.cover.acov.real').filter((c) => c.querySelector('img.on'))
    const coverRects = all('.cover').map((c) => {
      const r = c.getBoundingClientRect()
      return [Math.max(0, r.x), Math.max(0, r.y), Math.min(innerWidth, r.right), Math.min(vh, r.bottom)]
    })
    return {
      covers: {
        real: realCovers.length,
        missing: all('.cover.acov.missing').length,
        sample: all('.cover.acov.sample').length,
        generated: all('.cover:not(.acov)').length,
        pending: all('.cover.acov.real').length - realCovers.length,
      },
      icons: { diff: all('.adiff-ico img, .dt-ico').length, crown: all('.acrown img').length, rank: all('.arank img').length, plate: all('.gplate').length, avatarImg: all('.aavatar.img').length },
      cssMarks: { diff: all('.diff').length, crown: all('.crown').length, rank: all('.rank').length, plate: all('.plate').length, avatar: all('.pavatar').length + all('svg.aavatar').length, crownRing: all('.acrown.played').length },
      coverRects,
    }
  })
}

export const VARIANTS = ['a', 'b', 'c']
// shots: real Chrome, production build, data=real by default. Names: {page}__{vp}__{theme}__{variant}{suffix}.jpg
async function shots(dir, { noBuild, pages = PAGES, vps = ['1440x900', '390x844'], themes = ['light', 'dark'], variants = VARIANTS, data = 'real', suffix = '', layoutDir = null } = {}) {
  ensureDir(dir)
  if (layoutDir) ensureDir(layoutDir)
  const report = []
  await withServer(noBuild, async (base, browser) => {
    for (const vp of vps) {
      const ctx = await newContext(browser, { vp, state: { theme: 'light', dataset: 'full' } })
      try {
        const page = await ctx.newPage()
        const errs = collectErrors(page)
        for (const p of pages)
          for (const theme of themes)
            for (const v of variants) {
              errs.length = 0
              await page.goto(pageUrl(base, p.route, { variant: v, theme, data }), { waitUntil: 'load' })
              await settle(page)
              const w = await waitFirstScreenImages(page)
              const name = `${p.slug}__${vp}__${theme}__${v}${suffix}`
              await page.screenshot({ path: path.join(dir, name + '.jpg'), type: 'jpeg', quality: 78, scale: 'css' })
              const census = await assetCensus(page)
              if (layoutDir) fs.writeFileSync(path.join(layoutDir, name + '.json'), JSON.stringify(await layoutSnapshot(page)))
              const attrs = await page.evaluate(() => ({ assets: document.documentElement.dataset.assets, brand: document.documentElement.dataset.brand, theme: document.documentElement.dataset.theme }))
              report.push({ name, page: p.slug, vp, theme, variant: v, data, imagesSettled: w.ok, waitMs: w.ms, attrs, census, errors: errs.filter((e) => e.kind !== 'favicon').slice() })
              log(`${name}: ${w.ok ? 'settled' : 'TIMEOUT'} ${w.ms}ms covers=${JSON.stringify(census.covers)} errors=${errs.length}`)
            }
      } finally {
        await ctx.close().catch(() => {})
      }
    }
  })
  ensureDir(path.join(OUT_DIR, 'v13'))
  // merge with earlier runs into the same directory (same names are replaced)
  const rf = path.join(OUT_DIR, 'v13', `shots-report-${path.basename(dir)}.json`)
  let prev = []
  try {
    prev = JSON.parse(fs.readFileSync(rf, 'utf8'))
  } catch {}
  const names = new Set(report.map((r) => r.name))
  fs.writeFileSync(rf, JSON.stringify([...prev.filter((r) => !names.has(r.name)), ...report], null, 1))
  return report
}

async function withServer(noBuild, fn) {
  if (!noBuild) {
    const b = await build({ retries: 1 })
    if (!b.ok) throw new Error('build failed')
  }
  const srv = await startPreview(4311)
  const { browser } = await launchBrowser()
  try {
    return await fn(srv.url, browser)
  } finally {
    await withTimeout(browser.close(), 15000, 'browser.close').catch(() => {})
    await stopServer(srv)
  }
}

async function baseline(dir, noBuild) {
  ensureDir(dir)
  await withServer(noBuild, async (base, browser) => {
    for (const p of PAGES)
      for (const vp of ['1440x900', '390x844'])
        for (const theme of ['light', 'dark']) {
          const ctx = await newContext(browser, { vp, state: { theme } })
          try {
            const page = await ctx.newPage()
            await page.goto(pageUrl(base, p.route), { waitUntil: 'load' })
            await settle(page)
            await waitFirstScreenImages(page)
            await page.screenshot({ path: path.join(dir, `${p.slug}__${vp}__${theme}.png`), scale: 'css' })
          } finally {
            await ctx.close().catch(() => {})
          }
        }
    log('baseline captured in ' + dir)
  })
}

async function pixdiff(a, b) {
  const files = fs.readdirSync(a).filter((f) => f.endsWith('.png'))
  const { browser } = await launchBrowser()
  const out = []
  try {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await page.goto('about:blank')
    for (const f of files) {
      if (!fs.existsSync(path.join(b, f))) {
        out.push({ f, missing: true })
        continue
      }
      // pass as data URLs (small PNGs) to an in-page canvas comparison; only the counts come back
      const da = 'data:image/png;base64,' + fs.readFileSync(path.join(a, f)).toString('base64')
      const db = 'data:image/png;base64,' + fs.readFileSync(path.join(b, f)).toString('base64')
      const r = await page.evaluate(
        async ([da, db]) => {
          const load = (s) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = s })
          const [ia, ib] = await Promise.all([load(da), load(db)])
          if (ia.width !== ib.width || ia.height !== ib.height) return { size: [ia.width, ia.height, ib.width, ib.height] }
          const c = document.createElement('canvas')
          c.width = ia.width
          c.height = ia.height
          const x = c.getContext('2d', { willReadFrequently: true })
          x.drawImage(ia, 0, 0)
          const pa = x.getImageData(0, 0, c.width, c.height).data
          x.clearRect(0, 0, c.width, c.height)
          x.drawImage(ib, 0, 0)
          const pb = x.getImageData(0, 0, c.width, c.height).data
          let n = 0
          let minY = Infinity, maxY = -1, minX = Infinity, maxX = -1
          for (let i = 0; i < pa.length; i += 4) {
            if (pa[i] !== pb[i] || pa[i + 1] !== pb[i + 1] || pa[i + 2] !== pb[i + 2]) {
              n++
              const p = i / 4, y = Math.floor(p / c.width), xx = p % c.width
              if (y < minY) minY = y
              if (y > maxY) maxY = y
              if (xx < minX) minX = xx
              if (xx > maxX) maxX = xx
            }
          }
          return { diff: n, total: c.width * c.height, box: n ? [minX, minY, maxX, maxY] : null }
        },
        [da, db],
      )
      out.push({ f, ...r })
    }
    await ctx.close()
  } finally {
    await browser.close().catch(() => {})
  }
  for (const r of out) log(`${r.f}: ${r.missing ? 'MISSING' : r.size ? 'SIZE ' + r.size.join(',') : r.diff + ' differing px' + (r.box ? ' in ' + r.box.join(',') : '')}`)
  return out
}

const [cmd, ...rest] = process.argv.slice(2)
const noBuild = rest.includes('--no-build')
const args = rest.filter((x) => !x.startsWith('--'))
const isMain = import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  try {
    if (cmd === 'baseline') await baseline(args[0] || path.join(OUT_DIR, 'v13-baseline'), noBuild)
    else if (cmd === 'pixdiff') await pixdiff(args[0], args[1])
    else if (cmd === 'gallery') {
      // node qa/v13.mjs gallery <dir> [--no-build]: full-page Asset Gallery, light and dark
      const dir = args[0] || path.join(QA_DIR, 'screenshots', 'v13')
      ensureDir(dir)
      await withServer(noBuild, async (base, browser) => {
        for (const theme of ['light', 'dark']) {
          const ctx = await newContext(browser, { vp: '1440x900', state: { theme } })
          try {
            const page = await ctx.newPage()
            await page.goto(pageUrl(base, '/review/assets', { variant: 'b', theme }), { waitUntil: 'load' })
            await settle(page)
            await waitFirstScreenImages(page)
            await page.waitForTimeout(1500)
            await page.screenshot({ path: path.join(dir, `assets__1440x900__${theme}.jpg`), type: 'jpeg', quality: 70, scale: 'css', fullPage: true })
          } finally {
            await ctx.close().catch(() => {})
          }
        }
      })
    }
    else if (cmd === 'shots') {
      // node qa/v13.mjs shots <dir> [--no-build] [--pages=today,song] [--vps=1440x900] [--themes=light] [--variants=b,c] [--data=real] [--layout=<dir>] [--suffix=x]
      const opt = (k) => rest.find((x) => x.startsWith(`--${k}=`))?.split('=')[1]
      const pick = (k, all) => (opt(k) ? opt(k).split(',') : all)
      await shots(args[0] || path.join(OUT_DIR, 'v13-shots'), {
        noBuild,
        pages: PAGES.filter((p) => pick('pages', PAGES.map((x) => x.slug)).includes(p.slug)),
        vps: pick('vps', ['1440x900', '390x844']),
        themes: pick('themes', ['light', 'dark']),
        variants: pick('variants', VARIANTS),
        data: opt('data') || 'real',
        suffix: opt('suffix') || '',
        layoutDir: opt('layout') || null,
      })
    }
    else {
      console.log('usage: node qa/v13.mjs baseline <dir> [--no-build] | pixdiff <a> <b>')
      process.exit(2)
    }
  } catch (e) {
    console.error(e.message)
    process.exit(1)
  }
}
