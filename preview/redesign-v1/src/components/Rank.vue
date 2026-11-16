<script setup>
import { computed } from 'vue'
import { RANKS } from '../mock/data'
import { L } from '../store'

const props = defineProps({
  v: { type: Number, default: 0 },
  lg: { type: Boolean, default: false },
  label: { type: Boolean, default: false },
})
const meta = computed(() => RANKS[props.v] || RANKS[0])
</script>

<template>
  <span class="rank-wrap" :title="L(meta.zh, meta.ja)">
    <span class="rank" :class="[meta.key, { lg }]" role="img" :aria-label="L(meta.zh, meta.ja)">{{ meta.glyph ? L(meta.glyph, meta.glyphJa) : '' }}</span>
    <span v-if="label" class="rank-label">{{ L(meta.zh, meta.ja) }}</span>
  </span>
</template>

<style scoped>
.rank-wrap {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  vertical-align: middle;
}
.rank-label {
  font-size: var(--fs-13);
  font-weight: 500;
}
</style>
