<script setup lang="ts">
// ReworkCommunityListPage — /forum/section/:slug and /forum/discussions (moved from components/forum/ThreadListPage.vue;
// the script is unchanged: the committed URL drives every read, filter edits stay a draft until applied, the page
// number is corrected into range by replace). Presentation: sections, the title search (the `keyword` filter, applied
// on submit), the sort row, an inline filter panel instead of the dialog, the thread list with its states, the pager.
import type { ForumSection, ForumThreadCard, ForumThreadType } from "~/types/forum";
import { parseForumListQuery, forumListLocationQuery, forumPageInRange } from "~/utils/forumListQuery";
import { buildPageDescription } from "~/utils/seo";
import { resolveForumSectionTranslation, resolveForumSectionDescription } from "~/utils/forum";

type ThreadListPayload = {
  total: number;
  page: number;
  pageSize: number;
  sort: string;
  items: ForumThreadCard[];
};

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const localePath = useLocalePath();
const apiFetch = useViewerApiFetch();

// Only the committed URL drives reads. Dialog edits are a draft until Apply.
const applied = computed(() => parseForumListQuery(route.query));
const filterState = reactive({ ...applied.value });
const filterOpen = ref(false);
const filterPanelId = useId();

const { data: sectionsData, error: sectionsError, pending: sectionsPending, refresh: refreshSections } = useForumResource<{ items: ForumSection[] }>(
  `forum-sections:${route.path}`, () => apiFetch('/api/forum/sections', { retry: 0 })
);

const currentSection = computed(
  () => sectionsData.value?.items.find((item) => item.slug === String(route.params.slug || "")) || null
);

const localizedSectionName = computed(() =>
  !route.params.slug ? t("community.relatedDiscussions") : currentSection.value ? resolveForumSectionTranslation(t, currentSection.value.slug, currentSection.value.name) : ""
);
const localizedSectionDescription = computed(() =>
  currentSection.value ? resolveForumSectionDescription(t, currentSection.value.slug, currentSection.value.description) : ""
);

useViewerSeo(() => ({
  title: localizedSectionName.value || `${t("page.forum.section.title")} - ${String(route.params.slug || "")}`,
  description: buildPageDescription(localizedSectionDescription.value || t("page.forum.section.desc")),
  path: route.params.slug ? `/forum/section/${route.params.slug}` : "/forum/discussions",
  keywords: [t("page.forum.section.title"), localizedSectionName.value || ""].filter(Boolean)
}));

const fixedSectionSlug = computed(() => String(route.params.slug || ""));
const selectedSectionSlug = computed(() => fixedSectionSlug.value || applied.value.sectionSlug);
const sectionOptions = computed(() => [
  { label: t("page.forum.section.allSections"), value: "" },
  ...(sectionsData.value?.items || []).map(item => ({
    label: resolveForumSectionTranslation(t, item.slug, item.name), value: item.slug
  }))
]);
const requestQuery = computed(() => ({ ...applied.value, sectionSlug: selectedSectionSlug.value || undefined, pageSize: 12 }));
const { data, pending, error, refresh } = useForumResource<ThreadListPayload>(
  `forum-thread-list:${route.path}`, () => apiFetch('/api/forum/threads', { query: requestQuery.value, retry: 0 }),
  { context: () => `${route.path}:${JSON.stringify(requestQuery.value)}` }
);
const correctedPage = computed(() => data.value ? forumPageInRange(applied.value.page, data.value.total, data.value.pageSize) : applied.value.page);
const correctingPage = computed(() => correctedPage.value !== applied.value.page);
// Server-render failures stay as rendered until the page has hydrated (useForumHydratedState).
const { pending: listPendingView, error: listErrorView } = useForumHydratedState(pending, error);
const { error: sectionsErrorView } = useForumHydratedState(sectionsPending, sectionsError);
const listLoading = computed(() => listPendingView.value || correctingPage.value);
watch(data, payload => {
  if (!payload || !correctingPage.value) return;
  void router.replace({ query: { ...route.query, page: correctedPage.value > 1 ? String(correctedPage.value) : undefined } });
}, { immediate: true, flush: 'post' });
const section = currentSection;

const sortOptions = computed(() => [
  { label: t("page.forum.section.sortLatest"), value: "latest" },
  { label: t("page.forum.section.sortHot"), value: "hot" },
  { label: t("page.forum.section.sortFeatured"), value: "featured" }
]);

const typeOptions = computed<Array<{ label: string; value: "" | ForumThreadType }>>(() => [
  { label: t("page.forum.section.allTypes"), value: "" },
  { label: t("forum.types.discussion"), value: "discussion" },
  { label: t("forum.types.guide"), value: "guide" },
  { label: t("forum.types.achievement"), value: "achievement" },
  { label: t("forum.types.official"), value: "official" }
]);

const totalPages = computed(() => Math.max(1, Math.ceil((data.value?.total || 0) / (data.value?.pageSize || 12))));
const activeFilterCount = computed(() => Number(Boolean(applied.value.keyword)) + Number(Boolean(applied.value.threadType)) + Number(applied.value.sort === "featured") + Number(!fixedSectionSlug.value && Boolean(applied.value.sectionSlug)));
const boardsCurrent = computed(() => fixedSectionSlug.value || (route.path.endsWith("/forum/discussions") && !applied.value.sectionSlug ? "all" : applied.value.sectionSlug));
const clearFilters = () => pushFilters(1, { ...applied.value, keyword: "", threadType: "", sort: "latest", sectionSlug: fixedSectionSlug.value ? applied.value.sectionSlug : "" });
const newThreadPath = computed(() => ({
  path: "/forum/new",
  query: {
    ...(selectedSectionSlug.value ? { section: selectedSectionSlug.value } : {}),
    ...(applied.value.songId ? { songId: applied.value.songId } : {}),
    ...(applied.value.difficultyType ? { difficulty: applied.value.difficultyType } : {})
  }
}));

const pushFilters = async (page = 1, filters = filterState) => {
  await router.push({ query: forumListLocationQuery({ ...filters, page }) });
  filterOpen.value = false;
};
watch(() => route.query, () => Object.assign(filterState, applied.value));
watch(filterOpen, open => { if (open) Object.assign(filterState, applied.value); });
</script>

<template>
  <div class="forum-section-page">
    <ReworkPageHeader class="cl-head" :title="localizedSectionName || t('page.forum.section.title')">
      <p v-if="route.params.slug && localizedSectionDescription" class="cl-desc">{{ localizedSectionDescription }}</p>
      <template #actions>
        <NuxtLink :to="localePath(newThreadPath)" class="rw-btn rw-btn--primary"><ReworkIcon name="edit" />{{ t("forum.writeThread") }}</NuxtLink>
      </template>
    </ReworkPageHeader>
    <ReworkCommunityColumns>
      <template #boards>
        <ReworkState v-if="sectionsErrorView" kind="failed" :text="sectionsErrorView" compact @retry="refreshSections" />
        <ReworkCommunityBoards v-else :sections="sectionsData?.items || []" :current="boardsCurrent" />
      </template>
      <div class="cl-main">
        <ReworkCommunitySearch :model-value="applied.keyword" @search="(keyword) => pushFilters(1, { ...applied, keyword })" />
        <div class="cl-bar filter-panel">
          <div class="rw-seg sort-chips" role="group" :aria-label="t('page.forum.section.sortLabel')">
            <button v-for="option in sortOptions.slice(0, 2)" :key="option.value" type="button" :aria-pressed="applied.sort === option.value" @click="pushFilters(1, { ...applied, sort: option.value })">{{ option.label }}</button>
          </div>
          <span v-if="data && !correctingPage" class="rw-count cl-total" role="status">{{ t("rework.forum.list.total", { count: route.params.slug ? (section?.threadCount ?? data.total) : data.total }) }}</span>
          <button type="button" class="rw-btn rw-btn--sm filter-trigger" :aria-expanded="filterOpen" :aria-controls="filterPanelId" @click="filterOpen = !filterOpen">
            {{ t("page.forum.section.filter") }}<span v-if="activeFilterCount" class="num">· {{ activeFilterCount }}</span><ReworkIcon name="chevron" />
          </button>
        </div>
        <form v-if="filterOpen" :id="filterPanelId" class="rw-form cl-filters" @submit.prevent="pushFilters()">
          <label v-if="!fixedSectionSlug" class="rw-field">
            <span class="rw-field__label">{{ t("page.forum.section.sectionLabel") }}</span>
            <select v-model="filterState.sectionSlug" class="rw-select">
              <option v-for="option in sectionOptions" :key="option.value || 'all'" :value="option.value">{{ option.label }}</option>
            </select>
          </label>
          <label class="rw-field">
            <span class="rw-field__label">{{ t("rework.forum.list.sort") }}</span>
            <select v-model="filterState.sort" class="rw-select">
              <option v-for="option in sortOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </label>
          <label class="rw-field">
            <span class="rw-field__label">{{ t("rework.forum.list.type") }}</span>
            <select v-model="filterState.threadType" class="rw-select">
              <option v-for="option in typeOptions" :key="option.value || 'all'" :value="option.value">{{ option.label }}</option>
            </select>
          </label>
          <button type="submit" class="rw-btn rw-btn--primary">{{ t("page.forum.section.applyFilters") }}</button>
        </form>
        <section class="thread-list-panel" :aria-label="localizedSectionName || t('page.forum.section.title')">
          <ReworkCommunityThreadList :items="listLoading || listErrorView ? null : data?.items || []" :pending="listLoading" :error="listErrorView" :empty-title="t('page.forum.section.empty')" @retry="refresh">
            <template #empty>
              <button v-if="activeFilterCount" type="button" class="rw-btn" @click="clearFilters">{{ t("rework.forum.list.clear") }}</button>
              <NuxtLink :to="localePath(newThreadPath)" class="rw-btn">{{ t("forum.writeThread") }}</NuxtLink>
            </template>
          </ReworkCommunityThreadList>
        </section>
        <ReworkPager v-if="data && !correctingPage && totalPages > 1" class="pager-panel" :page="applied.page" :count="totalPages" @select="(page) => pushFilters(page, applied)" />
      </div>
    </ReworkCommunityColumns>
  </div>
</template>

<style scoped>
/* Layout only; the reworked components and the rw-* classes carry colours and type. */
.forum-section-page {
  display: grid;
  gap: 20px;
  min-width: 0;
}
.cl-desc {
  margin: 6px 0 0;
  max-width: 640px;
  line-height: 1.6;
}
.cl-main {
  display: grid;
  gap: 16px;
  min-width: 0;
}
.cl-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}
.cl-total {
  margin-left: auto;
}
.filter-trigger svg {
  width: 16px;
  height: 16px;
}
.filter-trigger[aria-expanded="true"] svg {
  transform: rotate(180deg);
}
.thread-list-panel {
  min-width: 0;
}
@media (max-width: 767px) {
  .cl-head :deep(.rw-head__actions) {
    flex-basis: auto;
  }
}
</style>
