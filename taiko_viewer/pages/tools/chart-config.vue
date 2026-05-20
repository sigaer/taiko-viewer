<script setup lang="ts">
import { ref } from "vue";
import { buildPageDescription } from "~/utils/seo";
import { resolveViewerError, viewerErrorAlertType } from "~/utils/viewerError";

const pageMeta = {
  title: "查配置",
  desc: buildPageDescription("按 BPM、难度或谱面配置字符串查询太鼓达人国行谱面。")
};

definePageMeta({
  pageTitle: pageMeta.title,
  pageDesc: pageMeta.desc,
  navKey: "/tools/chart-config",
  breadcrumbs: [
    { label: "查谱工具", to: "/tools" },
    { label: "查配置", to: "/tools/chart-config" }
  ]
});

useViewerSeo({
  title: pageMeta.title,
  description: pageMeta.desc,
  path: "/tools/chart-config"
});

const query = ref("16 oxxo");
const loading = ref(false);
const errorMessage = ref("");
const lines = ref<string[]>([]);

const submit = async () => {
  loading.value = true;
  errorMessage.value = "";
  lines.value = [];
  try {
    const result = await $fetch<{ lines: string[] }>("/api/tools/chart-config", {
      query: { q: query.value.trim() }
    });
    lines.value = result.lines || [];
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
      <p class="hint">
        示例：<code>180</code>、<code>180 鬼10</code>、<code>16 oxxo</code>、<code>16 oxxo 180 鬼10</code>（省略分音符时默认 16 分）
      </p>
      <el-form label-position="top" @submit.prevent="submit">
        <el-form-item label="查询内容">
          <el-input v-model="query" placeholder="例如：16 oxxo 180 鬼10" clearable />
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
      <pre v-else-if="lines.length" class="result-box">{{ lines.join("\n") }}</pre>
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
  line-height: 1.6;
}

.result-alert {
  margin-top: 16px;
}

.result-box {
  margin: 16px 0 0;
  padding: 14px 16px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(196, 127, 79, 0.2);
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 13px;
  line-height: 1.6;
  color: #4a3b30;
}
</style>
