<script setup>
import { computed } from 'vue'
import Cover from './Cover.vue'
import Diff from './Diff.vue'
import Rank from './Rank.vue'
import Crown from './Crown.vue'
import { FACT, DIFFS, RANKS, songById, chartOf, fmt } from '../mock/data'
import { L, songTitle } from '../store'

/**
 * 一条成长事实：左边音符表示类型，右边是「之前 → 之后」。今日页、成长档案、每周回顾共用。
 * props: fact（{ type, songId, d, before, after, rankFrom?, rankTo? }）、dense
 * 链接的读屏名称是一句完整的话（曲名、难度、事实、变化），不逐个读图形。
 */
const props = defineProps({ fact: { type: Object, required: true }, dense: { type: Boolean, default: false } })
const song = computed(() => songById[props.fact.songId])
const chart = computed(() => chartOf(props.fact.songId, props.fact.d))
const meta = computed(() => FACT[props.fact.type])
const rankName = (v) => (RANKS[v] ? L(RANKS[v].zh, RANKS[v].ja) : '—')
const change = computed(() => {
  const f = props.fact
  if (f.type === 'df' || f.type === 'fc') return fmt(f.after)
  if (f.type === 'rank-upgrade') return `${rankName(f.rankFrom)} → ${rankName(f.rankTo)}`
  if (f.type === 'ng-reduced' || f.type === 'goal-completed') return `${L('不可', '不可')} ${f.before} → ${f.after}`
  if (f.type === 'combo-improved') return `${L('连击', 'コンボ')} ${f.before} → ${f.after}`
  return `${fmt(f.after)}（+${fmt(f.after - f.before)}）`
})
const linkName = computed(() => {
  const dm = DIFFS[props.fact.d]
  return `${songTitle(song.value)}，${L(dm.zh, dm.ja)} ★${chart.value.star}，${L(meta.value.zh, meta.value.ja)}：${change.value}`
})
const noteClass = computed(() => ({ don: '', ka: 'ka', fc: 'big fc', dfc: 'big dfc', goal: 'big roll', ghost: 'ghost' })[meta.value.note])
</script>

<template>
  <RouterLink :to="`/songs/${song.id}?d=${fact.d}`" class="fact" :class="{ dense }" :aria-label="linkName">
    <i class="note" :class="noteClass" aria-hidden="true" />
    <Cover :song="song" :size="dense ? 'sm' : ''" />
    <span class="grow">
      <span class="t title-1l" :title="songTitle(song)">{{ songTitle(song) }}</span>
      <span class="s">
        <Diff :d="fact.d" :star="chart.star" short />
        <span>{{ L(meta.zh, meta.ja) }}</span>
      </span>
    </span>
    <span class="chg">
      <template v-if="fact.type === 'df'"><Crown :v="2" /><b class="num">{{ fmt(fact.after) }}</b></template>
      <template v-else-if="fact.type === 'fc'"><Crown :v="1" /><b class="num">{{ fmt(fact.after) }}</b></template>
      <template v-else-if="fact.type === 'rank-upgrade'"><Rank :v="fact.rankFrom" :px="24" /><span class="arrow">→</span><Rank :v="fact.rankTo" :px="30" /></template>
      <template v-else-if="fact.type === 'ng-reduced' || fact.type === 'goal-completed'">
        <span class="lbl">{{ L('不可', '不可') }}</span><span class="num was">{{ fact.before }}</span><span class="arrow">→</span><b class="num">{{ fact.after }}</b>
      </template>
      <template v-else-if="fact.type === 'combo-improved'">
        <span class="lbl">{{ L('连击', 'コンボ') }}</span><span class="num was">{{ fact.before }}</span><span class="arrow">→</span><b class="num">{{ fact.after }}</b>
      </template>
      <template v-else>
        <b class="num">{{ fmt(fact.after) }}</b><span class="num up">+{{ fmt(fact.after - fact.before) }}</span>
      </template>
    </span>
  </RouterLink>
</template>

<style scoped>
.fact {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
}
.fact:last-child {
  border-bottom: 0;
}
.fact:hover .t {
  color: var(--link);
}
.fact .note {
  width: 14px;
  height: 14px;
  margin: 0 3px;
}
.fact .note.big {
  width: 20px;
  height: 20px;
  margin: 0;
}
.t {
  display: block;
  font-weight: 700;
  line-height: 1.35;
}
.s {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  margin-top: 3px;
  font-size: var(--fs-12);
  color: var(--ink-2);
  white-space: nowrap;
}
/* C1：行内元素不逐字换行 —— 说明文字单行截断，分数与差值不换行不截断 */
.s > span:last-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.chg {
  white-space: nowrap;
}
.chg {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: none;
  font-size: var(--fs-16);
}
.chg b {
  font-size: var(--fs-18);
}
.chg .was {
  color: var(--ink-3);
}
.chg .lbl {
  font-size: var(--fs-12);
  color: var(--ink-3);
}
.arrow {
  color: var(--ink-3);
  font-size: var(--fs-12);
}
.dense {
  padding: 8px 0;
}
@media (max-width: 767px) {
  .chg {
    flex-direction: column;
    align-items: flex-end;
    gap: 0;
  }
  .chg:has(.arrow) {
    flex-direction: row;
    gap: 5px;
  }
}
</style>
