#!/usr/bin/env node
// Design V1.3 Phase A post-processing (no PIL: all pixel work happens in a browser canvas).
//   node qa/v13-post.mjs layout       B-vs-C layout identity (element boxes) + A-vs-B pixel changes inside/outside the six components
//   node qa/v13-post.mjs triptych     A | B | C strips per page × viewport × theme → qa/screenshots/v13/tri__*.jpg
//   node qa/v13-post.mjs analyze      colour / asset density for the 48 comparison shots → analysis.json + analysis.md
//   node qa/v13-post.mjs index        static qa/screenshots/v13/index.html
// Inputs: qa/screenshots/v13/*.jpg, qa/out/v13/layout/*.json, qa/out/v13/shots-report-v13.json (written by `v13.mjs shots`).
import fs from 'node:fs'
import path from 'node:path'
import { launchBrowser } from './lib/browser.mjs'
import { log, OUT_DIR, QA_DIR, ensureDir } from './lib/util.mjs'
import { PAGES } from './v13.mjs'

const SHOT_DIR = path.join(QA_DIR, 'screenshots', 'v13')
const LAYOUT_DIR = path.join(OUT_DIR, 'v13', 'layout')
const REPORT = path.join(OUT_DIR, 'v13', 'shots-report-v13.json')
const VPS = ['1440x900', '390x844']
const THEMES = ['light', 'dark']
const name = (p, vp, t, v) => `${p}__${vp}__${t}__${v}`
const dataUrl = (f) => 'data:image/jpeg;base64,' + fs.readFileSync(f).toString('base64')

async function withPage(fn) {
  const { browser } = await launchBrowser()
  try {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await page.goto('about:blank')
    try {
      return await fn(page)
    } finally {
      await ctx.close().catch(() => {})
    }
  } finally {
    await browser.close().catch(() => {})
  }
}

// in-page helpers (string-injected once)
const HELPERS = `
window.__load = (s) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = s })
window.__px = async (s) => { const i = await __load(s); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(i, 0, 0); return { w: c.width, h: c.height, d: x.getImageData(0, 0, c.width, c.height).data } }
`

/* ---------------- layout ---------------- */
async function layout() {
  const rows = []
  const all = [...PAGES.flatMap((p) => VPS.flatMap((vp) => THEMES.map((t) => [p.slug, vp, t]))), ...['today', 'song'].flatMap((p) => THEMES.map((t) => [p, '360x740', t]))]
  await withPage(async (page) => {
    await page.addScriptTag({ content: HELPERS })
    for (const [p, vp, t] of all) {
      const L = (v) => JSON.parse(fs.readFileSync(path.join(LAYOUT_DIR, name(p, vp, t, v) + '.json'), 'utf8'))
      const a = L('a'), b = L('b'), c = L('c')
      // Leaf drawing nodes (img / svg internals / placeholder label) are excluded: a cover below the fold may still be
      // loading in one run and already failed in the other — its box is the same, its content node is not.
      const LEAF = new Set(['IMG', 'svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'text', 'g', 'SMALL'])
      for (const x of [b, c]) x.boxes = x.boxes.filter((e) => !LEAF.has(e[0]))
      // B vs C: every element box identical
      let mism = 0
      const n = Math.max(b.boxes.length, c.boxes.length)
      const ex = []
      for (let i = 0; i < n; i++) {
        const x = b.boxes[i], y = c.boxes[i]
        if (!x || !y || x.join() !== y.join()) {
          mism++
          if (ex.length < 3) ex.push([x, y])
        }
      }
      // A vs B: share of changed pixels that fall inside the union of A/B component rects (first screen)
      const rects = [...a.comps, ...b.comps]
      const r = await page.evaluate(
        async ([fa, fb, rects]) => {
          const A = await __px(fa), B = await __px(fb)
          if (A.w !== B.w || A.h !== B.h) return { size: true }
          const inside = new Uint8Array(A.w * A.h)
          for (const [x0, y0, x1, y1] of rects) for (let y = Math.max(0, y0 - 1); y < Math.min(A.h, y1 + 1); y++) for (let x = Math.max(0, x0 - 1); x < Math.min(A.w, x1 + 1); x++) inside[y * A.w + x] = 1
          let diff = 0, inn = 0
          for (let i = 0, p = 0; i < A.d.length; i += 4, p++) {
            const dd = Math.abs(A.d[i] - B.d[i]) + Math.abs(A.d[i + 1] - B.d[i + 1]) + Math.abs(A.d[i + 2] - B.d[i + 2])
            if (dd > 60) {
              diff++
              if (inside[p]) inn++
            }
          }
          return { diff, inside: inn, total: A.w * A.h }
        },
        [dataUrl(path.join(SHOT_DIR, name(p, vp, t, 'a') + '.jpg')), dataUrl(path.join(SHOT_DIR, name(p, vp, t, 'b') + '.jpg')), rects],
      )
      rows.push({ page: p, vp, theme: t, bcBoxes: b.boxes.length, bcMismatch: mism, bcExamples: ex, abChangedPx: r.diff, abInsideComponents: r.inside, abOutsideShare: r.diff ? +(1 - r.inside / r.diff).toFixed(3) : 0, abChangedShare: +(r.diff / r.total).toFixed(4), aBoxes: a.boxes.length, bBoxes: b.boxes.length })
      log(`${p} ${vp} ${t}: B≡C boxes ${mism === 0 ? 'identical' : mism + ' MISMATCH'} (${b.boxes.length}); A→B changed ${(100 * r.diff / r.total).toFixed(2)}% of px, ${(100 * (1 - r.inside / Math.max(1, r.diff))).toFixed(1)}% of them outside component rects`)
    }
  })
  fs.writeFileSync(path.join(OUT_DIR, 'v13', 'layout-check.json'), JSON.stringify(rows, null, 1))
  return rows
}

/* ---------------- triptych ---------------- */
async function triptych() {
  const sets = [...PAGES.flatMap((p) => VPS.flatMap((vp) => THEMES.map((t) => [p.slug, vp, t]))), ...['today', 'song'].flatMap((p) => THEMES.map((t) => [p, '360x740', t]))]
  await withPage(async (page) => {
    await page.addScriptTag({ content: HELPERS })
    for (const [p, vp, t] of sets) {
      const srcs = ['a', 'b', 'c'].map((v) => dataUrl(path.join(SHOT_DIR, name(p, vp, t, v) + '.jpg')))
      const out = await page.evaluate(
        async ([srcs, title, dark]) => {
          const imgs = await Promise.all(srcs.map(__load))
          const w = imgs[0].width, h = imgs[0].height
          const s = w > 1000 ? 0.5 : 1
          const gap = 16, head = 34
          const c = document.createElement('canvas')
          c.width = Math.round(3 * w * s + 4 * gap)
          c.height = Math.round(h * s + head + gap)
          const x = c.getContext('2d')
          x.fillStyle = dark ? '#0b0f17' : '#e9ecf1'
          x.fillRect(0, 0, c.width, c.height)
          const L = ['A · V1.2 基线（生成式 · Fumen）', 'B · 真实素材（Fumen）', 'C · 真实素材（Viewer Teal）']
          x.font = '600 15px system-ui, sans-serif'
          imgs.forEach((im, i) => {
            const ox = gap + i * (w * s + gap)
            x.fillStyle = dark ? '#e9edf7' : '#17203a'
            x.fillText(L[i], ox, 22)
            x.drawImage(im, ox, head, w * s, h * s)
          })
          x.fillStyle = dark ? '#8994b2' : '#5f6983'
          x.font = '12px system-ui, sans-serif'
          x.textAlign = 'right'
          x.fillText(title, c.width - gap, 22)
          return c.toDataURL('image/jpeg', 0.8)
        },
        [srcs, `${p} · ${vp} · ${t} · data=real`, t === 'dark'],
      )
      fs.writeFileSync(path.join(SHOT_DIR, `tri__${p}__${vp}__${t}.jpg`), Buffer.from(out.split(',')[1], 'base64'))
    }
  })
  log(`triptychs: ${sets.length}`)
}

/* ---------------- analyze ---------------- */
// Thresholds (stated in analysis.md):
//   near-neutral: chroma (max−min)/255 < 0.12
//   dark tinted surface: chroma 0.12–0.20 and max channel ≤ 0.35 (night-indigo / deep-teal page, card and lane surfaces);
//     reported separately and not counted as saturated colour
//   brand hue band (Viewer Teal): hue 170°–200° with chroma ≥ 0.12
//   don band (朱): hue 0°–20° or 345°–360° with chroma ≥ 0.12 (reported separately; it is the V1.2 action colour)
//   other saturated: chroma ≥ 0.12 outside both bands
//   hue bins: twelve 30° bins over saturated pixels; a bin counts when it holds > 1.5 % of all sampled pixels
//   sampling: every 2nd pixel in x and y
const TH = { neutral: 0.12, darkTint: [0.2, 0.35], brand: [170, 200], binShare: 0.015 }
async function analyze() {
  const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'))
  const byName = Object.fromEntries(report.map((r) => [r.name, r]))
  const rows = []
  await withPage(async (page) => {
    await page.addScriptTag({ content: HELPERS })
    for (const p of PAGES)
      for (const vp of VPS)
        for (const t of THEMES)
          for (const v of ['a', 'b', 'c']) {
            const n = name(p.slug, vp, t, v)
            const rep = byName[n]
            const m = await page.evaluate(
              async ([src, rects, TH]) => {
                const I = await __px(src)
                const res = (excl) => {
                  let tot = 0, neu = 0, dark = 0, brand = 0, don = 0, other = 0
                  const bins = new Array(12).fill(0)
                  for (let y = 0; y < I.h; y += 2)
                    for (let x = 0; x < I.w; x += 2) {
                      if (excl && rects.some(([x0, y0, x1, y1]) => x >= x0 && x < x1 && y >= y0 && y < y1)) continue
                      const i = (y * I.w + x) * 4
                      const r = I.d[i] / 255, g = I.d[i + 1] / 255, b = I.d[i + 2] / 255
                      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), ch = mx - mn
                      tot++
                      if (ch < TH.neutral) { neu++; continue }
                      if (ch < TH.darkTint[0] && mx <= TH.darkTint[1]) { dark++; continue }
                      let h = mx === r ? ((g - b) / ch) % 6 : mx === g ? (b - r) / ch + 2 : (r - g) / ch + 4
                      h = (h * 60 + 360) % 360
                      bins[Math.floor(h / 30)]++
                      if (h >= TH.brand[0] && h <= TH.brand[1]) brand++
                      else if (h <= 20 || h >= 345) don++
                      else other++
                    }
                  const f = (k) => +(k / tot).toFixed(4)
                  return { samples: tot, neutral: f(neu), darkTint: f(dark), brandBand: f(brand), donBand: f(don), otherSaturated: f(other), hueBinsOver: bins.filter((k) => k / tot > TH.binShare).length }
                }
                return { whole: res(false), noCovers: res(true) }
              },
              [dataUrl(path.join(SHOT_DIR, n + '.jpg')), rep?.census?.coverRects || [], TH],
            )
            const cen = rep?.census || {}
            rows.push({ name: n, page: p.slug, vp, theme: t, variant: v, ...m, covers: cen.covers, icons: cen.icons, cssMarks: cen.cssMarks })
          }
  })
  fs.writeFileSync(path.join(SHOT_DIR, 'analysis.json'), JSON.stringify({ thresholds: { ...TH, sampling: 'every 2nd px', binsOver: '> 1.5 % of sampled pixels' }, rows }, null, 1))
  const pc = (x) => (x * 100).toFixed(1)
  const lines = [
    '# V1.3 Phase A · 首屏颜色与素材密度',
    '',
    '48 张对照截图（4 页 × 1440×900 / 390×844 × 浅 / 深 × A / B / C，data=real），在浏览器 canvas 里逐点统计（每隔 1 像素取样）。',
    '',
    '阈值：近中性 = 色度 (max−min)/255 < 0.12；深色有色底 = 色度 0.12–0.20 且最亮通道 ≤ 0.35（夜藍 / 深青的页面底、卡片与谱面带，单列，不算饱和色）；品牌色相带 = 170°–200°（Viewer Teal 约 185°）；朱色带 = 0°–20° 与 345°–360°；其他饱和色 = 其余色度 ≥ 0.12 的点；色相格 = 12 个 30° 格中占全部取样点 > 1.5% 的格数。「去掉曲绘」= 排除首屏所有封面矩形后再统计。',
    '',
    '素材计数来自 DOM（首屏可见）：真实曲绘 / 缺失占位 / 示例占位 / 生成式封面；真实图标（难度、王冠、评价、称号牌）；CSS 画的标记（V1.2 的难度块、王冠、评价圈、称号牌、鼓面头像）。',
    '',
    '| 截图 | 中性% | 深色有色底% | 品牌带% | 朱色% | 其他饱和% | 色相格 | 去曲绘：中性% / 品牌带% / 其他% / 色相格 | 曲绘 真实/缺失/示例/生成 | 图标 难度/王冠/评价/牌面 | CSS 标记 难度/王冠/评价/牌/头像 |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
  ]
  for (const r of rows) {
    const w = r.whole, x = r.noCovers, c = r.covers || {}, i = r.icons || {}, s = r.cssMarks || {}
    lines.push(`| ${r.name} | ${pc(w.neutral)} | ${pc(w.darkTint)} | ${pc(w.brandBand)} | ${pc(w.donBand)} | ${pc(w.otherSaturated)} | ${w.hueBinsOver} | ${pc(x.neutral)} / ${pc(x.brandBand)} / ${pc(x.otherSaturated)} / ${x.hueBinsOver} | ${c.real}/${c.missing}/${c.sample}/${c.generated} | ${i.diff}/${i.crown}/${i.rank}/${i.plate} | ${s.diff}/${s.crown}/${s.rank}/${s.plate}/${s.avatar} |`)
  }
  // averages per variant
  lines.push('', '## 按版本平均', '', '| 版本 | 中性% | 深色有色底% | 品牌带% | 朱色% | 其他饱和% | 色相格 | 去曲绘 中性% | 去曲绘 其他% | 去曲绘 色相格 |', '|---|---|---|---|---|---|---|---|---|---|')
  for (const v of ['a', 'b', 'c']) {
    const rs = rows.filter((r) => r.variant === v)
    const avg = (f) => rs.reduce((a, r) => a + f(r), 0) / rs.length
    lines.push(`| ${v.toUpperCase()} | ${pc(avg((r) => r.whole.neutral))} | ${pc(avg((r) => r.whole.darkTint))} | ${pc(avg((r) => r.whole.brandBand))} | ${pc(avg((r) => r.whole.donBand))} | ${pc(avg((r) => r.whole.otherSaturated))} | ${avg((r) => r.whole.hueBinsOver).toFixed(1)} | ${pc(avg((r) => r.noCovers.neutral))} | ${pc(avg((r) => r.noCovers.otherSaturated))} | ${avg((r) => r.noCovers.hueBinsOver).toFixed(1)} |`)
  }
  lines.push('', '## 按版本 × 主题平均（整屏）', '', '| 版本 · 主题 | 中性% | 深色有色底% | 品牌带% | 朱色% | 其他饱和% | 色相格 |', '|---|---|---|---|---|---|---|')
  for (const v of ['a', 'b', 'c'])
    for (const t of THEMES) {
      const rs = rows.filter((r) => r.variant === v && r.theme === t)
      const avg = (f) => rs.reduce((a, r) => a + f(r), 0) / rs.length
      lines.push(`| ${v.toUpperCase()} · ${t} | ${pc(avg((r) => r.whole.neutral))} | ${pc(avg((r) => r.whole.darkTint))} | ${pc(avg((r) => r.whole.brandBand))} | ${pc(avg((r) => r.whole.donBand))} | ${pc(avg((r) => r.whole.otherSaturated))} | ${avg((r) => r.whole.hueBinsOver).toFixed(1)} |`)
    }
  fs.writeFileSync(path.join(SHOT_DIR, 'analysis.md'), lines.join('\n') + '\n')
  log(`analysis: ${rows.length} rows`)
  return rows
}

/* ---------------- index ---------------- */
function index() {
  const files = fs.readdirSync(SHOT_DIR)
  const tri = files.filter((f) => f.startsWith('tri__'))
  const single = files.filter((f) => f.endsWith('.jpg') && !f.startsWith('tri__'))
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>V1.3 三版对照截图</title>
<style>
:root{color-scheme:light dark;--bg:#f3f5f8;--ink:#17203a;--ink2:#5f6983;--line:#d5dae4}
@media (prefers-color-scheme:dark){:root{--bg:#101728;--ink:#e9edf7;--ink2:#8994b2;--line:#26314f}}
body{margin:0;padding:24px 16px 64px;background:var(--bg);color:var(--ink);font:14px/1.6 system-ui,sans-serif}
main{max-width:1500px;margin:0 auto}h1{font-size:24px}h2{font-size:18px;margin-top:36px}
figure{margin:0 0 24px}figure img{display:block;max-width:100%;height:auto;border:1px solid var(--line)}
figcaption{color:var(--ink2);font-size:12px}ul{columns:3;font-size:12px}a{color:inherit}
@media (max-width:767px){ul{columns:1}}
</style></head><body><main>
<h1>Design V1.3 Phase A · 三版对照</h1>
<p>A = V1.2 基线（生成式素材 · Fumen），B = 真实素材 · Fumen，C = 真实素材 · Viewer Teal。生产构建、真实 Chrome、数据集 real，首屏截图（等首屏图片加载完成或失败）。颜色与素材密度见 <a href="analysis.md">analysis.md</a>（<a href="analysis.json">json</a>）。</p>
${PAGES.map((p) => `<h2>${p.slug} · ${p.route}</h2>\n` + tri.filter((f) => f.startsWith(`tri__${p.slug}__`)).map((f) => `<figure><img loading="lazy" src="${f}" alt="${esc(f)}"><figcaption>${esc(f)}</figcaption></figure>`).join('\n')).join('\n')}
<h2>单张截图</h2>
<ul>${single.map((f) => `<li><a href="${f}">${esc(f)}</a></li>`).join('')}</ul>
</main></body></html>
`
  fs.writeFileSync(path.join(SHOT_DIR, 'index.html'), html)
  log(`index.html: ${tri.length} triptychs, ${single.length} singles`)
}

const cmd = process.argv[2]
ensureDir(path.join(OUT_DIR, 'v13'))
try {
  if (cmd === 'layout') await layout()
  else if (cmd === 'triptych') await triptych()
  else if (cmd === 'analyze') await analyze()
  else if (cmd === 'index') index()
  else {
    console.log('usage: node qa/v13-post.mjs layout | triptych | analyze | index')
    process.exit(2)
  }
} catch (e) {
  console.error(e.stack || e.message)
  process.exit(1)
}
