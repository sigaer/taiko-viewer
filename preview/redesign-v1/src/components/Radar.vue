<script setup>
import { computed } from 'vue'

// 六维 / 五维雷达。数值集中在一个窄区间时自动收窄量程，并把量程写在图上，避免「看起来都一样」。
const props = defineProps({
  axes: { type: Array, required: true }, // [{ label, value, prev?, key }]
  focus: { type: String, default: null },
  size: { type: Number, default: 260 },
  domain: { type: Array, default: null }, // [min, max]
  tone: { type: String, default: 'var(--don)' },
})
const C = 130
const R = 84
const dom = computed(() => {
  if (props.domain) return props.domain
  const vals = props.axes.flatMap((a) => [a.value, a.prev ?? a.value])
  const lo = Math.floor(Math.min(...vals) - 0.6)
  const hi = Math.ceil(Math.max(...vals) + 0.1)
  return [Math.max(0, lo), hi]
})
const n = computed(() => props.axes.length)
function pt(i, v, extra = 0) {
  const [lo, hi] = dom.value
  const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo)))
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / n.value
  const r = t * R + extra
  return [C + Math.cos(a) * r, C + Math.sin(a) * r]
}
const str = (p) => p.map((x) => x.toFixed(1)).join(',')
const poly = (key) => props.axes.map((a, i) => str(pt(i, a[key] ?? a.value))).join(' ')
const rings = computed(() => {
  const [lo, hi] = dom.value
  return [0.25, 0.5, 0.75, 1].map((t) => props.axes.map((_, i) => str(pt(i, lo + (hi - lo) * t))).join(' '))
})
const labels = computed(() =>
  props.axes.map((a, i) => {
    const [x, y] = pt(i, dom.value[1], 20)
    return { ...a, x, y, anchor: Math.abs(x - C) < 8 ? 'middle' : x > C ? 'start' : 'end' }
  }),
)
const hasPrev = computed(() => props.axes.some((a) => a.prev != null))
const ariaLabel = computed(() => props.axes.map((a) => `${a.label} ${a.value.toFixed(2)}`).join('，'))
</script>

<template>
  <svg viewBox="-20 0 300 260" :width="size" class="radar" role="img" :aria-label="ariaLabel" :style="{ '--tone': tone }">
    <polygon v-for="(r, i) in rings" :key="i" :points="r" class="ring" />
    <line v-for="(a, i) in axes" :key="'l' + i" :x1="C" :y1="C" :x2="pt(i, dom[1])[0]" :y2="pt(i, dom[1])[1]" class="spoke" />
    <polygon v-if="hasPrev" :points="poly('prev')" class="prev" />
    <polygon :points="poly('value')" class="now" />
    <circle v-for="(a, i) in axes" :key="'d' + i" :cx="pt(i, a.value)[0]" :cy="pt(i, a.value)[1]" :r="a.key === focus ? 5 : 3" :class="['dot', { focus: a.key === focus }]" />
    <g v-for="l in labels" :key="l.label" :text-anchor="l.anchor">
      <text :x="l.x" :y="l.y - 2" :class="['lab', { focus: l.key === focus }]">{{ l.label }}</text>
      <text :x="l.x" :y="l.y + 14" class="val">{{ l.value.toFixed(2) }}</text>
    </g>
    <text :x="C + 4" :y="C - R + 12" class="scale">{{ dom[1] }}</text>
    <text :x="C + 4" :y="C - 4" class="scale">{{ dom[0] }}</text>
  </svg>
</template>

<style scoped>
.radar {
  max-width: 100%;
  height: auto;
  overflow: visible;
}
.ring {
  fill: none;
  stroke: var(--line);
}
.spoke {
  stroke: var(--line);
}
.prev {
  fill: none;
  stroke: var(--ink-3);
  stroke-width: 1.25;
  stroke-dasharray: 3 3;
}
.now {
  fill: color-mix(in srgb, var(--tone) 16%, transparent);
  stroke: var(--tone);
  stroke-width: 2;
  stroke-linejoin: round;
}
.dot {
  fill: var(--surface);
  stroke: var(--tone);
  stroke-width: 2;
}
.dot.focus {
  fill: var(--ka);
  stroke: var(--surface);
}
.lab {
  font-size: 12px;
  font-weight: 500;
  fill: var(--ink-2);
}
.lab.focus {
  fill: var(--ka-ink);
  font-weight: 700;
}
.val {
  font-family: var(--font-num);
  font-size: 15px;
  font-weight: 700;
  fill: var(--ink);
}
.scale {
  font-family: var(--font-num);
  font-size: 10px;
  fill: var(--ink-3);
}
</style>
