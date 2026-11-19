<script setup lang="ts">
// ReworkCommunityChartCard — the chart a thread is about (thread.song): cover, title in the page language, difficulty
// and stars, linking to the song page at that difficulty and its player notes (#chart-ugc), as before.
import type { PropType } from "vue";
import type { ForumThreadCard } from "~/types/forum";
import { threadSongLocation, threadSongTitle } from "~/utils/rework/community";

const props = defineProps({
  song: { type: Object as PropType<NonNullable<ForumThreadCard["song"]>>, required: true }
});
const { t, locale } = useI18n();
const localePath = useLocalePath();
const name = computed(() => threadSongTitle(props.song, locale.value));
const to = computed(() => localePath(threadSongLocation(props.song, true)));
const id = useId();
</script>

<template>
  <section class="cc" :aria-labelledby="id">
    <h2 :id="id" class="cc__h">{{ t("rework.forum.thread.chart") }}</h2>
    <NuxtLink :to="to" class="cc__song">
      <DsCover :song-id="song.id" size="lg" />
      <span class="cc__text">
        <b class="cc__name" :lang="name.lang">{{ name.text }}</b>
        <DsDiff v-if="song.difficultyType" :difficulty="song.difficultyType" :star="song.level" :show-constant="false" />
        <span class="cc__go">{{ t("community.viewChart") }}<ReworkIcon name="forward" /></span>
      </span>
    </NuxtLink>
  </section>
</template>

<style scoped>
.cc {
  display: grid;
  gap: var(--sp-3);
  padding: var(--sp-4);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
  font-family: var(--font-ui);
  color: var(--ink);
}
.cc__h {
  margin: 0;
  font-size: var(--fs-13);
  font-weight: 600;
  color: var(--ink-2);
}
.cc__song {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  min-width: 0;
  color: inherit;
  text-decoration: none;
  border-radius: var(--r-ctl);
}
.cc__song:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 3px;
}
.cc__text {
  display: grid;
  gap: 6px;
  justify-items: start;
  min-width: 0;
}
.cc__name {
  font-size: var(--fs-16);
  line-height: var(--lh-snug);
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.cc__song:hover .cc__name {
  color: var(--link);
}
.cc__go {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: var(--fs-13);
  color: var(--link);
}
.cc__go :deep(svg) {
  width: 14px;
  height: 14px;
}
</style>
