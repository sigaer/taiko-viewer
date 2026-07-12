<script setup lang="ts">
import { ref, watch } from "vue";
import QRCode from "qrcode";
import { ElMessage } from "element-plus";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import AnnualPoster from "../AnnualPoster.vue";
import StorySlideShell from "../StorySlideShell.vue";

const props = defineProps<{ summary: VersionSummaryViewModel; pageIndex: number; pageTotal: number; active: boolean; reducedMotion: boolean }>();
const { t, locale } = useI18n();
const apiFetch = useViewerApiFetch();
const busy = ref(false);
type ActiveShare = { id: string; url: string; expiresAt: string; locale?: "zh" | "ja"; posterUrl?: string | null };
const share = ref<ActiveShare | null>(null);
const qrCodeUrl = ref("");
const posterUrl = ref("");
const currentLocale = () => locale.value === "ja" ? "ja" as const : "zh" as const;
const persistShare = (value: ActiveShare | null) => {
  props.summary.activeShare = value ? {
    id: value.id,
    url: value.url,
    expiresAt: value.expiresAt,
    locale: value.locale || currentLocale(),
    posterUrl: value.posterUrl || null
  } : null;
};

const absoluteUrl = (value: string) => process.client ? new URL(value, window.location.origin).toString() : value;
const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

watch(() => props.summary.activeShare, async (value) => {
  share.value = value ? { ...value } : null;
  posterUrl.value = value?.posterUrl || "";
  qrCodeUrl.value = value?.url
    ? await QRCode.toDataURL(absoluteUrl(value.url), { width: 320, margin: 2, color: { dark: "#17365D", light: "#FFFFFF" }, errorCorrectionLevel: "M" })
    : "";
}, { immediate: true });

const pollPoster = async (jobId: string) => {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const payload = await apiFetch<{ job: { status: string; error?: { message?: string } | null }; poster?: { url: string } }>(`/api/account/annual-poster-jobs/${encodeURIComponent(jobId)}`);
    if (payload.job.status === "completed" && payload.poster?.url) return payload.poster.url;
    if (payload.job.status === "failed") throw new Error(payload.job.error?.message || "POSTER_FAILED");
    await wait(900);
  }
  throw new Error("POSTER_TIMEOUT");
};

const renewShare = async () => {
  if (!share.value || busy.value) return;
  busy.value = true;
  try {
    const result = await apiFetch<{ share: ActiveShare }>(`/api/account/annual-shares/${encodeURIComponent(share.value.id)}`, { method: "PATCH" });
    share.value = { ...share.value, expiresAt: result.share.expiresAt };
    persistShare(share.value);
    ElMessage.success(t("annualSummary.share.renewed"));
  } catch {
    ElMessage.error(t("annualSummary.share.failed"));
  } finally {
    busy.value = false;
  }
};

const revokeShare = async () => {
  if (!share.value || busy.value) return;
  busy.value = true;
  try {
    await apiFetch(`/api/account/annual-shares/${encodeURIComponent(share.value.id)}`, { method: "DELETE" });
    share.value = null;
    persistShare(null);
    posterUrl.value = "";
    qrCodeUrl.value = "";
    ElMessage.success(t("annualSummary.share.revoked"));
  } catch {
    ElMessage.error(t("annualSummary.share.failed"));
  } finally {
    busy.value = false;
  }
};

const createShare = async () => {
  if (busy.value) return;
  busy.value = true;
  try {
    const shared = await apiFetch<{ share: ActiveShare }>(`/api/account/annual-summaries/${encodeURIComponent(props.summary.summaryId)}/shares`, {
      method: "POST", body: { locale: currentLocale() }
    });
    const activeShare = { ...shared.share, locale: currentLocale() };
    share.value = activeShare;
    persistShare(activeShare);
    qrCodeUrl.value = await QRCode.toDataURL(absoluteUrl(activeShare.url), { width: 320, margin: 2, color: { dark: "#17365D", light: "#FFFFFF" }, errorCorrectionLevel: "M" }).catch(() => "");
    posterUrl.value = activeShare.posterUrl || "";
    ElMessage.success(t("annualSummary.share.created"));
  } catch {
    ElMessage.error(t("annualSummary.share.failed"));
  } finally {
    busy.value = false;
  }
};

const generatePoster = async () => {
  if (busy.value) return;
  if (!share.value) {
    ElMessage.info(t("annualSummary.share.posterFirst"));
    return;
  }
  busy.value = true;
  try {
    const queued = await apiFetch<{ job: { id: string; status: string }; poster?: { url: string } }>(`/api/account/annual-summaries/${encodeURIComponent(props.summary.summaryId)}/posters`, {
      method: "POST", body: { shareId: share.value.id, locale: currentLocale() }
    });
    posterUrl.value = queued.poster?.url || (queued.job.status === "completed" ? "" : await pollPoster(queued.job.id));
    share.value.posterUrl = posterUrl.value || null;
    share.value.locale = currentLocale();
    persistShare(share.value);
    ElMessage.success(t("annualSummary.share.ready"));
  } catch {
    ElMessage.error(t("annualSummary.share.failed"));
  } finally {
    busy.value = false;
  }
};

const downloadPoster = () => {
  if (!posterUrl.value || !process.client) return false;
  const anchor = document.createElement("a");
  anchor.href = posterUrl.value;
  anchor.download = `taiko-annual-2026-${locale.value}.png`;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  return true;
};

const sharePoster = async () => {
  if (!process.client || !share.value) return;
  if (!posterUrl.value) {
    ElMessage.info(t("annualSummary.share.posterFirst"));
    return;
  }
  const url = absoluteUrl(share.value.url);
  try {
    if (posterUrl.value && navigator.share && navigator.canShare) {
      const response = await fetch(posterUrl.value);
      const file = new File([await response.blob()], "taiko-annual-2026.png", { type: "image/png" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ title: props.summary.poster.title, text: props.summary.finalTitle.title, url, files: [file] });
        return;
      }
    }
    if (navigator.share) await navigator.share({ title: props.summary.poster.title, text: props.summary.finalTitle.title, url });
    else if (downloadPoster()) ElMessage.success(t("annualSummary.share.downloadFallback"));
  } catch (error) {
    if ((error as Error)?.name !== "AbortError") {
      if (downloadPoster()) ElMessage.success(t("annualSummary.share.downloadFallback"));
      else ElMessage.error(t("annualSummary.share.failed"));
    }
  }
};
</script>

<template>
  <StorySlideShell :page-index="pageIndex" :page-total="pageTotal" :eyebrow="summary.copy.poster.eyebrow" :title="summary.copy.poster.title" :lead="summary.copy.poster.subtitle" :accent="summary.poster.periodLabel" tone="gold" :active="active" :reduced-motion="reducedMotion">
    <div class="poster-slide">
      <div class="poster-slide__preview" data-animate>
        <AnnualPoster :summary="summary" :share-url="share ? absoluteUrl(share.url) : ''" :qr-code-url="qrCodeUrl" :expires-at="share?.expiresAt" compact />
      </div>
      <div class="poster-slide__actions" data-animate>
        <button v-if="!share" type="button" :disabled="busy" @click="createShare">{{ t("annualSummary.controls.share") }}</button>
        <button v-else-if="!posterUrl" type="button" :disabled="busy" @click="generatePoster">{{ busy ? t("annualSummary.share.generating") : t("annualSummary.controls.generatePoster") }}</button>
        <button v-if="posterUrl" type="button" @click="downloadPoster">{{ t("annualSummary.controls.download") }}</button>
        <button v-if="share" type="button" @click="sharePoster">{{ t("annualSummary.controls.webShare") }}</button>
        <div v-if="share" class="poster-slide__management">
          <button type="button" :disabled="busy" @click="renewShare">{{ t("annualSummary.controls.renewShare") }}</button>
          <button type="button" :disabled="busy" class="poster-slide__revoke" @click="revokeShare">{{ t("annualSummary.controls.revokeShare") }}</button>
        </div>
        <small v-if="share">{{ t("annualSummary.share.expires", { date: new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'zh-CN', { dateStyle: 'medium' }).format(new Date(share.expiresAt)) }) }}</small>
        <p>{{ t("annualSummary.share.privacy") }}</p>
      </div>
    </div>
  </StorySlideShell>
</template>

<style scoped>
.poster-slide{height:100%;min-height:0;display:grid;grid-template-columns:minmax(260px,.74fr) minmax(220px,.46fr);gap:clamp(12px,3vw,32px);align-items:center;justify-content:center}.poster-slide__preview{min-height:0;max-height:100%;display:grid;place-items:center}.poster-slide__preview :deep(.annual-poster){width:auto;height:min(100%,62vh);max-width:100%}.poster-slide__actions{display:grid;gap:9px}.poster-slide__actions button{min-height:48px;padding:10px 18px;border-radius:99px;border:1px solid rgba(57,120,200,.2);color:#17365d;background:#f7fbff;font-size:12px;font-weight:700;cursor:pointer}.poster-slide__actions>button:first-child{color:#fff;background:#3978c8;border-color:#3978c8}.poster-slide__actions button:disabled{opacity:.55;cursor:wait}.poster-slide__actions button:focus-visible{outline:3px solid #3978c8;outline-offset:3px}.poster-slide__management{display:grid;grid-template-columns:1fr 1fr;gap:7px}.poster-slide__management button{min-height:44px;padding:7px 10px}.poster-slide__management .poster-slide__revoke{color:#17365d;border-color:#3978c855;background:#f7fbff}.poster-slide__actions small{color:#5c7697;font-size:10px;line-height:1.45}.poster-slide__actions p{margin:4px 0 0;color:#7890ab;font-size:12px;line-height:1.55}@media(max-width:720px){.poster-slide{grid-template-columns:minmax(0,1fr) minmax(130px,38vw);gap:8px;align-items:start}.poster-slide__preview :deep(.annual-poster){height:auto;width:100%}.poster-slide__actions{gap:6px}.poster-slide__actions button{min-height:44px;padding:7px 9px;font-size:10px}.poster-slide__management{grid-template-columns:1fr}.poster-slide__actions p{font-size:12px;line-height:1.35}}@media (orientation:landscape) and (min-width:721px) and (max-height:460px){.poster-slide{grid-template-columns:minmax(320px,1fr) minmax(260px,.65fr);gap:18px}.poster-slide__preview :deep(.annual-poster){height:min(100%,55vh)}.poster-slide__actions{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.poster-slide__actions button{min-height:44px;padding:6px 10px}.poster-slide__management{grid-column:1/-1;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.poster-slide__management button{min-height:44px}.poster-slide__actions small,.poster-slide__actions p{grid-column:1/-1}.poster-slide__actions p{margin-top:0;line-height:1.35}}
</style>
