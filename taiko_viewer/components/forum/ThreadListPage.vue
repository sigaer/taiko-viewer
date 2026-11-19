<script setup lang="ts">
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
const listLoading = computed(() => pending.value || correctingPage.value);
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
    <ForumReadState v-if="sectionsError" :pending="sectionsPending" :error="sectionsError" @retry="refreshSections" />
    <section class="section-hero" :style="{ '--section-accent': section?.accentColor || '#d84a34' }">
      <div>
        <h2>{{ localizedSectionName || t("page.forum.section.title") }}</h2>
        <p v-if="route.params.slug">{{ localizedSectionDescription || t("page.forum.section.heroDesc") }}</p>
      </div>
      <div class="section-hero__stats">
        <span v-if="route.params.slug ? section : data">{{ route.params.slug ? section?.threadCount : data?.total }} {{ t("page.forum.section.threads") }}</span>
        <NuxtLink :to="localePath(newThreadPath)">{{ t("forum.writeThread") }}</NuxtLink>
      </div>
    </section>

    <section class="filter-panel">
      <div class="sort-chips" role="group" :aria-label="t('page.forum.section.sortLabel')">
        <button v-for="option in sortOptions.slice(0, 2)" :key="option.value" type="button" :class="{ active: applied.sort === option.value }" :aria-pressed="applied.sort === option.value" @click="pushFilters(1, { ...applied, sort: option.value })">{{ option.label }}</button>
      </div>
      <button type="button" class="filter-trigger" :aria-expanded="filterOpen" @click="filterOpen = true">{{ t("page.forum.section.filter") }}<span v-if="activeFilterCount">{{ activeFilterCount }}</span></button>
    </section>

    <section class="thread-list-panel">
      <ForumReadState v-if="listLoading || error" :pending="listLoading" :error="error" @retry="refresh" />
      <el-empty v-else-if="!data?.items.length" :description="t('page.forum.section.empty')" />
      <div v-else class="thread-list">
        <ForumThreadCard v-for="thread in data?.items" :key="thread.id" :thread="thread" compact />
      </div>
    </section>

    <section v-if="data && !correctingPage" class="pager-panel">
      <div>{{ t("page.forum.section.pagination", { page: data?.page || 1, totalPages, total: data?.total || 0 }) }}</div>
      <div class="pager-panel__actions">
        <el-button :disabled="applied.page <= 1 || pending" @click="pushFilters(applied.page - 1, applied)">{{ t("page.forum.section.prevPage") }}</el-button>
        <el-button :disabled="applied.page >= totalPages || pending" @click="pushFilters(applied.page + 1, applied)">{{ t("page.forum.section.nextPage") }}</el-button>
      </div>
    </section>

    <el-dialog v-model="filterOpen" :title="t('page.forum.section.filter')" class="section-filter-dialog" width="min(92vw, 520px)" align-center>
      <div class="filter-dialog__body">
        <el-input v-model="filterState.keyword" :placeholder="t('page.forum.section.keywordPlaceholder')" clearable />
        <div v-if="!fixedSectionSlug" class="filter-dialog__field">
          <span>{{ t('page.forum.section.sectionLabel') }}</span>
          <el-select v-model="filterState.sectionSlug" :empty-values="[null, undefined]" :aria-label="t('page.forum.section.sectionLabel')">
            <el-option v-for="option in sectionOptions" :key="option.value || 'all'" :label="option.label" :value="option.value" />
          </el-select>
        </div>
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
  background:var(--viewer-surface-subtle);
}

.section-hero { padding: 4px 0 12px; border-bottom: 1px solid var(--viewer-border); background:transparent; }
.section-hero h2 { margin: 0 0 5px; font-size: clamp(24px, 4vw, 34px); }
.section-hero p { max-width: 640px; margin: 0; color:var(--viewer-text-muted); line-height: 1.55; }
.section-hero__stats { gap: 12px; color:var(--viewer-text-muted); font-size: 13px; }
.section-hero__stats a { min-height: 42px; display: inline-flex; align-items: center; padding: 0 14px; border-radius: 10px; }

.section-hero__eyebrow {
  font-size: 12px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color:var(--section-accent);
}

.section-hero h2 {
  margin: 8px 0 10px;
  font-size: 34px;
}

.section-hero p {
  margin: 0;
  color:var(--viewer-text-muted);
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
  color:var(--section-accent);
}

.section-hero__stats a {
  padding: 12px 18px;
  border-radius: 999px;
  text-decoration: none;
  color:var(--viewer-on-primary);
  background:linear-gradient(135deg, var(--section-accent), var(--viewer-primary-hover));
}

.filter-panel {
  display: flex;
  gap: 12px;
  align-items: center;
}

.filter-panel { justify-content: space-between; padding: 0 0 8px; border-bottom: 1px solid var(--viewer-border); }
.sort-chips { display: flex; gap: 4px; }
.sort-chips button, .filter-trigger { min-height: 40px; padding: 0 13px; border: 1px solid transparent; border-radius: 10px; color:var(--viewer-text-muted); background:transparent; font: inherit; font-size: 13px; cursor: pointer; }
.sort-chips button.active { color:var(--viewer-accent-strong); border-color:var(--viewer-border); background:color-mix(in srgb, var(--viewer-accent-strong) 10%, var(--viewer-surface)); font-weight: 700; }
.filter-trigger { border-color:var(--viewer-border); }
.filter-trigger span { display: inline-grid; min-width: 18px; margin-left: 6px; place-items: center; border-radius: 99px; color:var(--viewer-on-primary); background:var(--viewer-primary); font-size: 11px; }
.filter-dialog__body { display: grid; gap: 14px; }
.filter-dialog__field { display: grid; gap: 6px; min-width: 0; font-size: 14px; }
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
  color:var(--viewer-text-muted);
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
