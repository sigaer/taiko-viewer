<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElMessage } from "element-plus";

const route = useRoute();
const runtimeConfig = useRuntimeConfig();
const guideApiBase = runtimeConfig.public.guideApiBase || runtimeConfig.public.apiBase;

const pageMeta = {
  title: "谱面攻略",
  desc: "按难度与星级查看谱面详情与分类统计。"
};

definePageMeta({
  pageTitle: pageMeta.title,
  pageDesc: pageMeta.desc,
  navKey: "/guide",
  breadcrumbs: [{ label: "谱面攻略", to: "/guide" }]
});

useSeoMeta({
  title: pageMeta.title,
  description: pageMeta.desc,
  ogTitle: pageMeta.title,
  ogDescription: pageMeta.desc
});

const difficultyGroups = [
  { value: 1, label: "简单", max: 5 },
  { value: 2, label: "普通", max: 7 },
  { value: 3, label: "困难", max: 8 },
  { value: 4, label: "魔王", max: 10 }
];

const difficultyValue = computed(() => Number(route.query.difficulty || 0));
const levelValue = computed(() => Number(route.query.level || 0));

const difficultyLabel = computed(() => {
  return difficultyGroups.find((item) => item.value === difficultyValue.value)?.label || "未选择";
});

const tableData = ref([
  {
    "诈称+": 1,
    诈称: 3,
    强: 3,
    中: 4,
    弱: 5,
    逆诈称: 2,
    "逆诈称-": 1,
    合计: 17
  }
]);

const tagLabels = ["诈称+", "诈称", "强", "中", "弱", "逆诈称", "逆诈称-"];

const buildTagRows = () =>
  tagLabels.map((label, index) => ({
    id: index + 1,
    title: label,
    hasChildren: true
  }));

const songData = ref(buildTagRows());
const loadingTable = ref(false);
const tableKey = computed(() => `${difficultyValue.value}-${levelValue.value}`);

watch([difficultyValue, levelValue], () => {
  songData.value = buildTagRows();
  loadingTable.value = false;
});

const colorMap = ["hardest", "harder", "hard", "normal", "easy", "easier", "easiest"];

const mainSpanMethod = (row: any) => {
  if (row.row?.id < 8) {
    return [1, 8];
  }
};

const headerCellClassName = (row: any) => {
  if (row.rowIndex === 1) {
    return colorMap[row.columnIndex];
  }
  return "";
};

const cellClassName = (row: any) => {
  if (row.row?.id < 8) {
    return colorMap[row.row.id - 1];
  }
  return "common";
};

const loadChildren = async (
  row: { id: number },
  _treeNode: unknown,
  resolve: (data: unknown[]) => void
) => {
  if (!difficultyValue.value || !levelValue.value) {
    resolve([]);
    return;
  }
  loadingTable.value = true;
  try {
    const res = await $fetch<any>("/music/musicDetailList", {
      baseURL: guideApiBase,
      params: {
        difficultyType: difficultyValue.value,
        level: levelValue.value,
        levelTag: row.id
      }
    });

    const data = Array.isArray(res)
      ? res
      : Array.isArray(res?.data)
        ? res.data
        : [];

    resolve(data);
    if (!data.length) {
      ElMessage.warning("暂无谱面数据");
    }
  } catch (error) {
    resolve([]);
    ElMessage.error("获取谱面失败，请稍后重试");
  } finally {
    loadingTable.value = false;
  }
};

const showEmpty = computed(() => !difficultyValue.value || !levelValue.value);
</script>

<template>
  <div class="guide-shell">
    <el-card class="panel-card">
      <template v-if="showEmpty">
        <div class="empty-state">
          <el-empty description="请在左侧选择难度与星级" />
        </div>
      </template>
      <template v-else>
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
            国行收录曲/{{ difficultyLabel }}/{{ levelValue }}星
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
          :data="tableData"
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
          :data="songData"
          :span-method="mainSpanMethod"
          row-key="id"
          lazy
          :load="loadChildren"
          :tree-props="{ children: 'children', hasChildren: 'hasChildren' }"
          :cell-class-name="cellClassName"
          v-loading="loadingTable"
          class="detail-table"
        >
          <el-table-column prop="title" label="曲名" align="center" width="250" />
          <el-table-column prop="bpm" label="BPM" align="center" width="100" />
          <el-table-column prop="category" label="分类" align="center" width="120" />
          <el-table-column prop="tag" label="属性" align="center" width="120" />
          <el-table-column prop="feature" label="谱面特征" align="center" />
          <el-table-column prop="noteCount" label="物量" align="center" width="100" />
        </el-table>
      </template>
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
  border-radius: 6px;
  background: rgba(196, 127, 79, 0.2);
  color: #9a6d47;
}

.guide-icon svg {
  width: 14px;
  height: 14px;
}

.guide-avatar {
  position: absolute;
  top: 0;
  width: 120px;
  height: 140px;
  object-fit: contain;
}

.guide-avatar.left {
  left: 0;
}

.guide-avatar.right {
  right: 0;
}

.summary-table {
  margin: 0 auto;
  min-width: 640px;
  max-width: 1000px;
}

.guide-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
  color: #5a4634;
  margin-bottom: 10px;
}

.section-icon {
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: rgba(196, 127, 79, 0.18);
  color: #9a6d47;
}

.section-icon svg {
  width: 14px;
  height: 14px;
}

.section-icon.alt {
  background: rgba(88, 136, 197, 0.2);
  color: #3c6aa6;
}

.guide-divider {
  margin: 20px 0;
  border: none;
  border-top: 1px solid rgba(165, 138, 110, 0.25);
}

.detail-table {
  margin: 0 auto;
  min-width: 1000px;
}

.empty-state {
  padding: 24px 0;
}

:deep(.el-table .main-table) {
  background-color: #eef5ff;
}

:deep(.el-table .cell) {
  white-space: pre-line;
}

:deep(.el-table .el-table__placeholder) {
  width: 0;
}

:deep(.el-table .el-table__indent) {
  padding-left: 0 !important;
}

:deep(.el-table .hardest) {
  background-color: #002060 !important;
  color: #fff;
}

:deep(.el-table .harder) {
  background-color: #3f3f3f !important;
  color: #fff;
}

:deep(.el-table .hard) {
  background-color: #c824bf !important;
  color: #fff;
}

:deep(.el-table .normal) {
  background-color: #ed7d31 !important;
  color: #000;
}

:deep(.el-table .easy) {
  background-color: #ffe598 !important;
  color: #000;
}

:deep(.el-table .easier) {
  background-color: #92d050 !important;
  color: #000;
}

:deep(.el-table .easiest) {
  background-color: #2f5597 !important;
  color: #fff;
}
</style>
