<script setup lang="ts">
import { ref } from "vue";
import { buildPageDescription } from "~/utils/seo";
import { resolveViewerError, viewerErrorAlertType } from "~/utils/viewerError";
const { t } = useI18n();
const apiFetch = useViewerApiFetch();

definePageMeta({
  contentLayout: "wide",
  pageTitleKey: "tools.chartConfig",
  pageDescKey: "page.tools.chartConfig.desc",
  navKey: "/tools/chart-config",
  breadcrumbs: [
    { labelKey: "nav.tools", to: "/tools" },
    { labelKey: "tools.chartConfig", to: "/tools/chart-config" }
  ]
});

useViewerSeo(() => ({
  title: t("tools.chartConfig"),
  description: buildPageDescription(t("page.tools.chartConfig.desc", "按 BPM、难度或谱面配置字符串查询太鼓达人国行谱面。")),
  path: "/tools/chart-config"
}));

const query = ref("16 oxxo");
const loading = ref(false);
const errorMessage = ref("");
const lines = ref<string[]>([]);

const submit = async () => {
  loading.value = true;
  errorMessage.value = "";
  lines.value = [];
  try {
    const result = await apiFetch<{ lines: string[] }>("/api/tools/chart-config", {
      query: { q: query.value.trim() }
    });
    lines.value = result.lines || [];
  } catch (error: unknown) {
    errorMessage.value = await resolveViewerError(error, t("errors.queryFailed"));
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
        <el-form-item :label="t('page.tools.chartConfig.queryLabel', '查询内容')">
          <el-input v-model="query" :placeholder="t('page.tools.chartConfig.placeholder', '例如：16 oxxo 180 鬼10')" clearable />
        </el-form-item>
        <el-button type="primary" :loading="loading" native-type="submit">{{ t("common.search") }}</el-button>
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
  color:var(--viewer-text-muted);
  line-height: 1.6;
}

.result-alert {
  margin-top: 16px;
}

.result-box {
  margin: 16px 0 0;
  padding: 14px 16px;
  border-radius: 12px;
  background:var(--viewer-surface-subtle);
  border: 1px solid var(--viewer-surface-subtle);
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 13px;
  line-height: 1.6;
  color:#4a3b30;
}
</style>
