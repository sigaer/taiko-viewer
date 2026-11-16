<script setup>
// 标志：一面鼓的俯视图。朱色鼓面（咚）+ 浅葱鼓缘（咔）+ 一圈鋲。
defineProps({ size: { type: Number, default: 36 } })
const rivets = Array.from({ length: 12 }, (_, i) => {
  const a = (i * Math.PI) / 6
  return { x: 20 + Math.cos(a) * 16.2, y: 20 + Math.sin(a) * 16.2 }
})
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 40 40" aria-hidden="true">
    <circle cx="20" cy="20" r="19" fill="var(--ka)" />
    <circle v-for="(r, i) in rivets" :key="i" :cx="r.x" :cy="r.y" r="1.15" fill="var(--lane-outline)" opacity=".7" />
    <circle cx="20" cy="20" r="13" fill="var(--don)" stroke="#fff" stroke-width="2" />
    <path d="M14.500 15.500h11M20 15.500V26" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none" />
  </svg>
</template>
