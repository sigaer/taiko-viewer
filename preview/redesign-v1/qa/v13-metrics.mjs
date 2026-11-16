#!/usr/bin/env node
// Design V1.3 Phase A · real-image load metrics (docs/16 A7), production build, real Chrome, data=real.
//   node qa/v13-metrics.mjs [--no-build]
// 1. B and C × 4 pages × 1440×900 / 390×844: image requests (covers vs local icons), transferred bytes, time from navigation
//    start to the last first-screen image, failures, CLS (A measured the same way for comparison).
// 2. Blocked host: static.sakura-bot.cn aborted (B, 4 pages × 2 viewports): placeholders, console output, layout identical
//    to the unblocked B run (element boxes, leaf drawing nodes excluded). Aborted cover requests are expected only here.
// 3. Fast scroll on the longest real list (/community feed, 240 threads): cover requests issued, aborted, max in flight.
// Writes qa/out/v13/metrics.json and prints a table.
import fs from 'node:fs'
import path from 'node:path'
import { build, startPreview, stopServer } from './lib/server.mjs'
import { launchBrowser, newContext, settle } from './lib/browser.mjs'
import { log, OUT_DIR, ensureDir, withTimeout } from './lib/util.mjs'
import { PAGES, pageUrl, waitFirstScreenImages, layoutSnapshot } from './v13.mjs'

const HOST = 'static.sakura-bot.cn'
const noBuild = process.argv.includes('--no-build')
const VPS = ['1440x900', '390x844']

const CLS_INIT = () => {
  window.__cls = 0
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value
    }).observe({ type: 'layout-shift', buffered: true })
  } catch {}
}

function track(page) {
  const reqs = []
  page.on('requestfinished', async (r) => {
    if (r.resourceType() !== 'image') return
    let size = 0
    try {
      const s = await r.sizes()
      size = s.responseBodySize + s.responseHeadersSize
    } catch {}
    const resp = await r.response().catch(() => null)
    reqs.push({ url: r.url(), ok: !!resp && resp.status() < 400, status: resp?.status() ?? 0, size })
  })
  page.on('requestfailed', (r) => {
    if (r.resourceType() !== 'image') return
    reqs.push({ url: r.url(), ok: false, status: 0, size: 0, failure: r.failure()?.errorText || '' })
  })
  return reqs
}
const kind = (u) => (u.includes(HOST) ? 'cover' : u.includes('/game/') ? 'icon' : 'other')

async function firstScreenTiming(page) {
  return page.evaluate(() => {
    const vh = innerHeight
    const vis = [...document.images].filter((i) => {
      const r = i.getBoundingClientRect()
      return r.bottom > 0 && r.top < vh && r.width > 0
    })
    const ents = performance.getEntriesByType('resource')
    let last = 0
    for (const i of vis) {
      const e = ents.filter((x) => x.name === i.currentSrc).pop()
      if (e) last = Math.max(last, e.responseEnd)
    }
    // background-image plates
    for (const e of ents) if (/\/game\/plate\//.test(e.name)) last = Math.max(last, e.responseEnd)
    return { lastImageMs: Math.round(last), firstScreenImgs: vis.length, cls: +(window.__cls || 0).toFixed(4) }
  })
}

async function main() {
  ensureDir(path.join(OUT_DIR, 'v13'))
  if (!noBuild) {
    const b = await build({ retries: 1 })
    if (!b.ok) throw new Error('build failed')
  }
  const srv = await startPreview(4311)
  const { browser } = await launchBrowser()
  const out = { load: [], blocked: [], scroll: null }
  try {
    const onlyScroll = process.argv.includes('--only-scroll')
    if (onlyScroll) {
      const prev = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'v13', 'metrics.json'), 'utf8'))
      out.load = prev.load
      out.blocked = prev.blocked
    }
    // ---- 1. load metrics ----
    for (const vp of onlyScroll ? [] : VPS) {
      for (const p of PAGES)
        for (const v of ['a', 'b', 'c']) {
          // fresh context per measurement: empty HTTP cache, so bytes and timings are cold-load numbers
          const ctx = await newContext(browser, { vp, state: { theme: 'light' } })
          try {
            await ctx.addInitScript(CLS_INIT)
            const page = await ctx.newPage()
            const reqs = track(page)
            await page.goto(pageUrl(srv.url, p.route, { variant: v, theme: 'light', data: 'real' }), { waitUntil: 'load' })
            await settle(page)
            const w = await waitFirstScreenImages(page)
            await page.waitForTimeout(500)
            const t = await firstScreenTiming(page)
            const sum = (k, f) => reqs.filter((r) => kind(r.url) === k).reduce((a, r) => a + f(r), 0)
            const row = {
              page: p.slug, vp, variant: v,
              coverReq: reqs.filter((r) => kind(r.url) === 'cover').length,
              iconReq: reqs.filter((r) => kind(r.url) === 'icon').length,
              coverKB: +(sum('cover', (r) => r.size) / 1024).toFixed(1),
              iconKB: +(sum('icon', (r) => r.size) / 1024).toFixed(1),
              failed: reqs.filter((r) => !r.ok).length,
              failedUrls: reqs.filter((r) => !r.ok).map((r) => r.url.replace(/^https?:\/\/[^/]+/, '') + ' ' + (r.failure || r.status)).slice(0, 8),
              settled: w.ok,
              ...t,
            }
            row.failRate = reqs.length ? +(row.failed / reqs.length).toFixed(3) : 0
            out.load.push(row)
            log(`load ${p.slug} ${vp} ${v}: covers ${row.coverReq} (${row.coverKB} KB) icons ${row.iconReq} (${row.iconKB} KB) fail ${row.failed} last img ${row.lastImageMs} ms CLS ${row.cls}`)
          } finally {
            await ctx.close().catch(() => {})
          }
        }
    }
    // ---- 2. blocked host ----
    for (const vp of onlyScroll ? [] : VPS) {
      const ctx = await newContext(browser, { vp, state: { theme: 'light' } })
      try {
        await ctx.route(`https://${HOST}/**`, (r) => r.abort('blockedbyclient'))
        const page = await ctx.newPage()
        const msgs = []
        page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && msgs.push(m.type() + ': ' + m.text().slice(0, 160)))
        page.on('pageerror', (e) => msgs.push('pageerror: ' + e.message.slice(0, 160)))
        for (const p of PAGES) {
          msgs.length = 0
          await page.goto(pageUrl(srv.url, p.route, { variant: 'b', theme: 'light', data: 'real' }), { waitUntil: 'load' })
          await settle(page)
          await waitFirstScreenImages(page)
          await page.waitForTimeout(400)
          const census = await page.evaluate(() => ({
            real: document.querySelectorAll('.cover.acov.real img.on').length,
            missing: document.querySelectorAll('.cover.acov.missing').length,
            sample: document.querySelectorAll('.cover.acov.sample').length,
            pendingReal: document.querySelectorAll('.cover.acov.real').length,
          }))
          // layout vs the unblocked B capture (same page / vp / theme light)
          const snap = await layoutSnapshot(page)
          const ref = path.join(OUT_DIR, 'v13', 'layout', `${p.slug}__${vp}__light__b.json`)
          let mism = null
          if (fs.existsSync(ref)) {
            const LEAF = new Set(['IMG', 'svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'text', 'g', 'SMALL'])
            const a = JSON.parse(fs.readFileSync(ref, 'utf8')).boxes.filter((e) => !LEAF.has(e[0]))
            const b = snap.boxes.filter((e) => !LEAF.has(e[0]))
            mism = 0
            for (let i = 0; i < Math.max(a.length, b.length); i++) if (!a[i] || !b[i] || a[i].join() !== b[i].join()) mism++
          }
          const uniq = [...new Set(msgs.map((m) => m.replace(/https?:\/\/\S+/g, '<url>')))]
          out.blocked.push({ page: p.slug, vp, census, layoutMismatch: mism, consoleCount: msgs.length, console: uniq.slice(0, 5) })
          log(`blocked ${p.slug} ${vp}: ${JSON.stringify(census)} layout mismatch ${mism} console ${msgs.length} ${uniq.slice(0, 2).join(' | ')}`)
        }
      } finally {
        await ctx.close().catch(() => {})
      }
    }
    // ---- 3. fast scroll (longest real lists: /community feed, /play/scores virtual table, /songs virtual list) ----
    out.scroll = []
    for (const route of ['/community', '/play/scores', '/songs']) {
      const ctx = await newContext(browser, { vp: '1440x900', state: { theme: 'light' } })
      try {
        const page = await ctx.newPage()
        let issued = 0, done = 0, aborted = 0, inflight = 0, maxIn = 0
        page.on('request', (r) => {
          if (!r.url().includes(HOST)) return
          issued++
          inflight++
          maxIn = Math.max(maxIn, inflight)
        })
        page.on('requestfinished', (r) => r.url().includes(HOST) && (done++, inflight--))
        page.on('requestfailed', (r) => r.url().includes(HOST) && (aborted++, inflight--))
        await page.goto(pageUrl(srv.url, route, { variant: 'b', theme: 'light', data: 'real' }), { waitUntil: 'load' })
        await settle(page)
        await waitFirstScreenImages(page)
        const before = issued
        const H = await page.evaluate(() => document.documentElement.scrollHeight)
        const t0 = Date.now()
        for (let i = 0; i < 60; i++) {
          await page.mouse.wheel(0, 1600)
          await page.waitForTimeout(25)
        }
        const afterScroll = { issued, inflight, ms: Date.now() - t0 }
        await page.waitForTimeout(3000)
        const covers = await page.evaluate(() => ({ mounted: document.querySelectorAll('.cover.acov').length, withImg: document.querySelectorAll('.cover.acov img').length, scrollY: Math.round(scrollY) }))
        out.scroll.push({ route, variant: 'b', pageHeight: H, firstScreenRequests: before, issuedDuringScroll: afterScroll.issued - before, inflightRightAfterScroll: afterScroll.inflight, totalIssued: issued, finished: done, aborted, maxInFlight: maxIn, scrollMs: afterScroll.ms, inflightAfter3s: inflight, ...covers })
        log('scroll ' + JSON.stringify(out.scroll.at(-1)))
      } finally {
        await ctx.close().catch(() => {})
      }
    }
  } finally {
    await withTimeout(browser.close(), 15000, 'browser.close').catch(() => {})
    await stopServer(srv)
  }
  fs.writeFileSync(path.join(OUT_DIR, 'v13', 'metrics.json'), JSON.stringify(out, null, 1))
}

main().catch((e) => {
  console.error(e.stack || e.message)
  process.exit(1)
})
