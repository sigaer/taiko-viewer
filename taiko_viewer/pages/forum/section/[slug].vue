<script setup lang="ts">
import type { ForumSection, ForumThreadCard, ForumThreadType } from "~/types/forum";
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

const filterState = reactive({
  keyword: String(route.query.keyword || ""),
  sort: String(route.query.sort || "latest"),
  threadType: String(route.query.threadType || ""),
  songId: String(route.query.songId || ""),
  difficultyType: String(route.query.difficultyType || ""),
  page: Number(route.query.page || 1)
});
const filterOpen = ref(false);

definePageMeta({
  pageTitleKey: "page.forum.section.title",
  pageDescKey: "page.forum.section.desc",
  navKey: "/forum",
  breadcrumbs: [
    { labelKey: "forum.title", to: "/forum" },
    { labelKey: "page.forum.section.title" }
  ]
});

const { data: sectionsData } = await useAsyncData<{ items: ForumSection[] }>(
  "forum-sections",
  () => apiFetch("/api/forum/sections"),
  {
    default: () => ({ items: [] })
  }
);

const currentSection = computed(
  () => sectionsData.value?.items.find((item) => item.slug === String(route.params.slug || "")) || null
);

const localizedSectionName = computed(() =>
  currentSection.value ? resolveForumSectionTranslation(t, currentSection.value.slug, currentSection.value.name) : ""
);
const localizedSectionDescription = computed(() =>
  currentSection.value ? resolveForumSectionDescription(t, currentSection.value.slug, currentSection.value.description) : ""
);

useViewerSeo(() => ({
  title: localizedSectionName.value || `${t("page.forum.section.title")} - ${String(route.params.slug || "")}`,
  description: buildPageDescription(localizedSectionDescription.value || t("page.forum.section.desc")),
  path: `/forum/section/${route.params.slug}`,
  keywords: [t("page.forum.section.title"), localizedSectionName.value || ""].filter(Boolean)
}));

const requestQuery = computed(() => ({
  sectionSlug: route.params.slug,
  keyword: filterState.keyword,
  sort: filterState.sort,
  threadType: filterState.threadType,
  songId: filterState.songId,
  difficultyType: filterState.difficultyType,
  page: filterState.page,
  pageSize: 12
}));

const { data, pending, refresh } = await useAsyncData<ThreadListPayload>(
  () => `forum-section-${route.params.slug}-${JSON.stringify(requestQuery.value)}`,
  () =>
    apiFetch("/api/forum/threads", {
      query: requestQuery.value
    }),
  {
    watch: [requestQuery],
    default: () => ({
      total: 0,
      page: 1,
      pageSize: 12,
      sort: "latest",
      items: []
    })
  }
);

const section = computed(() => sectionsData.value.items.find((item) => item.slug === route.params.slug));

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
const activeFilterCount = computed(() => Number(Boolean(filterState.keyword)) + Number(Boolean(filterState.threadType)) + Number(filterState.sort === "featured"));
const newThreadPath = computed(() => `/forum/new?section=${encodeURIComponent(String(route.params.slug || ""))}`);

const pushFilters = async (page = 1) => {
  filterState.page = page;
  await router.push({
    query: {
      keyword: filterState.keyword || undefined,
      sort: filterState.sort !== "latest" ? filterState.sort : undefined,
      threadType: filterState.threadType || undefined,
      songId: filterState.songId || undefined,
      difficultyType: filterState.difficultyType || undefined,
      page: page > 1 ? String(page) : undefined
    }
  });
  await refresh();
  filterOpen.value = false;
};

watch(
  () => route.query,
  (query) => {
    filterState.keyword = String(query.keyword || "");
    filterState.sort = String(query.sort || "latest");
    filterState.threadType = String(query.threadType || "");
    filterState.songId = String(query.songId || "");
    filterState.difficultyType = String(query.difficultyType || "");
    filterState.page = Math.max(1, Number(query.page || 1));
  }
);
</script>

<template>
  <div class="forum-section-page">
    <section class="section-hero" :style="{ '--section-accent': section?.accentColor || '#d84a34' }">
      <div>
        <h2>{{ localizedSectionName || t("page.forum.section.title") }}</h2>
        <p>{{ localizedSectionDescription || t("page.forum.section.heroDesc") }}</p>
      </div>
      <div class="section-hero__stats">
        <span>{{ section?.threadCount || 0 }} {{ t("page.forum.section.threads") }}</span>
        <NuxtLink :to="localePath(newThreadPath)">{{ t("forum.writeThread") }}</NuxtLink>
      </div>
    </section>

    <section class="filter-panel">
      <div class="sort-chips" role="group" :aria-label="t('page.forum.section.sortLabel')">
        <button v-for="option in sortOptions.slice(0, 2)" :key="option.value" type="button" :class="{ active: filterState.sort === option.value }" :aria-pressed="filterState.sort === option.value" @click="filterState.sort = option.value; pushFilters()">{{ option.label }}</button>
      </div>
      <button type="button" class="filter-trigger" :aria-expanded="filterOpen" @click="filterOpen = true">{{ t("page.forum.section.filter") }}<span v-if="activeFilterCount">{{ activeFilterCount }}</span></button>
    </section>

    <section class="thread-list-panel">
      <el-empty v-if="!pending && !data?.items.length" :description="t('page.forum.section.empty')" />
      <div v-else class="thread-list">
        <ForumThreadCard v-for="thread in data?.items" :key="thread.id" :thread="thread" compact />
      </div>
    </section>

    <section class="pager-panel">
      <div>{{ t("page.forum.section.pagination", { page: data?.page || 1, totalPages, total: data?.total || 0 }) }}</div>
      <div class="pager-panel__actions">
        <el-button :disabled="filterState.page <= 1" @click="pushFilters(filterState.page - 1)">{{ t("page.forum.section.prevPage") }}</el-button>
        <el-button :disabled="filterState.page >= totalPages" @click="pushFilters(filterState.page + 1)">{{ t("page.forum.section.nextPage") }}</el-button>
      </div>
    </section>

    <el-dialog v-model="filterOpen" :title="t('page.forum.section.filter')" class="section-filter-dialog" width="min(92vw, 520px)" align-center>
      <div class="filter-dialog__body">
        <el-input v-model="filterState.keyword" :placeholder="t('page.forum.section.keywordPlaceholder')" clearable />
        <el-select v-model="filterState.sort"><el-option v-for="option in sortOptions" :key="option.value" :label="option.label" :value="option.value" /></el-select>
        <el-select v-model="filterState.threadType"><el-option v-for="option in typeOptions" :key="option.value || 'all'" :label="option.label" :value="option.value" /></el-select>
        <el-button type="primary" @click="pushFilters()">{{ t('page.forum.section.applyFilters') }}</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
.forum-section-page {
  display: grid;
  gap: 18px;
}

.section-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--section-accent) 12%, white), rgba(255, 250, 245, 0.9)),
    radial-gradient(circle at top right, color-mix(in srgb, var(--section-accent) 26%, transparent), transparent 50%);
}

.section-hero { padding: 4px 0 12px; border-bottom: 1px solid var(--viewer-border); background: transparent; }
.section-hero h2 { margin: 0 0 5px; font-size: clamp(24px, 4vw, 34px); }
.section-hero p { max-width: 640px; margin: 0; color: var(--viewer-text-muted); line-height: 1.55; }
.section-hero__stats { gap: 12px; color: var(--viewer-text-muted); font-size: 13px; }
.section-hero__stats a { min-height: 42px; display: inline-flex; align-items: center; padding: 0 14px; border-radius: 10px; }

.section-hero__eyebrow {
  font-size: 12px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--section-accent);
}

.section-hero h2 {
  margin: 8px 0 10px;
  font-size: 34px;
}

.section-hero p {
  margin: 0;
  color: #765e4a;
  line-height: 1.8;
}

.section-hero__stats {
  display: flex;
  align-items: center;
  gap: 14px;
}

.section-hero__stats div {
  display: grid;
  justify-items: center;
  min-width: 80px;
}

.section-hero__stats strong {
  font-size: 28px;
  color: var(--section-accent);
}

.section-hero__stats a {
  padding: 12px 18px;
  border-radius: 999px;
  text-decoration: none;
  color: #fff;
  background: linear-gradient(135deg, var(--section-accent), #f08a24);
}

.filter-panel {
  display: flex;
  gap: 12px;
  align-items: center;
}

.filter-panel { justify-content: space-between; padding: 0 0 8px; border-bottom: 1px solid var(--viewer-border); }
.sort-chips { display: flex; gap: 4px; }
.sort-chips button, .filter-trigger { min-height: 40px; padding: 0 13px; border: 1px solid transparent; border-radius: 10px; color: var(--viewer-text-muted); background: transparent; font: inherit; font-size: 13px; cursor: pointer; }
.sort-chips button.active { color: var(--viewer-accent-strong); border-color: var(--viewer-border); background: color-mix(in srgb, var(--viewer-accent-strong) 10%, var(--viewer-surface)); font-weight: 700; }
.filter-trigger { border-color: var(--viewer-border); }
.filter-trigger span { display: inline-grid; min-width: 18px; margin-left: 6px; place-items: center; border-radius: 99px; color: #fff; background: var(--viewer-accent-strong); font-size: 11px; }
.filter-dialog__body { display: grid; gap: 14px; }
.thread-list-panel { min-width: 0; }
.thread-list { border-top: 0; }

.filter-panel__keyword {
  flex: 1;
}

.filter-panel__select {
  width: 160px;
}

.thread-list {
  display: grid;
  gap: 16px;
}

.pager-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.pager-panel__actions {
  display: flex;
  gap: 10px;
}

body.theme-dark .section-hero p {
  color: #c4b1a4;
}

@media (max-width: 860px) {
  .section-hero,
  .filter-panel,
  .pager-panel {
    flex-direction: column;
    align-items: stretch;
  }

  .section-hero__stats {
    justify-content: space-between;
  }

  .filter-panel__select {
    width: 100%;
  }

  .section-hero__stats { justify-content: space-between; }
}

@media (max-width: 600px) {
  :global(.section-filter-dialog .el-dialog) { position: fixed; left: 0; right: 0; bottom: 0; width: 100% !important; margin: 0; border-radius: 18px 18px 0 0; }
  :global(.section-filter-dialog .el-dialog__body) { padding-bottom: calc(20px + env(safe-area-inset-bottom)); }
}
</style>
