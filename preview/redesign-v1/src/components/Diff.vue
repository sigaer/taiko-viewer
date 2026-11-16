<script setup>
import { computed } from 'vue'
import { DIFFS } from '../mock/data'
import { L } from '../store'

/**
 * 难度徽章：难度名 + 星级 +（可选）定数。三段信息始终按同一顺序出现。
 * props: d（1–5）、star、constant、short（简称）、lg、
 *        showMissing（没有定数时显示「—」占位，用于需要列对齐的地方；默认不显示第三段）
 * 读屏：读出「难度全称 星级 N 定数」一次；简称与 ★ 对读屏隐藏。
 */
const props = defineProps({
  d: { type: Number, required: true },
  star: { type: [Number, String], default: null },
  constant: { type: Number, default: null },
  short: { type: Boolean, default: false },
  lg: { type: Boolean, default: false },
  showMissing: { type: Boolean, default: false },
})
const meta = computed(() => DIFFS[props.d])
const full = computed(() => L(meta.value.zh, meta.value.ja))
const label = computed(() => (props.short ? L(meta.value.short, meta.value.shortJa) : full.value))
</script>

<template>
  <span class="diff" :class="[meta.key, { lg }]" :title="full">
    <span class="d"><span v-if="short" aria-hidden="true">{{ label }}</span><span v-if="short" class="sr-only">{{ full }}</span><template v-else>{{ label }}</template></span>
    <span v-if="star != null" class="s"><span aria-hidden="true">★</span><span class="sr-only">{{ L('星级', '星') }}</span>{{ star }}</span>
    <span v-if="constant != null" class="k"><span class="sr-only">{{ L('定数', '定数') }}</span>{{ constant.toFixed(2) }}</span>
    <span v-else-if="showMissing" class="k na"><span aria-hidden="true">—</span><span class="sr-only">{{ L('没有定数', '定数なし') }}</span></span>
  </span>
</template>
