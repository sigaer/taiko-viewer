#!/usr/bin/env node
// Design V1.3 Final（C+）· 关键页截图（docs/19 G12 / Stage 2 C）。生产构建、真实 Chrome、默认状态（C+、full 数据、已同步）。
//   node qa/v13-final.mjs [--no-build]
// 原始单张在 qa/out/v13f/raw/（不提交）；qa/screenshots/v13-final/ 里放浅|深并排的对图：{slug}__{vp}.jpg，
// 以及屏蔽曲绘域名的状态 blocked__{slug}__{vp}__light.jpg。
import fs from 'node:fs'
import path from 'node:path'
import { build, startPreview, stopServer } from './lib/server.mjs'
import { launchBrowser, newContext, settle, collectErrors } from './lib/browser.mjs'
import { ensureDir, log, OUT_DIR, QA_DIR, withTimeout } from './lib/util.mjs'
import { pageUrl, waitFirstScreenImages } from './v13.mjs'

const RAW = path.join(OUT_DIR, 'v13f', 'raw')
const FINAL = path.join(QA_DIR, 'screenshots', 'v13-final')
const noBuild = process.argv.includes('--no-build')

// slug, route, optional action after load
const KEY = [
  ['today', '/'],
  ['songs', '/songs'],
  ['song', '/songs/615'],
  ['rating', '/play'],
  ['scores', '/play/scores'],
  ['progress', '/play/progress'],
  ['growth', '/growth'],
  ['goals', '/growth/goals'],
  ['community', '/community'],
  ['thread', '/community/t/4017'],
  ['profile', '/u/mochidon'],
  ['me', '/me'],
  ['account', '/account'],
  ['login', '/login'],
  ['titles', '/titles'],
  ['dan', '/dan'],
  ['tools', '/tools'],
  ['notifications', '/notifications'],
  ['palette', '/', 'palette'],
  ['syncpanel', '/', 'sync'],
  ['sheet', '/play/scores', 'sheet'],
]
const EXTRA_VPS = { '820x1180': ['today', 'songs', 'song', 'scores', 'community'], '360x740': ['today', 'songs', 'song', 'scores', 'community'] }
const BLOCKED = ['scores', 'community']
const HOST = 'static.sakura-bot.cn'

async function act(page, what) {
  if (what === 'palette') {
    await page.keyboard.press('Control+k')
    await page.waitForSelector('[role=dialog] input', { timeout: 5000 })
    await page.locator('[role=dialog] input').first().fill('天狗')
    await page.waitForTimeout(500)
  } else if (what === 'sync') {
    // 桌面：顶栏的同步状态条；手机：顶栏的同步按钮（与 qa/flows/sync.mjs 相同的选择器）
    const phone = page.viewportSize().width < 768
    if (phone) await page.locator('header button.m-sync').first().dispatchEvent('click')
    else {
      // 桌面：已同步时点状态条直接开始同步（S4），浮动面板只在失败 / 部分成功时打开 —— 用「失败」结果拍面板
      await page.evaluate(() => {
        const st = JSON.parse(localStorage.getItem('tv-design-v1') || '{}')
        st.syncOutcome = 'failed'
        localStorage.setItem('tv-design-v1', JSON.stringify(st))
      })
      await page.reload({ waitUntil: 'load' })
      await settle(page)
      const chip = page.locator('header .syncchip:visible').first()
      await chip.click()
      await page.waitForFunction(() => /失败|失敗/.test(document.querySelector('header .syncchip')?.getAttribute('aria-label') || ''), null, { timeout: 12000 })
      await chip.click()
      await page.waitForTimeout(500)
      await page.evaluate(() => {
        const st = JSON.parse(localStorage.getItem('tv-design-v1') || '{}')
        st.syncOutcome = 'success'
        localStorage.setItem('tv-design-v1', JSON.stringify(st))
      })
    }
    await page.waitForTimeout(600)
  } else if (what === 'sheet') {
    await page.locator('button:has-text("补录一条")').first().click()
    await page.waitForSelector('[role=dialog]', { timeout: 5000 })
    await page.waitForTimeout(500)
  }
}

async function shoot(browser, base, list, vp, { blocked = false, themes = ['light', 'dark'], tag = '' } = {}) {
  const out = []
  for (const theme of themes) {
    const ctx = await newContext(browser, { vp, state: { theme } })
    try {
      if (blocked) await ctx.route(`https://${HOST}/**`, (r) => r.abort('blockedbyclient'))
      const page = await ctx.newPage()
      const errs = collectErrors(page)
      for (const [slug, route, action] of list) {
        errs.length = 0
        await page.goto(pageUrl(base, route, { theme }), { waitUntil: 'load' })
        await settle(page)
        await waitFirstScreenImages(page)
        if (action) await act(page, action)
        const f = path.join(RAW, `${tag}${slug}__${vp}__${theme}.jpg`)
        await page.screenshot({ path: f, type: 'jpeg', quality: 78, scale: 'css' })
        const pageErr = errs.filter((e) => e.kind === 'pageerror')
        out.push({ slug, vp, theme, blocked, file: f, pageErrors: pageErr.length })
        // 浮层停留在 SPA 状态里（同一 query 只换 hash 不会重载）：离开空白页，下一张从干净的页面载入
        if (action) await page.goto('about:blank')
      }
    } finally {
      await ctx.close().catch(() => {})
    }
  }
  return out
}

async function pair(browser, a, b, title, outFile, dark2) {
  const ctx = await browser.newContext()
  try {
    const page = await ctx.newPage()
    await page.goto('about:blank')
    const d = (f) => 'data:image/jpeg;base64,' + fs.readFileSync(f).toString('base64')
    const data = await page.evaluate(
      async ([srcs, title, labels]) => {
        const load = (s) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = s })
        const imgs = await Promise.all(srcs.map(load))
        const w = imgs[0].width, h = Math.max(...imgs.map((i) => i.height))
        const s = w > 1000 ? 0.6 : 1
        const gap = 16, head = 32
        const c = document.createElement('canvas')
        c.width = Math.round(imgs.length * w * s + (imgs.length + 1) * gap)
        c.height = Math.round(h * s + head + gap)
        const x = c.getContext('2d')
        x.fillStyle = '#5f6f72'
        x.fillRect(0, 0, c.width, c.height)
        x.font = '600 14px system-ui, sans-serif'
        imgs.forEach((im, i) => {
          const ox = gap + i * (w * s + gap)
          x.fillStyle = '#ffffff'
          x.fillText(labels[i], ox, 21)
          x.drawImage(im, ox, head, w * s, im.height * s)
        })
        x.textAlign = 'right'
        x.font = '12px system-ui, sans-serif'
        x.fillText(title, c.width - gap, 21)
        return c.toDataURL('image/jpeg', 0.8)
      },
      [[a, b].filter(Boolean).map(d), title, dark2 ? ['浅色', '深色'] : ['浅色']],
    )
    fs.writeFileSync(outFile, Buffer.from(data.split(',')[1], 'base64'))
  } finally {
    await ctx.close().catch(() => {})
  }
}

async function main() {
  ensureDir(RAW)
  ensureDir(FINAL)
  if (!noBuild) {
    const b = await build({ retries: 1 })
    if (!b.ok) throw new Error('build failed')
  }
  const srv = await startPreview(4311)
  const { browser } = await launchBrowser()
  const report = []
  try {
    for (const vp of ['1440x900', '390x844']) report.push(...(await shoot(browser, srv.url, KEY, vp)))
    for (const [vp, slugs] of Object.entries(EXTRA_VPS)) report.push(...(await shoot(browser, srv.url, KEY.filter((k) => slugs.includes(k[0])), vp)))
    for (const vp of ['1440x900', '390x844']) report.push(...(await shoot(browser, srv.url, KEY.filter((k) => BLOCKED.includes(k[0])), vp, { blocked: true, themes: ['light'], tag: 'blocked__' })))
    // pairs
    const vps = ['1440x900', '390x844', ...Object.keys(EXTRA_VPS)]
    for (const vp of vps)
      for (const [slug] of KEY) {
        const a = path.join(RAW, `${slug}__${vp}__light.jpg`)
        const b = path.join(RAW, `${slug}__${vp}__dark.jpg`)
        if (!fs.existsSync(a)) continue
        await pair(browser, a, b, `${slug} · ${vp} · C+ · full`, path.join(FINAL, `${slug}__${vp}.jpg`), true)
      }
    for (const vp of ['1440x900', '390x844'])
      for (const slug of BLOCKED) fs.copyFileSync(path.join(RAW, `blocked__${slug}__${vp}__light.jpg`), path.join(FINAL, `blocked__${slug}__${vp}__light.jpg`))
  } finally {
    await withTimeout(browser.close(), 15000, 'browser.close').catch(() => {})
    await stopServer(srv)
  }
  fs.writeFileSync(path.join(OUT_DIR, 'v13f', 'final-captures.json'), JSON.stringify(report, null, 1))
  log(`captures: ${report.length}, page errors: ${report.reduce((a, r) => a + r.pageErrors, 0)}`)
}

main().catch((e) => {
  console.error(e.stack || e.message)
  process.exit(1)
})
