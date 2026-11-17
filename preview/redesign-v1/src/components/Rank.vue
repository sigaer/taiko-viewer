<script setup>
import { useAuthentic } from './assets'
import { computed } from 'vue'
import { RANKS } from '../mock/data'
import { L } from '../store'
import { smallSrc } from './smallasset'
import { rankFile } from './gamemap'

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
  compact: { type: Boolean, default: false }, // C+ G4：手机列表行，占位 20、绘制 24，后面跟 --fs-11 的评价名（任何宽度都在图标右边；360 宽放不下时由列表行隐藏次要信息让位，见 Scores.vue）
})
const authentic = useAuthentic()
const meta = computed(() => RANKS[props.v] || RANKS[0])
const none = computed(() => meta.value.key === 'none')
const text = computed(() => (none.value ? L('没有评价', '評価なし') : L(meta.value.zh, meta.value.ja)))
const glyph = computed(() => (none.value ? '—' : meta.value.glyph ? L(meta.value.glyph, meta.value.glyphJa) : ''))

const slot = computed(() => (props.compact ? 20 : props.px || (props.lg ? 36 : 24)))
const draw = computed(() => (props.compact ? 24 : !props.px && props.lg ? 40 : Math.round((slot.value * 28) / 24)))
const showName = computed(() => (props.named || props.compact) && !none.value)
const withText = computed(() => props.label || showName.value)
// 小于 24px 的占位只写评价名；compact 是例外（docs/19 G4：图标 + 名称）
const imageOk = computed(() => props.compact || slot.value >= 24)
const srcs = computed(() => (rankFile(props.v) ? smallSrc('rank', rankFile(props.v), draw.value) : null))
const aText = computed(() => (props.v === 1 ? L('未取得', '未取得') : none.value ? L('未设置', '未設定') : text.value))
</script>

<template>
  <span v-if="authentic" class="rank-wrap" :class="{ 'a-gap': withText && !compact, compact }" :title="withText ? undefined : aText">
    <span
      class="arank"
      :class="{ none, txt: !none && !imageOk }"
      :style="{ width: slot + 'px', height: slot + 'px', '--draw': draw + 'px' }"
      :role="withText ? undefined : 'img'"
      :aria-label="withText ? undefined : aText"
      :aria-hidden="withText ? 'true' : undefined"
    >
      <template v-if="none">—</template>
      <template v-else-if="!imageOk">{{ text }}</template>
      <picture v-else
        ><source type="image/webp" :srcset="srcs.webp" /><img :src="srcs.src" :srcset="srcs.png" alt="" :width="draw" :height="draw" decoding="async"
      /></picture>
    </span>
    <span v-if="label" class="rank-label">{{ none ? '—' : text }}</span>
    <span v-else-if="showName" class="rank-name">{{ text }}</span>
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
/* 手机列表行（G4）：图标 20 / 24 + 两字评价名 --fs-11；图比占位大 2px，间距 6px 看得见 4px */
.rank-wrap.compact {
  gap: 6px;
}
.rank-wrap.compact .rank-name {
  font-size: var(--fs-11);
}
</style>
