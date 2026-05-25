<script setup lang="ts">
import type { ForumSection, ForumThreadCard, ForumThreadType } from "~/types/forum";
import { buildPageDescription } from "~/utils/seo";

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
  page: Number(route.query.page || 1)
});

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
  currentSection.value ? t(`forum.sections.${currentSection.value.slug}.name`, currentSection.value.name) : ""
);
const localizedSectionDescription = computed(() =>
  currentSection.value ? t(`forum.sections.${currentSection.value.slug}.description`, currentSection.value.description) : ""
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

const pushFilters = async (page = 1) => {
  filterState.page = page;
  await router.push({
    query: {
      keyword: filterState.keyword || undefined,
      sort: filterState.sort !== "latest" ? filterState.sort : undefined,
      threadType: filterState.threadType || undefined,
      page: page > 1 ? String(page) : undefined
    }
  });
  await refresh();
};

watch(
  () => route.query,
  (query) => {
    filterState.keyword = String(query.keyword || "");
    filterState.sort = String(query.sort || "latest");
    filterState.threadType = String(query.threadType || "");
    filterState.page = Math.max(1, Number(query.page || 1));
  }
);
</script>

<template>
  <div class="forum-section-page">
    <section class="panel-card section-hero" :style="{ '--section-accent': section?.accentColor || '#d84a34' }">
      <div>
        <span class="section-hero__eyebrow">Forum Section</span>
        <h2>{{ localizedSectionName || t("page.forum.section.title") }}</h2>
        <p>{{ localizedSectionDescription || t("page.forum.section.heroDesc") }}</p>
      </div>
      <div class="section-hero__stats">
        <div>
          <strong>{{ section?.threadCount || 0 }}</strong>
          <span>{{ t("page.forum.section.threads") }}</span>
        </div>
        <div>
          <strong>{{ section?.postCount || 0 }}</strong>
          <span>{{ t("forum.stats.reply") }}</span>
        </div>
        <NuxtLink :to="localePath('/forum/new')">{{ t("forum.writeThread") }}</NuxtLink>
      </div>
    </section>

    <section class="panel-card filter-panel">
      <el-input
        v-model="filterState.keyword"
        :placeholder="t('page.forum.section.keywordPlaceholder')"
        clearable
        class="filter-panel__keyword"
        @keyup.enter="pushFilters()"
      />
      <el-select v-model="filterState.sort" class="filter-panel__select" @change="pushFilters()">
        <el-option v-for="option in sortOptions" :key="option.value" :label="option.label" :value="option.value" />
      </el-select>
      <el-select v-model="filterState.threadType" class="filter-panel__select" @change="pushFilters()">
        <el-option v-for="option in typeOptions" :key="option.value || 'all'" :label="option.label" :value="option.value" />
      </el-select>
      <el-button type="primary" @click="pushFilters()">{{ t("page.forum.section.applyFilters") }}</el-button>
    </section>

    <section class="thread-list-panel">
      <el-empty v-if="!pending && !data?.items.length" :description="t('page.forum.section.empty')" />
      <div v-else class="thread-list">
        <ForumThreadCard v-for="thread in data?.items" :key="thread.id" :thread="thread" />
      </div>
    </section>

    <section class="panel-card pager-panel">
      <div>{{ t("page.forum.section.pagination", { page: data?.page || 1, totalPages, total: data?.total || 0 }) }}</div>
      <div class="pager-panel__actions">
        <el-button :disabled="filterState.page <= 1" @click="pushFilters(filterState.page - 1)">{{ t("page.forum.section.prevPage") }}</el-button>
        <el-button :disabled="filterState.page >= totalPages" @click="pushFilters(filterState.page + 1)">{{ t("page.forum.section.nextPage") }}</el-button>
      </div>
    </section>
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
}
</style>
