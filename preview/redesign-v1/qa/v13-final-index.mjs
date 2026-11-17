#!/usr/bin/env node
// qa/screenshots/v13-final/index.html：C+ 最终截图的索引（无浏览器，静态生成）。
import fs from 'node:fs'
import path from 'node:path'
import { QA_DIR, log } from './lib/util.mjs'

const DIR = path.join(QA_DIR, 'screenshots', 'v13-final')
const files = fs.readdirSync(DIR)
const cmp = fs.existsSync(path.join(DIR, 'compare')) ? fs.readdirSync(path.join(DIR, 'compare')) : []
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const ORDER = ['today', 'songs', 'song', 'rating', 'scores', 'progress', 'growth', 'goals', 'community', 'thread', 'profile', 'me', 'account', 'login', 'titles', 'dan', 'tools', 'notifications', 'palette', 'syncpanel', 'sheet']
const fig = (src) => `<figure><img loading="lazy" src="${src}" alt="${esc(src)}"><figcaption>${esc(src)}</figcaption></figure>`
const pairs = ORDER.flatMap((slug) => ['1440x900', '390x844', '820x1180', '360x740'].map((vp) => `${slug}__${vp}.jpg`).filter((f) => files.includes(f)))
const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>V1.3 C+ 最终截图</title>
<style>
:root{color-scheme:light dark;--bg:#eaf6f5;--ink:#203f43;--ink2:#4d696c;--line:#ccdfdc}
@media (prefers-color-scheme:dark){:root{--bg:#0c2023;--ink:#e4f4f1;--ink2:#a3c0c0;--line:#2f5257}}
body{margin:0;padding:24px 16px 64px;background:var(--bg);color:var(--ink);font:14px/1.6 system-ui,sans-serif}
main{max-width:1500px;margin:0 auto}h1{font-size:24px}h2{font-size:18px;margin-top:36px}
figure{margin:0 0 24px}figure img{display:block;max-width:100%;height:auto;border:1px solid var(--line)}
figcaption{color:var(--ink2);font-size:12px}a{color:inherit}
</style></head><body><main>
<h1>Design V1.3 Final（C+）· 截图</h1>
<p>生产构建、真实 Chrome、默认状态（C+、full 数据、已同步）。每张是同一页面的浅色 | 深色并排。报告见 docs/21-v1.3-visual-acceptance.md。Phase A 的三版对照在 ../v13/（历史）。</p>
<h2>关键页面</h2>
${pairs.map(fig).join('\n')}
<h2>缺失素材（屏蔽曲绘域名）</h2>
${files.filter((f) => f.startsWith('blocked__')).map(fig).join('\n')}
<h2>小尺寸素材（G5）：原图 / WebP / PNG，1× 与 2×</h2>
${files.filter((f) => f.startsWith('small-assets__')).map(fig).join('\n')}
<h2>Stage 1：C（Phase A）→ C+ 前后对照</h2>
<p>朱色带与品牌色带的像素统计见 <a href="g3-analysis.json">g3-analysis.json</a>。</p>
${cmp.filter((f) => f.startsWith('pair__')).map((f) => fig('compare/' + f)).join('\n')}
<h2>C+ 360 宽</h2>
${cmp.filter((f) => f.includes('__360x740__')).map((f) => fig('compare/' + f)).join('\n')}
</main></body></html>
`
fs.writeFileSync(path.join(DIR, 'index.html'), html)
log(`index.html: ${pairs.length} pairs`)
