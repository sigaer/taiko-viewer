<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import type { GuideTagItemsPayload } from "~/types/content";
import { useGuideContent } from "~/composables/useGuideContent";
import { useViewerApiFetch } from "~/composables/useViewerApiFetch";
import { getGuideDifficultyOption } from "~/utils/guide";
import { buildPageDescription } from "~/utils/seo";

type TreeRow = {
  rowKey: string;
  id: number;
  title: string;
  count: number;
};

const route = useRoute();
const { t } = useI18n();
const localePath = useLocalePath();
const difficulty = computed(() => Number(route.params.difficulty || 0));
const level = computed(() => Number(route.params.level || 0));
const fallbackDifficulty = computed(() => getGuideDifficultyOption(difficulty.value));
const fallbackDifficultyLabel = computed(
  () => (fallbackDifficulty.value ? t(`difficulty.${fallbackDifficulty.value.value}`) : t("difficulty.unknown"))
);

const pageMeta = computed(() => ({
  title: fallbackDifficulty.value ? `${fallbackDifficultyLabel.value} ${level.value}${t("guide.starSuffix", "星")}攻略` : t("guide.title"),
  desc: fallbackDifficulty.value
    ? buildPageDescription(t("page.guide.detail.descWithLevel", { difficulty: fallbackDifficultyLabel.value, level: level.value }))
    : buildPageDescription(t("page.guide.detail.desc"))
}));

definePageMeta({
  contentLayout: "wide",
  pageTitleKey: "guide.title",
  pageDescKey: "guide.summary",
  navKey: "/guide",
  hidePageHeader: true,
  reworkElementPlus: true,
  breadcrumbs: [
    { labelKey: "guide.title", to: "/guide" },
    { labelKey: "guide.detail" }
  ]
});

const { data: guideContent, pending, error, refresh } = await useGuideContent(difficulty, level);
const viewerApiFetch = useViewerApiFetch();

const difficultyLabel = computed(
  () => guideContent.value.difficultyLabel || fallbackDifficultyLabel.value
);
const summaryColumns = computed(() => [
  { prop: "overPlus", label: t("guide.summaryColumns.overPlus") },
  { prop: "over", label: t("guide.summaryColumns.over") },
  { prop: "strong", label: t("guide.summaryColumns.strong") },
  { prop: "middle", label: t("guide.summaryColumns.middle") },
  { prop: "weak", label: t("guide.summaryColumns.weak") },
  { prop: "under", label: t("guide.summaryColumns.under") },
  { prop: "underMinus", label: t("guide.summaryColumns.underMinus") },
  { prop: "total", label: t("guide.summaryColumns.total") }
]);
const tagRows = computed<TreeRow[]>(() =>
  guideContent.value.tags.map((item) => ({
    rowKey: `tag-${item.id}`,
    id: item.id,
    title: item.label,
    count: item.count
  }))
);

const detailCache = reactive<Record<number, GuideTagItemsPayload>>({});
const loadingTagIds = ref<number[]>([]);
const expandedTagIds = ref<number[]>([]);
const detailErrors = reactive<Record<number, boolean>>({});
const isTagLoading = (tagId: number) => loadingTagIds.value.includes(tagId);
const isTagExpanded = (tagId: number) => expandedTagIds.value.includes(tagId);

const ensureTagItemsLoaded = async (row: TreeRow, force = false) => {
  if (!force && (detailCache[row.id] || isTagLoading(row.id))) {
    return;
  }
  if (force) {
    delete detailCache[row.id];
  }
  delete detailErrors[row.id];
  loadingTagIds.value = [...loadingTagIds.value, row.id];
  try {
    const payload = await viewerApiFetch<GuideTagItemsPayload>(
      `/api/content/guide/${difficulty.value}/${level.value}/tag/${row.id}`
    );
    detailCache[row.id] = payload;
    if (!payload.items.length) {
      ElMessage.warning(t("guide.empty"));
    }
  } catch {
    detailErrors[row.id] = true;
    ElMessage.error(t("guide.loadFailed"));
  } finally {
    loadingTagIds.value = loadingTagIds.value.filter((tagId) => tagId !== row.id);
  }
};

const toggleTagRow = async (row: TreeRow) => {
  if (isTagExpanded(row.id)) {
    expandedTagIds.value = expandedTagIds.value.filter((tagId) => tagId !== row.id);
    return;
  }
  expandedTagIds.value = [...expandedTagIds.value, row.id];
  await ensureTagItemsLoaded(row);
};

useViewerSeo(() => ({
  title: pageMeta.value.title,
  description: pageMeta.value.desc,
  path: `/guide/${difficulty.value}/${level.value}`,
  keywords: [difficultyLabel.value, t("guide.title"), `${level.value}${t("guide.starSuffix", "星")}`],
  breadcrumbs: [
    { name: t("nav.home"), path: "/" },
    { name: t("guide.title"), path: "/guide" },
    { name: `${difficultyLabel.value} ${level.value}${t("guide.starSuffix", "星")}`, path: `/guide/${difficulty.value}/${level.value}` }
  ]
}));
const levelCount = computed(() => fallbackDifficulty.value?.max || 0);
</script>

<template>
  <div class="rw-stack">
    <ReworkPageHeader :title="t('page.guide.detail.header', { difficulty: difficultyLabel, level })">
      <!-- both illustrations in one row beside the title (they used to flank it); decorative, empty alt as before -->
      <template #lead><span style="display: flex; gap: 4px"><img src="/optimized/guide-makina-160.webp" alt="" width="56" height="56" decoding="async" /><img src="/optimized/guide-miku-160.webp" alt="" width="56" height="56" decoding="async" /></span></template>
    </ReworkPageHeader>

    <ReworkState v-if="pending" kind="loading" :lines="8" />
    <ReworkState
      v-else-if="error"
      kind="failed"
      :title="t('guide.pageLoadFailed')"
      :text="t('page.guide.detail.loadFailedSubtitle')"
      @retry="refresh()"
    >
      <NuxtLink class="rw-btn" :to="localePath('/guide')">{{ t("guide.backToGuide") }}</NuxtLink>
    </ReworkState>
    <ReworkGuideLevel
      v-else
      :difficulty="difficulty"
      :level="level"
      :levels="levelCount"
      :summary="guideContent.summary"
      :summary-columns="summaryColumns"
      :rows="tagRows"
      :expanded="expandedTagIds"
      :loading="loadingTagIds"
      :errors="detailErrors"
      :items="detailCache"
      @toggle="toggleTagRow"
      @retry="(row) => ensureTagItemsLoaded(row, true)"
    />
  </div>
</template>
