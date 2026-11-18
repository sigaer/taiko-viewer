<script setup lang="ts">
import type { ForumThreadCard } from "~/types/forum";

const props = defineProps<{ songId: number; difficultyType?: number; appearance?: "song-detail" }>();
const { t } = useI18n();
const localePath = useLocalePath();
const apiFetch = useViewerApiFetch();
const { data, pending } = await useLazyAsyncData<{ items: ForumThreadCard[] }>(
  () => `song-related-discussions-${props.songId}-${props.difficultyType || 0}`,
  () => apiFetch("/api/forum/threads", { query: { songId: props.songId, difficultyType: props.difficultyType || undefined, page: 1, pageSize: 3, sort: "latest" } }),
  { default: () => ({ items: [] }), server: true }
);
const items = computed(() => data.value?.items || []);
const composeQuery = computed(() => ({ songId: String(props.songId), ...(props.difficultyType ? { difficulty: String(props.difficultyType) } : {}) }));
const compactEmpty = computed(() => props.appearance === "song-detail" && !pending.value && !items.value.length);
const allDiscussionsLocation = computed(() => ({ path: '/forum/discussions', query: { songId: String(props.songId), ...(props.difficultyType ? { difficultyType: String(props.difficultyType) } : {}) } }));
</script>

<template>
  <section class="related-discussions" :class="{ 'related-discussions--song-detail': appearance === 'song-detail' }" :aria-labelledby="`related-discussions-${songId}`">
    <div class="related-discussions__head"><component :is="appearance === 'song-detail' ? 'h2' : 'h3'" :id="`related-discussions-${songId}`" class="related-discussions__title">{{ appearance === 'song-detail' ? t("rework.songDetail.discussions.title") : t("community.relatedDiscussions") }}</component><NuxtLink v-if="compactEmpty" class="related-discussions__compose" :to="localePath({ path: '/forum/new', query: composeQuery })">{{ t("community.discussThisChart") }}</NuxtLink><NuxtLink v-else :to="localePath(allDiscussionsLocation)">{{ t("community.viewAllDiscussions") }}</NuxtLink></div>
    <div v-if="pending" class="related-discussions__loading">{{ t("layout.loading") }}</div>
    <ul v-else-if="items.length" class="related-discussions__list">
      <li v-for="thread in items" :key="thread.id"><ReworkCommunityThreadRow :thread="thread" compact /></li>
    </ul>
    <template v-else>
      <div v-if="compactEmpty" class="related-discussions__empty-row"><p class="related-discussions__empty">{{ t("community.noRelatedDiscussions") }}</p><NuxtLink :to="localePath(allDiscussionsLocation)">{{ t("rework.songDetail.discussions.all") }} →</NuxtLink></div>
      <p v-else class="related-discussions__empty">{{ t("community.noRelatedDiscussions") }}</p>
    </template>
    <NuxtLink v-if="!compactEmpty" class="related-discussions__compose" :to="localePath({ path: '/forum/new', query: composeQuery })">{{ t("community.discussThisChart") }}</NuxtLink>
  </section>
</template>

<style scoped>
.related-discussions { display: grid; gap: 9px; padding: 14px; border: 1px solid var(--viewer-border); border-radius: 14px; background:var(--viewer-surface); }
.related-discussions__head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.related-discussions__title { margin: 0; font-size: 16px; }
.related-discussions a { color:var(--viewer-accent-strong); text-decoration: none; }
.related-discussions__head a, .related-discussions__compose { font-size: 12px; }
.related-discussions__list { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; }
.related-discussions__loading { color:var(--viewer-text-muted); font-size: 13px; }
</style>

<style scoped>
.related-discussions--song-detail {padding:0 4px;border:0;border-radius:0;background:transparent;gap:4px;}
.related-discussions--song-detail .related-discussions__head {align-items:baseline;flex-wrap:wrap;gap:6px 16px;}
.related-discussions--song-detail .related-discussions__title {font-size:18px;font-weight:600;line-height:1.5;}
.related-discussions--song-detail a {color:var(--viewer-link);font-size:14px;min-height:44px;display:inline-flex;align-items:center;}
.related-discussions--song-detail .related-discussions__head>a {padding:8px 0;}
.related-discussions--song-detail .related-discussions__empty {font-size:15px;line-height:1.7;margin:0;color:var(--viewer-text-muted);}
.related-discussions--song-detail .related-discussions__empty-row {display:flex;align-items:center;justify-content:space-between;gap:8px 16px;flex-wrap:wrap;}
.related-discussions--song-detail a:focus-visible {outline:3px solid var(--viewer-link);outline-offset:3px;}
</style>
