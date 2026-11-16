<script setup>
import { computed } from 'vue'
import { danTier, faceColor } from './identity'

/**
 * PlayerAvatar —— 鼓面头像（V6）。社区帖子、楼层、榜单、通知、个人主页、今日、我的统一使用。
 *
 * props:
 *   user   { name, hue, dan }（mock 的 users[id] 可直接传入）；也可分别传 name / hue / dan
 *   name   string   昵称（取第一个字作鼓面字）
 *   hue    number   0–360，鼓面色相；面色自动取到白字 ≥ 4.5:1
 *   dan    string   段位：决定鼓缘颜色 —— 低（级位、初–五段）中性；中（六–九段）浅葱；
 *                   高（十段及以上 / 玄人 / 名人 / 超人 / 达人）山吹
 *   size   24 | 32 | 44 | 72 | 96（默认 32）；≥ 72 时鼓缘上画一圈装饰鋲
 *   label  string   默认对读屏隐藏（旁边总有昵称）；传入时作为 role="img" 的名称
 *
 * 例：<PlayerAvatar :user="users[thread.author]" :size="32" />
 */
const props = defineProps({
  user: { type: Object, default: null },
  name: { type: String, default: '' },
  hue: { type: Number, default: null },
  dan: { type: String, default: '' },
  size: { type: Number, default: 32 },
  label: { type: String, default: '' },
})
const nm = computed(() => props.user?.name ?? props.name ?? '')
const hueV = computed(() => props.user?.hue ?? props.hue ?? 220)
const danV = computed(() => props.user?.dan ?? props.dan ?? '')
const tier = computed(() => danTier(danV.value) || 'low')
const glyph = computed(() => {
  const ch = [...nm.value.trim()][0] || '?'
  return ch.toUpperCase()
})
// 鼓缘宽度随尺寸变化（viewBox 100）
const rim = computed(() => (props.size >= 72 ? 9 : props.size >= 44 ? 8 : 9))
const rivets = computed(() => {
  if (props.size < 72) return []
  const r = 50 - rim.value / 2
  return Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI) / 6
    return { x: 50 + Math.cos(a) * r, y: 50 + Math.sin(a) * r }
  })
})
</script>

<template>
  <svg
    class="pavatar"
    :class="'tier-' + tier"
    :width="size"
    :height="size"
    viewBox="0 0 100 100"
    :role="label ? 'img' : undefined"
    :aria-label="label || undefined"
    :aria-hidden="label ? undefined : 'true'"
  >
    <circle cx="50" cy="50" r="50" class="rim" />
    <circle cx="50" cy="50" :r="50 - rim" :style="{ fill: faceColor(hueV) }" />
    <circle cx="50" cy="50" :r="50 - rim" class="face-ring" />
    <circle v-for="(p, i) in rivets" :key="i" :cx="p.x" :cy="p.y" r="1.6" class="rivet" />
    <text x="50" y="52" text-anchor="middle" dominant-baseline="middle" class="glyph">{{ glyph }}</text>
  </svg>
</template>

<style scoped>
.pavatar {
  display: inline-block;
  flex: none;
  vertical-align: middle;
  overflow: visible;
}
.rim {
  fill: var(--ctl-border);
}
.tier-mid .rim {
  fill: var(--ka);
}
.tier-high .rim {
  fill: var(--roll);
}
.face-ring {
  fill: none;
  stroke: var(--note-outline);
  stroke-opacity: 0.22;
  stroke-width: 1.5;
}
.rivet {
  fill: var(--note-outline);
  fill-opacity: 0.45;
}
.glyph {
  fill: var(--note-ring);
  font-family: var(--font-ui);
  font-size: 40px;
  font-weight: 700;
}
</style>
