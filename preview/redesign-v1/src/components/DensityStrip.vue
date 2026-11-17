<script setup>
import { computed } from 'vue'
import { L } from '../store'

/**
 * 密度条：每小节一根，越密越高；超过阈值的小节用朱色标出「难点位置」。
 * props: values（0–1，每小节一个）、height、label（读屏名称；默认按语言给出）
 */
const props = defineProps({
  values: { type: Array, required: true },
  height: { type: Number, default: 56 },
  label: { type: String, default: '' },
})
const ariaLabel = computed(() => {
  if (props.label) return props.label
  const hot = props.values.filter((v) => v > 0.72).length
  return L(`每小节音符密度，共 ${props.values.length} 小节，${hot} 个高密度小节`, `小節ごとのノーツ密度：全 ${props.values.length} 小節、高密度 ${hot} 小節`)
})
</script>

<template>
  <div class="ds" :style="{ height: height + 'px' }" role="img" :aria-label="ariaLabel">
    <i v-for="(v, i) in values" :key="i" :class="{ hot: v > 0.72 }" :style="{ height: Math.round(v * 100) + '%' }" />
  </div>
</template>

<style scoped>
.ds {
  display: flex;
  align-items: flex-end;
  gap: 2px;
}
i {
  flex: 1;
  min-width: 2px;
  border-radius: 2px 2px 0 0;
  background: var(--density-bar);
}
i.hot {
  background: var(--don-data);
}
</style>
