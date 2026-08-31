<script setup lang="ts">
import type { ForumHomePayload, ForumThreadCard } from "~/types/forum";
import type { CommunityChartActivityPayload } from "~/types/ugc";
import { buildPageDescription } from "~/utils/seo";
import { resolveForumSectionTranslation } from "~/utils/forum";

const { t } = useI18n();
const localePath = useLocalePath();
const apiFetch = useViewerApiFetch();
const route = useRoute();
const activeFilter = useState("community-filter", () => String(route.query.filter || "latest"));

definePageMeta({ pageTitleKey: "forum.title", pageDescKey: "page.forum.index.desc", navKey: "/forum", breadcrumbs: [{ labelKey: "forum.title", to: "/forum" }] });
useViewerSeo(() => ({ title: t("forum.title"), description: buildPageDescription(t("page.forum.index.desc")), path: "/forum", keywords: [t("forum.title"), t("page.forum.index.keyword")] }));

const { data, pending, refresh } = await useLazyAsyncData<ForumHomePayload>("forum-home", () => apiFetch("/api/forum/home"), {
  default: () => ({ sections: [], featuredThreads: [], hotThreads: [], latestGuides: [], announcements: [], leaderboard: [], currentUser: null, unreadNotificationCount: 0, highlightedTags: [] })
});
const { data: chartActivity, pending: chartActivityPending } = await useLazyAsyncData<CommunityChartActivityPayload>("community-chart-activity", () => apiFetch("/api/content/community/chart-activity"), {
  default: () => ({ items: [] }),
  server: true
});
const home = computed(() => data.value);
const getSectionName = (slug: string, fallback = "") => resolveForumSectionTranslation(t, slug, fallback);
const uniqueThreads = (groups: ForumThreadCard[][]) => {
  const seen = new Set<number>();
  return groups.flat().filter((thread) => !seen.has(thread.id) && seen.add(thread.id));
};
const feedThreads = computed(() => {
  const source = activeFilter.value === "hot" ? home.value?.hotThreads || [] : activeFilter.value === "guide" ? home.value?.latestGuides || [] : activeFilter.value === "featured" ? home.value?.featuredThreads || [] : uniqueThreads([home.value?.featuredThreads || [], home.value?.hotThreads || [], home.value?.latestGuides || [], home.value?.announcements || []]);
  return uniqueThreads([source]).slice(0, 12);
});
const filters = computed(() => [
  { key: "latest", label: t("page.forum.index.latest") },
  { key: "hot", label: t("page.forum.index.hot") },
  { key: "guide", label: t("forum.types.guide") },
  { key: "featured", label: t("page.forum.index.featured") }
]);

const scrollStorageKey = "community-scroll-position";
let saveScrollPosition: (() => void) | null = null;
onMounted(() => {
  const saved = Number(sessionStorage.getItem(scrollStorageKey) || 0);
  if (saved > 0) requestAnimationFrame(() => window.scrollTo({ top: saved, behavior: "instant" as ScrollBehavior }));
  saveScrollPosition = () => sessionStorage.setItem(scrollStorageKey, String(window.scrollY));
  window.addEventListener("scroll", saveScrollPosition, { passive: true });
});
onBeforeUnmount(() => {
  if (saveScrollPosition) window.removeEventListener("scroll", saveScrollPosition);
  saveScrollPosition = null;
});
</script>

<template>
  <div class="community-page">
    <header class="community-header">
      <div><p class="community-kicker">{{ t("page.forum.index.kicker") }}</p><p class="community-subtitle">{{ t("page.forum.index.subtitle") }}</p></div>
      <div class="community-header__actions">
        <NuxtLink :to="localePath('/forum/notifications')" class="community-icon-link" :aria-label="t('forum.notifications')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 6 2.5 6.5 2.5 8H4c0-1.5 2.5-2 2.5-8ZM10 21h4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg><span v-if="home?.unreadNotificationCount" class="notification-dot">{{ home.unreadNotificationCount }}</span></NuxtLink>
        <NuxtLink :to="localePath('/forum/new')" class="community-publish">{{ t("forum.newThread") }}</NuxtLink>
      </div>
    </header>
    <nav class="community-filters" :aria-label="t('page.forum.index.filtersLabel')">
      <button v-for="filter in filters" :key="filter.key" type="button" class="community-filter" :class="{ 'is-active': activeFilter === filter.key }" :aria-pressed="activeFilter === filter.key" @click="activeFilter = filter.key">{{ filter.label }}</button>
      <span class="community-filter__rule" aria-hidden="true"></span>
      <NuxtLink v-for="section in home?.sections?.slice(0, 4)" :key="section.id" :to="localePath(`/forum/section/${section.slug}`)" class="community-section-link">{{ getSectionName(section.slug, section.name) }}</NuxtLink>
    </nav>
    <section v-if="pending || home?.hotThreads?.length" class="community-rail" aria-labelledby="active-discussions-title">
      <div class="community-section-heading"><div><p class="eyebrow">{{ t("page.forum.index.activeEyebrow") }}</p><h3 id="active-discussions-title">{{ t("page.forum.index.activeTitle") }}</h3></div><button type="button" class="text-action" @click="refresh">{{ t("common.retry") }}</button></div>
      <div v-if="pending" class="community-rail__items"><div v-for="n in 3" :key="n" class="community-skeleton"></div></div>
      <div v-else-if="home?.hotThreads?.length" class="community-rail__items" :class="{ 'is-single': home.hotThreads.length === 1 }"><NuxtLink v-for="thread in home.hotThreads.slice(0, 4)" :key="thread.id" :to="localePath(`/forum/thread/${thread.id}`)" class="active-thread"><span class="active-thread__type">{{ getSectionName(thread.section.slug, thread.section.name) }}</span><strong>{{ thread.title }}</strong><span>{{ thread.replyCount }} {{ t("forum.stats.reply") }} · {{ thread.likeCount }} {{ t("forum.stats.like") }}</span></NuxtLink></div>
    </section>
    <section v-if="chartActivityPending || chartActivity?.items?.length" class="community-chart-activity" aria-labelledby="chart-activity-title">
      <div class="community-section-heading"><div><p class="eyebrow">{{ t("community.chartActivity.eyebrow") }}</p><h3 id="chart-activity-title">{{ t("community.chartActivity.title") }}</h3></div></div>
      <div v-if="chartActivityPending" class="community-chart-activity__grid"><div v-for="n in 2" :key="n" class="community-skeleton"></div></div>
      <div v-else class="community-chart-activity__grid" :class="{ 'is-single': chartActivity.items.length === 1 }"><ForumCommunityChartActivityCard v-for="item in chartActivity.items" :key="item.chartId" :item="item" /></div>
    </section>
    <section class="community-feed" aria-labelledby="latest-discussions-title">
      <div class="community-section-heading"><div><p class="eyebrow">{{ t("page.forum.index.feedEyebrow") }}</p><h3 id="latest-discussions-title">{{ t("page.forum.index.feedTitle") }}</h3></div><NuxtLink :to="localePath('/forum')" class="text-action">{{ t("common.viewAll") }}</NuxtLink></div>
      <div v-if="pending" class="community-feed__list"><div v-for="n in 4" :key="n" class="community-skeleton community-skeleton--row"></div></div>
      <div v-else-if="feedThreads.length" class="community-feed__list"><ForumThreadCard v-for="thread in feedThreads" :key="thread.id" :thread="thread" compact /></div>
      <p v-else class="community-empty">{{ t("page.forum.index.empty") }}</p>
    </section>
  </div>
</template>

<style scoped>
.community-page { display: grid; gap: 20px; max-width: 1040px; margin: 0 auto; }
.community-header { display: flex; align-items: end; justify-content: space-between; gap: 18px; padding: 4px 0 2px; }
.community-kicker, .eyebrow { margin: 0; color: var(--viewer-accent-strong); font-size: 11px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
.community-header h2 { margin: 5px 0 0; color: var(--viewer-text); font-size: clamp(28px, 5vw, 42px); letter-spacing: -.03em; }
.community-subtitle { max-width: 560px; margin: 6px 0 0; color: var(--viewer-text-muted); line-height: 1.55; }
.community-header__actions { display: flex; align-items: center; gap: 9px; }
.community-icon-link, .community-publish { min-height: 44px; display: inline-flex; align-items: center; justify-content: center; border-radius: 12px; text-decoration: none; font-weight: 700; }
.community-icon-link { position: relative; width: 44px; color: var(--viewer-text-muted); border: 1px solid var(--viewer-border); font-size: 22px; }
.community-icon-link svg { width: 20px; height: 20px; }
.community-publish { padding: 0 16px; color: #fff; background: var(--viewer-accent-strong); box-shadow: 0 8px 18px rgba(196, 127, 79, .2); }
.notification-dot { position: absolute; top: -6px; right: -6px; min-width: 18px; padding: 2px 4px; border-radius: 99px; color: #fff; background: #c64c3a; font-size: 10px; text-align: center; }
.community-filters { display: flex; align-items: center; gap: 8px; overflow-x: auto; padding: 2px 0 8px; scrollbar-width: none; }
.community-filters::-webkit-scrollbar { display: none; }
.community-filter, .community-section-link { min-height: 38px; display: inline-flex; align-items: center; flex: 0 0 auto; padding: 0 14px; border: 1px solid var(--viewer-border); border-radius: 999px; color: var(--viewer-text-muted); background: transparent; font: inherit; font-size: 13px; text-decoration: none; cursor: pointer; }
.community-filter.is-active { border-color: var(--viewer-accent-strong); color: #fff; background: var(--viewer-accent-strong); }
.community-section-link { border-style: dashed; }
.community-filter__rule { width: 1px; height: 22px; flex: 0 0 auto; margin: 0 2px; background: var(--viewer-border); }
.community-section-heading { display: flex; align-items: end; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.community-section-heading h3 { margin: 3px 0 0; color: var(--viewer-text); font-size: 20px; }
.text-action { color: var(--viewer-accent-strong); background: none; border: 0; font: inherit; font-size: 13px; cursor: pointer; text-decoration: none; }
.community-rail__items { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(210px, 280px); gap: 10px; overflow-x: auto; padding-bottom: 3px; }
.community-rail__items.is-single { grid-auto-flow: row; grid-auto-columns: auto; overflow: visible; }
.active-thread { min-height: 116px; display: grid; align-content: start; gap: 7px; padding: 14px; border: 1px solid var(--viewer-border); border-radius: 14px; color: var(--viewer-text); background: var(--viewer-surface); text-decoration: none; transition: border-color .18s ease, transform .18s ease; }
.active-thread:hover, .active-thread:focus-visible { border-color: var(--viewer-accent-strong); transform: translateY(-1px); }
.active-thread strong { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; font-size: 15px; line-height: 1.35; }
.active-thread span:last-child { color: var(--viewer-text-muted); font-size: 12px; }
.active-thread__type { color: var(--viewer-accent-strong); font-size: 11px; }
.community-feed__list { display: grid; gap: 0; border-top: 1px solid var(--viewer-border); }
.community-chart-activity__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.community-chart-activity__grid.is-single { grid-template-columns: minmax(0, 1fr); }
.community-empty { margin: 0; padding: 24px 0; color: var(--viewer-text-muted); }
.community-skeleton { height: 116px; border-radius: 14px; background: linear-gradient(90deg, var(--viewer-surface), color-mix(in srgb, var(--viewer-border) 60%, var(--viewer-surface)), var(--viewer-surface)); background-size: 200% 100%; animation: shimmer 1.4s ease-in-out infinite; }
.community-skeleton--row { height: 92px; border-radius: 0; border-bottom: 1px solid var(--viewer-border); }
@keyframes shimmer { to { background-position: -200% 0; } }
@media (max-width: 700px) { .community-chart-activity__grid { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 560px) { .community-header { align-items: flex-start; } .community-publish { padding: 0 12px; font-size: 13px; } }
@media (prefers-reduced-motion: reduce) { .community-skeleton { animation: none; } .active-thread { transition: none; } }
</style>
