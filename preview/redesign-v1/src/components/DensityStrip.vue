<script setup>
// 密度条：每小节一根，越密越高；超过阈值的小节用朱色标出「难点位置」。
defineProps({
  values: { type: Array, required: true },
  height: { type: Number, default: 56 },
})
</script>

<template>
  <div class="ds" :style="{ height: height + 'px' }" role="img" aria-label="每小节音符密度">
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
  background: var(--ink-3);
  opacity: 0.55;
}
i.hot {
  background: var(--don);
  opacity: 1;
}
</style>
