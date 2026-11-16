<script setup>
import { computed } from 'vue'
import { danTier } from './identity'
import { L } from '../store'

/**
 * DanBadge —— 段位徽章（V6）。紧凑的文字徽章，档次颜色与 PlayerAvatar 的鼓缘一致：
 * 低（级位、初–五段）中性；中（六–九段）浅葱；高（十段及以上 / 玄人 / 名人 / 超人 / 达人）山吹。
 *
 * props:
 *   dan  string  段位文字，如「九段」「达人」；为空或「—」时不渲染
 *
 * 例：<DanBadge :dan="user.dan" />
 */
const props = defineProps({ dan: { type: String, default: '' } })
const tier = computed(() => danTier(props.dan))
</script>

<template>
  <span v-if="tier" class="dan" :class="tier" :title="L(`段位：${dan}`, `段位：${dan}`)">{{ dan }}</span>
</template>

<style scoped>
.dan {
  --c: var(--ctl-border);
  display: inline-flex;
  align-items: center;
  height: var(--tag-h);
  padding: 0 6px;
  border-radius: var(--tag-radius);
  background: var(--bg-sunk);
  color: var(--ink-2);
  box-shadow: inset 0 0 0 1px var(--c);
  font-size: var(--fs-11);
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
  vertical-align: middle;
  flex: none;
}
.dan.mid {
  --c: var(--ka);
  background: var(--ka-wash);
  color: var(--ka-ink);
}
.dan.high {
  --c: var(--roll);
  background: var(--roll-wash);
  color: var(--roll-ink);
}
</style>
