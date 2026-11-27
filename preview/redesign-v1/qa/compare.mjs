#!/usr/bin/env node
// F6: before / after screenshots of the two phone detail pages, and side-by-side comparison images.
//   node qa/compare.mjs capture before|after [--no-build]   → qa/screenshots/compare/<name>__<phase>.jpg
//   node qa/compare.mjs combine                             → qa/screenshots/compare/<route>__<state>__compare.jpg
// Positions: top of page, scrolled to the very bottom, and (thread only) reply box focused.
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build, startPreview, stopServer } from './lib/server.mjs'
import { launchBrowser, newContext, gotoRoute } from './lib/browser.mjs'
import { QA_DIR, OUT_DIR, ensureDir, log, withTimeout } from './lib/util.mjs'

const DIR = ensureDir(path.join(QA_DIR, 'screenshots', 'compare'))
const ROUTES = [
  { slug: 'song-615', route: '/songs/615', states: ['top', 'bottom'] },
  { slug: 'thread-4017', route: '/community/t/4017', states: ['top', 'bottom', 'reply-focus'] },
]
const VPS = ['390x844', '360x740']
const LABEL = { top: '顶部', bottom: '滚到底', 'reply-focus': '回复框聚焦' }

async function capture(phase, noBuild) {
  if (!noBuild) {
    const b = await build({ retries: 1 })
    if (!b.ok) throw new Error('build failed')
  }
  const srv = await startPreview(4311)
  const { browser } = await launchBrowser()
  try {
    for (const r of ROUTES) {
      for (const vp of VPS) {
        for (const st of r.states) {
          const ctx = await newContext(browser, { vp, state: { theme: 'light', locale: 'zh', auth: 'ready' } })
          try {
            const page = await ctx.newPage()
            await gotoRoute(page, srv.url, r.route)
            if (st === 'bottom') {
              await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
              await page.waitForTimeout(500)
              await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
              await page.waitForTimeout(300)
            }
            if (st === 'reply-focus') {
              const ta = page.locator('main textarea, textarea').last()
              await ta.focus()
              await page.waitForTimeout(400)
            }
            const f = path.join(DIR, `${r.slug}__${vp}__${st}__${phase}.jpg`)
            await page.screenshot({ path: f, type: 'jpeg', quality: 72, scale: 'css' })
            log('saved ' + path.basename(f))
          } finally {
            await withTimeout(ctx.close(), 10_000, 'ctx.close').catch(() => {})
          }
        }
      }
    }
  } finally {
    await withTimeout(browser.close(), 15_000, 'browser.close').catch(() => {})
    await stopServer(srv)
  }
}

// One image per route × state: [390 before | 390 after | 360 before | 360 after], with captions.
async function combine() {
  const { browser } = await launchBrowser()
  const tmp = ensureDir(path.join(OUT_DIR, 'compare-tmp'))
  const made = []
  try {
    const ctx = await browser.newContext({ deviceScaleFactor: 1, viewport: { width: 1700, height: 1000 } })
    const page = await ctx.newPage()
    for (const r of ROUTES) {
      for (const st of r.states) {
        const cells = []
        for (const vp of VPS)
          for (const ph of ['before', 'after']) {
            const f = path.join(DIR, `${r.slug}__${vp}__${st}__${ph}.jpg`)
            cells.push(fs.existsSync(f) ? `<figure><figcaption>${vp} · ${ph === 'before' ? '修改前' : '修改后'}</figcaption><img src="${pathToFileURL(f).href}"></figure>` : `<figure><figcaption>${vp} · ${ph} 缺</figcaption></figure>`)
          }
        const html = `<!doctype html><meta charset=utf-8><style>body{margin:0;font:600 14px system-ui,sans-serif}#c{display:inline-flex;gap:14px;padding:12px;background:#d9dce3;align-items:flex-start}figure{margin:0}figcaption{padding:0 0 6px}img{display:block;border:1px solid #888}</style><div id=c>${cells.join('')}</div>`
        const t = path.join(tmp, 'c.html')
        fs.writeFileSync(t, html)
        await page.goto(pathToFileURL(t).href)
        await page.waitForFunction(() => [...document.images].every((i) => i.complete))
        const out = `${r.slug}__${st}__compare.jpg`
        await page.locator('#c').screenshot({ path: path.join(DIR, out), type: 'jpeg', quality: 68 })
        made.push({ out, caption: `${r.route} · ${LABEL[st]}` })
        log('combined ' + out)
      }
    }
    await ctx.close()
  } finally {
    await withTimeout(browser.close(), 15_000, 'browser.close').catch(() => {})
    fs.rmSync(tmp, { recursive: true, force: true })
  }
  fs.writeFileSync(path.join(DIR, 'compare.json'), JSON.stringify(made, null, 1))
}

const [cmd, phase] = process.argv.slice(2)
const noBuild = process.argv.includes('--no-build')
try {
  if (cmd === 'capture' && (phase === 'before' || phase === 'after')) await capture(phase, noBuild)
  else if (cmd === 'combine') await combine()
  else {
    console.log('usage: node qa/compare.mjs capture before|after [--no-build] | combine')
    process.exit(2)
  }
} catch (e) {
  console.error(e.message)
  process.exit(1)
}
