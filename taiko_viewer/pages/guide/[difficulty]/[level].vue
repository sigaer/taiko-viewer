<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import type { GuideTagItemsPayload } from "~/types/content";
import { loadGuideTagItems, useGuideContent } from "~/composables/useGuideContent";
import { getGuideDifficultyOption } from "~/utils/guide";
import { buildPageDescription } from "~/utils/seo";

type TreeRow = {
  id: number;
  title: string;
  count: number;
  hasChildren: boolean;
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
  pageTitleKey: "guide.title",
  pageDescKey: "guide.summary",
  navKey: "/guide",
  breadcrumbs: [
    { labelKey: "guide.title", to: "/guide" },
    { labelKey: "guide.detail" }
  ]
});

const { data: guideContent, pending, error } = await useGuideContent(difficulty, level);

const difficultyLabel = computed(
  () => guideContent.value.difficultyLabel || fallbackDifficultyLabel.value
);
const summaryRows = computed(() => [guideContent.value.summary]);
const summaryColumns = computed(() => [
  t("guide.summaryColumns.overPlus"),
  t("guide.summaryColumns.over"),
  t("guide.summaryColumns.strong"),
  t("guide.summaryColumns.middle"),
  t("guide.summaryColumns.weak"),
  t("guide.summaryColumns.under"),
  t("guide.summaryColumns.underMinus"),
  t("guide.summaryColumns.total")
]);
const tableKey = computed(() => `${difficulty.value}-${level.value}`);
const tagRows = computed<TreeRow[]>(() =>
  guideContent.value.tags.map((item) => ({
    id: item.id,
    title: item.label,
    count: item.count,
    hasChildren: item.count > 0
  }))
);

const detailCache = reactive<Record<number, GuideTagItemsPayload>>({});
const loadingTagId = ref(0);
const colorMap = ["hardest", "harder", "hard", "normal", "easy", "easier", "easiest"];

const mainSpanMethod = (row: { row?: TreeRow }) => {
  if ((row.row?.id || 0) < 8) {
    return [1, 6];
  }
};

const headerCellClassName = (row: { rowIndex: number; columnIndex: number }) => {
  if (row.rowIndex === 1) {
    return colorMap[row.columnIndex];
  }
  return "";
};

const cellClassName = (row: { row?: TreeRow }) => {
  if ((row.row?.id || 0) < 8) {
    return colorMap[(row.row?.id || 1) - 1];
  }
  return "common";
};

const loadChildren = async (
  row: TreeRow,
  _treeNode: unknown,
  resolve: (data: unknown[]) => void
) => {
  if (!row.hasChildren) {
    resolve([]);
    return;
  }
  if (detailCache[row.id]) {
    resolve(detailCache[row.id].items);
    return;
  }
  loadingTagId.value = row.id;
  try {
    const payload = await loadGuideTagItems(difficulty.value, level.value, row.id);
    detailCache[row.id] = payload;
    resolve(payload.items);
    if (!payload.items.length) {
      ElMessage.warning(t("guide.empty"));
    }
  } catch {
    resolve([]);
    ElMessage.error(t("guide.loadFailed"));
  } finally {
    loadingTagId.value = 0;
  }
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
</script>

<template>
  <div class="guide-shell">
    <el-card v-if="pending" class="panel-card">
      <el-skeleton :rows="10" animated />
    </el-card>

    <el-card v-else-if="error" class="panel-card">
      <el-result :icon="'error'" :title="t('guide.pageLoadFailed')" :sub-title="t('page.guide.detail.loadFailedSubtitle')">
        <template #extra>
          <NuxtLink :to="localePath('/guide')">
            <el-button type="primary">{{ t("guide.backToGuide") }}</el-button>
          </NuxtLink>
        </template>
      </el-result>
    </el-card>

    <el-card v-else class="panel-card">
      <div class="guide-header">
        <el-image src="/Makina.png" class="guide-avatar left" />
        <h3>
          <span class="guide-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M4.5 5.5h7.5a2 2 0 0 1 2 2v11H6.5a2 2 0 0 0-2 2v-15z M19.5 5.5h-7.5a2 2 0 0 0-2 2v11h7.5a2 2 0 0 1 2 2v-15z"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linejoin="round"
              />
            </svg>
          </span>
          {{ t("page.guide.detail.header", { difficulty: difficultyLabel, level }) }}
        </h3>
        <el-image src="/miku.png" class="guide-avatar right" />
      </div>

      <div class="guide-section-title">
        <span class="section-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M5 19V9 M12 19V5 M19 19v-7"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
            />
          </svg>
        </span>
        <span>{{ t("guide.difficultyDistribution") }}</span>
      </div>
      <el-table
        :data="summaryRows"
        class="summary-table"
        :header-cell-class-name="headerCellClassName"
      >
        <el-table-column :label="t('page.guide.detail.summaryLabel')" align="center">
          <el-table-column v-for="column in summaryColumns" :key="column" :prop="column" :label="column" align="center" />
        </el-table-column>
      </el-table>

      <hr class="guide-divider" />

      <div class="guide-section-title">
        <span class="section-icon alt" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M5 7h14M5 12h14M5 17h10"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
            />
          </svg>
        </span>
        <span>{{ t("guide.detailTable") }}</span>
      </div>
      <el-table
        :key="tableKey"
        border
        row-class-name="main-table"
        :data="tagRows"
        :span-method="mainSpanMethod"
        row-key="id"
        lazy
        :load="loadChildren"
        :tree-props="{ children: 'children', hasChildren: 'hasChildren' }"
        :cell-class-name="cellClassName"
        v-loading="loadingTagId > 0"
        class="detail-table"
      >
        <el-table-column prop="title" :label="t('page.guide.detail.columns.tag')" align="center" width="220" />
        <el-table-column prop="count" :label="t('page.guide.detail.columns.count')" align="center" width="100" />
        <el-table-column prop="category" :label="t('page.guide.detail.columns.category')" align="center" width="120" />
        <el-table-column prop="tag" :label="t('page.guide.detail.columns.attribute')" align="center" width="120" />
        <el-table-column prop="feature" :label="t('page.guide.detail.columns.feature')" align="center" />
        <el-table-column prop="noteCount" :label="t('page.guide.detail.columns.noteCount')" align="center" width="100" />
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.guide-shell {
  display: grid;
  gap: 20px;
}

.guide-header {
  position: relative;
  text-align: center;
  margin-bottom: 12px;
  min-height: 140px;
}

.guide-header h3 {
  margin: 0;
  font-size: 18px;
  padding-top: 20px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.guide-icon {
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.guide-icon svg {
  width: 100%;
  height: 100%;
}

.guide-avatar {
  position: absolute;
  bottom: 0;
  width: 108px;
  height: 108px;
}

.guide-avatar.left {
  left: 0;
}

.guide-avatar.right {
  right: 0;
}

.guide-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 700;
  margin: 10px 0 12px;
}

.section-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  color: #d36d37;
}

.section-icon svg {
  width: 14px;
  height: 14px;
}

.section-icon.alt {
  color: #a34b6b;
}

.summary-table,
.detail-table {
  width: 100%;
}

.guide-divider {
  border: 0;
  border-top: 1px solid rgba(181, 146, 113, 0.2);
  margin: 20px 0;
}

:deep(.hardest) {
  background: rgba(196, 79, 45, 0.16) !important;
}

:deep(.harder) {
  background: rgba(220, 116, 58, 0.16) !important;
}

:deep(.hard) {
  background: rgba(232, 148, 51, 0.16) !important;
}

:deep(.normal) {
  background: rgba(241, 183, 80, 0.16) !important;
}

:deep(.easy) {
  background: rgba(171, 197, 117, 0.16) !important;
}

:deep(.easier) {
  background: rgba(107, 182, 132, 0.16) !important;
}

:deep(.easiest) {
  background: rgba(76, 160, 180, 0.16) !important;
}

@media (max-width: 840px) {
  .guide-avatar {
    position: static;
    width: 72px;
    height: 72px;
  }

  .guide-header {
    display: grid;
    gap: 12px;
    justify-items: center;
  }

  .guide-header h3 {
    padding-top: 0;
  }
}
</style>
