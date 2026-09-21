<script setup lang="ts">
import { prepareAnnualAssets } from "~/utils/annualAssets.client";
import { computed, nextTick, watch } from "vue";
import AnnualShareCardExport from "~/components/account/version-summary/AnnualShareCardExport.vue";
import type { AnnualSummaryV4 } from "~/types/account-version-summary";
import { normalizeAnnualSummary } from "~/utils/annualSummary";

declare global { interface Window { __ANNUAL_SHARE_CARD_READY__?: boolean } }

definePageMeta({ layout: false, keepalive: false, mobileNav: false });
const route = useRoute();
const apiFetch = useViewerApiFetch();
const { t } = useI18n();

const desiredLocale = String(route.query.locale || "zh") === "ja" ? "ja" : "zh";
const renderToken = String(route.query.renderToken || "");
const summaryId = String(route.params.summaryId || "");
const translate = (key: string, params?: Record<string, unknown>) => t(key, params || {}, { locale: desiredLocale });

const { data, error } = await useAsyncData(`annual-share-card-${summaryId}-${desiredLocale}`, () =>
  apiFetch<{ summary: AnnualSummaryV4; promoQrCodeDataUrl: string; promoUrl: string }>(`/api/internal/annual-share-cards/${encodeURIComponent(summaryId)}`, { query: { token: renderToken, locale: desiredLocale } })
);

const summary = computed(() => data.value?.summary ? normalizeAnnualSummary(data.value.summary, desiredLocale, translate) : null);

const markReady = async () => {
  if (!process.client || !summary.value) return;
  await nextTick();
  window.__ANNUAL_SHARE_CARD_READY__ = false;
  const root = document.querySelector<HTMLElement>('.share-card-render-page');
  if (!root) return;
  await prepareAnnualAssets(root);
  window.__ANNUAL_SHARE_CARD_READY__ = true;
};

watch(summary, () => { if (process.client && summary.value) void markReady(); }, { immediate: true });
</script>

<template>
  <main class="share-card-render-page">
    <AnnualShareCardExport
      v-if="summary"
      :summary="summary"
      :locale="desiredLocale"
      :qr-code-data-url="data?.promoQrCodeDataUrl"
      :qr-target-url="data?.promoUrl || ''"
    />
    <p v-else>{{ error ? translate("annualSummary.state.loadFailed") : translate("annualSummary.state.loading") }}</p>
  </main>
</template>

<style scoped>
.share-card-render-page{width:1080px;height:1872px;overflow:hidden;background:#fff}
.share-card-render-page>p{margin:0;width:100%;height:100%;display:grid;place-items:center;color:#17365d;background:#fff;font-size:28px}
</style>
