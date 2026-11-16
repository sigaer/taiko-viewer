#!/usr/bin/env node
// 对比度检查（D11）：解析 tokens.css，按浅色 / 深色分别解析 var() 链，计算 WCAG 2.x 对比度。
// 用法：node src/styles/contrast-check.mjs [--json]
// 任一检查项不达标时退出码为 1。只读、无依赖，不在构建中运行。
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(join(here, 'tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

/* ---------- 解析：只读取顶层规则块（跳过 @media） ---------- */
function topLevelBlocks(src) {
  const out = []
  let i = 0
  while (i < src.length) {
    const open = src.indexOf('{', i)
    if (open < 0) break
    const selector = src.slice(i, open).trim()
    let depth = 1
    let j = open + 1
    while (j < src.length && depth) {
      if (src[j] === '{') depth++
      else if (src[j] === '}') depth--
      j++
    }
    out.push({ selector, body: src.slice(open + 1, j - 1) })
    i = j
  }
  return out
}
function decls(body) {
  const m = {}
  for (const part of body.split(';')) {
    const k = part.indexOf(':')
    if (k < 0) continue
    const name = part.slice(0, k).trim()
    if (name.startsWith('--')) m[name] = part.slice(k + 1).trim()
  }
  return m
}
const blocks = topLevelBlocks(css).filter((b) => !b.selector.startsWith('@'))
function themeVars(theme) {
  const vars = {}
  for (const b of blocks) {
    const sels = b.selector.split(',').map((s) => s.trim())
    const applies = sels.some((s) => s === ':root' || s === `:root[data-theme='${theme}']`)
    if (applies) Object.assign(vars, decls(b.body))
  }
  return vars
}

/* ---------- 颜色运算 ---------- */
function resolve(expr, vars, depth = 0) {
  if (depth > 30) throw new Error('var() 循环：' + expr)
  return expr.replace(/var\((--[\w-]+)(?:\s*,\s*([^()]*))?\)/g, (_, name, fb) => {
    const v = vars[name] ?? fb
    if (v == null) throw new Error('未定义的 token：' + name)
    return resolve(v, vars, depth + 1)
  })
}
function splitTop(s, sep = ',') {
  const out = []
  let depth = 0
  let cur = ''
  for (const ch of s) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === sep && !depth) {
      out.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}
// 返回 [r, g, b, a]（0–255, 0–1）
function parse(c) {
  c = c.trim()
  if (c === 'transparent') return [0, 0, 0, 0]
  if (c.startsWith('#')) {
    let h = c.slice(1)
    if (h.length === 3) h = [...h].map((x) => x + x).join('')
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1]
  }
  let m = c.match(/^rgba?\((.*)\)$/)
  if (m) {
    const [rgb, a] = m[1].split('/')
    const p = rgb.trim().split(/[\s,]+/).map(Number)
    return [p[0], p[1], p[2], a != null ? parseFloat(a) : p[3] ?? 1]
  }
  m = c.match(/^color-mix\(in srgb,(.*)\)$/s)
  if (m) {
    const [A, B] = splitTop(m[1])
    const pa = A.match(/^(.*?)\s+([\d.]+)%$/)
    const pb = B.match(/^(.*?)\s+([\d.]+)%$/)
    let wa = pa ? +pa[2] / 100 : null
    let wb = pb ? +pb[2] / 100 : null
    if (wa == null && wb == null) wa = wb = 0.5
    else if (wa == null) wa = 1 - wb
    else if (wb == null) wb = 1 - wa
    const ca = parse(pa ? pa[1] : A)
    const cb = parse(pb ? pb[1] : B)
    const t = wa + wb
    wa /= t
    wb /= t
    // srgb 预乘 alpha 插值
    const a = ca[3] * wa + cb[3] * wb
    if (!a) return [0, 0, 0, 0]
    const ch = (i) => (ca[i] * ca[3] * wa + cb[i] * cb[3] * wb) / a
    return [ch(0), ch(1), ch(2), a]
  }
  throw new Error('无法解析颜色：' + c)
}
const over = (fg, bg) => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3])).concat(1)
function lum([r, g, b]) {
  const f = (v) => {
    v /= 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
export function ratio(fg, bg) {
  const a = lum(fg)
  const b = lum(bg)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}
function color(expr, vars, base) {
  const c = parse(resolve(expr.startsWith('--') ? `var(${expr})` : expr, vars))
  return c[3] < 1 && base ? over(c, base) : c
}
const hex = (c) => '#' + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')

/* ---------- 检查项 ---------- */
const tint = (c, p, on = '--surface') => `color-mix(in srgb, var(${c}) ${p}%, var(${on}))`
const DIFFS = ['easy', 'normal', 'hard', 'oni', 'ura']
const RANKS = ['iki1', 'iki2', 'iki3', 'miyabi1', 'miyabi2', 'miyabi3']
const TEXT = 4.5
const UI = 3

const checks = []
const add = (group, fg, bg, min = TEXT) => checks.push({ group, fg, bg, min })

for (const ink of ['--ink', '--ink-2', '--ink-3']) for (const bg of ['--bg', '--bg-sunk', '--surface', '--surface-2']) add('正文', ink, bg)
for (const bg of ['--surface', '--bg', '--don-wash']) add('音符色文字', '--don-ink', bg)
for (const bg of ['--surface', '--bg', '--ka-wash']) add('音符色文字', '--ka-ink', bg)
for (const bg of ['--surface', '--roll-wash']) add('音符色文字', '--roll-ink', bg)
for (const bg of ['--surface', '--ok-wash']) add('状态色文字', '--ok', bg)
for (const bg of ['--surface', '--danger-wash', '--don-wash']) add('状态色文字', '--danger', bg)
add('状态色文字', '--warn', '--surface')
add('状态色文字', '--warn', '--roll-wash')
add('实色填充', '--ink-on-solid', '--don-solid')
add('实色填充', '--bg', '--ink') // .btn-ink / .chip[aria-pressed]
add('实色填充', '--toast-ink', '--toast-bg')
for (const d of DIFFS) {
  add('难度文字', `--diff-${d}-ink`, '--surface')
  add('难度文字', `--diff-${d}-ink`, tint(`--diff-${d}`, 14))
  add('难度填充', '--ink-on-solid', `--diff-${d}`)
}
for (const r of RANKS) {
  add('评价文字', `--rank-${r}-ink`, '--surface')
  add('评价文字', `--rank-${r}-ink`, tint(`--rank-${r}`, 14))
}
add('评价文字', '--bg', '--rank-kiwami')
add('王冠文字', '--crown-fc-ink', '--surface')
add('王冠文字', '--crown-fc-ink', tint('--crown-fc', 20))
for (const t of ['--lane-ink', '--lane-ink-2', '--lane-ink-3']) add('谱面带文字', t, '--lane')
add('谱面带文字', '--lane-ink-3', tint('--lane-ink', 9, '--lane')) // 选中列的底
add('非文字', '--ctl-border', '--surface', UI)
add('非文字', '--ctl-border', '--bg', UI)
add('非文字', '--ctl-border', '--surface-2', UI)
add('焦点环', '--focus-ring', '--surface', UI)
add('焦点环', '--focus-ring', '--bg', UI)
add('焦点环', '--focus-ring', '--bg-sunk', UI)
add('焦点环', '--focus-ring', '--focus-gap', UI)
add('焦点环', '--focus-gap', '--don-solid', UI) // 主按钮：间隙把实色环与按钮分开
add('焦点环', '--lane-focus', '--lane', UI)
add('焦点环', '--lane-focus', tint('--lane-ink', 9, '--lane'), UI)
for (const s of ['--status-attn', '--status-fail', '--status-ok']) for (const bg of ['--surface', '--bg']) add('状态点', s, bg, UI)
// 舞台面（I1）：.stage 内 --ink / --ink-2 / --ink-3 映射到这些值；--surface → stage-surface，--bg-sunk / --surface-2 → stage-sunk
for (const ink of ['--stage-ink', '--stage-ink-2', '--stage-ink-3']) for (const bg of ['--stage-bg', '--stage-sunk', '--stage-surface']) add('舞台文字', ink, bg)
for (const bg of ['--stage-bg', '--stage-ka-wash']) add('舞台文字', '--stage-ka-ink', bg)
for (const bg of ['--stage-bg', '--stage-roll-wash']) add('舞台文字', '--stage-roll-ink', bg)
for (const bg of ['--stage-bg', '--stage-don-wash']) add('舞台文字', '--stage-don-ink', bg)
add('舞台文字', '--stage-bg', '--stage-ink') // .btn-ink / .chip[aria-pressed]：底 = --ink，字 = --bg
add('舞台非文字', '--stage-ctl-border', '--stage-bg', UI)
add('舞台非文字', '--stage-ctl-border', '--stage-surface', UI)
add('舞台非文字', '--stage-focus', '--stage-bg', UI)
add('舞台非文字', '--stage-focus', '--stage-surface', UI)
// 版块色（I4）：色点 / 色条，非文字，在 --surface 与 --bg 上 ≥ 3:1
const SECTIONS = ['official', 'events', 'beginner-help', 'score-guides', 'dojo', 'achievements', 'arcade', 'general', 'creative']
for (const s of SECTIONS) for (const bg of ['--surface', '--bg']) add('版块色', `--section-${s}`, bg, UI)

function run(theme) {
  const vars = themeVars(theme)
  return checks.map((c) => {
    const bg = color(c.bg, vars, color('--bg', vars))
    const fg = color(c.fg, vars, bg)
    const r = ratio(fg, bg)
    return { ...c, theme, fgHex: hex(fg), bgHex: hex(bg), ratio: r, pass: r >= c.min }
  })
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const rows = [...run('light'), ...run('dark')]
  if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 2))
  else {
    const light = rows.filter((r) => r.theme === 'light')
    const dark = rows.filter((r) => r.theme === 'dark')
    const short = (s) => (s.startsWith('color-mix') ? s.replace(/color-mix\(in srgb, var\((--[\w-]+)\) (\d+)%, var\((--[\w-]+)\)\)/, '$1@$2%/$3') : s)
    console.log('组'.padEnd(8) + '前景'.padEnd(18) + '背景'.padEnd(26) + '浅色'.padStart(8) + '深色'.padStart(8) + '  min')
    light.forEach((l, i) => {
      const d = dark[i]
      const f = (r) => (r.pass ? '' : '✗') + r.ratio.toFixed(2)
      console.log(l.group.padEnd(8) + l.fg.padEnd(18) + short(l.bg).padEnd(26) + f(l).padStart(8) + f(d).padStart(8) + '  ' + l.min)
    })
    const bad = rows.filter((r) => !r.pass)
    console.log(bad.length ? `\n${bad.length} 项未达标` : `\n全部 ${rows.length} 项达标`)
    process.exitCode = bad.length ? 1 : 0
  }
}
export { run, themeVars, parse, resolve }
