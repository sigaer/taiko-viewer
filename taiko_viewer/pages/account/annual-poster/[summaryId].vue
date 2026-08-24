<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import AnnualPoster from "~/components/account/version-summary/AnnualPoster.vue";
import type { AnnualSummaryV4 } from "~/types/account-version-summary";
import { normalizeAnnualSummary } from "~/utils/annualSummary";

declare global { interface Window { __ANNUAL_POSTER_READY__?: boolean } }

definePageMeta({ layout: "story", keepalive: false, mobileNav: false });
const route = useRoute();
const apiFetch = useViewerApiFetch();
const { t } = useI18n();
const immersiveStory = useState<boolean>("story-layout-immersive", () => false);
immersiveStory.value = true;

const desiredLocale = String(route.query.locale || "zh") === "ja" ? "ja" : "zh";
const renderToken = String(route.query.renderToken || "");
const summaryId = String(route.params.summaryId || "");
const translate = (key: string, params?: Record<string, unknown>) => t(key, params || {}, { locale: desiredLocale });

const { data, error } = await useAsyncData(`annual-poster-${summaryId}-${desiredLocale}`, () =>
  apiFetch<{ summary: AnnualSummaryV4; share: { url: string; expiresAt: string } }>(`/api/internal/annual-posters/${encodeURIComponent(summaryId)}`, { query: { token: renderToken, locale: desiredLocale } })
);

const summary = computed(() => data.value?.summary ? normalizeAnnualSummary(data.value.summary, desiredLocale, translate) : null);
const shareUrl = computed(() => data.value?.share.url ? new URL(data.value.share.url, useRequestURL().origin).toString() : "");
const qrCodeUrl = ref("");
const createQrCode = async (value: string) => {
  const { default: QRCode } = await import("qrcode");
  return QRCode.toDataURL(value, { width: 360, margin: 2, color: { dark: "#17365D", light: "#FFFFFF" }, errorCorrectionLevel: "M" });
};

const markReady = async () => {
  if (!process.client || !summary.value) return;
  const serverQr = String((data.value?.summary.poster as Record<string, unknown> | undefined)?.qrCodeDataUrl || "");
  qrCodeUrl.value = serverQr || await createQrCode(shareUrl.value);
  await nextTick();
  await document.fonts.ready;
  await Promise.all(Array.from(document.images).map((image) => image.complete ? Promise.resolve() : new Promise<void>((resolve) => {
    image.addEventListener("load", () => resolve(), { once: true }); image.addEventListener("error", () => resolve(), { once: true });
  })));
  await nextTick();
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  window.__ANNUAL_POSTER_READY__ = true;
};

watch([summary, () => data.value?.share.url], () => {
  if (process.client && summary.value) void markReady();
}, { immediate: true });
onBeforeUnmount(() => { immersiveStory.value = false; });
</script>

<template>
  <main class="poster-render-page">
    <AnnualPoster v-if="summary" :summary="summary" :share-url="shareUrl" :qr-code-url="qrCodeUrl" :expires-at="data?.share.expiresAt" />
    <p v-else>{{ error ? translate("annualSummary.state.loadFailed") : translate("annualSummary.state.loading") }}</p>
  </main>
</template>

<style scoped>
.poster-render-page{width:1080px;height:1440px;overflow:hidden;background:#f7fbff}.poster-render-page>:deep(.annual-poster){width:1080px;height:1440px}.poster-render-page>p{margin:0;width:100%;height:100%;display:grid;place-items:center;color:#17365d;background:#f7fbff;font-size:28px}
</style>
