<script setup lang="ts">
import type { ForumHomePayload, ForumThreadCard } from "~/types/forum";
import type { CommunityChartActivityPayload } from "~/types/ugc";
import { buildPageDescription } from "~/utils/seo";

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

definePageMeta({ pageTitleKey: "forum.title", pageDescKey: "page.forum.index.desc", navKey: "/forum", hidePageHeader: true, contentLayout: "wide", reworkElementPlus: true, breadcrumbs: [{ labelKey: "forum.title", to: "/forum" }] });
useViewerSeo(() => ({ title: t("forum.title"), description: buildPageDescription(t("page.forum.index.desc")), path: "/forum", keywords: [t("forum.title"), t("page.forum.index.keyword")] }));

const { data, pending, error: homeError, refresh: refreshHome } = useForumResource<ForumHomePayload>('forum-home', () => apiFetch('/api/forum/home', { retry: 0 }));
// Home DTO has no latest feed. Read the existing list endpoint with its real
// latest ordering instead of relabelling a union of featured/hot/guides.
const { data: latest, pending: latestPending, error: latestError, refresh: refreshLatest } = useForumResource<{ items: ForumThreadCard[] }>(
  'forum-home-latest', () => apiFetch('/api/forum/threads', { query: { sort: 'latest', page: 1, pageSize: 12 }, retry: 0 }),
  { enabled: () => activeFilter.value === 'latest' }
);
// Server-render failures stay as rendered until the page has hydrated (useForumHydratedState).
const { pending: latestPendingView, error: latestErrorView } = useForumHydratedState(latestPending, latestError);
const { pending: homePendingView, error: homeErrorView } = useForumHydratedState(pending, homeError);
const feedPending = computed(() => activeFilter.value === 'latest' ? latestPendingView.value : homePendingView.value);
const feedError = computed(() => activeFilter.value === 'latest' ? latestErrorView.value : homeErrorView.value);
const retryFeed = () => activeFilter.value === 'latest' ? refreshLatest() : refreshHome();
const { data: chartActivity, pending: chartActivityPending } = await useLazyAsyncData<CommunityChartActivityPayload>("community-chart-activity", () => apiFetch("/api/content/community/chart-activity"), {
  default: () => ({ items: [] }),
  server: true
});
const home = computed(() => data.value);
// The home payload's unread count also updates the shell's bell (the same shared count the notification pages set).
const { setUnreadCount } = useForumUnreadCount();
watch(() => home.value?.unreadNotificationCount, (count) => { if (typeof count === "number") setUnreadCount(count); }, { immediate: true });
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
    <ReworkPageHeader class="community-header" :title="t('rework.community')">
      <template #actions>
        <NuxtLink :to="localePath('/forum/new')" class="rw-btn rw-btn--primary community-publish"><ReworkIcon name="edit" />{{ t("forum.newThread") }}</NuxtLink>
      </template>
    </ReworkPageHeader>
    <ReworkCommunityColumns has-side>
      <template #boards>
        <ReworkCommunityBoards :sections="home?.sections || []" />
      </template>
      <div class="community-feed-column">
        <div class="community-filters rw-seg" role="group" :aria-label="t('page.forum.index.filtersLabel')">
          <button v-for="filter in filters" :key="filter.key" type="button" :aria-pressed="activeFilter === filter.key" @click="selectFilter(filter.key)">{{ filter.label }}</button>
        </div>
        <ReworkState v-if="homeErrorView && activeFilter === 'latest'" kind="failed" :text="homeErrorView" compact @retry="refreshHome" />
        <section class="community-feed" aria-labelledby="latest-discussions-title">
          <div class="community-section-heading">
            <h2 id="latest-discussions-title">{{ t("page.forum.index.feedTitle") }}</h2>
            <NuxtLink :to="localePath(allDiscussionsPath)" class="rw-link">{{ t("common.viewAll") }}</NuxtLink>
          </div>
          <ReworkCommunityThreadList :items="feedPending || feedError ? null : feedThreads" :pending="feedPending" :error="feedError" :empty-title="t('page.forum.index.empty')" @retry="retryFeed">
            <template #empty>
              <NuxtLink :to="localePath('/forum/new')" class="rw-btn">{{ t("forum.newThread") }}</NuxtLink>
            </template>
          </ReworkCommunityThreadList>
        </section>
      </div>
      <template #side>
        <ReworkCommunityHomeSide
          class="community-chart-activity"
          :activity="chartActivity?.items || []"
          :activity-pending="chartActivityPending"
          :tags="home?.highlightedTags || []"
          :leaderboard="home?.leaderboard || []"
        />
      </template>
    </ReworkCommunityColumns>
  </div>
</template>

<style scoped>
/* Layout only (no DS tokens in pages): the reworked components carry colours and type. */
.community-page {
  display: grid;
  gap: 20px;
  width: 100%;
  min-width: 0;
}
.community-feed-column {
  display: grid;
  gap: 16px;
  min-width: 0;
}
.community-filters {
  justify-self: start;
}
.community-section-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 4px;
}
.community-section-heading h2 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 700;
}
@media (max-width: 767px) {
  /* the publish action stays on the title's row on phones */
  .community-header :deep(.rw-head__actions) {
    flex-basis: auto;
  }
}
</style>
