<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import type { GuideTagItemsPayload } from "~/types/content";
import { loadGuideTagItems, useGuideContent } from "~/composables/useGuideContent";
import { getGuideDifficultyOption } from "~/utils/guide";

type TreeRow = {
  id: number;
  title: string;
  count: number;
  hasChildren: boolean;
};

const route = useRoute();
const difficulty = computed(() => Number(route.params.difficulty || 0));
const level = computed(() => Number(route.params.level || 0));
const fallbackDifficulty = computed(() => getGuideDifficultyOption(difficulty.value));
const fallbackDifficultyLabel = computed(() => fallbackDifficulty.value?.label || "未知难度");

const pageMeta = computed(() => ({
  title: fallbackDifficulty.value ? `${fallbackDifficultyLabel.value} ${level.value}星攻略` : "谱面攻略",
  desc: fallbackDifficulty.value
    ? `查看国行收录曲 ${fallbackDifficultyLabel.value} ${level.value} 星的谱面攻略与分类统计。`
    : "按难度与星级查看谱面攻略。"
}));

definePageMeta({
  pageTitle: "谱面攻略",
  pageDesc: "按难度与星级查看谱面攻略。",
  navKey: "/guide",
  breadcrumbs: [
    { label: "谱面攻略", to: "/guide" },
    { label: "攻略详情" }
  ]
});

const { data: guideContent, pending, error } = await useGuideContent(difficulty, level);

const difficultyLabel = computed(
  () => guideContent.value.difficultyLabel || fallbackDifficultyLabel.value
);
const summaryRows = computed(() => [guideContent.value.summary]);
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
      ElMessage.warning("暂无谱面数据");
    }
  } catch {
    resolve([]);
    ElMessage.error("获取谱面失败，请稍后重试");
  } finally {
    loadingTagId.value = 0;
  }
};

useViewerSeo(() => ({
  title: pageMeta.value.title,
  description: pageMeta.value.desc,
  path: `/guide/${difficulty.value}/${level.value}`,
  breadcrumbs: [
    { name: "首页", path: "/" },
    { name: "谱面攻略", path: "/guide" },
    { name: `${difficultyLabel.value} ${level.value}星`, path: `/guide/${difficulty.value}/${level.value}` }
  ]
}));
</script>

<template>
  <div class="guide-shell">
    <el-card v-if="pending" class="panel-card">
      <el-skeleton :rows="10" animated />
    </el-card>

    <el-card v-else-if="error" class="panel-card">
      <el-result icon="error" title="攻略页面加载失败" sub-title="请稍后重试或返回攻略入口。">
        <template #extra>
          <NuxtLink to="/guide">
            <el-button type="primary">返回攻略入口</el-button>
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
          国行收录曲/{{ difficultyLabel }}/{{ level }}星
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
        <span>难度分布</span>
      </div>
      <el-table
        :data="summaryRows"
        class="summary-table"
        :header-cell-class-name="headerCellClassName"
      >
        <el-table-column label="各难易度曲数" align="center">
          <el-table-column prop="诈称+" label="诈称+" align="center" />
          <el-table-column prop="诈称" label="诈称" align="center" />
          <el-table-column prop="强" label="强" align="center" />
          <el-table-column prop="中" label="中" align="center" />
          <el-table-column prop="弱" label="弱" align="center" />
          <el-table-column prop="逆诈称" label="逆诈称" align="center" />
          <el-table-column prop="逆诈称-" label="逆诈称-" align="center" />
          <el-table-column prop="合计" label="合计" align="center" />
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
        <span>谱面详情</span>
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
        <el-table-column prop="title" label="标签" align="center" width="220" />
        <el-table-column prop="count" label="数量" align="center" width="100" />
        <el-table-column prop="category" label="分类" align="center" width="120" />
        <el-table-column prop="tag" label="属性" align="center" width="120" />
        <el-table-column prop="feature" label="谱面特征" align="center" />
        <el-table-column prop="noteCount" label="物量" align="center" width="100" />
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
  width: 20px;
  height: 20px;
  color: #d36d37;
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
