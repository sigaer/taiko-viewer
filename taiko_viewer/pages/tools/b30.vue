<script setup lang="ts">
import { computed, ref } from "vue";
import { buildPageDescription } from "~/utils/seo";

const { t } = useI18n();
const { accountUser, fetchCurrentUser } = useAccountState();
await fetchCurrentUser();

definePageMeta({
  contentLayout: "wide",
  pageTitleKey: "tools.b30",
  pageDescKey: "page.tools.b30.desc",
  navKey: "/tools/b30",
  hidePageHeader: true,
  breadcrumbs: [
    { labelKey: "nav.myTaiko", to: "/my" },
    { labelKey: "tools.b30", to: "/tools/b30" }
  ]
});

useViewerSeo(() => ({
  title: t("tools.b30"),
  description: buildPageDescription(t("page.tools.b30.desc")),
  path: "/tools/b30"
}));

const n = ref(30);
const dim = ref("");
const dynamicOrigin = ref(false);
const query = computed(() => ({ n: n.value, dim: dim.value || undefined, r: dynamicOrigin.value ? "1" : undefined }));
const { imageUrl, loading, errorMessage, errorStatus, resultQuery, changed, generate } = useToolChartResult(query);
// Values are what the endpoint accepts (taikob dimensions); labels come from the locale files.
const dimOptions = [
  { value: "大歌", key: "big" },
  { value: "节奏", key: "rhythm" },
  { value: "复合", key: "complex" },
  { value: "精度", key: "accuracy" },
  { value: "体力", key: "stamina" },
  { value: "高速", key: "speed" }
] as const;
const dimLabel = (value: unknown) => {
  const option = dimOptions.find((item) => item.value === value);
  return option ? t(`rework.ratingDims.${option.key}`) : t("rework.b30Tool.overall");
};
const valid = computed(() => Number.isInteger(n.value) && n.value >= 1 && n.value <= 50);
const resultSummary = computed(() =>
  resultQuery.value
    ? `Top ${resultQuery.value.n} · ${dimLabel(resultQuery.value.dim)} · ${resultQuery.value.r ? t("rework.b30Tool.dynamicOrigin") : t("rework.b30Tool.fixedOrigin")}`
    : ""
);

const submit = async () => {
  if (loading.value || !valid.value) return;
  await generate("/api/account/charts/b30");
};
</script>

<template>
  <div class="rw-stack">
    <ReworkPageHeader :title="t('tools.b30')" />
    <ReworkGate :need="accountUser ? null : 'login'">
      <form class="rw-form" :aria-label="t('rework.imageTool.params')" @submit.prevent="submit">
        <label class="rw-field">
          <span class="rw-field__label">{{ t("rework.b30Tool.topN") }}</span>
          <input v-model.number="n" class="rw-input num" type="number" min="1" max="50" step="1" inputmode="numeric" required />
        </label>
        <fieldset class="rw-field">
          <legend class="rw-field__label">{{ t("rework.b30Tool.dim") }}</legend>
          <div class="rw-seg">
            <button type="button" :aria-pressed="!dim" @click="dim = ''">{{ t("rework.b30Tool.overall") }}</button>
            <button v-for="option in dimOptions" :key="option.value" type="button" :aria-pressed="dim === option.value" @click="dim = option.value">{{ t(`rework.ratingDims.${option.key}`) }}</button>
          </div>
        </fieldset>
        <label class="rw-check"><input v-model="dynamicOrigin" type="checkbox" />{{ t("rework.b30Tool.origin") }}</label>
        <button type="submit" class="rw-btn rw-btn--primary" :disabled="!valid || loading" :aria-busy="loading">{{ imageUrl ? t("rework.imageTool.regenerate") : t("rework.imageTool.generate") }}</button>
      </form>
      <ReworkScoresImageResult
        :url="imageUrl"
        :loading="loading"
        :error="errorMessage"
        :status="errorStatus"
        :idle-text="changed ? t('rework.imageTool.changed') : t('rework.imageTool.ready')"
        :alt="t('rework.b30Tool.imageAlt')"
        :summary="resultSummary"
        download="taiko-b30.jpg"
        @retry="submit"
      />
    </ReworkGate>
  </div>
</template>
