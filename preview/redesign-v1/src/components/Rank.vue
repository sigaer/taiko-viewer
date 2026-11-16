<script setup>
import { useAuthentic } from './assets'
import { computed } from 'vue'
import { RANKS } from '../mock/data'
import { L } from '../store'

/**
 * 评价（粹 / 雅 / 极）。
 * props: v（RANKS 下标；0 / 1 = 没有评价 → 显示「—」）、lg、label（同时显示文字；此时图形对读屏隐藏）、
 *        px（只在版本 B、C 生效：指定占位边长，用于评价升级的「原 → 新」）、
 *        named（只在版本 B、C 生效：图后面跟评价名文字，图对读屏隐藏；桌面密集表格用，粋 / 雅 三档只靠颜色区分时要有文字）
 *
 * 版本 A：圆圈 + 粹 / 雅 / 极 字（V1.2）。
 * 版本 B、C（docs/16 A4）：public/game/rank/{2–8}.png；占位 24px，图按占位的 28/24 绘制并居中（素材四周有透明边，不裁切）；
 *   lg（歌曲详情成绩区）占位 36px、绘制 40px；
 *   0 = 未设置、1 = 未取得，都显示「—」但可访问名称不同（rank/1.png 是全透明图，不加载）；占位小于 24px 时不放图，写评价名。
 */
const props = defineProps({
  v: { type: Number, default: 0 },
  lg: { type: Boolean, default: false },
  label: { type: Boolean, default: false },
  px: { type: Number, default: 0 },
  named: { type: Boolean, default: false },
})
const authentic = useAuthentic()
const meta = computed(() => RANKS[props.v] || RANKS[0])
const none = computed(() => meta.value.key === 'none')
const text = computed(() => (none.value ? L('没有评价', '評価なし') : L(meta.value.zh, meta.value.ja)))
const glyph = computed(() => (none.value ? '—' : meta.value.glyph ? L(meta.value.glyph, meta.value.glyphJa) : ''))

const slot = computed(() => props.px || (props.lg ? 36 : 24))
const draw = computed(() => (!props.px && props.lg ? 40 : Math.round((slot.value * 28) / 24)))
const withText = computed(() => props.label || (props.named && !none.value))
const aText = computed(() => (props.v === 1 ? L('未取得', '未取得') : none.value ? L('未设置', '未設定') : text.value))
</script>

<template>
  <span v-if="authentic" class="rank-wrap" :class="{ 'a-gap': withText }" :title="withText ? undefined : aText">
    <span
      class="arank"
      :class="{ none, txt: !none && slot < 24 }"
      :style="{ width: slot + 'px', height: slot + 'px', '--draw': draw + 'px' }"
      :role="withText ? undefined : 'img'"
      :aria-label="withText ? undefined : aText"
      :aria-hidden="withText ? 'true' : undefined"
    >
      <template v-if="none">—</template>
      <template v-else-if="slot < 24">{{ text }}</template>
      <img v-else :src="`game/rank/${v}.png`" alt="" :width="draw" :height="draw" decoding="async" />
    </span>
    <span v-if="label" class="rank-label">{{ none ? '—' : text }}</span>
    <span v-else-if="named && !none" class="rank-name">{{ text }}</span>
  </span>
  <span v-else class="rank-wrap" :title="label ? undefined : text">
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
/* 真实素材绘制尺寸比占位大（四周透明边各 2px），图与文字之间看得见的间距 ≥ 8px */
.rank-wrap.a-gap {
  gap: 10px;
}
.rank-name {
  font-size: var(--fs-12);
  font-weight: 500;
  color: var(--ink-2);
  white-space: nowrap;
}
</style>
