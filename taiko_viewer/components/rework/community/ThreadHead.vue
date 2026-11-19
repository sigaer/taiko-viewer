<script setup lang="ts">
// ReworkCommunityThreadHead — the thread's header: section (link), type and states, the title as the page <h1>, the
// author (avatar, name, role, titles), when it was posted, reply and view counts, tags.
import type { PropType } from "vue";
import type { ForumThreadDetail } from "~/types/forum";
import { resolveForumSectionTranslation } from "~/utils/forum";
import { threadStates } from "~/utils/rework/community";

const props = defineProps({
  thread: { type: Object as PropType<ForumThreadDetail>, required: true }
});
const { t } = useI18n();
const localePath = useLocalePath();
const sectionName = computed(() => resolveForumSectionTranslation(t, props.thread.section.slug, props.thread.section.name));
const typeText = computed(() => {
  const type = props.thread.threadType;
  return type === "guide" ? t("forum.types.guide") : type === "achievement" ? t("forum.types.achievement") : type === "official" ? t("forum.types.official") : t("forum.types.discussion");
});
const states = computed(() => threadStates(props.thread));
const stateText = (state: string) =>
  state === "pinned" ? t("forum.states.pinned") : state === "featured" ? t("forum.states.featured") : state === "locked" ? t("forum.states.locked") : t("rework.forum.hidden");
const dot = computed(() => ({ color: `var(--section-${props.thread.section.slug}, var(--ink-3))` }));
</script>

<template>
  <ReworkPageHeader class="th" :title="thread.title">
    <template #eyebrow>
      <NuxtLink :to="localePath(`/forum/section/${thread.section.slug}`)" class="th__sec"><i class="th__dot" :style="dot" aria-hidden="true" />{{ sectionName }}</NuxtLink>
      <span class="th__tag">{{ typeText }}</span>
      <span v-for="state in states" :key="state" class="th__tag" :class="`is-${state}`">{{ stateText(state) }}</span>
    </template>
    <div class="th__by">
      <ReworkCommunityAuthor :user="thread.author" :size="44" titles="plate" />
      <p class="th__facts">
        <ReworkCommunityTime :value="thread.createdAt" />
        <span><b class="num">{{ thread.replyCount }}</b> {{ t("forum.stats.reply") }}</span>
        <span><b class="num">{{ thread.viewCount }}</b> {{ t("forum.stats.view") }}</span>
      </p>
    </div>
    <p v-if="thread.tags.length" class="th__tags">
      <span v-for="tag in thread.tags" :key="tag">#{{ tag }}</span>
    </p>
  </ReworkPageHeader>
</template>

<style scoped>
.th :deep(.rw-head__title) {
  line-height: 1.25;
}
.th__sec {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  color: var(--ink-2);
  font-weight: 600;
  text-decoration: none;
}
.th__sec:hover {
  color: var(--link);
}
.th__sec:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
  border-radius: var(--r-xs);
}
.th__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}
.th__tag {
  display: inline-flex;
  align-items: center;
  height: var(--tag-h);
  padding: 0 6px;
  border-radius: var(--tag-radius);
  background: var(--tag-info-bg);
  color: var(--tag-info-ink);
  font-size: var(--fs-11);
}
.th__tag.is-pinned,
.th__tag.is-featured {
  background: var(--tag-don-bg);
  color: var(--tag-don-ink);
  font-weight: 700;
}
.th__tag.is-hidden {
  background: var(--warn-wash);
  color: var(--ink);
}
.th__by {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3) var(--sp-4);
  margin-top: var(--sp-4);
}
.th__facts {
  display: flex;
  flex-wrap: wrap;
  gap: 4px var(--sp-3);
  margin: 0;
  font-size: var(--fs-12);
  color: var(--ink-3);
}
.th__facts b {
  color: var(--ink-2);
  font-weight: 600;
}
.th__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px var(--sp-3);
  margin: var(--sp-3) 0 0;
  font-size: var(--fs-13);
  color: var(--ink-2);
  overflow-wrap: anywhere;
}
</style>
