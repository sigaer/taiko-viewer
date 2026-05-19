<script setup lang="ts">
import { computed } from "vue";

type TableCell = {
  tag: "th" | "td";
  attrs: Record<string, string>;
  html: string;
};

type TableRow = {
  attrs: Record<string, string>;
  cells: TableCell[];
};

type WikiTablePayload = {
  table?: {
    attrs?: Record<string, string> & { style?: string };
  };
  rows?: TableRow[];
};

const { data: titleTableData, pending, error } = await useTitlesContent();

const tableRows = computed<TableRow[]>(() => {
  return (titleTableData.value?.rows || []) as TableRow[];
});

const tableStyle = computed(() => titleTableData.value?.table?.attrs?.style || "");

import { buildPageDescription } from "~/utils/seo";

const pageMeta = {
  title: "称号一览",
  desc: buildPageDescription("太鼓达人国行称号列表与获取条件查询。")
};

definePageMeta({
  pageTitle: pageMeta.title,
  pageDesc: pageMeta.desc,
  navKey: "/titles",
  breadcrumbs: [{ label: "称号一览", to: "/titles" }]
});

useViewerSeo({
  title: pageMeta.title,
  description: pageMeta.desc,
  path: "/titles",
  keywords: ["称号一览", "太鼓达人称号"],
  breadcrumbs: [
    { name: "首页", path: "/" },
    { name: "称号一览", path: "/titles" }
  ]
});
</script>

<template>
  <div class="titles-page">
    <el-card class="panel-card">
      <template #header>
        <div class="card-header">
          <div class="header-title">
            <span class="header-icon">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 3l3 2 3.5-.5.5 3.5 2.5 2.5-2.5 2.5-.5 3.5L15 18l-3 2-3-2-3.5.5-.5-3.5L2 10.5 4.5 8 .5 4.5 4 5l3-2z"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </span>
            <div>
              <h3 class="title-text">称号一览</h3>
              <p class="subtitle-text">所有可获得的称号及获取条件（已翻译为中文）</p>
            </div>
          </div>
        </div>
      </template>
      
      <el-skeleton v-if="pending" :rows="10" animated />
      <el-alert
        v-else-if="error"
        title="称号数据加载失败，请稍后重试"
        type="error"
        :closable="false"
        show-icon
      />
      <div v-else class="table-wrap">
        <table class="wikitable" :style="tableStyle">
          <tbody>
            <tr v-for="(row, rowIndex) in tableRows" :key="rowIndex" v-bind="row.attrs">
              <component
                :is="cell.tag"
                v-for="(cell, cellIndex) in row.cells"
                :key="`${rowIndex}-${cellIndex}`"
                v-bind="cell.attrs"
                v-html="cell.html"
              />
            </tr>
          </tbody>
        </table>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.titles-page {
  display: grid;
}

.panel-card {
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(160, 120, 86, 0.12);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(248, 224, 193, 0.85), rgba(255, 244, 230, 0.95));
  color: #a36b39;
}

.header-icon svg {
  width: 20px;
  height: 20px;
}

.title-text {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #73573d;
}

.subtitle-text {
  margin: 4px 0 0;
  font-size: 13px;
  color: #9b7a5c;
}

.table-wrap {
  overflow-x: auto;
}

.wikitable {
  width: 100%;
  min-width: 980px;
  background-color: #f8f9fa;
  color: #202122;
  margin: 0;
  border: 1px solid #a2a9b1;
  border-collapse: collapse;
}

.wikitable > caption {
  font-weight: 700;
}

.wikitable > tbody > tr > th,
.wikitable > tbody > tr > td {
  border: 1px solid #a2a9b1;
  padding: 0.6em 0.8em;
  font-size: 14px;
  line-height: 1.5;
}

.wikitable > tbody > tr > th {
  background-color: #eaecf0;
  text-align: center;
  font-weight: 600;
  color: #73573d;
}

.wikitable > tbody > tr > td {
  vertical-align: top;
}

.wikitable a {
  color: #0645ad;
  text-decoration: none;
}

.wikitable a:hover,
.wikitable a:focus-visible {
  text-decoration: underline;
}

/* 优化表格行hover效果 */
.wikitable > tbody > tr:hover {
  background-color: #fff8f0;
}

:deep(.el-card__header) {
  border-bottom: 1px solid #f0e6dc;
  padding: 16px 20px;
}

:deep(.el-card__body) {
  padding: 20px;
}
</style>
