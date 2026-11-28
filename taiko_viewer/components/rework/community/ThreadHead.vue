<script setup lang="ts">
// ReworkCommunityThreadHead — the thread's header: section (link), type and states, the title as the page <h1>, the
// author (avatar, name linking to their page, role, titles), when it was posted, reply and view counts, tags (each
// searches all discussions, like the home page's tags).
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
</script>

<template>
  <ReworkPageHeader class="th" :title="thread.title">
    <template #eyebrow>
      <NuxtLink :to="localePath(`/forum/section/${thread.section.slug}`)" class="th__sec">{{ sectionName }}</NuxtLink>
      <span class="th__tag">{{ typeText }}</span>
      <span v-for="state in states" :key="state" class="th__tag" :class="`is-${state}`">{{ stateText(state) }}</span>
    </template>
    <div class="th__by">
      <ReworkCommunityAuthor :user="thread.author" :size="44" titles="plate" link />
      <p class="th__facts">
        <ReworkCommunityTime :value="thread.createdAt" />
        <span><b class="num">{{ thread.replyCount }}</b> {{ t("forum.stats.reply") }}</span>
        <span><b class="num">{{ thread.viewCount }}</b> {{ t("forum.stats.view") }}</span>
      </p>
    </div>
    <p v-if="thread.tags.length" class="th__tags">
      <NuxtLink v-for="tag in thread.tags" :key="tag" class="th__tagchip" :to="localePath({ path: '/forum/discussions', query: { keyword: tag } })">#{{ tag }}</NuxtLink>
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
  height: 24px;
  padding: 0 var(--sp-2);
  border-radius: var(--tag-radius);
  background: var(--info-wash);
  color: var(--info-ink);
  font-size: var(--fs-12);
  font-weight: 700;
  text-decoration: none;
}
.th__sec:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}
.th__sec:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.th__tag {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 var(--sp-2);
  border-radius: var(--tag-radius);
  background: var(--tag-info-bg);
  color: var(--tag-info-ink);
  font-size: var(--fs-12);
  font-weight: 600;
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
  gap: var(--sp-2);
  margin: var(--sp-3) 0 0;
}
.th__tagchip {
  display: inline-flex;
  align-items: center;
  min-height: 36px;
  max-width: 100%;
  padding: 0 var(--sp-3);
  border: 1px solid var(--line-strong);
  border-radius: var(--r-note);
  color: var(--ink-2);
  font-size: var(--fs-12);
  font-weight: 600;
  text-decoration: none;
  overflow-wrap: anywhere;
}
.th__tagchip:hover {
  background: var(--bg-sunk);
  color: var(--link);
}
.th__tagchip:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
</style>
