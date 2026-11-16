<script setup>
import { computed, useId } from 'vue'
import { RouterLink } from 'vue-router'
import Icon from './Icon.vue'
import Cover from './Cover.vue'
import Diff from './Diff.vue'
import PlayerAvatar from './PlayerAvatar.vue'
import DanBadge from './DanBadge.vue'
import { sectionBySlug, users, songById, chartOf, THREAD_TYPES, fmt } from '../mock/data'
import { L, songTitle } from '../store'

/**
 * 帖子行：先是作者（鼓面头像 32px + 昵称 + 段位，V6），再是标题；版块色只出现在一个小圆点上；
 * 关联歌曲作为一等信息出现在右侧。
 * props:
 *   thread   帖子对象
 *   compact  侧栏 / 列表的紧凑形态：作者缩到底部一行，24px 头像，不显示摘要与关联谱面
 *   preview  预览（I3）：渲染为不可交互的 div（无链接、无悬停），版式与普通行完全相同；发帖页右侧预览用
 * 读屏：链接名称 = 帖子标题；作者、版块、回复数作为描述。
 */
const props = defineProps({
  thread: { type: Object, required: true },
  compact: { type: Boolean, default: false },
  preview: { type: Boolean, default: false },
})
const uid = useId()
const sec = computed(() => sectionBySlug[props.thread.section])
const author = computed(() => users[props.thread.author])
const song = computed(() => (props.thread.song ? songById[props.thread.song.id] : null))
const chart = computed(() => (props.thread.song ? chartOf(props.thread.song.id, props.thread.song.d) : null))
const desc = computed(() =>
  L(
    `${author.value.name}，${L(sec.value.zh, sec.value.ja)}，${props.thread.ago}，${props.thread.replies} 条回复`,
    `${author.value.name}、${sec.value.ja}、${props.thread.ago}、返信 ${props.thread.replies} 件`,
  ),
)
</script>

<template>
  <component
    :is="preview ? 'div' : RouterLink"
    :to="preview ? undefined : `/community/t/${thread.id}`"
    class="th"
    :class="{ compact, 'is-preview': preview }"
    :aria-labelledby="preview ? undefined : uid + '-t'"
    :aria-describedby="preview ? undefined : uid + '-d'"
  >
    <div class="grow">
      <div v-if="!compact" class="author" aria-hidden="true">
        <PlayerAvatar :user="author" :size="32" />
        <span class="an">{{ author.name }}</span>
        <DanBadge :dan="author.dan" />
        <span class="ago">{{ thread.ago }}</span>
      </div>
      <div class="meta" aria-hidden="true">
        <span class="sec"><i class="dot" :style="{ color: sec.color }" />{{ L(sec.zh, sec.ja) }}</span>
        <span v-if="thread.pinned" class="tag tag-don"><Icon name="pin" :size="12" />{{ L('置顶', '固定') }}</span>
        <span v-if="thread.featured" class="tag tag-roll">{{ L('精华', '注目') }}</span>
        <span v-if="thread.type !== 'discussion'" class="tag">{{ L(THREAD_TYPES[thread.type].zh, THREAD_TYPES[thread.type].ja) }}</span>
      </div>
      <h3 :id="uid + '-t'" class="title" :class="compact ? 'title-wrap-2' : 'title-wrap'">{{ thread.title }}</h3>
      <p v-if="!compact" class="sum">{{ thread.summary }}</p>
      <div class="foot" aria-hidden="true">
        <span v-if="compact" class="who"><PlayerAvatar :user="author" :size="24" />{{ author.name }}</span>
        <span v-if="compact">{{ thread.ago }}</span>
        <span class="stat"><Icon name="reply" :size="14" /><b class="num">{{ thread.replies }}</b></span>
        <span class="stat"><Icon name="heart" :size="14" /><b class="num">{{ fmt(thread.likes) }}</b></span>
        <span v-if="!compact" class="stat only-desktop"><Icon name="eye" :size="14" /><b class="num">{{ fmt(thread.views) }}</b></span>
      </div>
      <span :id="uid + '-d'" class="sr-only">{{ desc }}</span>
    </div>
    <div v-if="song && !compact" class="linked" aria-hidden="true">
      <Cover :song="song" size="lg" />
      <span class="title-1l ls">{{ songTitle(song) }}</span>
      <Diff :d="thread.song.d" :star="chart.star" short />
    </div>
  </component>
</template>

<style scoped>
.th {
  position: relative;
  display: flex;
  gap: 20px;
  padding: 18px 0;
  border-bottom: 1px solid var(--line);
}
.th:last-child {
  border-bottom: 0;
}
.author {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  margin-bottom: 8px;
  font-size: var(--fs-13);
}
.an {
  font-weight: 700;
  color: var(--ink);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ago {
  color: var(--ink-3);
  font-size: var(--fs-12);
  white-space: nowrap;
}
.meta {
  display: flex;
  flex-wrap: wrap;
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
.th:not(.is-preview):hover .title {
  color: var(--ka-ink);
}
.sum {
  margin-top: 4px;
  font-size: var(--fs-13);
  color: var(--ink-2);
  overflow-wrap: anywhere;
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
