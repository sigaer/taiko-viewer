<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { L } from '../store'

/**
 * 趋势折线：单一序列不画图例；Y 轴只留 3–4 条参考线；悬停/触摸出现读数线。
 * props: points（[{ label, v }]）、height、marks（[{ index, text }]）、digits、tone（CSS 颜色）、
 *        label（读屏名称；不传时按语言概括首尾数值）
 * 多行共享时间轴的成长图请用 TimeStack。
 */
const props = defineProps({
  points: { type: Array, required: true }, // [{ label, v }]
  height: { type: Number, default: 220 },
  marks: { type: Array, default: () => [] }, // [{ index, text }]
  digits: { type: Number, default: 2 },
  tone: { type: String, default: 'var(--series)' },
  label: { type: String, default: '' }, // 读屏用的图表说明；不传时自动概括首尾数值
})
const ariaLabel = computed(() => {
  if (props.label) return props.label
  const a = props.points[0]?.v.toFixed(props.digits)
  const b = props.points[props.points.length - 1]?.v.toFixed(props.digits)
  return L(`从 ${a} 到 ${b}`, `${a} から ${b}`)
})
const el = ref(null)
const w = ref(640)
let ro
onMounted(() => {
  ro = new ResizeObserver(([e]) => (w.value = Math.max(240, e.contentRect.width)))
  ro.observe(el.value)
})
onBeforeUnmount(() => ro?.disconnect())

const pad = { l: 40, r: 14, t: 16, b: 26 }
const dom = computed(() => {
  const vs = props.points.map((p) => p.v)
  const lo = Math.min(...vs)
  const hi = Math.max(...vs)
  const span = hi - lo || 1
  const stepSize = span > 1.2 ? 0.5 : span > 0.5 ? 0.25 : 0.1
  return { lo: Math.floor(lo / stepSize) * stepSize, hi: Math.ceil((hi + span * 0.04) / stepSize) * stepSize, stepSize }
})
const X = (i) => pad.l + (i / (props.points.length - 1)) * (w.value - pad.l - pad.r)
const Y = (v) => pad.t + (1 - (v - dom.value.lo) / (dom.value.hi - dom.value.lo)) * (props.height - pad.t - pad.b)
const path = computed(() => props.points.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p.v).toFixed(1)}`).join(''))
const area = computed(() => `${path.value}L${X(props.points.length - 1)} ${props.height - pad.b}L${pad.l} ${props.height - pad.b}Z`)
const ticks = computed(() => {
  const out = []
  const { lo, hi, stepSize } = dom.value
  const count = Math.round((hi - lo) / stepSize)
  // 最多 4 条横向参考线
  const every = Math.max(1, Math.ceil(count / 3))
  for (let i = 0; i <= count; i += every) out.push(lo + i * stepSize)
  return out
})
const xt = computed(() => {
  const n = props.points.length
  const k = w.value < 480 ? 3 : 6
  return Array.from({ length: k + 1 }, (_, i) => Math.round((i / k) * (n - 1)))
})
const hover = ref(null)
function move(e) {
  const rect = el.value.getBoundingClientRect()
  const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left
  const i = Math.round(((x - pad.l) / (w.value - pad.l - pad.r)) * (props.points.length - 1))
  hover.value = Math.max(0, Math.min(props.points.length - 1, i))
}
const tipLeft = computed(() => (hover.value == null ? 0 : Math.max(52, Math.min(w.value - 52, X(hover.value)))))
const hoverMark = computed(() => props.marks.find((m) => m.index === hover.value))
</script>

<template>
  <div ref="el" class="lc" :style="{ height: height + 'px', '--tone': tone }" @pointermove="move" @pointerleave="hover = null" @touchstart.passive="move" @touchmove.passive="move">
    <svg :width="w" :height="height" role="img" :aria-label="ariaLabel">
      <g v-for="t in ticks" :key="t">
        <line :x1="pad.l" :x2="w - pad.r" :y1="Y(t)" :y2="Y(t)" class="grid" />
        <text :x="pad.l - 8" :y="Y(t) + 4" text-anchor="end" class="ax">{{ t.toFixed(2).replace(/0$/, '') }}</text>
      </g>
      <text v-for="i in xt" :key="'x' + i" :x="X(i)" :y="height - 6" :text-anchor="i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'" class="ax">{{ points[i].label }}</text>
      <path :d="area" class="area" />
      <path :d="path" class="line" />
      <g v-for="m in marks" :key="m.index">
        <line :x1="X(m.index)" :x2="X(m.index)" :y1="pad.t" :y2="height - pad.b" class="mark" />
        <circle :cx="X(m.index)" :cy="Y(points[m.index].v)" r="5" class="mark-dot" />
      </g>
      <circle :cx="X(points.length - 1)" :cy="Y(points[points.length - 1].v)" r="4.5" class="end" />
      <g v-if="hover != null">
        <line :x1="X(hover)" :x2="X(hover)" :y1="pad.t" :y2="height - pad.b" class="cross" />
        <circle :cx="X(hover)" :cy="Y(points[hover].v)" r="5" class="hv" />
      </g>
    </svg>
    <div v-if="hover != null" class="tip" :style="{ left: tipLeft + 'px' }">
      <b class="num">{{ points[hover].v.toFixed(digits) }}</b>
      <span>{{ points[hover].label }}</span>
      <em v-if="hoverMark">{{ hoverMark.text }}</em>
    </div>
  </div>
</template>

<style scoped>
.lc {
  position: relative;
  width: 100%;
  touch-action: pan-y;
}
svg {
  display: block;
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
.mark {
  stroke: var(--roll);
  stroke-dasharray: 2 3;
}
.mark-dot {
  fill: var(--roll);
  stroke: var(--surface);
  stroke-width: 2;
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
  padding: 6px 10px;
  border-radius: var(--r-ctl);
  background: var(--toast-bg);
  color: var(--toast-ink);
  font-size: var(--fs-11);
  line-height: 1.3;
  pointer-events: none;
  white-space: nowrap;
}
.tip b {
  font-size: var(--fs-16);
}
.tip em {
  font-style: normal;
  color: var(--roll);
}
</style>
