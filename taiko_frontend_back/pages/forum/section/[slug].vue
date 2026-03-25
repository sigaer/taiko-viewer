<script setup lang="ts">
import { formatViewerTitle } from "~/composables/useViewerSeo";
import type { ForumSection, ForumThreadCard, ForumThreadType } from "~/types/forum";

type ThreadListPayload = {
  total: number;
  page: number;
  pageSize: number;
  sort: string;
  items: ForumThreadCard[];
};

const route = useRoute();
const router = useRouter();
const headers = import.meta.server ? useRequestHeaders(["cookie"]) : undefined;

const filterState = reactive({
  keyword: String(route.query.keyword || ""),
  sort: String(route.query.sort || "latest"),
  threadType: String(route.query.threadType || ""),
  page: Number(route.query.page || 1)
});

const pageMeta = {
  title: "论坛版块",
  desc: "按版块查看太鼓之达人论坛的主题与最新讨论。"
};

definePageMeta({
  pageTitle: pageMeta.title,
  pageDesc: pageMeta.desc,
  navKey: "/forum",
  breadcrumbs: [
    { label: "论坛社区", to: "/forum" },
    { label: "版块" }
  ]
});

useSeoMeta({
  title: () => formatViewerTitle(`${pageMeta.title} - ${String(route.params.slug || "")}`),
  description: pageMeta.desc
});

const { data: sectionsData } = await useAsyncData<{ items: ForumSection[] }>(
  "forum-sections",
  () => $fetch("/api/forum/sections", { headers }),
  {
    default: () => ({ items: [] })
  }
);

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
    $fetch("/api/forum/threads", {
      headers,
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

const sortOptions = [
  { label: "最新", value: "latest" },
  { label: "热帖", value: "hot" },
  { label: "精选", value: "featured" }
];

const typeOptions: Array<{ label: string; value: "" | ForumThreadType }> = [
  { label: "全部类型", value: "" },
  { label: "讨论", value: "discussion" },
  { label: "攻略", value: "guide" },
  { label: "战报", value: "achievement" },
  { label: "公告", value: "official" }
];

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
        <h2>{{ section?.name || "论坛版块" }}</h2>
        <p>{{ section?.description || "按条件筛选帖子，快速找到你要看的攻略、讨论或战报。" }}</p>
      </div>
      <div class="section-hero__stats">
        <div>
          <strong>{{ section?.threadCount || 0 }}</strong>
          <span>主题</span>
        </div>
        <div>
          <strong>{{ section?.postCount || 0 }}</strong>
          <span>回复</span>
        </div>
        <NuxtLink to="/forum/new">写新帖</NuxtLink>
      </div>
    </section>

    <section class="panel-card filter-panel">
      <el-input
        v-model="filterState.keyword"
        placeholder="搜索标题关键词"
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
      <el-button type="primary" @click="pushFilters()">应用筛选</el-button>
    </section>

    <section class="thread-list-panel">
      <el-empty v-if="!pending && !data?.items.length" description="当前筛选下还没有帖子" />
      <div v-else class="thread-list">
        <ForumThreadCard v-for="thread in data?.items" :key="thread.id" :thread="thread" />
      </div>
    </section>

    <section class="panel-card pager-panel">
      <div>第 {{ data?.page || 1 }} / {{ totalPages }} 页，共 {{ data?.total || 0 }} 条主题</div>
      <div class="pager-panel__actions">
        <el-button :disabled="filterState.page <= 1" @click="pushFilters(filterState.page - 1)">上一页</el-button>
        <el-button :disabled="filterState.page >= totalPages" @click="pushFilters(filterState.page + 1)">下一页</el-button>
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
