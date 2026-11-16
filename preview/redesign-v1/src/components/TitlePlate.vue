<script setup>
/**
 * TitlePlate —— 称号牌（V6）。一块小铭牌：双细线边框、两端各一颗鋲，读起来是「牌」而不是普通标签。
 *
 * props:
 *   text  string   称号文字（必填）
 *   rare  boolean  稀有称号：山吹色牌面
 *
 * 例：<TitlePlate :text="user.title" :rare="user.rareTitle" />
 * 高 --plate-h（22px，比 --tag-h 高：它是牌，不是标签）；文字不换行，过长时截断并以 title 属性给出全文。
 */
defineProps({
  text: { type: String, required: true },
  rare: { type: Boolean, default: false },
})
</script>

<template>
  <span class="plate" :class="{ rare }" :title="text">
    <span class="pt">{{ text }}</span>
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
.plate.rare {
  --pc: var(--roll);
  background: var(--roll-wash);
  color: var(--roll-ink);
}
.pt {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
