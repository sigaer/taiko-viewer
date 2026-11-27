// node src/assets.test.mjs —— 真实素材映射测试（docs/19 G9）。只读、无依赖。
// 评价：值 2–8 ↔ 中日文名（与正式站 utils/scoreRank.ts 一致，快照在 qa/fixtures/scoreRank.main.json）↔ 文件 ↔ md5；0 / 1 没有图。
// 难度 1–5、王冠三档（含正式站的优先级规则）、称号牌 12 张（对 manifest）。md5 的期望值取自 public/game/README.md 的来源表
// （复制时已与 `git show origin/main:<path>` 核对）。能访问 git 时，再直接对一次 origin/main 的 scoreRank.ts。
import { readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

globalThis.location ??= { search: '', hash: '' }
const here = dirname(fileURLToPath(import.meta.url))
const ROOT = join(here, '..')
const GAME = join(ROOT, 'public', 'game')
const { RANKS, DIFFS, CROWNS } = await import('./mock/catalog.js')
const { diffImage, rankFile, crownFile, crownFromCounts } = await import('./components/gamemap.js')
const { PLATES } = await import('./mock/titles.js')
const { SETS } = { SETS: [{ dir: 'rank', sizes: [56, 80] }, { dir: 'crown', sizes: [36, 60, 96] }] }

let pass = 0
let fail = 0
function ok(cond, name, extra = '') {
  if (cond) pass++
  else fail++
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`)
}
const md5 = (f) => createHash('md5').update(readFileSync(f)).digest('hex')

// README 来源表：| `public/game/x` | `taiko_viewer/...` | bytes | md5 |
const README = readFileSync(join(GAME, 'README.md'), 'utf8')
const EXPECT = {}
for (const m of README.matchAll(/\|\s*`public\/game\/([^`]+)`\s*\|\s*`([^`]+)`\s*\|\s*(\d+)\s*\|\s*([0-9a-f]{32})\s*\|/g)) EXPECT[m[1]] = { src: m[2], bytes: +m[3], md5: m[4] }
const checkFile = (rel, label) => {
  const f = join(GAME, rel)
  const e = EXPECT[rel]
  ok(existsSync(f) && !!e && md5(f) === e.md5 && readFileSync(f).length === e.bytes, `${label}：${rel} 与 ${e?.src || '?'} 逐字节相同`, e ? e.md5 : 'README 里没有这一行')
}

/* ---------------- 评价 ---------------- */
const fixture = JSON.parse(readFileSync(join(ROOT, 'qa', 'fixtures', 'scoreRank.main.json'), 'utf8')).definitions
let live = null
try {
  const ts = execFileSync('git', ['show', 'origin/main:taiko_viewer/utils/scoreRank.ts'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  live = [...ts.matchAll(/value: (\d+), zhName: "([^"]+)", jaName: "([^"]+)"/g)].map((m) => ({ value: +m[1], zh: m[2], ja: m[3] }))
} catch {
  /* 没有 git 或没有 origin/main：只用快照 */
}
if (live) ok(JSON.stringify(live) === JSON.stringify(fixture), '快照 qa/fixtures/scoreRank.main.json 与 origin/main 的 scoreRank.ts 一致')
else console.log('SKIP  无法读取 origin/main，scoreRank 只对快照核对')
for (const def of fixture) {
  const r = RANKS[def.value]
  if (def.value <= 1) {
    ok(rankFile(def.value) === null, `评价 ${def.value}（${def.zh}）没有图`)
    continue
  }
  ok(r && r.v === def.value && r.zh === def.zh && r.ja === def.ja, `评价 ${def.value}：原型名称 ${r?.zh} / ${r?.ja} = 正式站 ${def.zh} / ${def.ja}`)
  ok(rankFile(def.value) === String(def.value), `评价 ${def.value} → rank/${def.value}.png`)
  checkFile(`rank/${def.value}.png`, `评价 ${def.value}`)
}
ok(rankFile(9) === null && rankFile(-1) === null && rankFile(undefined) === null, '超出 0–8 的评价值没有图')
// 看图核对的结果（docs/19 G9 表）：2 白「粋」、3 铜、4 银蓝、5 金「雅」、6 粉、7 紫、8 彩虹「極」—— 这里只能核对名称与文件的对应；图上的字与颜色由人看图确认

/* ---------------- 难度 ---------------- */
const DIFF_NAMES = { 1: ['简单', 'かんたん'], 2: ['普通', 'ふつう'], 3: ['困难', 'むずかしい'], 4: ['魔王', 'おに'], 5: ['魔王（里）', 'おに（裏）'] }
for (let d = 1; d <= 5; d++) {
  ok(diffImage(d) === `game/diff/${d}.png` && DIFFS[d].zh === DIFF_NAMES[d][0] && DIFFS[d].ja === DIFF_NAMES[d][1], `难度 ${d}（${DIFFS[d].zh}）→ diff/${d}.png`)
  checkFile(`diff/${d}.png`, `难度 ${d}`)
}
ok(diffImage(0) === null && diffImage(6) === null, '难度 0 / 6 没有图')

/* ---------------- 王冠 ---------------- */
const CROWN_EXPECT = [
  [2, 'dondaful', '全良'],
  [1, 'full', '全连'],
  [0, 'clear', '通关'],
]
for (const [v, file, zh] of CROWN_EXPECT) {
  ok(crownFile(v) === file && CROWNS[v].zh === zh, `王冠 ${v}（${zh}）→ crown/${file}.png`)
  checkFile(`crown/${file}.png`, `王冠 ${zh}`)
}
ok(crownFile(-1) === null && crownFile(null) === null, '已游玩 / 未游玩没有王冠图')
// 正式站优先级：全良 > 全连 > 通关 > 已游玩；没有记录 = 未游玩
ok(crownFromCounts({ dondafulComboCnt: 1, fullComboCnt: 3, clearCnt: 9 }) === 2, '优先级：有全良次数 → 全良（即使也有全连、通关）')
ok(crownFromCounts({ dondafulComboCnt: 0, fullComboCnt: 2, clearCnt: 5 }) === 1, '优先级：没有全良、有全连 → 全连')
ok(crownFromCounts({ clearCnt: 1 }) === 0, '优先级：只有通关 → 通关')
ok(crownFromCounts({ clearCnt: 0, fullComboCnt: 0, dondafulComboCnt: 0 }) === -1, '有记录、三项都是 0 → 已游玩')
ok(crownFromCounts(null) === null, '没有记录 → 未游玩')

/* ---------------- 称号牌 ---------------- */
const manifest = JSON.parse(readFileSync(join(GAME, 'plate', 'manifest.json'), 'utf8'))
checkFile('plate/manifest.json', '称号牌清单')
for (const it of manifest.items) {
  const p = PLATES[it.plateId]
  ok(p && p.req === it.usage.requirementType && p.scope === it.usage.difficultyScope && p.w === it.width && p.h === it.height, `牌面 ${it.plateId}：${it.usage.requirementType} × ${it.usage.difficultyScope}，${it.width}×${it.height}`)
  checkFile(`plate/name_plate_${it.plateId}_slice.png`, `牌面 ${it.plateId}`)
}
for (const k of ['custom_sliver', 'custom_gold', 'custom_rainbow']) {
  const p = PLATES[k]
  ok(p && p.w === 556 && p.h === 90 && p.scope === 'custom', `自定义牌面 ${k}：556×90`)
  checkFile(`plate/name_plate_${k}.png`, `自定义牌面 ${k}`)
}
ok(Object.keys(PLATES).length === 12, '牌面一共 12 张（清单 9 + 自定义 3）', String(Object.keys(PLATES).length))

/* ---------------- 小尺寸素材（G5）：每个尺寸都有 WebP 与 PNG ---------------- */
for (const set of SETS)
  for (const size of set.sizes)
    for (const name of set.dir === 'rank' ? ['2', '3', '4', '5', '6', '7', '8'] : ['clear', 'full', 'dondaful'])
      ok(existsSync(join(GAME, set.dir, String(size), name + '.webp')) && existsSync(join(GAME, set.dir, String(size), name + '.png')), `${set.dir}/${size}/${name}.webp + .png`)

/* ---------------- 默认头像与品牌标志（G6） ---------------- */
checkFile('avatar/default-avatar.svg', '默认头像')
checkFile('brand/logo-256.webp', '完整标志')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
