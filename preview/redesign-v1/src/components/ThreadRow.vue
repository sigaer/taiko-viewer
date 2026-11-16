<script setup>
import { computed } from 'vue'
import Icon from './Icon.vue'
import Cover from './Cover.vue'
import Diff from './Diff.vue'
import { sectionBySlug, users, songById, chartOf, THREAD_TYPES, fmt } from '../mock/data'
import { L, songTitle } from '../store'

// 帖子行：版块色只出现在左侧一个小圆点上；关联歌曲作为一等信息出现在右侧。
const props = defineProps({
  thread: { type: Object, required: true },
  compact: { type: Boolean, default: false },
})
const sec = computed(() => sectionBySlug[props.thread.section])
const author = computed(() => users[props.thread.author])
const song = computed(() => (props.thread.song ? songById[props.thread.song.id] : null))
const chart = computed(() => (props.thread.song ? chartOf(props.thread.song.id, props.thread.song.d) : null))
</script>

<template>
  <RouterLink :to="`/community/t/${thread.id}`" class="th" :class="{ compact }">
    <div class="grow">
      <div class="meta">
        <span class="sec"><i class="dot" :style="{ color: sec.color }" />{{ L(sec.zh, sec.ja) }}</span>
        <span v-if="thread.pinned" class="tag tag-don"><Icon name="pin" :size="12" />{{ L('置顶', '固定') }}</span>
        <span v-if="thread.featured" class="tag tag-roll">{{ L('精华', '注目') }}</span>
        <span v-if="thread.type !== 'discussion'" class="tag">{{ L(THREAD_TYPES[thread.type].zh, THREAD_TYPES[thread.type].ja) }}</span>
      </div>
      <h3 class="title">{{ thread.title }}</h3>
      <p v-if="!compact" class="sum">{{ thread.summary }}</p>
      <div class="foot">
        <span class="who"><span class="avatar sm" :style="{ background: `hsl(${author.hue} 45% 42%)` }">{{ author.name[0] }}</span>{{ author.name }}</span>
        <span>{{ thread.ago }}</span>
        <span class="stat"><Icon name="reply" :size="14" /><b class="num">{{ thread.replies }}</b></span>
        <span class="stat"><Icon name="heart" :size="14" /><b class="num">{{ fmt(thread.likes) }}</b></span>
        <span v-if="!compact" class="stat only-desktop"><Icon name="eye" :size="14" /><b class="num">{{ fmt(thread.views) }}</b></span>
      </div>
    </div>
    <div v-if="song && !compact" class="linked">
      <Cover :song="song" size="lg" />
      <span class="truncate ls">{{ songTitle(song) }}</span>
      <Diff :d="thread.song.d" :star="chart.star" short />
    </div>
  </RouterLink>
</template>

<style scoped>
.th {
  display: flex;
  gap: 20px;
  padding: 18px 0;
  border-bottom: 1px solid var(--line);
}
.th:last-child {
  border-bottom: 0;
}
.meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--fs-12);
  color: var(--ink-2);
}
.sec {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}
.title {
  margin-top: 6px;
  font-size: var(--fs-16);
  font-weight: 700;
  line-height: 1.45;
}
.th:hover .title {
  color: var(--ka-ink);
}
.sum {
  margin-top: 4px;
  font-size: var(--fs-13);
  color: var(--ink-2);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.foot {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 10px;
  font-size: var(--fs-12);
  color: var(--ink-3);
}
.who {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--ink-2);
  font-weight: 500;
}
.stat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.stat b {
  font-size: var(--fs-14);
  color: var(--ink-2);
}
.linked {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 96px;
  flex: none;
  text-align: center;
}
.ls {
  width: 100%;
  font-size: var(--fs-12);
  color: var(--ink-2);
}
.compact {
  padding: 12px 0;
}
.compact .title {
  font-size: var(--fs-14);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.compact .foot {
  margin-top: 6px;
}
@media (max-width: 767px) {
  .th {
    gap: 12px;
    padding: 16px 0;
  }
  .linked {
    width: 56px;
  }
  .linked :deep(.cover) {
    width: 56px;
    font-size: 24px;
  }
  .ls {
    display: none;
  }
}
</style>
