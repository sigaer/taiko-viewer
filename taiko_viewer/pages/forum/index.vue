<script setup lang="ts">
import type { ForumHomePayload, ForumThreadCard } from "~/types/forum";
import type { CommunityChartActivityPayload } from "~/types/ugc";
import { buildPageDescription } from "~/utils/seo";
import { resolveForumSectionTranslation } from "~/utils/forum";

const { t } = useI18n();
const localePath = useLocalePath();
const apiFetch = useViewerApiFetch();
const route = useRoute();
const router = useRouter();
const activeFilter = computed(() => ['hot', 'guide', 'featured'].includes(String(route.query.filter)) ? String(route.query.filter) : 'latest');
const selectFilter = (filter: string) => router.push({ query: { ...route.query, filter: filter === 'latest' ? undefined : filter } });
const allDiscussionsPath = computed(() => ({ path: '/forum/discussions', query: {
  ...(activeFilter.value === 'hot' || activeFilter.value === 'featured' ? { sort: activeFilter.value } : {}),
  ...(activeFilter.value === 'guide' ? { threadType: 'guide' } : {})
} }));

definePageMeta({ pageTitleKey: "forum.title", pageDescKey: "page.forum.index.desc", navKey: "/forum", hidePageHeader: true, breadcrumbs: [{ labelKey: "forum.title", to: "/forum" }] });
useViewerSeo(() => ({ title: t("forum.title"), description: buildPageDescription(t("page.forum.index.desc")), path: "/forum", keywords: [t("forum.title"), t("page.forum.index.keyword")] }));

const { data, pending, error: homeError, refresh: refreshHome } = useForumResource<ForumHomePayload>('forum-home', () => apiFetch('/api/forum/home', { retry: 0 }));
// Home DTO has no latest feed. Read the existing list endpoint with its real
// latest ordering instead of relabelling a union of featured/hot/guides.
const { data: latest, pending: latestPending, error: latestError, refresh: refreshLatest } = useForumResource<{ items: ForumThreadCard[] }>(
  'forum-home-latest', () => apiFetch('/api/forum/threads', { query: { sort: 'latest', page: 1, pageSize: 12 }, retry: 0 }),
  { enabled: () => activeFilter.value === 'latest' }
);
const feedPending = computed(() => activeFilter.value === 'latest' ? latestPending.value : pending.value);
const feedError = computed(() => activeFilter.value === 'latest' ? latestError.value : homeError.value);
const retryFeed = () => activeFilter.value === 'latest' ? refreshLatest() : refreshHome();
const { data: chartActivity, pending: chartActivityPending } = await useLazyAsyncData<CommunityChartActivityPayload>("community-chart-activity", () => apiFetch("/api/content/community/chart-activity"), {
  default: () => ({ items: [] }),
  server: true
});
const home = computed(() => data.value);
const getSectionName = (slug: string, fallback = "") => resolveForumSectionTranslation(t, slug, fallback);
const feedThreads = computed(() => (activeFilter.value === 'latest' ? latest.value?.items : activeFilter.value === 'hot' ? home.value?.hotThreads : activeFilter.value === 'guide' ? home.value?.latestGuides : home.value?.featuredThreads) || []);
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
      <h1>{{ t("forum.title") }}</h1>
      <div class="community-header__actions">
        <NuxtLink :to="localePath('/forum/notifications')" class="community-icon-link" :aria-label="t('forum.notifications')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 6 2.5 6.5 2.5 8H4c0-1.5 2.5-2 2.5-8ZM10 21h4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg><span v-if="home?.unreadNotificationCount" class="notification-dot">{{ home.unreadNotificationCount }}</span></NuxtLink>
        <NuxtLink :to="localePath('/forum/new')" class="community-publish">{{ t("forum.newThread") }}</NuxtLink>
      </div>
    </header>
    <nav class="community-filters" :aria-label="t('page.forum.index.filtersLabel')">
      <button v-for="filter in filters" :key="filter.key" type="button" class="community-filter" :class="{ 'is-active': activeFilter === filter.key }" :aria-pressed="activeFilter === filter.key" @click="selectFilter(filter.key)">{{ filter.label }}</button>
      <span class="community-filter__rule" aria-hidden="true"></span>
      <NuxtLink v-for="section in home?.sections?.slice(0, 4)" :key="section.id" :to="localePath(`/forum/section/${section.slug}`)" class="community-section-link">{{ getSectionName(section.slug, section.name) }}</NuxtLink>
    </nav>
    <ForumReadState v-if="homeError && activeFilter === 'latest'" :pending="pending" :error="homeError" @retry="refreshHome" />
    <section class="community-feed" aria-labelledby="latest-discussions-title">
      <div class="community-section-heading"><h2 id="latest-discussions-title">{{ t("page.forum.index.feedTitle") }}</h2><NuxtLink :to="localePath(allDiscussionsPath)" class="text-action">{{ t("common.viewAll") }}</NuxtLink></div>
      <div v-if="feedPending" class="community-feed__list"><div v-for="n in 4" :key="n" class="community-skeleton community-skeleton--row"></div></div>
      <ForumReadState v-else-if="feedError" :pending="false" :error="feedError" @retry="retryFeed" />
      <div v-else-if="feedThreads.length" class="community-feed__list"><ForumThreadCard v-for="thread in feedThreads" :key="thread.id" :thread="thread" compact /></div>
      <p v-else class="community-empty">{{ t("page.forum.index.empty") }}</p>
    </section>
    <section v-if="chartActivityPending || chartActivity?.items?.length" class="community-chart-activity" aria-labelledby="chart-activity-title">
      <div class="community-section-heading"><h2 id="chart-activity-title">{{ t("community.chartActivity.title") }}</h2></div>
      <div v-if="chartActivityPending" class="community-chart-activity__grid"><div v-for="n in 2" :key="n" class="community-skeleton"></div></div>
      <div v-else class="community-chart-activity__grid" :class="{ 'is-single': chartActivity.items.length === 1 }"><ForumCommunityChartActivityCard v-for="item in chartActivity.items" :key="item.chartId" :item="item" /></div>
    </section>
  </div>
</template>

<style scoped>
.community-page { display: grid; gap: 20px; width: 100%; }
.community-header { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 4px 0 2px; }
.community-header h1 { margin: 0; color:var(--viewer-text); font-size: clamp(28px, 5vw, 42px); letter-spacing: -.03em; }
.community-header__actions { display: flex; align-items: center; gap: 9px; }
.community-icon-link, .community-publish { min-height: 44px; display: inline-flex; align-items: center; justify-content: center; border-radius: 12px; text-decoration: none; font-weight: 700; }
.community-icon-link { position: relative; width: 44px; color:var(--viewer-text-muted); border: 1px solid var(--viewer-border); font-size: 22px; }
.community-icon-link svg { width: 20px; height: 20px; }
.community-publish { padding: 0 16px; color:var(--viewer-on-primary); background:var(--viewer-primary); box-shadow:none; }
.notification-dot { position: absolute; top: -6px; right: -6px; min-width: 18px; padding: 2px 4px; border-radius: 99px; color:var(--viewer-on-primary); background:var(--viewer-primary); font-size: 10px; text-align: center; }
.community-filters { display: flex; align-items: center; gap: 8px; overflow-x: auto; padding: 2px 0 8px; scrollbar-width: none; }
.community-filters::-webkit-scrollbar { display: none; }
.community-filter, .community-section-link { min-height: 38px; display: inline-flex; align-items: center; flex: 0 0 auto; padding: 0 14px; border: 1px solid var(--viewer-border); border-radius: 999px; color:var(--viewer-text-muted); background:transparent; font: inherit; font-size: 13px; text-decoration: none; cursor: pointer; }
.community-filter.is-active { border-color:var(--viewer-accent-strong); color:var(--viewer-on-primary); background:var(--viewer-primary); }
.community-section-link { border-color:transparent; }
.community-filter__rule { width: 1px; height: 22px; flex: 0 0 auto; margin: 0 2px; background:var(--viewer-border); }
.community-section-heading { display: flex; align-items: end; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.community-section-heading h2 { margin: 0; color:var(--viewer-text); font-size: 20px; }
.text-action { color:var(--viewer-accent-strong); background:none; border: 0; font: inherit; font-size: 13px; cursor: pointer; text-decoration: none; }
.community-feed__list { display: grid; gap: 0; border-top: 1px solid var(--viewer-border); }
.community-chart-activity__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.community-chart-activity__grid.is-single { grid-template-columns: minmax(0, 1fr); }
.community-empty { margin: 0; padding: 24px 0; color:var(--viewer-text-muted); }
.community-skeleton { height: 116px; border-radius: 14px; background:linear-gradient(90deg, var(--viewer-surface), color-mix(in srgb, var(--viewer-border) 60%, var(--viewer-surface)), var(--viewer-surface)); background-size: 200% 100%; animation: shimmer 1.4s ease-in-out infinite; }
.community-skeleton--row { height: 92px; border-radius: 0; border-bottom: 1px solid var(--viewer-border); }
@keyframes shimmer { to { background-position: -200% 0; } }
@media (max-width: 700px) { .community-chart-activity__grid { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 560px) { .community-header { align-items: flex-start; } .community-publish { padding: 0 12px; font-size: 13px; } }
@media (prefers-reduced-motion: reduce) { .community-skeleton { animation: none; } .active-thread { transition: none; } }
</style>
