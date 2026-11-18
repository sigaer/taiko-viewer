<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import type { V2ConstantsDifficulty, V2ConstantsPayload, V2ConstantsSortKey } from "~/types/content";
import { buildPageDescription } from "~/utils/seo";

const { t } = useI18n();
const apiFetch = useViewerApiFetch();

definePageMeta({
  contentLayout: "wide",
  pageTitleKey: "page.songs.v2Constants.title",
  pageDescKey: "page.songs.v2Constants.desc",
  navKey: "/songs/constants",
  hidePageHeader: true,
  breadcrumbs: [
    { labelKey: "nav.songs", to: "/songs" },
    { labelKey: "page.songs.v2Constants.title", to: "/songs/constants" }
  ]
});

useViewerSeo(() => ({
  title: t("page.songs.v2Constants.title"),
  description: buildPageDescription(t("page.songs.v2Constants.desc")),
  path: "/songs/constants",
  keywords: [
    t("page.songs.v2Constants.title"),
    t("page.songs.v2Constants.keyword")
  ],
  breadcrumbs: [
    { name: t("nav.home"), path: "/" },
    { name: t("nav.songs"), path: "/songs" },
    { name: t("page.songs.v2Constants.title"), path: "/songs/constants" }
  ]
}));

const keywordInput = ref("");
const keyword = ref("");
const difficulty = ref<"" | V2ConstantsDifficulty>("");
const page = ref(1);
const pageSize = ref(50);
const sortBy = ref<V2ConstantsSortKey>("id");
const sortOrder = ref<"asc" | "desc">("asc");
let searchTimer: ReturnType<typeof setTimeout> | null = null;

watch(keywordInput, (value) => {
  if (searchTimer) {
    clearTimeout(searchTimer);
  }
  // Back to the applied keyword (also "clear filters"): nothing to apply, and the page must not jump back to 1.
  if (value.trim() === keyword.value) return;
  searchTimer = setTimeout(() => {
    page.value = 1;
    keyword.value = value.trim();
  }, 300);
});

watch(difficulty, () => {
  page.value = 1;
});

watch(pageSize, () => {
  page.value = 1;
});

onBeforeUnmount(() => {
  if (searchTimer) {
    clearTimeout(searchTimer);
  }
});

const { data, pending, error, refresh } = await useAsyncData<V2ConstantsPayload>(
  "v2-constants-table",
  () =>
    apiFetch("/api/content/v2-constants", {
      query: {
        keyword: keyword.value,
        difficulty: difficulty.value,
        page: page.value,
        pageSize: pageSize.value,
        sortBy: sortBy.value,
        sortOrder: sortOrder.value
      }
    }),
  {
    watch: [keyword, difficulty, page, pageSize, sortBy, sortOrder],
    default: () => ({
      total: 0,
      page: 1,
      pageSize: 50,
      generatedAt: "",
      fetchedAt: "",
      stale: false,
      items: []
    })
  }
);

const filtered = computed(() => Boolean(keywordInput.value.trim() || keyword.value || difficulty.value));
const clearFilters = () => {
  if (searchTimer) clearTimeout(searchTimer);
  keywordInput.value = "";
  keyword.value = "";
  difficulty.value = "";
  page.value = 1;
};
</script>

<template>
  <ReworkConstantsTable
    v-model:keyword-input="keywordInput"
    v-model:difficulty="difficulty"
    v-model:page="page"
    v-model:page-size="pageSize"
    v-model:sort-by="sortBy"
    v-model:sort-order="sortOrder"
    :payload="data"
    :pending="pending"
    :failed="Boolean(error)"
    :filtered="filtered"
    @retry="refresh()"
    @clear="clearFilters"
  />
</template>
