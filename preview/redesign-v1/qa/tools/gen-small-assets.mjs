#!/usr/bin/env node
// Design V1.3 Phase B · G5：评价与王冠的小尺寸素材。可重复运行：输出完全由原图决定。
//   node qa/tools/gen-small-assets.mjs            生成 public/game/{rank,crown}/{size}/*.{webp,png}，打印每个文件前后字节数
//   node qa/tools/gen-small-assets.mjs --check    只核对已生成的文件尺寸（不写文件）
//
// 规则（docs/19 G5）：只做等比缩小，不裁切、不改色、不锐化；保留原图。
// 这里没有 PIL / sharp：用系统 Chrome（playwright-core）的 canvas 重采样——每次最多缩小一半（逐级 2×，
// imageSmoothingQuality = 'high'），最后一步缩到目标尺寸；输出带透明通道的 WebP（quality 0.92）与同尺寸 PNG（回退）。
// 原图都是正方形（评价 200×200、王冠 167×167），所以目标边长即宽高。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { launchBrowser } from '../lib/browser.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const GAME = path.join(ROOT, 'public', 'game')
export const SETS = [
  { dir: 'rank', files: ['2', '3', '4', '5', '6', '7', '8'], sizes: [56, 80] },
  { dir: 'crown', files: ['clear', 'full', 'dondaful'], sizes: [36, 60, 96] },
]
const WEBP_Q = 0.92
const check = process.argv.includes('--check')

async function main() {
  const { browser } = await launchBrowser()
  const rows = []
  try {
    const page = await browser.newPage()
    await page.goto('about:blank')
    for (const set of SETS)
      for (const f of set.files) {
        const srcFile = path.join(GAME, set.dir, f + '.png')
        const orig = fs.statSync(srcFile).size
        const data = 'data:image/png;base64,' + fs.readFileSync(srcFile).toString('base64')
        for (const size of set.sizes) {
          const outDir = path.join(GAME, set.dir, String(size))
          fs.mkdirSync(outDir, { recursive: true })
          if (check) {
            rows.push({ file: `${set.dir}/${size}/${f}`, exists: fs.existsSync(path.join(outDir, f + '.webp')) && fs.existsSync(path.join(outDir, f + '.png')) })
            continue
          }
          const out = await page.evaluate(
            async ([src, size, q]) => {
              const img = await new Promise((res, rej) => {
                const i = new Image()
                i.onload = () => res(i)
                i.onerror = rej
                i.src = src
              })
              let cur = img
              let w = img.width
              let h = img.height
              // 逐级减半，直到下一步不再大于目标的 2 倍
              while (w / 2 >= size) {
                const c = document.createElement('canvas')
                c.width = Math.round(w / 2)
                c.height = Math.round(h / 2)
                const x = c.getContext('2d')
                x.imageSmoothingEnabled = true
                x.imageSmoothingQuality = 'high'
                x.drawImage(cur, 0, 0, c.width, c.height)
                cur = c
                w = c.width
                h = c.height
              }
              const c = document.createElement('canvas')
              c.width = size
              c.height = Math.round((size * img.height) / img.width)
              const x = c.getContext('2d')
              x.imageSmoothingEnabled = true
              x.imageSmoothingQuality = 'high'
              x.drawImage(cur, 0, 0, c.width, c.height)
              return { webp: c.toDataURL('image/webp', q), png: c.toDataURL('image/png'), w: c.width, h: c.height, srcW: img.width, srcH: img.height }
            },
            [data, size, WEBP_Q],
          )
          const webp = Buffer.from(out.webp.split(',')[1], 'base64')
          const png = Buffer.from(out.png.split(',')[1], 'base64')
          if (!out.webp.startsWith('data:image/webp')) throw new Error('this Chrome cannot encode WebP')
          fs.writeFileSync(path.join(outDir, f + '.webp'), webp)
          fs.writeFileSync(path.join(outDir, f + '.png'), png)
          rows.push({ file: `${set.dir}/${size}/${f}`, src: `${out.srcW}×${out.srcH}`, out: `${out.w}×${out.h}`, origBytes: orig, webpBytes: webp.length, pngBytes: png.length })
        }
      }
  } finally {
    await browser.close().catch(() => {})
  }
  for (const r of rows) console.log(check ? `${r.file}: ${r.exists ? 'ok' : 'MISSING'}` : `${r.file}  ${r.src} → ${r.out}  original ${r.origBytes} B → webp ${r.webpBytes} B / png ${r.pngBytes} B`)
  if (!check) fs.writeFileSync(path.join(GAME, 'small-assets.json'), JSON.stringify({ generator: 'qa/tools/gen-small-assets.mjs', webpQuality: WEBP_Q, files: rows }, null, 1) + '\n')
}

main().catch((e) => {
  console.error(e.stack || e.message)
  process.exit(1)
})
