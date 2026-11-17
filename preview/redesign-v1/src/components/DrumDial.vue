<script setup>
import { computed } from 'vue'

// 鼓面刻度盘：边缘一圈「鋲」，每颗 = 0.5（Rating 满刻度 15.5 → 31 颗）。
// 也可用于目标完成度（max=1, step=1/24）。
const props = defineProps({
  value: { type: Number, required: true },
  max: { type: Number, default: 15.5 },
  step: { type: Number, default: 0.5 },
  size: { type: Number, default: 168 },
  tone: { type: String, default: 'don' },
})
const rivets = computed(() => {
  const n = Math.round(props.max / props.step)
  const lit = props.value / props.step
  return Array.from({ length: n }, (_, i) => {
    // 从 7 点半方向顺时针走 270°
    const a = ((135 + (270 * i) / (n - 1)) * Math.PI) / 180
    return { x: 60 + Math.cos(a) * 52, y: 60 + Math.sin(a) * 52, on: i + 1 <= lit, half: i < lit && i + 1 > lit }
  })
})
</script>

<template>
  <div class="dial" :style="{ width: size + 'px', height: size + 'px' }" :class="tone">
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r="43" class="face" />
      <circle cx="60" cy="60" r="43" class="rim" />
      <circle v-for="(r, i) in rivets" :key="i" :cx="r.x" :cy="r.y" :r="r.on || r.half ? 2.6 : 1.7" :class="['rv', { on: r.on, half: r.half }]" />
    </svg>
    <div class="mid"><slot /></div>
  </div>
</template>

<style scoped>
.dial {
  position: relative;
  flex: none;
  --tone: var(--series); /* 单一序列（Rating）：fumen = --don，teal = 品牌色 */
}
.dial.ka {
  --tone: var(--series-alt);
}
.dial.roll {
  --tone: var(--chart-mark);
}
svg {
  width: 100%;
  height: 100%;
}
.face {
  fill: var(--surface-2);
}
.rim {
  fill: none;
  stroke: var(--line-strong);
  stroke-width: 1;
}
.rv {
  fill: var(--line-strong);
}
.rv.on {
  fill: var(--tone);
}
.rv.half {
  fill: color-mix(in srgb, var(--tone) 50%, var(--line-strong));
}
.mid {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  text-align: center;
}
</style>
