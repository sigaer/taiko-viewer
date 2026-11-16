<script setup>
import { useAuthentic } from './assets'
import { computed } from 'vue'
import { DIFFS } from '../mock/data'
import { L } from '../store'

/**
 * 难度徽章：难度 + 星级 +（可选）定数。三段信息始终按同一顺序出现。
 * props: d（1–5）、star、constant、short（简称）、lg、
 *        showMissing（没有定数时显示「—」占位，用于需要列对齐的地方；默认不显示第三段）
 * 读屏：读出「难度全称 星级 N 定数」一次；简称、图标与 ★ 对读屏隐藏。
 *
 * 版本 A：难度色实色块 + 难度名（V1.2）。
 * 版本 B、C（docs/16 A2）：中性容器 + 难度图标（public/game/diff/{d}.png，正方形框内 contain，不拉伸）+ ★星级 + 定数；
 *   魔王（里）与魔王图标形状相同，图标后加「里 / 裏」。图标框 18px（lg 22px）。
 */
const props = defineProps({
  d: { type: Number, required: true },
  star: { type: [Number, String], default: null },
  constant: { type: Number, default: null },
  short: { type: Boolean, default: false },
  lg: { type: Boolean, default: false },
  showMissing: { type: Boolean, default: false },
})
const authentic = useAuthentic()
const meta = computed(() => DIFFS[props.d])
const full = computed(() => L(meta.value.zh, meta.value.ja))
const label = computed(() => (props.short ? L(meta.value.short, meta.value.shortJa) : full.value))
const icon = computed(() => (props.lg ? 22 : 18))
</script>

<template>
  <span v-if="authentic" class="adiff" :class="[meta.key, { lg }]" :title="full">
    <span class="adiff-ico" :style="{ width: icon + 'px', height: icon + 'px' }"><img :src="`game/diff/${d}.png`" alt="" :width="icon" :height="icon" decoding="async" /></span>
    <span v-if="d === 5" class="adiff-ura" aria-hidden="true">{{ L('里', '裏') }}</span>
    <span class="sr-only">{{ full }}</span>
    <span v-if="star != null" class="s num"><span aria-hidden="true">★</span><span class="sr-only">{{ L('星级', '星') }}</span>{{ star }}</span>
    <span v-if="constant != null" class="k num"><span class="sr-only">{{ L('定数', '定数') }}</span>{{ constant.toFixed(2) }}</span>
    <span v-else-if="showMissing" class="k na"><span aria-hidden="true">—</span><span class="sr-only">{{ L('没有定数', '定数なし') }}</span></span>
  </span>
  <span v-else class="diff" :class="[meta.key, { lg }]" :title="full">
    <span class="d"><span v-if="short" aria-hidden="true">{{ label }}</span><span v-if="short" class="sr-only">{{ full }}</span><template v-else>{{ label }}</template></span>
    <span v-if="star != null" class="s"><span aria-hidden="true">★</span><span class="sr-only">{{ L('星级', '星') }}</span>{{ star }}</span>
    <span v-if="constant != null" class="k"><span class="sr-only">{{ L('定数', '定数') }}</span>{{ constant.toFixed(2) }}</span>
    <span v-else-if="showMissing" class="k na"><span aria-hidden="true">—</span><span class="sr-only">{{ L('没有定数', '定数なし') }}</span></span>
  </span>
</template>
