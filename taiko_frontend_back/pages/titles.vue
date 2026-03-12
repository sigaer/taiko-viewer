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

const { data: titleTableData, pending, error } = await useAsyncData(
  "title-wikitable",
  () => $fetch<WikiTablePayload>("/api/data/title_wikitable"),
  {
    default: () => ({
      table: { attrs: {} },
      rows: []
    })
  }
);

const tableRows = computed<TableRow[]>(() => (titleTableData.value?.rows || []) as TableRow[]);
const tableStyle = computed(() => titleTableData.value?.table?.attrs?.style || "");

const pageMeta = {
  title: "称号一览",
  desc: "称号列表与获取条件。"
};

definePageMeta({
  pageTitle: pageMeta.title,
  pageDesc: pageMeta.desc,
  navKey: "/titles",
  breadcrumbs: [{ label: "称号一览", to: "/titles" }]
});

useSeoMeta({
  title: pageMeta.title,
  description: pageMeta.desc,
  ogTitle: pageMeta.title,
  ogDescription: pageMeta.desc
});
</script>

<template>
  <div class="titles-page">
    <el-card class="panel-card">
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
  padding: 0.2em 0.4em;
}

.wikitable > tbody > tr > th {
  background-color: #eaecf0;
  text-align: center;
}

.wikitable a {
  color: #0645ad;
  text-decoration: none;
}

.wikitable a:hover,
.wikitable a:focus-visible {
  text-decoration: underline;
}
</style>
