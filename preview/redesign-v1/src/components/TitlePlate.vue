<script setup>
import { useAuthentic } from './assets'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { L } from '../store'
import { PLATES } from '../mock/titles'

/**
 * TitlePlate —— 称号。
 *
 * 版本 A（V1.2 的 V6 称号牌）：一块小铭牌，双细线边框、两端各一颗鋲。
 *   text  string   称号文字（必填）
 *
 * 版本 B、C（docs/16 A5）：游戏称号与站内称号分开画。
 *   game  { name, plate, custom? } | null   游戏称号（user.gameTitle）；null = 没有称号，什么都不显示。
 *         不传（undefined）时退回版本 A 的画法（尚未迁移的页面）。
 *   form  'plate' | 'text'   plate：宽位置（身份带、帖子作者区、社区头条作者区），有切片时铺 220px 牌面、文字 12px 压在上面，
 *                            放不下先缩到 10px，再放不下退回文字形式（完整称号在 title 里）；没有切片时只显示 --ink-2 文字。
 *                            text：列表行等窄位置，只显示 --ink-3 / --fs-12 文字，单行截断。
 *   site  { name } | null   站内称号（AccountTitle）：中性小标签 + 左侧 3px 彩虹竖条，不套牌面。
 *
 * 例：<TitlePlate :text="user.title" :game="user.gameTitle" :site="user.siteTitle" form="plate" />
 */
const props = defineProps({
  text: { type: String, default: '' },
  game: { type: Object, default: undefined },
  form: { type: String, default: 'plate' },
  site: { type: Object, default: null },
})
const authentic = useAuthentic()
const plate = computed(() => (props.game && props.game.plate != null ? PLATES[props.game.plate] : null))
const W = 220
const plateH = computed(() => (plate.value ? Math.round((W * plate.value.h) / plate.value.w) : 0))
// 文字放在牌面的文字段（band）里，右侧有角色图的切片留出角色图的宽度：文字永远不压图
const textBox = computed(() => {
  const p = plate.value
  if (!p) return {}
  const k = W / p.w
  const right = p.art ? Math.max(22, Math.ceil((p.w - p.art) * k) + 6) : 22
  return { top: p.band[0] * k + 'px', height: (p.band[1] - p.band[0]) * k + 'px', left: '22px', right: right + 'px' }
})
const legacy = computed(() => !authentic.value || props.game === undefined)

// 文字适配：12px → 10px → 退回文字形式
const fs = ref(12)
const fallback = ref(false)
const textEl = ref(null)
async function fit() {
  fs.value = 12
  fallback.value = false
  if (legacy.value || props.form !== 'plate' || !plate.value) return
  await nextTick()
  const el = textEl.value
  if (!el) return
  if (el.scrollWidth <= el.clientWidth) return
  fs.value = 10
  await nextTick()
  if (el.scrollWidth > el.clientWidth) fallback.value = true
}
onMounted(fit)
watch(() => [props.game, props.form, authentic.value], fit)
</script>

<template>
  <span v-if="legacy" class="plate" :title="text">
    <span class="pt">{{ text }}</span>
  </span>
  <span v-else class="gtitle" :class="'f-' + form">
    <template v-if="game">
      <span
        v-if="form === 'plate' && plate && !fallback"
        class="gplate"
        :style="{ width: W + 'px', height: plateH + 'px', backgroundImage: `url(${plate.src})` }"
        :title="game.name"
        lang="ja"
        ><span ref="textEl" class="gp-t" :style="{ ...textBox, fontSize: fs + 'px' }">{{ game.name }}</span></span
      >
      <span v-else class="gtext" :class="{ strong: form === 'plate' }" :title="game.name" lang="ja">{{ game.name }}</span>
    </template>
    <span v-if="site" class="stitle" :title="L('站内称号', 'サイト称号')">{{ site.name }}</span>
  </span>
</template>

<style scoped>
.plate {
  --pc: var(--ctl-border);
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 100%;
  height: var(--plate-h);
  padding: 0 7px;
  border: 3px double var(--pc);
  border-radius: var(--r-xs);
  background: var(--surface-2);
  color: var(--ink-2);
  font-size: var(--fs-11);
  font-weight: 700;
  letter-spacing: 0.04em;
  line-height: 1;
  white-space: nowrap;
  vertical-align: middle;
  flex: none;
}
.plate::before,
.plate::after {
  content: '';
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--pc);
  flex: none;
}
.pt {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ---------- 版本 B、C ---------- */
.gtitle {
  display: inline-flex;
  flex-wrap: wrap; /* 窄屏：牌面 220px + 站内称号放不下一行时，站内称号换到下一行 */
  align-items: center;
  gap: 4px 6px;
  min-width: 0;
  max-width: 100%;
  vertical-align: middle;
}
.gplate {
  position: relative;
  display: inline-block;
  flex: none;
  max-width: 100%;
  background-size: 100% 100%;
  background-repeat: no-repeat;
}
.gp-t {
  position: absolute;
  display: block;
  text-align: center;
  align-content: center;
  overflow: hidden;
  white-space: nowrap;
  font-weight: 700;
  line-height: 1;
  color: var(--plate-ink);
  text-shadow:
    1px 0 0 var(--plate-ink-outline),
    -1px 0 0 var(--plate-ink-outline),
    0 1px 0 var(--plate-ink-outline),
    0 -1px 0 var(--plate-ink-outline),
    1px 1px 0 var(--plate-ink-outline),
    -1px -1px 0 var(--plate-ink-outline),
    1px -1px 0 var(--plate-ink-outline),
    -1px 1px 0 var(--plate-ink-outline);
}
.gtext {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--fs-12);
  color: var(--ink-3);
}
.gtext.strong {
  color: var(--ink-2);
  font-weight: 700;
}
.stitle {
  display: inline-flex;
  align-items: center;
  flex: none;
  height: var(--tag-h);
  padding: 0 7px 0 9px;
  border-radius: var(--tag-radius);
  background: var(--bg-sunk);
  color: var(--ink-2);
  font-size: var(--fs-12);
  font-weight: 700;
  white-space: nowrap;
  position: relative;
  overflow: hidden;
}
.stitle::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--site-title-bar);
}
</style>
