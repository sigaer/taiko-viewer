<script setup>
import { computed, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import { L } from '../store'

/**
 * TimeStack —— 成长档案的「时间栈」（V3）：指标折线、关注方向带、里程碑音符、练习密度条
 * 上下对齐、共用同一条横轴与同一个读数光标。开放图表：没有面板框，≤ 4 条横向参考线，横轴标签只在底部出现一次。
 *
 * props:
 *   points  [{ daysAgo, label, v }]   指标序列，按时间先后（今天在最后）；决定横轴范围（最早一点 → 今天）
 *   marks   [{ daysAgo, type, text }] 里程碑，画在折线下方的专用行；type → 音符样式：
 *                                     'df' 新全良（朱面 + 白环 + 金外环）、'fc' 新全连（朱面 + 金环）、
 *                                     'rating' Rating 里程碑（山吹）、'dan' 段位（山吹大音符）、'goal' 目标达成（朱）
 *   bands   [{ fromDaysAgo, toDaysAgo, key, label, current }]  关注方向时段（浅葱带；current = 进行中）
 *   days    [{ daysAgo, played, facts }]  每日练习：底部细条，有游玩画短刻度，有进展画小音符
 *   digits  number   读数小数位（默认 2）
 *   tone    string   折线颜色（默认 'var(--don)'）
 *   label   string   图表的读屏名称（默认「成长时间栈」）
 *   height  number   折线区高度 px（默认 180）
 *
 * 交互：悬停 / 点按 / 拖动移动光标（一条贯穿所有行的竖线 + 读数：日期、数值、当天的里程碑 / 关注方向 / 练习）。
 * 键盘：聚焦后 ← → 移动光标，Home / End 到首尾，Esc 收起读数；读数同时通过 aria-live 播报。
 * 读屏另有一张视觉隐藏的里程碑表。宽度 < 480px 时关注方向标签截断、里程碑标签隐藏（仍在读数中显示）。
 */
const props = defineProps({
  points: { type: Array, required: true },
  marks: { type: Array, default: () => [] },
  bands: { type: Array, default: () => [] },
  days: { type: Array, default: () => [] },
  digits: { type: Number, default: 2 },
  tone: { type: String, default: 'var(--don)' },
  label: { type: String, default: '' },
  height: { type: Number, default: 180 },
})

const uid = useId()
const el = ref(null)
const w = ref(640)
let ro
onMounted(() => {
  ro = new ResizeObserver(([e]) => (w.value = Math.max(240, Math.round(e.contentRect.width))))
  ro.observe(el.value)
})
onBeforeUnmount(() => ro?.disconnect())
const narrow = computed(() => w.value < 480)

/* ---------- 版面：所有行共用 pad.l / pad.r ---------- */
const pad = { l: 40, r: 14 }
const rows = computed(() => {
  const plotTop = 10
  const plotBottom = plotTop + props.height
  const bandTop = plotBottom + 12
  const bandH = props.bands.length ? 20 : 0
  const markTop = bandTop + bandH + (bandH ? 8 : 0)
  const markH = props.marks.length ? 26 : 0
  const dayTop = markTop + markH + (markH ? 6 : 0)
  const dayH = props.days.length ? 14 : 0
  const axisTop = dayTop + dayH + 6
  return { plotTop, plotBottom, bandTop, bandH, markTop, markH, dayTop, dayH, axisTop, total: axisTop + 16 }
})

/* ---------- 共享横轴：daysAgo → x ---------- */
const span = computed(() => Math.max(1, props.points[0]?.daysAgo ?? 1))
const X = (daysAgo) => pad.l + ((span.value - Math.min(span.value, Math.max(0, daysAgo))) / span.value) * (w.value - pad.l - pad.r)
const inRange = (d) => d >= 0 && d <= span.value

/* ---------- 折线 ---------- */
const dom = computed(() => {
  const vs = props.points.map((p) => p.v)
  const lo = Math.min(...vs)
  const hi = Math.max(...vs)
  const s = hi - lo || 1
  const step = s > 1.2 ? 0.5 : s > 0.5 ? 0.25 : 0.1
  return { lo: Math.floor(lo / step) * step, hi: Math.ceil((hi + s * 0.04) / step) * step, step }
})
const Y = (v) => {
  const { lo, hi } = dom.value
  const { plotTop, plotBottom } = rows.value
  return plotTop + (1 - (v - lo) / (hi - lo || 1)) * (plotBottom - plotTop)
}
const path = computed(() => props.points.map((p, i) => `${i ? 'L' : 'M'}${X(p.daysAgo).toFixed(1)} ${Y(p.v).toFixed(1)}`).join(''))
const area = computed(() => {
  if (!props.points.length) return ''
  const b = rows.value.plotBottom
  return `${path.value}L${X(props.points[props.points.length - 1].daysAgo).toFixed(1)} ${b}L${X(props.points[0].daysAgo).toFixed(1)} ${b}Z`
})
const yTicks = computed(() => {
  const { lo, hi, step } = dom.value
  const count = Math.round((hi - lo) / step)
  const every = Math.max(1, Math.ceil(count / 3)) // ≤ 4 条
  const out = []
  for (let i = 0; i <= count; i += every) out.push(+(lo + i * step).toFixed(4))
  return out
})
const xTicks = computed(() => {
  const n = props.points.length
  if (!n) return []
  const k = Math.min(n - 1, narrow.value ? 3 : 5)
  const idx = Array.from({ length: k + 1 }, (_, i) => Math.round((i / Math.max(1, k)) * (n - 1)))
  return [...new Set(idx)].map((i) => ({ i, x: X(props.points[i].daysAgo), text: props.points[i].label, anchor: i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle' }))
})

/* ---------- 文字适配（SVG 不会自动截断） ---------- */
function fit(text, px, fs = 11) {
  let used = 0
  let out = ''
  for (const ch of text) {
    const cw = /[⺀-￿]/.test(ch) ? fs : fs * 0.58
    if (used + cw > px) return out ? out.replace(/.$/u, '') + '…' : ''
    used += cw
    out += ch
  }
  return out
}

/* ---------- 关注方向带 ---------- */
const bandItems = computed(() =>
  props.bands
    .filter((b) => inRange(Math.min(b.fromDaysAgo, b.toDaysAgo)) || inRange(Math.max(b.fromDaysAgo, b.toDaysAgo)))
    .map((b) => {
      const x1 = X(Math.max(b.fromDaysAgo, b.toDaysAgo))
      const x2 = X(Math.min(b.fromDaysAgo, b.toDaysAgo))
      const wd = Math.max(2, x2 - x1 - 2)
      return { ...b, x: x1 + 1, w: wd, text: fit(b.label, wd - 12, narrow.value ? 10 : 11) }
    }),
)
const bandAt = (d) => props.bands.find((b) => d <= Math.max(b.fromDaysAgo, b.toDaysAgo) && d >= Math.min(b.fromDaysAgo, b.toDaysAgo))

/* ---------- 里程碑 ---------- */
const NOTE = { df: { r: 7, cls: 'm-df' }, fc: { r: 7, cls: 'm-fc' }, rating: { r: 5, cls: 'm-rating' }, dan: { r: 8, cls: 'm-dan' }, goal: { r: 6, cls: 'm-goal' } }
const nearestIndex = (d) => {
  let best = 0
  let bd = Infinity
  props.points.forEach((p, i) => {
    const dd = Math.abs(p.daysAgo - d)
    if (dd < bd) {
      bd = dd
      best = i
    }
  })
  return best
}
const markItems = computed(() => {
  let lastLabelEnd = -Infinity
  const list = props.marks
    .filter((m) => inRange(m.daysAgo))
    .slice()
    .sort((a, b) => b.daysAgo - a.daysAgo)
  return list.map((m, i) => {
    const x = X(m.daysAgo)
    const n = NOTE[m.type] || NOTE.goal
    // 标签只能占到下一个里程碑音符之前（C14 看图复核：820 宽下标签压在下一个音符上）
    const next = list[i + 1]
    const limit = next ? X(next.daysAgo) - (NOTE[next.type] || NOTE.goal).r - 6 : w.value - pad.r
    let text = ''
    const avail = Math.min(110, limit - x - n.r - 4)
    if (!narrow.value && x - n.r > lastLabelEnd + 4 && avail >= 40) {
      text = fit(m.text, avail, 11)
      if (text) lastLabelEnd = x + n.r + 4 + avail
    }
    return { ...m, x, ...n, text, idx: nearestIndex(m.daysAgo) }
  })
})

/* ---------- 每日练习 ---------- */
const dayItems = computed(() => props.days.filter((d) => d.played && inRange(d.daysAgo)).map((d) => ({ ...d, x: X(d.daysAgo), hasFacts: (d.facts?.length || 0) > 0 })))
const dayAt = (d) => props.days.find((x) => x.daysAgo === d)

/* ---------- 光标 ---------- */
const cur = ref(null)
function fromEvent(e) {
  const rect = el.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const t = (x - pad.l) / (w.value - pad.l - pad.r)
  const d = span.value - t * span.value
  cur.value = nearestIndex(d)
}
const curPoint = computed(() => (cur.value == null ? null : props.points[cur.value]))
const readout = computed(() => {
  const p = curPoint.value
  if (!p) return null
  const ms = markItems.value.filter((m) => m.idx === cur.value)
  const band = bandAt(p.daysAgo)
  const day = dayAt(p.daysAgo)
  const act = !props.days.length ? '' : !day || !day.played ? L('没有游玩', 'プレイなし') : day.facts?.length ? L(`练习 · ${day.facts.length} 条进展`, `プレイ · 記録 ${day.facts.length} 件`) : L('有游玩', 'プレイあり')
  return { date: p.label, value: p.v.toFixed(props.digits), marks: ms, band: band?.label || '', act }
})
const tipLeft = computed(() => (curPoint.value ? Math.max(70, Math.min(w.value - 70, X(curPoint.value.daysAgo))) : 0))
const live = ref('')
function announce() {
  const r = readout.value
  if (!r) return
  live.value = [`${r.date} ${r.value}`, ...r.marks.map((m) => m.text), r.band && L(`关注：${r.band}`, `重点：${r.band}`), r.act].filter(Boolean).join(L('，', '、'))
}
function onKey(e) {
  const n = props.points.length
  if (!n) return
  let i = cur.value ?? n - 1
  if (e.key === 'ArrowLeft') i = Math.max(0, i - 1)
  else if (e.key === 'ArrowRight') i = Math.min(n - 1, i + 1)
  else if (e.key === 'Home') i = 0
  else if (e.key === 'End') i = n - 1
  else if (e.key === 'Escape') {
    cur.value = null
    return
  } else return
  e.preventDefault()
  cur.value = i
  announce()
}
function onLeave(e) {
  if (e.pointerType === 'mouse') cur.value = null
}
function onFocus() {
  if (cur.value == null && props.points.length) {
    cur.value = props.points.length - 1
    announce()
  }
}

const ariaLabel = computed(() => {
  const name = props.label || L('成长时间栈', '成長タイムライン')
  const a = props.points[0]
  const b = props.points[props.points.length - 1]
  if (!a || !b) return name
  return L(`${name}：${a.label} ${a.v.toFixed(props.digits)} 到 ${b.label} ${b.v.toFixed(props.digits)}，${props.marks.length} 个里程碑。用左右方向键查看每个时间点。`, `${name}：${a.label} ${a.v.toFixed(props.digits)} から ${b.label} ${b.v.toFixed(props.digits)}、マイルストーン ${props.marks.length} 件。左右キーで各時点を確認できます。`)
})
const fmtTick = (t) => t.toFixed(2).replace(/0$/, '')
</script>

<template>
  <div
    ref="el"
    class="ts"
    :class="{ narrow }"
    :style="{ '--tone': tone }"
    tabindex="0"
    role="group"
    :aria-label="ariaLabel"
    :aria-describedby="uid + '-tbl'"
    @pointermove="fromEvent"
    @pointerdown="fromEvent"
    @pointerleave="onLeave"
    @keydown="onKey"
    @focus="onFocus"
  >
    <svg :width="w" :height="rows.total" aria-hidden="true">
      <!-- 折线区 -->
      <g v-for="t in yTicks" :key="'y' + t">
        <line :x1="pad.l" :x2="w - pad.r" :y1="Y(t)" :y2="Y(t)" class="grid" />
        <text :x="pad.l - 8" :y="Y(t) + 4" text-anchor="end" class="ax">{{ fmtTick(t) }}</text>
      </g>
      <line v-for="m in markItems" :key="'g' + m.daysAgo + m.type" :x1="m.x" :x2="m.x" :y1="rows.plotTop" :y2="rows.markTop + rows.markH / 2" class="mark-guide" />
      <path :d="area" class="area" />
      <path :d="path" class="line" />
      <circle v-if="points.length" :cx="X(points[points.length - 1].daysAgo)" :cy="Y(points[points.length - 1].v)" r="4.5" class="end" />

      <!-- 关注方向带 -->
      <g v-if="rows.bandH">
        <g v-for="b in bandItems" :key="b.key + b.fromDaysAgo" :class="['band', { current: b.current }]">
          <rect :x="b.x" :y="rows.bandTop" :width="b.w" :height="rows.bandH" rx="4" />
          <text v-if="b.text" :x="b.x + 6" :y="rows.bandTop + rows.bandH / 2 + 4" class="band-t">{{ b.text }}</text>
        </g>
      </g>

      <!-- 里程碑行 -->
      <g v-if="rows.markH">
        <line :x1="pad.l" :x2="w - pad.r" :y1="rows.markTop + rows.markH / 2" :y2="rows.markTop + rows.markH / 2" class="rail" />
        <g v-for="m in markItems" :key="'m' + m.daysAgo + m.type" :class="['mk', m.cls]">
          <circle v-if="m.type === 'df'" :cx="m.x" :cy="rows.markTop + rows.markH / 2" :r="m.r + 2" class="mk-halo" />
          <circle :cx="m.x" :cy="rows.markTop + rows.markH / 2" :r="m.r" class="mk-face" />
          <text v-if="m.text" :x="m.x + m.r + 4" :y="rows.markTop + rows.markH / 2 + 4" class="mk-t">{{ m.text }}</text>
        </g>
      </g>

      <!-- 练习密度条 -->
      <g v-if="rows.dayH">
        <template v-for="d in dayItems" :key="'d' + d.daysAgo">
          <circle v-if="d.hasFacts" :cx="d.x" :cy="rows.dayTop + rows.dayH / 2" r="2.6" class="day-note" />
          <line v-else :x1="d.x" :x2="d.x" :y1="rows.dayTop + 3" :y2="rows.dayTop + rows.dayH - 3" class="day-tick" />
        </template>
      </g>

      <!-- 横轴：只在底部出现一次 -->
      <text v-for="t in xTicks" :key="'x' + t.i" :x="t.x" :y="rows.axisTop + 11" :text-anchor="t.anchor" class="ax">{{ t.text }}</text>

      <!-- 共享光标 -->
      <g v-if="curPoint">
        <line :x1="X(curPoint.daysAgo)" :x2="X(curPoint.daysAgo)" :y1="rows.plotTop" :y2="rows.dayTop + rows.dayH" class="cross" />
        <circle :cx="X(curPoint.daysAgo)" :cy="Y(curPoint.v)" r="5" class="hv" />
      </g>
    </svg>

    <div v-if="readout" class="tip" :style="{ left: tipLeft + 'px' }" aria-hidden="true">
      <span class="tip-d">{{ readout.date }}</span>
      <b class="num">{{ readout.value }}</b>
      <span v-for="m in readout.marks" :key="m.text" class="tip-m"><i class="tip-note" :class="m.cls" />{{ m.text }}</span>
      <span v-if="readout.band" class="tip-b">{{ L('关注', '重点') }} · {{ readout.band }}</span>
      <span v-if="readout.act" class="tip-a">{{ readout.act }}</span>
    </div>

    <p class="sr-only" aria-live="polite">{{ live }}</p>
    <table :id="uid + '-tbl'" class="sr-only">
      <caption>{{ L('里程碑', 'マイルストーン') }}</caption>
      <thead>
        <tr><th scope="col">{{ L('日期', '日付') }}</th><th scope="col">{{ L('事件', '出来事') }}</th></tr>
      </thead>
      <tbody>
        <tr v-for="m in markItems" :key="'r' + m.daysAgo + m.type">
          <td>{{ points[m.idx]?.label }}</td>
          <td>{{ m.text }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.ts {
  position: relative;
  width: 100%;
  touch-action: pan-y;
  border-radius: var(--r-ctl);
}
svg {
  display: block;
  overflow: visible;
}
.grid {
  stroke: var(--line);
}
.ax {
  font-family: var(--font-num);
  font-size: 12px;
  fill: var(--ink-3);
}
.area {
  fill: color-mix(in srgb, var(--tone) 9%, transparent);
}
.line {
  fill: none;
  stroke: var(--tone);
  stroke-width: 2.25;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.end,
.hv {
  fill: var(--tone);
  stroke: var(--surface);
  stroke-width: 2;
}
.mark-guide {
  stroke: var(--roll);
  stroke-dasharray: 2 3;
  opacity: 0.7;
}
.band rect {
  fill: var(--ka-wash);
  stroke: color-mix(in srgb, var(--ka) 45%, transparent);
}
.band.current rect {
  fill: color-mix(in srgb, var(--ka) 22%, var(--surface));
  stroke: var(--ka);
}
.band-t {
  font-size: 11px;
  font-weight: 700;
  fill: var(--ka-ink);
}
.narrow .band-t {
  font-size: 10px;
}
.rail {
  stroke: var(--line);
}
.mk-face {
  stroke: var(--note-ring);
  stroke-width: 2;
  fill: var(--don);
}
.mk.m-fc .mk-face {
  stroke: var(--note-fc);
  stroke-width: 2.5;
}
.mk.m-df .mk-halo {
  fill: none;
  stroke: var(--note-fc);
  stroke-width: 2;
}
.mk.m-rating .mk-face,
.mk.m-dan .mk-face {
  fill: var(--roll);
}
.mk-face,
.mk-halo {
  paint-order: stroke;
}
.mk {
  filter: drop-shadow(0 0 0.5px var(--note-outline));
}
.mk-t {
  font-size: 11px;
  fill: var(--ink-2);
}
.day-tick {
  stroke: var(--ink-3);
  stroke-width: 1.5;
}
.day-note {
  fill: var(--ka);
}
.cross {
  stroke: var(--ink-3);
}
.tip {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  max-width: 220px;
  padding: 6px 10px;
  border-radius: var(--r-ctl);
  background: var(--toast-bg);
  color: var(--toast-ink);
  font-size: var(--fs-11);
  line-height: 1.35;
  pointer-events: none;
  text-align: center;
  box-shadow: var(--shadow-lift);
}
.tip b {
  font-size: var(--fs-16);
}
.tip-m {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-weight: 700;
}
.tip-note {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--don);
  box-shadow: 0 0 0 1.5px var(--note-ring);
  flex: none;
}
.tip-note.m-rating,
.tip-note.m-dan {
  background: var(--roll);
}
.ts:focus-visible {
  box-shadow: var(--focus);
}
</style>
