<script setup>
import { computed } from 'vue'
import { RANKS } from '../mock/data'
import { L } from '../store'

/**
 * 评价（粹 / 雅 / 极）。
 * props: v（RANKS 下标；0 / 1 = 没有评价 → 显示「—」）、lg、label（同时显示文字；此时图形对读屏隐藏）
 */
const props = defineProps({
  v: { type: Number, default: 0 },
  lg: { type: Boolean, default: false },
  label: { type: Boolean, default: false },
})
const meta = computed(() => RANKS[props.v] || RANKS[0])
const none = computed(() => meta.value.key === 'none')
const text = computed(() => (none.value ? L('没有评价', '評価なし') : L(meta.value.zh, meta.value.ja)))
const glyph = computed(() => (none.value ? '—' : meta.value.glyph ? L(meta.value.glyph, meta.value.glyphJa) : ''))
</script>

<template>
  <span class="rank-wrap" :title="label ? undefined : text">
    <span v-if="label" class="rank" :class="[meta.key, { lg }]" aria-hidden="true">{{ glyph }}</span>
    <span v-else class="rank" :class="[meta.key, { lg }]" role="img" :aria-label="text">{{ glyph }}</span>
    <span v-if="label" class="rank-label">{{ none ? '—' : text }}</span>
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
