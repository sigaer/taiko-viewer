<script setup>
import { useAuthentic } from './assets'
import { computed } from 'vue'
import { CROWNS } from '../mock/data'
import { L } from '../store'
import { smallSrc } from './smallasset'
import { crownFile } from './gamemap'

/**
 * 王冠。
 * props: v（-1 已游玩 / 0 通关 / 1 全连 / 2 全良 / null 未游玩 → 显示「—」）、
 *        size：'' 默认 | 'sm' | 'lg' | 'table'（密集表格）| 'chip'（筛选胶囊）| 'xl'（达成时刻），
 *        label（同时显示文字；此时图形对读屏隐藏，只读一次文字）
 *
 * 版本 A：CSS 遮罩画的王冠（V1.2）；table → 默认、chip → sm、xl → lg。
 * 版本 B、C（docs/16 A3）：public/game/crown/{clear,full,dondaful}.png，正方形框；
 *   尺寸 table 18 / sm 18 / 默认 22 / lg 30 / xl 48 / chip 16。已游玩 = 空心圆环，未游玩 =「—」，不画灰王冠、不加底板。
 */
const props = defineProps({
  v: { type: Number, default: null },
  size: { type: String, default: '' },
  label: { type: Boolean, default: false },
})
const authentic = useAuthentic()
const meta = computed(() => (props.v == null ? null : CROWNS[props.v]))
const text = computed(() => (meta.value ? L(meta.value.zh, meta.value.ja) : L('未游玩', '未プレイ')))
const legacySize = computed(() => ({ table: '', chip: 'sm', xl: 'lg' })[props.size] ?? props.size)
const PX = { '': 22, sm: 18, table: 18, lg: 30, xl: 48, chip: 16 }
const px = computed(() => PX[props.size] ?? 22)
const file = computed(() => crownFile(props.v))
const srcs = computed(() => (file.value ? smallSrc('crown', file.value, px.value) : null))
</script>

<template>
  <span v-if="authentic" class="crown-wrap" :title="label ? undefined : text">
    <span
      class="acrown"
      :class="file ? 'img' : meta ? 'played' : 'none'"
      :style="{ width: px + 'px', height: px + 'px' }"
      :role="label ? undefined : 'img'"
      :aria-label="label ? undefined : text"
      :aria-hidden="label ? 'true' : undefined"
      ><picture v-if="file"
        ><source type="image/webp" :srcset="srcs.webp" /><img :src="srcs.src" :srcset="srcs.png" alt="" :width="px" :height="px" decoding="async"
      /></picture
    ></span>
    <span v-if="label" class="crown-label">{{ text }}</span>
  </span>
  <span v-else class="crown-wrap" :title="label ? undefined : text">
    <span v-if="label" class="crown" :class="[meta ? meta.key : 'none', legacySize]" aria-hidden="true" />
    <span v-else class="crown" :class="[meta ? meta.key : 'none', legacySize]" role="img" :aria-label="text" />
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
