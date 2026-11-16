<script setup>
import { computed } from 'vue'
import { CROWNS } from '../mock/data'
import { L } from '../store'

/**
 * 王冠。
 * props: v（-1 已游玩 / 0 通关 / 1 全连 / 2 全良 / null 未游玩 → 显示「—」）、size（'' | 'sm' | 'lg'）、
 *        label（同时显示文字；此时图形对读屏隐藏，只读一次文字）
 */
const props = defineProps({
  v: { type: Number, default: null },
  size: { type: String, default: '' },
  label: { type: Boolean, default: false },
})
const meta = computed(() => (props.v == null ? null : CROWNS[props.v]))
const text = computed(() => (meta.value ? L(meta.value.zh, meta.value.ja) : L('未游玩', '未プレイ')))
</script>

<template>
  <span class="crown-wrap" :title="label ? undefined : text">
    <span v-if="label" class="crown" :class="[meta ? meta.key : 'none', size]" aria-hidden="true" />
    <span v-else class="crown" :class="[meta ? meta.key : 'none', size]" role="img" :aria-label="text" />
    <span v-if="label" class="crown-label">{{ text }}</span>
  </span>
</template>

<style scoped>
.crown-wrap {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  vertical-align: middle;
}
.crown-label {
  font-size: var(--fs-13);
  font-weight: 500;
}
</style>
