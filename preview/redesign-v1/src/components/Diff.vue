<script setup>
import { computed } from 'vue'
import { DIFFS } from '../mock/data'
import { L } from '../store'

// 难度徽章：难度名 + 星级 +（可选）定数。三段信息始终按同一顺序出现。
const props = defineProps({
  d: { type: Number, required: true },
  star: { type: [Number, String], default: null },
  constant: { type: Number, default: null },
  short: { type: Boolean, default: false },
  lg: { type: Boolean, default: false },
})
const meta = computed(() => DIFFS[props.d])
const label = computed(() => (props.short ? L(meta.value.short, meta.value.shortJa) : L(meta.value.zh, meta.value.ja)))
</script>

<template>
  <span class="diff" :class="[meta.key, { lg }]" :title="L(meta.zh, meta.ja)">
    <span class="d">{{ label }}</span>
    <span v-if="star != null" class="s">★{{ star }}</span>
    <span v-if="constant != null" class="k">{{ constant.toFixed(2) }}</span>
  </span>
</template>
