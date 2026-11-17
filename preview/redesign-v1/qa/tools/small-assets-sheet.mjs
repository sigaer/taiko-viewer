#!/usr/bin/env node
// Design V1.3 Phase B · G5：小尺寸素材的对照图。原图（浏览器在显示尺寸下缩放）与缩小版（WebP / PNG）并排，
// 每个实际使用的绘制尺寸一行，在 deviceScaleFactor 1 与 2 下各截一张。
//   node qa/tools/small-assets-sheet.mjs [outDir] [--no-build]   默认输出 qa/screenshots/v13-final/
import path from 'node:path'
import { build, startPreview, stopServer } from '../lib/server.mjs'
import { launchBrowser } from '../lib/browser.mjs'
import { ensureDir, log, QA_DIR } from '../lib/util.mjs'

const out = process.argv.slice(2).find((a) => !a.startsWith('--')) || path.join(QA_DIR, 'screenshots', 'v13-final')
const noBuild = process.argv.includes('--no-build')
// 实际使用的绘制尺寸（组件里的 draw / px）
const ROWS = [
  { dir: 'rank', names: ['2', '3', '4', '5', '6', '7', '8'], draws: [24, 28, 35, 40], sizes: [56, 80] },
  { dir: 'crown', names: ['clear', 'full', 'dondaful'], draws: [16, 18, 22, 30, 48], sizes: [36, 60, 96] },
]
const pick = (sizes, px) => sizes.find((s) => s >= px) ?? sizes[sizes.length - 1]

function html(dpr) {
  const cells = []
  for (const r of ROWS)
    for (const d of r.draws) {
      const s = pick(r.sizes, d * dpr)
      cells.push(`<tr><th>${r.dir} ${d}px<br><small>${dpr}× → ${r.dir}/${s}/</small></th>
        <td>${r.names.map((n) => `<img src="game/${r.dir}/${n}.png" width="${d}" height="${d}">`).join('')}</td>
        <td>${r.names.map((n) => `<img src="game/${r.dir}/${s}/${n}.webp" width="${d}" height="${d}">`).join('')}</td>
        <td>${r.names.map((n) => `<img src="game/${r.dir}/${s}/${n}.png" width="${d}" height="${d}">`).join('')}</td></tr>`)
    }
  return `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;padding:12px;font:12px system-ui,sans-serif;background:#f9fdfc;color:#203f43}
    .dark{background:#1a383d;color:#e4f4f1}
    table{border-collapse:collapse}th,td{padding:6px 10px;border-bottom:1px solid #ccdfdc;text-align:left;vertical-align:middle}
    th small{font-weight:400;color:#4d696c}.dark th small{color:#a3c0c0}
    img{margin-right:6px;vertical-align:middle;object-fit:contain}
    h2{font-size:13px;margin:8px 0}
  </style>
  ${['', 'dark'].map((cls) => `<div class="${cls}" style="padding:8px"><h2>deviceScaleFactor ${dpr} · ${cls ? '深色表面 #1a383d' : '浅色表面 #f9fdfc'}</h2>
  <table><tr><th>绘制尺寸</th><th>原图（浏览器缩放）</th><th>缩小版 WebP</th><th>缩小版 PNG</th></tr>${cells.join('')}</table></div>`).join('')}`
}

async function main() {
  ensureDir(out)
  if (!noBuild) {
    const b = await build({ retries: 1 })
    if (!b.ok) throw new Error('build failed')
  }
  const srv = await startPreview(4311)
  const { browser } = await launchBrowser()
  try {
    for (const dpr of [1, 2]) {
      const ctx = await browser.newContext({ viewport: { width: 900, height: 900 }, deviceScaleFactor: dpr })
      try {
        const page = await ctx.newPage()
        await page.goto(srv.url, { waitUntil: 'load' })
        await page.setContent(html(dpr).replace('<meta charset="utf-8">', `<meta charset="utf-8"><base href="${srv.url}">`), { waitUntil: 'load' })
        await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 15000 })
        const f = path.join(out, `small-assets__${dpr}x.png`)
        await page.screenshot({ path: f, fullPage: true })
        log('sheet: ' + f)
      } finally {
        await ctx.close().catch(() => {})
      }
    }
  } finally {
    await browser.close().catch(() => {})
    await stopServer(srv)
  }
}
main().catch((e) => {
  console.error(e.stack || e.message)
  process.exit(1)
})
