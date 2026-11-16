<script setup>
import { computed } from 'vue'

const props = defineProps({
  values: { type: Array, required: true },
  w: { type: Number, default: 96 },
  h: { type: Number, default: 28 },
  tone: { type: String, default: 'var(--ink-2)' },
})
const pts = computed(() => {
  const lo = Math.min(...props.values)
  const hi = Math.max(...props.values)
  const s = hi - lo || 1
  return props.values.map((v, i) => [(i / (props.values.length - 1)) * (props.w - 6) + 3, props.h - 4 - ((v - lo) / s) * (props.h - 8)])
})
const d = computed(() => pts.value.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(''))
</script>

<template>
  <svg :width="w" :height="h" aria-hidden="true" class="spark">
    <path :d="d" fill="none" :stroke="tone" stroke-width="1.75" stroke-linejoin="round" stroke-linecap="round" />
    <circle :cx="pts[pts.length - 1][0]" :cy="pts[pts.length - 1][1]" r="2.5" :fill="tone" />
  </svg>
</template>
