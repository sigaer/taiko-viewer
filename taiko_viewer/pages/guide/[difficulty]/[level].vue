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
  pageTitleKey: "guide.title",
  pageDescKey: "guide.summary",
  navKey: "/guide",
  breadcrumbs: [
    { labelKey: "guide.title", to: "/guide" },
    { labelKey: "guide.detail" }
  ]
});

const { data: guideContent, pending, error } = await useGuideContent(difficulty, level);
const viewerApiFetch = useViewerApiFetch();

const difficultyLabel = computed(
  () => guideContent.value.difficultyLabel || fallbackDifficultyLabel.value
);
const summaryRows = computed(() => [guideContent.value.summary]);
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
const colorMap = ["hardest", "harder", "hard", "normal", "easy", "easier", "easiest"];

const headerCellClassName = (row: { rowIndex: number; columnIndex: number }) => {
  if (row.rowIndex === 1 && row.columnIndex < colorMap.length) {
    return colorMap[row.columnIndex];
  }
  return "";
};

const getRowToneClass = (rowId: number) => {
  if (rowId < 1 || rowId > colorMap.length) {
    return "";
  }
  return `guide-tag-row ${colorMap[rowId - 1]}`;
};

const isTagLoading = (tagId: number) => loadingTagIds.value.includes(tagId);
const isTagExpanded = (tagId: number) => expandedTagIds.value.includes(tagId);
const hasTagLoadError = (tagId: number) => Boolean(detailErrors[tagId]);

const getTagItems = (tagId: number) => detailCache[tagId]?.items || [];

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
          <el-table-column
            v-for="column in summaryColumns"
            :key="column.prop"
            :prop="column.prop"
            :label="column.label"
            align="center"
          />
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
      <div class="detail-table">
        <div class="guide-detail-head">
          <span class="guide-detail-head__toggle" aria-hidden="true"></span>
          <span class="guide-detail-head__label">{{ t("page.guide.detail.columns.tag") }}</span>
          <span class="guide-detail-head__count">{{ t("page.guide.detail.columns.count") }}</span>
        </div>

        <div
          v-for="row in tagRows"
          :key="row.rowKey"
          class="guide-detail-item"
        >
          <button
            type="button"
            class="guide-detail-row"
            :class="[getRowToneClass(row.id), { 'is-expanded': isTagExpanded(row.id) }]"
            :aria-expanded="isTagExpanded(row.id)"
            @click="toggleTagRow(row)"
          >
            <span class="guide-expand-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M9 6l6 6-6 6"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </span>
            <span class="guide-detail-cell guide-detail-cell--title">{{ row.title }}</span>
            <span class="guide-detail-cell guide-detail-cell--count">{{ row.count }}</span>
          </button>

          <div v-if="isTagExpanded(row.id)" class="tag-detail-wrap">
            <el-skeleton v-if="isTagLoading(row.id)" :rows="6" animated />
            <div v-else-if="hasTagLoadError(row.id)" class="tag-detail-error">
              <span>{{ t("guide.loadFailed") }}</span>
              <el-button link type="primary" @click.stop="ensureTagItemsLoaded(row, true)">
                {{ t("common.retry") }}
              </el-button>
            </div>
            <el-empty v-else-if="!getTagItems(row.id).length" :description="t('guide.empty')" />
            <el-table
              v-else
              :data="getTagItems(row.id)"
              border
              class="tag-detail-table"
            >
              <el-table-column prop="title" :label="t('page.guide.detail.columns.tag')" min-width="220" />
              <el-table-column prop="bpm" label="BPM" align="center" width="120" />
              <el-table-column prop="category" :label="t('page.guide.detail.columns.category')" align="center" width="140" />
              <el-table-column prop="tag" :label="t('page.guide.detail.columns.attribute')" align="center" width="150" />
              <el-table-column prop="feature" :label="t('page.guide.detail.columns.feature')" min-width="320" />
              <el-table-column prop="noteCount" :label="t('page.guide.detail.columns.noteCount')" align="center" width="100" />
            </el-table>
          </div>
        </div>
      </div>
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
.tag-detail-table {
  width: 100%;
}

.guide-divider {
  border: 0;
  border-top: 1px solid rgba(181, 146, 113, 0.2);
  margin: 20px 0;
}

:deep(.tag-detail-table .cell) {
  white-space: pre-line;
}

.detail-table {
  border: 1px solid var(--el-border-color-light);
  border-radius: 14px;
  overflow: hidden;
  background: rgba(255, 252, 248, 0.72);
}

.guide-detail-head,
.guide-detail-row {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr) 100px;
  align-items: center;
}

.guide-detail-head {
  min-height: 46px;
  padding: 0 12px;
  background: rgba(245, 236, 227, 0.92);
  color: var(--el-text-color-secondary);
  font-size: 13px;
  font-weight: 600;
}

.guide-detail-head__toggle,
.guide-detail-head__count {
  text-align: center;
}

.guide-detail-item + .guide-detail-item {
  border-top: 1px solid rgba(181, 146, 113, 0.16);
}

.guide-detail-row {
  width: 100%;
  min-height: 56px;
  padding: 0 12px;
  border: 0;
  text-align: left;
  background: transparent;
  color: inherit;
  cursor: pointer;
  transition: background-color 0.2s ease;
  font-weight: 600;
}

.guide-detail-row:hover {
  filter: brightness(0.985);
}

.guide-detail-row:focus-visible {
  outline: 2px solid rgba(211, 109, 55, 0.45);
  outline-offset: -2px;
}

.guide-expand-icon {
  width: 24px;
  height: 24px;
  margin: 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: rgba(87, 66, 49, 0.78);
  transition: transform 0.2s ease;
}

.guide-expand-icon svg {
  width: 18px;
  height: 18px;
}

.guide-detail-row.is-expanded .guide-expand-icon {
  transform: rotate(90deg);
}

.guide-detail-cell--title {
  min-width: 0;
}

.guide-detail-cell--count {
  text-align: center;
}

.guide-tag-row.hardest {
  background: rgba(196, 79, 45, 0.16);
}

.guide-tag-row.harder {
  background: rgba(220, 116, 58, 0.16);
}

.guide-tag-row.hard {
  background: rgba(232, 148, 51, 0.16);
}

.guide-tag-row.normal {
  background: rgba(241, 183, 80, 0.16);
}

.guide-tag-row.easy {
  background: rgba(171, 197, 117, 0.16);
}

.guide-tag-row.easier {
  background: rgba(107, 182, 132, 0.16);
}

.guide-tag-row.easiest {
  background: rgba(76, 160, 180, 0.16);
}

.tag-detail-wrap {
  padding: 8px 12px;
  background: rgba(255, 252, 248, 0.92);
  border-radius: 12px;
  border-top: 1px solid rgba(181, 146, 113, 0.16);
}

.tag-detail-error {
  min-height: 88px;
  padding: 12px;
  display: grid;
  place-items: center;
  gap: 8px;
  color: var(--el-text-color-secondary);
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

  .guide-detail-head,
  .guide-detail-row {
    grid-template-columns: 44px minmax(0, 1fr) 72px;
    padding: 0 8px;
  }

  .tag-detail-wrap {
    padding: 8px;
  }
}
</style>
