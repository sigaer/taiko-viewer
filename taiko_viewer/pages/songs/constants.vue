<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import type { V2ConstantsDifficulty, V2ConstantsDimension, V2ConstantsPayload, V2ConstantsRange, V2ConstantsSortKey } from "~/types/content";
import { buildPageDescription } from "~/utils/seo";
import { withoutLocale } from "~/utils/rework/navigation";
import {
  CONSTANTS_PATH,
  DEFAULT_DIMENSION,
  constantRangeFromQuery,
  constantRangeQuery,
  formatBound,
  normalizeConstantRange,
  sameConstantRange
} from "~/utils/rework/constantQuery";

const { t } = useI18n();
const apiFetch = useViewerApiFetch();
const route = useRoute();
const router = useRouter();

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

// ---------- Range filter: state in the URL (dimension, min, max), so SSR and the client start from the same
// filter and a filtered view can be shared. Inputs apply after 300 ms like the keyword; the column applies at once.
const initialRange = constantRangeFromQuery(route.query);
const range = shallowRef<V2ConstantsRange | null>(initialRange);
const boundText = (value: number | null | undefined) => (value === null || value === undefined ? "" : formatBound(value));
const rangeDimension = ref<V2ConstantsDimension>(initialRange?.dimension ?? DEFAULT_DIMENSION);
const rangeMin = ref(boundText(initialRange?.min));
const rangeMax = ref(boundText(initialRange?.max));
let rangeTimer: ReturnType<typeof setTimeout> | null = null;
const readRange = () => normalizeConstantRange({ dimension: rangeDimension.value, min: rangeMin.value, max: rangeMax.value });
const isOwnRoute = () => withoutLocale(route.path) === CONSTANTS_PATH;
const applyRange = (next: V2ConstantsRange | null) => {
  if (rangeTimer) clearTimeout(rangeTimer);
  rangeTimer = null;
  if (sameConstantRange(next, range.value)) return;
  range.value = next;
  page.value = 1;
  if (!isOwnRoute()) return;
  const { dimension: _dimension, min: _min, max: _max, ...rest } = route.query;
  void router.replace({ path: route.path, query: { ...rest, ...constantRangeQuery(next) } });
};
watch([rangeMin, rangeMax], () => {
  if (rangeTimer) clearTimeout(rangeTimer);
  rangeTimer = setTimeout(() => applyRange(readRange()), 300);
});
watch(rangeDimension, () => applyRange(readRange()));
// Kept alive: follow only this page's own route (back / forward, a link from the search panel).
watch(
  () => route.fullPath,
  () => {
    if (!isOwnRoute()) return;
    const next = constantRangeFromQuery(route.query);
    if (sameConstantRange(next, range.value)) return;
    if (rangeTimer) clearTimeout(rangeTimer);
    rangeTimer = null;
    range.value = next;
    page.value = 1;
    rangeDimension.value = next?.dimension ?? DEFAULT_DIMENSION;
    rangeMin.value = boundText(next?.min);
    rangeMax.value = boundText(next?.max);
  }
);

onBeforeUnmount(() => {
  if (searchTimer) {
    clearTimeout(searchTimer);
  }
  if (rangeTimer) {
    clearTimeout(rangeTimer);
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
        sortOrder: sortOrder.value,
        ...constantRangeQuery(range.value)
      }
    }),
  {
    watch: [keyword, difficulty, page, pageSize, sortBy, sortOrder, range],
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

const filtered = computed(() =>
  Boolean(keywordInput.value.trim() || keyword.value || difficulty.value || range.value || rangeMin.value.trim() || rangeMax.value.trim())
);
const clearFilters = () => {
  if (searchTimer) clearTimeout(searchTimer);
  keywordInput.value = "";
  keyword.value = "";
  difficulty.value = "";
  page.value = 1;
  rangeDimension.value = DEFAULT_DIMENSION;
  rangeMin.value = "";
  rangeMax.value = "";
  applyRange(null);
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
    v-model:range-dimension="rangeDimension"
    v-model:range-min="rangeMin"
    v-model:range-max="rangeMax"
    :range-active="range?.dimension ?? null"
    :payload="data"
    :pending="pending"
    :failed="Boolean(error)"
    :filtered="filtered"
    @retry="refresh()"
    @clear="clearFilters"
  />
</template>
