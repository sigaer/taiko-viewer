<script setup lang="ts">
import { ref } from "vue";
import { buildPageDescription } from "~/utils/seo";
import { resolveViewerError, viewerErrorAlertType } from "~/utils/viewerError";

const pageMeta = {
  title: "查物量",
  desc: buildPageDescription("按音符物量精确查找太鼓达人国行谱面。")
};

definePageMeta({
  pageTitle: pageMeta.title,
  pageDesc: pageMeta.desc,
  navKey: "/tools/note-count",
  breadcrumbs: [
    { label: "查谱工具", to: "/tools" },
    { label: "查物量", to: "/tools/note-count" }
  ]
});

useViewerSeo({
  title: pageMeta.title,
  description: pageMeta.desc,
  path: "/tools/note-count"
});

const count = ref(500);
const loading = ref(false);
const errorMessage = ref("");
const items = ref<Array<{ title: string; course: string }>>([]);
const total = ref(0);
const truncated = ref(false);

const submit = async () => {
  loading.value = true;
  errorMessage.value = "";
  items.value = [];
  total.value = 0;
  truncated.value = false;
  try {
    const result = await $fetch<{
      total: number;
      items: Array<{ title: string; course: string }>;
      truncated: boolean;
    }>("/api/tools/note-count", {
      query: { count: count.value }
    });
    total.value = result.total;
    items.value = result.items;
    truncated.value = result.truncated;
  } catch (error: unknown) {
    errorMessage.value = await resolveViewerError(error, "查询失败，请稍后重试");
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="page-stack">
    <el-card class="panel-card">
      <p class="hint">输入目标物量（total），将返回匹配的谱面列表，最多显示 20 条。</p>
      <el-form label-position="top" @submit.prevent="submit">
        <el-form-item label="物量">
          <el-input-number v-model="count" :min="0" :max="99999" controls-position="right" />
        </el-form-item>
        <el-button type="primary" :loading="loading" native-type="submit">查询</el-button>
      </el-form>
      <el-alert
        v-if="errorMessage"
        :title="errorMessage"
        :type="viewerErrorAlertType(errorMessage)"
        show-icon
        :closable="false"
        class="result-alert viewer-friendly-alert"
      />
      <div v-else-if="total > 0" class="result-box">
        <p>共 {{ total }} 条{{ truncated ? "（仅显示前 20 条）" : "" }}</p>
        <ul>
          <li v-for="(item, index) in items" :key="`${item.title}-${item.course}-${index}`">
            {{ item.title }} {{ item.course }}
          </li>
        </ul>
      </div>
      <el-alert
        v-else-if="!loading && total === 0 && items.length === 0 && !errorMessage"
        title="没有找到对应物量的谱面"
        type="info"
        :closable="false"
        show-icon
        class="result-alert"
      />
    </el-card>
  </div>
</template>

<style scoped>
.page-stack {
  display: grid;
  gap: 20px;
}

.hint {
  margin: 0 0 14px;
  color: #6c5a4b;
}

.result-alert {
  margin-top: 16px;
}

.result-box {
  margin-top: 16px;
  padding: 14px 16px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(196, 127, 79, 0.2);
}

.result-box ul {
  margin: 10px 0 0;
  padding-left: 18px;
  line-height: 1.7;
  font-size: 13px;
}
</style>
