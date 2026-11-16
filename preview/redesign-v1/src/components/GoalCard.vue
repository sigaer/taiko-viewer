<script setup>
import { computed } from 'vue'
import Cover from './Cover.vue'
import Diff from './Diff.vue'
import Icon from './Icon.vue'
import { songById, chartOf, GOAL_TYPES, DIMS, fmt } from '../mock/data'
import { L, songTitle, runSync, store } from '../store'

// 「这次想练」：当前目标。把每次尝试画成一串音符 —— 离判定圈越近，离目标越近。
const props = defineProps({ goal: { type: Object, required: true } })
const song = computed(() => songById[props.goal.songId])
const chart = computed(() => chartOf(props.goal.songId, props.goal.d))
const type = computed(() => GOAL_TYPES[props.goal.type])
const dim = computed(() => DIMS.find((d) => d.key === props.goal.dim))
</script>

<template>
  <section class="goal panel">
    <header class="spread">
      <h2 class="t-h3">{{ L('这次想练', '今回の練習') }}</h2>
      <RouterLink to="/growth/goals" class="link t-small">{{ L('全部目标', 'すべての目標') }}</RouterLink>
    </header>

    <RouterLink :to="`/songs/${song.id}?d=${goal.d}`" class="song">
      <Cover :song="song" size="lg" />
      <span class="grow">
        <span class="type">{{ L(type.zh, type.ja) }}</span>
        <span class="t truncate">{{ songTitle(song) }}</span>
        <span class="row" style="gap: 8px; margin-top: 6px">
          <Diff :d="goal.d" :star="chart.star" :constant="chart.constant" />
          <span class="tag tag-ka">{{ L(dim.zh, dim.ja) }}</span>
        </span>
      </span>
    </RouterLink>

    <div class="track" :aria-label="L('尝试记录', '挑戦の記録')">
      <div v-for="(a, i) in goal.attempts" :key="i" class="try">
        <i class="note" :class="i === goal.attempts.length - 1 ? '' : 'ghost'" />
        <b class="num">{{ a.ng }}</b>
        <span>{{ a.ago === 1 ? L('昨天', '昨日') : L(`${a.ago} 天前`, `${a.ago} 日前`) }}</span>
      </div>
      <div class="try target">
        <i class="ring" />
        <b class="num">0</b>
        <span>{{ L('全连', 'フルコンボ') }}</span>
      </div>
    </div>
    <p class="t-small say">{{ L(`不可从 ${goal.baseline.ng} 降到了 ${goal.latest.ng}，最好成绩 ${fmt(goal.latest.score)}。`, `不可が ${goal.baseline.ng} から ${goal.latest.ng} に。自己ベスト ${fmt(goal.latest.score)}。`) }}</p>

    <div class="acts">
      <RouterLink :to="`/songs/${song.id}?d=${goal.d}`" class="btn">{{ L('查看谱面', '譜面を見る') }}</RouterLink>
      <button class="btn btn-primary" :disabled="store.syncing" @click="runSync"><Icon name="sync" :size="16" />{{ L('练后同步', 'プレイ後に同期') }}</button>
    </div>
  </section>
</template>

<style scoped>
.goal {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px 20px 20px;
}
.song {
  display: flex;
  gap: 14px;
  align-items: center;
}
.type {
  display: block;
  font-size: var(--fs-13);
  font-weight: 700;
  color: var(--don-ink);
}
.t {
  display: block;
  font-size: var(--fs-18);
  font-weight: 900;
  line-height: 1.3;
}
.song:hover .t {
  color: var(--ka-ink);
}
.track {
  position: relative;
  display: flex;
  justify-content: space-between;
  padding: 0 4px;
}
.track::before {
  content: '';
  position: absolute;
  left: 14px;
  right: 22px;
  top: 12px;
  border-top: 2px dashed var(--line-strong);
}
.try {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font-size: var(--fs-11);
  color: var(--ink-3);
}
.try .note {
  --n: 18px;
  margin: 4px 0;
  background-clip: padding-box;
}
.try .note.ghost {
  background: var(--surface);
}
.try b {
  font-size: var(--fs-18);
  color: var(--ink);
  line-height: 1.1;
}
.ring {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid var(--ink);
  background: var(--surface);
  box-shadow: inset 0 0 0 3px var(--surface), inset 0 0 0 4px var(--line-strong);
}
.target b {
  color: var(--don-ink);
}
.say {
  margin-top: -4px;
}
.acts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: auto;
}
</style>
