<script setup lang="ts">
import { computed, ref } from "vue";
import { buildPageDescription } from "~/utils/seo";

const { t } = useI18n();
const { accountUser, fetchCurrentUser } = useAccountState();
await fetchCurrentUser();

definePageMeta({
  contentLayout: "wide",
  pageTitleKey: "tools.trend",
  pageDescKey: "page.tools.trend.desc",
  navKey: "/tools/trend",
  hidePageHeader: true,
  reworkElementPlus: true,
  breadcrumbs: [
    { labelKey: "nav.myTaiko", to: "/my" },
    { labelKey: "tools.trend", to: "/tools/trend" }
  ]
});

useViewerSeo(() => ({
  title: t("tools.trend"),
  description: buildPageDescription(t("page.tools.trend.desc")),
  path: "/tools/trend"
}));

const n = ref(20);
const maxDays = ref(30);
const dim = ref("");
const barMode = ref(false);
const showAll = ref(false);
const { imageUrl, loading, errorMessage, errorStatus, loadChart } = useToolChartImage();
// Values are what the endpoint accepts (taikotrend dimensions); "" draws every dimension.
const dimOptions = [
  { value: "综合", key: "overall" },
  { value: "大歌力", key: "big" },
  { value: "体力", key: "stamina" },
  { value: "高速", key: "speed" },
  { value: "精度", key: "accuracy" },
  { value: "节奏", key: "rhythm" },
  { value: "复合", key: "complex" }
] as const;
const valid = computed(() => Number.isInteger(n.value) && n.value >= 1 && n.value <= 50 && Number.isInteger(maxDays.value) && maxDays.value >= 1 && maxDays.value <= 365);

const submit = async () => {
  if (loading.value || !valid.value) return;
  await loadChart("/api/account/charts/trend", {
    n: n.value,
    maxDays: maxDays.value,
    dim: dim.value || undefined,
    bar: barMode.value ? "1" : undefined,
    all: showAll.value ? "1" : undefined
  });
};
</script>

<template>
  <div class="rw-stack">
    <ReworkPageHeader :title="t('tools.trend')" />
    <ReworkGate :need="accountUser ? null : 'login'">
      <form class="rw-form" :aria-label="t('rework.imageTool.params')" @submit.prevent="submit">
        <label class="rw-field">
          <span class="rw-field__label">{{ t("rework.trendTool.points") }}</span>
          <input v-model.number="n" class="rw-input num" type="number" min="1" max="50" step="1" inputmode="numeric" required />
        </label>
        <label class="rw-field">
          <span class="rw-field__label">{{ t("rework.trendTool.days") }}</span>
          <input v-model.number="maxDays" class="rw-input num" type="number" min="1" max="365" step="1" inputmode="numeric" required />
        </label>
        <fieldset class="rw-field">
          <legend class="rw-field__label">{{ t("rework.trendTool.dim") }}</legend>
          <div class="rw-seg">
            <button type="button" :aria-pressed="!dim" @click="dim = ''">{{ t("rework.trendTool.all") }}</button>
            <button v-for="option in dimOptions" :key="option.value" type="button" :aria-pressed="dim === option.value" @click="dim = option.value">{{ t(`rework.ratingDims.${option.key}`) }}</button>
          </div>
        </fieldset>
        <label class="rw-check"><input v-model="barMode" type="checkbox" />{{ t("rework.trendTool.bar") }}</label>
        <label class="rw-check"><input v-model="showAll" type="checkbox" />{{ t("rework.trendTool.showAll") }}</label>
        <button type="submit" class="rw-btn rw-btn--primary" :disabled="!valid || loading" :aria-busy="loading">{{ imageUrl ? t("rework.imageTool.regenerate") : t("rework.imageTool.generate") }}</button>
      </form>
      <ReworkScoresImageResult
        :url="imageUrl"
        :loading="loading"
        :error="errorMessage"
        :status="errorStatus"
        :idle-text="t('rework.imageTool.ready')"
        :alt="t('rework.trendTool.imageAlt')"
        download="taiko-trend.jpg"
        @retry="submit"
      />
    </ReworkGate>
  </div>
</template>
