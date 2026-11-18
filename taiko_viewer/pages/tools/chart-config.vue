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
  hidePageHeader: true,
  reworkElementPlus: true,
  breadcrumbs: [
    { labelKey: "nav.more", to: "/more" },
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
    // slice F: pass the setup-time `t` (without it resolveViewerError calls useI18n() outside setup, throws, and no error is shown)
    errorMessage.value = await resolveViewerError(error, t("errors.queryFailed"), t);
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="rw-stack">
    <ReworkPageHeader :title="t('tools.chartConfig')" />
    <ReworkPanel :label="t('tools.chartConfig')">
      <form class="rw-form" @submit.prevent="submit">
        <label class="rw-field rw-field--grow">
          <span class="rw-field__label">{{ t("page.tools.chartConfig.queryLabel", "查询内容") }}</span>
          <input
            v-model="query"
            class="rw-input rw-input--block"
            type="search"
            :placeholder="t('page.tools.chartConfig.placeholder', '例如：16 oxxo 180 鬼10')"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            enterkeyhint="search"
            aria-describedby="chart-config-hint"
          />
        </label>
        <button type="submit" class="rw-btn rw-btn--primary" :class="{ 'is-busy': loading }" :disabled="loading" :aria-busy="loading">{{ t("common.search") }}</button>
      </form>
      <ReworkToolsExamples id="chart-config-hint" :examples="['180', '180 鬼10', '16 oxxo', '16 oxxo 180 鬼10']" :note="t('rework.toolPages.chartConfig.note')" @pick="(value) => (query = value)" />
    </ReworkPanel>
    <p v-if="errorMessage" class="rw-alert" :class="{ 'rw-alert--warn': viewerErrorAlertType(errorMessage) === 'warning' }" role="alert">{{ errorMessage }}</p>
    <ReworkToolsLines v-else-if="lines.length" :lines="lines" :label="t('rework.toolPages.result')" />
  </div>
</template>
