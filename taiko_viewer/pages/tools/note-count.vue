<script setup lang="ts">
import { ref } from "vue";
import { buildPageDescription } from "~/utils/seo";
import { resolveViewerError, viewerErrorAlertType } from "~/utils/viewerError";
const { t } = useI18n();
const apiFetch = useViewerApiFetch();

definePageMeta({
  contentLayout: "standard", // slice G: one content width for the 工具 group
  pageTitleKey: "tools.noteCount",
  pageDescKey: "page.tools.noteCount.desc",
  navKey: "/tools/note-count",
  hidePageHeader: true,
  breadcrumbs: [
    { labelKey: "nav.more", to: "/more" },
    { labelKey: "tools.noteCount", to: "/tools/note-count" }
  ]
});

useViewerSeo(() => ({
  title: t("tools.noteCount"),
  description: buildPageDescription(t("page.tools.noteCount.desc", "按音符物量精确查找太鼓达人国行谱面。")),
  path: "/tools/note-count"
}));

const count = ref(500);
const loading = ref(false);
const errorMessage = ref("");
const items = ref<Array<{ title: string; course: string }>>([]);
const total = ref(0);
const truncated = ref(false);
// The empty result is shown once a search has run (before the first search there is no result to describe).
const searched = ref(false);

const submit = async () => {
  searched.value = true;
  loading.value = true;
  errorMessage.value = "";
  items.value = [];
  total.value = 0;
  truncated.value = false;
  try {
    const result = await apiFetch<{
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
    // slice F: pass the setup-time `t` (without it resolveViewerError calls useI18n() outside setup, throws, and no error is shown)
    errorMessage.value = await resolveViewerError(error, t("errors.queryFailed"), t);
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="rw-stack">
    <ReworkPageHeader :title="t('tools.noteCount')" />
    <ReworkPanel :label="t('tools.noteCount')">
      <form class="rw-form" @submit.prevent="submit">
        <label class="rw-field">
          <span class="rw-field__label">{{ t("tools.noteCount") }}</span>
          <input v-model.number="count" class="rw-input num" type="number" inputmode="numeric" min="0" max="99999" step="1" aria-describedby="note-count-hint" />
        </label>
        <button type="submit" class="rw-btn rw-btn--primary" :class="{ 'is-busy': loading }" :disabled="loading" :aria-busy="loading">{{ t("common.search") }}</button>
      </form>
      <p id="note-count-hint" class="rw-field__hint">{{ t("page.tools.noteCount.hint", "输入目标物量（total），将返回匹配的谱面列表，最多显示 20 条。") }}</p>
    </ReworkPanel>
    <p v-if="errorMessage" class="rw-alert" :class="{ 'rw-alert--warn': viewerErrorAlertType(errorMessage) === 'warning' }" role="alert">{{ errorMessage }}</p>
    <ReworkPanel v-else-if="total > 0" :title="t('rework.toolPages.result')">
      <p class="rw-count" role="status">{{ t("page.tools.noteCount.summary", { total, suffix: truncated ? t('page.tools.noteCount.truncated', '（仅显示前 20 条）') : '' }) }}</p>
      <ReworkToolsCharts :items="items" />
    </ReworkPanel>
    <ReworkState v-else-if="searched && !loading && total === 0 && items.length === 0 && !errorMessage" kind="empty" :title="t('page.tools.noteCount.empty', '没有找到对应物量的谱面')" />
  </div>
</template>
