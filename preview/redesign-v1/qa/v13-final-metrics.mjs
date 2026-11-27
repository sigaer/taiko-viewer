#!/usr/bin/env node
// Design V1.3 Final（C+）· 图片与降级指标（docs/19 G12）。生产构建、真实 Chrome、默认状态（C+、full 数据、已同步）。
//   node qa/v13-final-metrics.mjs [--no-build]
// 1. 关键页（今日、曲库、歌曲详情、成绩、点灯进度、社区、帖子、个人主页）× 1440 / 390：图片请求数与传输字节（曲绘 / 本地图标 / 其他），
//    导航开始到首屏最后一张图的时间，CLS。每次测量用新的浏览器上下文（空缓存）。
// 2. 屏蔽曲绘域名：今日、曲库、歌曲详情、成绩、社区、个人主页 × 1440 / 390 × 浅 / 深：同一页面先不屏蔽拍版面，再屏蔽，比较元素框
//    （不计图片与 SVG 内部节点）；占位数量；页面错误；控制台输出。
// 3. 快速滚动：曲库、成绩（full 数据的长列表）与社区：请求数、被取消数、最大并发、滚动后 3 秒仍在途的请求。
// 写 qa/out/v13f/final-metrics.json。
import fs from 'node:fs'
import path from 'node:path'
import { build, startPreview, stopServer } from './lib/server.mjs'
import { launchBrowser, newContext, settle } from './lib/browser.mjs'
import { log, OUT_DIR, ensureDir, withTimeout } from './lib/util.mjs'
import { pageUrl, waitFirstScreenImages, layoutSnapshot } from './v13.mjs'

const HOST = 'static.sakura-bot.cn'
const noBuild = process.argv.includes('--no-build')
const KEY = [
  ['today', '/'],
  ['songs', '/songs'],
  ['song', '/songs/615'],
  ['scores', '/play/scores'],
  ['progress', '/play/progress'],
  ['community', '/community'],
  ['thread', '/community/t/4017'],
  ['profile', '/u/mochidon'],
]
const BLOCK = ['today', 'songs', 'song', 'scores', 'community', 'profile']
const LEAF = new Set(['IMG', 'PICTURE', 'SOURCE', 'svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'text', 'g', 'SMALL'])

const CLS_INIT = () => {
  window.__cls = 0
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value
    }).observe({ type: 'layout-shift', buffered: true })
  } catch {}
}
const kind = (u) => (u.includes(HOST) ? 'cover' : /\/game\//.test(u) ? 'icon' : 'other')

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
    return { lastImageMs: Math.round(last), firstScreenImgs: vis.length, cls: +(window.__cls || 0).toFixed(4) }
  })
}

async function main() {
  ensureDir(path.join(OUT_DIR, 'v13f'))
  if (!noBuild) {
    const b = await build({ retries: 1 })
    if (!b.ok) throw new Error('build failed')
  }
  const srv = await startPreview(4311)
  const { browser } = await launchBrowser()
  const out = { load: [], blocked: [], scroll: [] }
  try {
    // ---- 1 ----
    for (const vp of ['1440x900', '390x844'])
      for (const [slug, route] of KEY) {
        const ctx = await newContext(browser, { vp, state: { theme: 'light' } })
        try {
          await ctx.addInitScript(CLS_INIT)
          const page = await ctx.newPage()
          const reqs = track(page)
          await page.goto(pageUrl(srv.url, route), { waitUntil: 'load' })
          await settle(page)
          await waitFirstScreenImages(page)
          await page.waitForTimeout(500)
          const t = await firstScreenTiming(page)
          const n = (k) => reqs.filter((r) => kind(r.url) === k).length
          const kb = (k) => +(reqs.filter((r) => kind(r.url) === k).reduce((a, r) => a + r.size, 0) / 1024).toFixed(1)
          const row = { page: slug, vp, coverReq: n('cover'), coverKB: kb('cover'), iconReq: n('icon'), iconKB: kb('icon'), otherReq: n('other'), otherKB: kb('other'), failed: reqs.filter((r) => !r.ok).length, iconFiles: reqs.filter((r) => kind(r.url) === 'icon').map((r) => r.url.replace(/^.*\/game\//, '')), ...t }
          out.load.push(row)
          log(`load ${slug} ${vp}: covers ${row.coverReq}/${row.coverKB}KB icons ${row.iconReq}/${row.iconKB}KB other ${row.otherReq}/${row.otherKB}KB failed ${row.failed} last ${row.lastImageMs}ms CLS ${row.cls}`)
        } finally {
          await ctx.close().catch(() => {})
        }
      }
    // ---- 2 ----
    for (const vp of ['1440x900', '390x844'])
      for (const theme of ['light', 'dark'])
        for (const [slug, route] of KEY.filter((k) => BLOCK.includes(k[0]))) {
          const snaps = {}
          let census = null
          let msgs = []
          let pageErrors = 0
          for (const blocked of [false, true]) {
            const ctx = await newContext(browser, { vp, state: { theme } })
            try {
              if (blocked) await ctx.route(`https://${HOST}/**`, (r) => r.abort('blockedbyclient'))
              const page = await ctx.newPage()
              const m = []
              page.on('console', (x) => (x.type() === 'error' || x.type() === 'warning') && m.push(x.type() + ': ' + x.text().slice(0, 140)))
              page.on('pageerror', (e) => {
                pageErrors += blocked ? 1 : 0
                m.push('pageerror: ' + e.message.slice(0, 140))
              })
              await page.goto(pageUrl(srv.url, route), { waitUntil: 'load' })
              await settle(page)
              await waitFirstScreenImages(page)
              await page.waitForTimeout(400)
              snaps[blocked] = (await layoutSnapshot(page)).boxes.filter((e) => !LEAF.has(e[0]))
              if (blocked) {
                msgs = m
                census = await page.evaluate(() => ({
                  real: document.querySelectorAll('.cover.acov.real img.on').length,
                  missing: document.querySelectorAll('.cover.acov.missing').length,
                  sample: document.querySelectorAll('.cover.acov.sample').length,
                  pendingReal: document.querySelectorAll('.cover.acov.real').length,
                }))
              }
            } finally {
              await ctx.close().catch(() => {})
            }
          }
          const a = snaps[false], b = snaps[true]
          let mism = 0
          for (let i = 0; i < Math.max(a.length, b.length); i++) if (!a[i] || !b[i] || a[i].join() !== b[i].join()) mism++
          const uniq = [...new Set(msgs.map((x) => x.replace(/https?:\/\/\S+/g, '<url>')))]
          out.blocked.push({ page: slug, vp, theme, census, boxes: a.length, layoutMismatch: mism, pageErrors, consoleCount: msgs.length, console: uniq.slice(0, 4) })
          log(`blocked ${slug} ${vp} ${theme}: ${JSON.stringify(census)} boxes ${a.length} mismatch ${mism} pageErrors ${pageErrors} console ${msgs.length} ${uniq.slice(0, 1).join('')}`)
        }
    // ---- 3 ----
    for (const route of ['/songs', '/play/scores', '/community']) {
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
        await page.goto(pageUrl(srv.url, route), { waitUntil: 'load' })
        await settle(page)
        await waitFirstScreenImages(page)
        const before = issued
        const H = await page.evaluate(() => document.documentElement.scrollHeight)
        const t0 = Date.now()
        for (let i = 0; i < 60; i++) {
          await page.mouse.wheel(0, 1600)
          await page.waitForTimeout(25)
        }
        const right = { issued, inflight, ms: Date.now() - t0 }
        await page.waitForTimeout(3000)
        const m = await page.evaluate(() => ({ mountedRows: document.querySelectorAll('tbody tr, .mlist > *, .vlist-row').length, coversMounted: document.querySelectorAll('.cover.acov').length, scrollY: Math.round(scrollY) }))
        const row = { route, pageHeight: H, firstScreenRequests: before, issuedDuringScroll: right.issued - before, inflightRightAfterScroll: right.inflight, totalIssued: issued, finished: done, aborted, maxInFlight: maxIn, scrollMs: right.ms, inflightAfter3s: inflight, ...m }
        out.scroll.push(row)
        log('scroll ' + JSON.stringify(row))
      } finally {
        await ctx.close().catch(() => {})
      }
    }
  } finally {
    await withTimeout(browser.close(), 15000, 'browser.close').catch(() => {})
    await stopServer(srv)
  }
  fs.writeFileSync(path.join(OUT_DIR, 'v13f', 'final-metrics.json'), JSON.stringify(out, null, 1))
}

main().catch((e) => {
  console.error(e.stack || e.message)
  process.exit(1)
})
