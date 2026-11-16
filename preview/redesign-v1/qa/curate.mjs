#!/usr/bin/env node
// Copy a curated set of key screenshots from qa/out into qa/screenshots (committed). Light | dark
// pairs of the key pages are composed side by side into one JPEG through the system browser (no
// image library), everything else is re-encoded singly. Limits: ≤ 70 files, ≤ 12 MB.
// Writes qa/screenshots/index.html (static, relative paths, opens from the file system).
// Usage: node qa/curate.mjs [--quality 70]
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { launchBrowser } from './lib/browser.mjs'
import { QA_DIR, SHOTS_DIR, FLOW_SHOTS_DIR, OUT_DIR, ensureDir, log, mb, dirSize, withTimeout } from './lib/util.mjs'
import { caseId, EDGE_PAGES } from './matrix.mjs'

const DEST = path.join(QA_DIR, 'screenshots')
const TMP = ensureDir(path.join(OUT_DIR, 'curate-tmp'))
const COMPARE = path.join(DEST, 'compare') // F6 before / after set (qa/compare.mjs) — kept across curations
const MAX_FILES = 80 // including compare/
const MAX_BYTES = 14 * 1024 * 1024

const def = (route, vp, o = {}) => ({ route, vp, theme: o.theme || 'light', locale: o.locale || 'zh', auth: o.auth || 'ready', dataset: o.dataset || 'full' })
const shot = (route, vp, o) => path.join(SHOTS_DIR, caseId(def(route, vp, o)) + '.jpg')
const flowShot = (name) => path.join(FLOW_SHOTS_DIR, name + '.jpg')

const KEY_PAGES = [
  ['/', '今日'], ['/songs', '曲库'], ['/songs/615', '歌曲详情'], ['/play/scores', '全部成绩'], ['/growth', '成长档案'],
  ['/community', '社区广场'], ['/community/t/4017', '帖子详情'], ['/u/mochidon', '个人主页'], ['/account', '账号与绑定'],
]

function plan() {
  const sections = []
  const pairs = []
  for (const [route, name] of KEY_PAGES) {
    const slug = caseId(def(route, '1440x900')).split('__')[0]
    pairs.push({ out: `${slug}__desktop.jpg`, caption: `${name} ${route} · 桌面 1440×900`, light: shot(route, '1440x900'), dark: shot(route, '1440x900', { theme: 'dark' }) })
    pairs.push({ out: `${slug}__phone.jpg`, caption: `${name} ${route} · 手机 390×844`, light: shot(route, '390x844'), dark: shot(route, '390x844', { theme: 'dark' }), phone: true })
  }
  pairs.push({ out: 'me__phone.jpg', caption: '我的 /me · 手机 390×844', light: shot('/me', '390x844'), dark: shot('/me', '390x844', { theme: 'dark' }), phone: true })
  pairs.push({ out: 'palette__desktop.jpg', caption: '命令面板 · 桌面「千本」', light: flowShot('palette-showcase__desktop-light'), dark: flowShot('palette-showcase__desktop-dark') })
  pairs.push({ out: 'palette__phone.jpg', caption: '命令面板 · 手机全屏「16 oxxo 180 鬼10」', light: flowShot('palette-showcase__phone-light'), dark: flowShot('palette-showcase__phone-dark'), phone: true })
  sections.push({ title: '关键页面：浅色 | 深色', pairs })

  const singles = [
    ['sync__phone-success.jpg', '同步面板 · 手机 · 成功', flowShot('sync-phone__panel-success'), true],
    ['sync__phone-partial.jpg', '同步面板 · 手机 · 部分成功', flowShot('sync-phone__panel-partial'), true],
    ['sync__phone-failed.jpg', '同步面板 · 手机 · 失败', flowShot('sync-phone__panel-failed'), true],
    ['sync__desktop-partial.jpg', '同步浮层 · 桌面 · 部分成功', flowShot('sync-desktop__popover-partial')],
    ['ja__home__desktop.jpg', '日文 · 今日 · 桌面', shot('/', '1440x900', { locale: 'ja' })],
    ['ja__home__phone.jpg', '日文 · 今日 · 手机', shot('/', '390x844', { locale: 'ja' }), true],
    ['ja__song__desktop.jpg', '日文 · 歌曲详情 · 桌面', shot('/songs/615', '1440x900', { locale: 'ja' })],
    ['ja__song__phone.jpg', '日文 · 歌曲详情 · 手机', shot('/songs/615', '390x844', { locale: 'ja' }), true],
    ['auth__guest__desktop.jpg', '游客 · 今日 · 桌面', shot('/', '1440x900', { auth: 'guest' })],
    ['auth__guest__phone.jpg', '游客 · 今日 · 手机', shot('/', '390x844', { auth: 'guest' }), true],
    ['auth__unbound__desktop.jpg', '未绑定 · 今日 · 桌面', shot('/', '1440x900', { auth: 'unbound' })],
    ['auth__unbound__phone.jpg', '未绑定 · 今日 · 手机', shot('/', '390x844', { auth: 'unbound' }), true],
    ['auth__empty__desktop.jpg', '无成绩 · 今日 · 桌面', shot('/', '1440x900', { auth: 'empty' })],
    ['auth__empty__phone.jpg', '无成绩 · 今日 · 手机', shot('/', '390x844', { auth: 'empty' }), true],
    ['tablet__home.jpg', '平板 820×1180 · 今日', shot('/', '820x1180')],
    ['tablet__songs.jpg', '平板 820×1180 · 曲库', shot('/songs', '820x1180')],
    ['tablet__song.jpg', '平板 820×1180 · 歌曲详情', shot('/songs/615', '820x1180')],
    ['tablet__growth.jpg', '平板 820×1180 · 成长档案', shot('/growth', '820x1180')],
    ['tablet__community.jpg', '平板 820×1180 · 社区广场', shot('/community', '820x1180')],
    ['tablet__play-scores.jpg', '平板 820×1180 · 全部成绩', shot('/play/scores', '820x1180')],
    ['w360__home.jpg', '360×740 · 今日', shot('/', '360x740'), true],
    ['w360__songs.jpg', '360×740 · 曲库', shot('/songs', '360x740'), true],
    ['w360__me.jpg', '360×740 · 我的', shot('/me', '360x740'), true],
    ['long-title__desktop.jpg', `长标题 · ${EDGE_PAGES[0]} · 桌面`, shot(EDGE_PAGES[0], '1440x900')],
    ['long-title__phone.jpg', `长标题 · ${EDGE_PAGES[0]} · 手机`, shot(EDGE_PAGES[0], '390x844'), true],
  ].map(([out, caption, src, phone]) => ({ out, caption, src, phone: !!phone }))
  sections.push({ title: '同步、语言、登录态、平板与窄屏、长标题', singles })
  return sections
}

async function main() {
  const quality = (() => {
    const i = process.argv.indexOf('--quality')
    return i > 0 ? Number(process.argv[i + 1]) : 70
  })()
  const sections = plan()
  const missing = []
  // clear everything except compare/
  ensureDir(DEST)
  for (const f of fs.readdirSync(DEST)) if (f !== 'compare') fs.rmSync(path.join(DEST, f), { recursive: true, force: true })
  const { browser } = await launchBrowser()
  let q = quality
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      missing.length = 0
      const ctx = await browser.newContext({ deviceScaleFactor: 1, viewport: { width: 1600, height: 1000 } })
      try {
        const page = await ctx.newPage()
        const render = async (imgs, out, gap) => {
          const html = `<!doctype html><meta charset=utf-8><style>body{margin:0;background:#888}#c{display:inline-flex;gap:${gap}px;padding:0;background:#888}img{display:block}</style><div id=c>${imgs.map((f) => `<img src="${pathToFileURL(f).href}">`).join('')}</div>`
          const tmp = path.join(TMP, 'c.html')
          fs.writeFileSync(tmp, html)
          await page.goto(pathToFileURL(tmp).href)
          await page.waitForFunction(() => [...document.images].every((i) => i.complete))
          if (attempt === 2) await page.evaluate(() => document.querySelectorAll('img').forEach((i) => (i.style.width = Math.round(i.naturalWidth * 0.8) + 'px')))
          await page.locator('#c').screenshot({ path: path.join(DEST, out), type: 'jpeg', quality: q })
        }
        for (const s of sections) {
          for (const p of s.pairs || []) {
            const have = [p.light, p.dark].filter((f) => fs.existsSync(f))
            if (have.length < 2) missing.push(`${p.caption}（${have.length ? '缺深色或浅色' : '缺两张'}）`)
            if (have.length) await render(have, p.out, 12)
            p.ok = have.length > 0
          }
          for (const x of s.singles || []) {
            if (!fs.existsSync(x.src)) {
              missing.push(x.caption)
              continue
            }
            await render([x.src], x.out, 0)
            x.ok = true
          }
        }
        await page.close()
      } finally {
        await withTimeout(ctx.close(), 10_000, 'ctx.close').catch(() => {})
      }
      const s = dirSize(DEST)
      log(`curated ${s.files} files incl. compare/ at q${q}${attempt === 2 ? ' (80% scale)' : ''}: ${mb(s.total)}`)
      if (s.total <= MAX_BYTES - 300_000 && s.files <= MAX_FILES - 1) break
      q = Math.max(45, q - 15)
    }
  } finally {
    await withTimeout(browser.close(), 15_000, 'browser.close').catch(() => {})
    fs.rmSync(TMP, { recursive: true, force: true })
  }
  let meta = {}
  try {
    const r = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'results.json'), 'utf8'))
    meta = { at: r.startedAt, target: r.target?.kind, browser: r.browser }
  } catch {}
  let compare = []
  try {
    compare = JSON.parse(fs.readFileSync(path.join(COMPARE, 'compare.json'), 'utf8'))
  } catch {}
  fs.writeFileSync(path.join(DEST, 'index.html'), gallery(sections, meta, missing, compare))
  const s = dirSize(DEST)
  log(`qa/screenshots: ${s.files} files, ${mb(s.total)}${missing.length ? ` · missing ${missing.length}: ${missing.join('; ')}` : ''}`)
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
function gallery(sections, meta, missing, compare = []) {
  const fig = (x, sub) => (x.ok ? `<figure class="${x.phone ? 'ph' : 'dk'}${x.pairs ? ' pair' : ''}"><a href="${x.out}"><img loading="lazy" src="${x.out}" alt="${esc(x.caption)}"></a><figcaption>${esc(x.caption)}${sub ? `<span>${sub}</span>` : ''}</figcaption></figure>` : '')
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>V1.1 关键截图</title>
<style>
:root{--bg:#f6f4ef;--ink:#1d1b18;--ink2:#5b574f;--line:#d9d4c9;--card:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#16161a;--ink:#ecebe7;--ink2:#a9a69e;--line:#34343a;--card:#202026}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 system-ui,"Noto Sans SC",sans-serif;padding:24px 16px 64px}
h1{font-size:22px;margin:0 0 4px}p.meta{color:var(--ink2);margin:0 0 24px}
h2{font-size:16px;margin:32px 0 12px;padding-bottom:6px;border-bottom:1px solid var(--line)}
.grid{display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start}
figure{margin:0;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:6px}
figure.dk{width:min(1100px,100%)}figure.dk:not(.pair){width:min(560px,100%)}
figure.ph{width:min(470px,100%)}figure.ph:not(.pair){width:min(230px,47%)}
figure img{display:block;width:100%;height:auto;border-radius:4px}
figcaption{font-size:12px;color:var(--ink2);padding-top:4px;display:flex;justify-content:space-between;gap:8px}
.note{color:var(--ink2);font-size:12px}
</style></head><body>
<h1>Design V1.1 关键截图</h1>
<p class="meta">${esc([meta.at, meta.target, meta.browser].filter(Boolean).join(' · '))} · 模拟数据下的截图，不是生产验收。成对图片左为浅色、右为深色；点图看原尺寸。</p>
${sections
  .map((s) => `<h2>${esc(s.title)}</h2><div class="grid">${(s.pairs || []).map((p) => fig({ ...p, pairs: true }, '浅色 | 深色')).join('')}${(s.singles || []).map((x) => fig(x)).join('')}</div>`)
  .join('\n')}
${compare.length ? `<h2>手机详情页导航：修改前 | 修改后（F1）</h2><p class="note">每张图从左到右：390×844 修改前、修改后，360×740 修改前、修改后。</p><div class="grid">${compare.map((c) => `<figure class="dk pair"><a href="compare/${c.out}"><img loading="lazy" src="compare/${c.out}" alt="${esc(c.caption)}"></a><figcaption>${esc(c.caption)}<span>修改前 | 修改后</span></figcaption></figure>`).join('')}</div>` : ''}
${missing.length ? `<p class="note">本次运行未生成：${esc(missing.join('；'))}</p>` : ''}
</body></html>
`
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
