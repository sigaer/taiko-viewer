<script setup lang="ts">
import { computed } from "vue";
import { buildPageDescription } from "~/utils/seo";

const { t } = useI18n();
// Signed-in gate (slice F: ReworkGate replaces AccountToolGate, which read the same account state).
const { accountUser, fetchCurrentUser } = useAccountState();
await fetchCurrentUser();

definePageMeta({
  contentLayout: "wide",
  pageTitleKey: "tools.wordCloud",
  pageDescKey: "page.tools.wordCloud.desc",
  navKey: "/tools/word-cloud",
  hidePageHeader: true,
  reworkElementPlus: true,
  breadcrumbs: [
    { labelKey: "nav.myTaiko", to: "/my" },
    { labelKey: "tools.wordCloud", to: "/tools/word-cloud" }
  ]
});

useViewerSeo(() => ({
  title: t("tools.wordCloud"),
  description: buildPageDescription(t("page.tools.wordCloud.desc")),
  path: "/tools/word-cloud"
}));

const { imageUrl, loading, errorMessage, errorStatus, loadChart } = useToolChartImage();
// Copy in locales/{zh,ja}.json rework.toolPages.wordCloud (moved word for word in slice F).
const copy = computed(() => ({
  hint: t("rework.toolPages.wordCloud.hint"),
  submit: t("rework.toolPages.wordCloud.submit"),
  imageAlt: t("rework.toolPages.wordCloud.imageAlt")
}));

const submit = async () => {
  await loadChart("/api/account/charts/word-cloud");
};
</script>

<template>
  <div class="rw-stack">
    <ReworkPageHeader :title="t('tools.wordCloud')" />
    <ReworkGate :need="accountUser ? null : 'login'">
      <div class="rw-form">
        <p class="rw-field__hint">{{ copy.hint }}</p>
        <button type="button" class="rw-btn rw-btn--primary" :class="{ 'is-busy': loading }" :disabled="loading" :aria-busy="loading" @click="submit">{{ copy.submit }}</button>
      </div>
      <ReworkScoresImageResult
        :url="imageUrl"
        :loading="loading"
        :error="errorMessage"
        :status="errorStatus"
        :alt="copy.imageAlt"
        download="taiko-word-cloud.png"
        @retry="submit"
      />
    </ReworkGate>
  </div>
</template>
