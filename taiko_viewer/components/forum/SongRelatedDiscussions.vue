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
</script>

<template>
  <section class="related-discussions" :class="{ 'related-discussions--song-detail': appearance === 'song-detail' }" :aria-labelledby="`related-discussions-${songId}`">
    <div class="related-discussions__head"><h3 :id="`related-discussions-${songId}`">{{ t("community.relatedDiscussions") }}</h3><NuxtLink :to="localePath({ path: '/forum/discussions', query: { songId: String(songId), ...(difficultyType ? { difficultyType: String(difficultyType) } : {}) } })">{{ t("community.viewAllDiscussions") }}</NuxtLink></div>
    <div v-if="pending" class="related-discussions__loading">{{ t("layout.loading") }}</div>
    <ul v-else-if="items.length" class="related-discussions__list">
      <li v-for="thread in items" :key="thread.id"><NuxtLink :to="localePath(`/forum/thread/${thread.id}`)"><span>{{ thread.title }}</span><small>{{ thread.replyCount }} {{ t("forum.stats.reply") }}<template v-if="thread.song?.difficultyType"> · {{ thread.song.difficultyLabel }}</template></small></NuxtLink></li>
    </ul>
    <p v-else class="related-discussions__empty">{{ t("community.noRelatedDiscussions") }}</p>
    <NuxtLink class="related-discussions__compose" :to="localePath({ path: '/forum/new', query: composeQuery })">{{ t("community.discussThisChart") }}</NuxtLink>
  </section>
</template>

<style scoped>
.related-discussions { display: grid; gap: 9px; padding: 14px; border: 1px solid var(--viewer-border); border-radius: 14px; background: var(--viewer-surface); }
.related-discussions__head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.related-discussions h3 { margin: 0; font-size: 16px; }
.related-discussions a { color: var(--viewer-accent-strong); text-decoration: none; }
.related-discussions__head a, .related-discussions__compose { font-size: 12px; }
.related-discussions__list { display: grid; gap: 5px; margin: 0; padding: 0; list-style: none; }
.related-discussions__list li a { display: flex; justify-content: space-between; gap: 10px; padding: 7px 0; color: var(--viewer-text); border-bottom: 1px solid var(--viewer-border); }
.related-discussions__list span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.related-discussions__list small { flex: 0 0 auto; color: var(--viewer-text-muted); }
.related-discussions__loading { color: var(--viewer-text-muted); font-size: 13px; }
</style>

<style scoped>
.related-discussions--song-detail {padding:24px 0 0;border:0;border-top:1px solid var(--song-rule);border-radius:0;background:transparent;gap:14px;}
.related-discussions--song-detail .related-discussions__head {align-items:baseline;flex-wrap:wrap;gap:6px 16px;}
.related-discussions--song-detail h3 {font-size:18px;font-weight:600;line-height:1.5;}
.related-discussions--song-detail a {color:var(--song-link);font-size:14px;min-height:44px;display:inline-flex;align-items:center;}
.related-discussions--song-detail .related-discussions__head>a {padding:8px 0;}
.related-discussions--song-detail .related-discussions__empty {font-size:15px;line-height:1.7;margin:0;color:var(--song-muted);}
.related-discussions--song-detail .related-discussions__list li a {display:grid;width:100%;gap:8px;padding:12px 0;}
.related-discussions--song-detail .related-discussions__list span {white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:anywhere;color:var(--song-ink);}
.related-discussions--song-detail .related-discussions__list small {font-size:14px;}
.related-discussions--song-detail a:focus-visible {outline:3px solid var(--song-link);outline-offset:3px;}
</style>
