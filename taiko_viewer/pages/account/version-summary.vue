<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, type WatchStopHandle } from "vue";
import { ElMessage } from "element-plus";
import StoryDrawer from "~/components/account/version-summary/StoryDrawer.vue";
import StoryPlayer from "~/components/account/version-summary/StoryPlayer.vue";
import AnnualBuildPrelude from "~/components/account/version-summary/AnnualBuildPrelude.vue";
import type { AnnualSummaryV4, VersionSummaryBinding, VersionSummaryPayload } from "~/types/account-version-summary";
import { normalizeAnnualSummary } from "~/utils/annualSummary";
import { preloadAnnualOpeningCovers } from "~/utils/annualCoverFlow";
import { preloadAnnualOpeningArtwork } from "~/utils/annualOpeningAssets.client";
import { ANNUAL_BGM_SRC, preloadAnnualBgm } from "~/utils/annualBgm.client";
import { buildPageDescription } from "~/utils/seo";
import { resolveViewerError } from "~/utils/viewerError";

type AnnualJob = {
  id: string;
  status: "queued" | "running" | "completed" | "failed" | "expired" | "cancelled";
  error?: { code: string; message: string } | null;
  progressStage?: string | null;
  progressPercent?: number;
  progressDetail?: string | null;
};
type AnnualEnvelope = Omit<VersionSummaryPayload, "summary"> & {
  summary: AnnualSummaryV4 | null;
  state: "ready" | "missing";
  buildJob: AnnualJob | null;
};

const { t, locale } = useI18n();
const localePath = useLocalePath();
const apiFetch = useViewerApiFetch();

definePageMeta({ layout: "story", middleware: ["annual-summary-access"], keepalive: false, mobileNav: false, pageTitleKey: "account.versionSummary", pageDescKey: "page.account.versionSummary.desc" });
useViewerSeo(() => ({ title: t("account.versionSummary"), description: buildPageDescription(t("page.account.versionSummary.desc")), path: "/account/version-summary" }));
useHead({
  link: [
    { rel: "preload", as: "audio", href: ANNUAL_BGM_SRC, type: "audio/ogg" },
    { rel: "preload", as: "image", href: "/title.png", fetchpriority: "high" },
    { rel: "preload", as: "image", href: "/to_end.png" },
    { rel: "preload", as: "image", href: "/icon.png" }
  ]
});

if (import.meta.client) {
  void preloadAnnualBgm();
  void preloadAnnualOpeningArtwork();
}

const beta = useAnnualBeta();
const betaSlide = ref("opening");
const storyStarted = ref(false);
const drawerOpen = ref(false);
const building = ref(false);
const switchingBindingId = ref<number | null>(null);
const selectedBindingId = ref<number | null>(null);
const jobStatus = ref<AnnualJob | null>(null);
const openingCriticalAssetsReadyId = ref("");
const immersiveStory = useState<boolean>("story-layout-immersive", () => false);
let pollGeneration = 0;
let pollingJobId = "";
let stopArtworkPreload: WatchStopHandle | null = null;

const fetchAnnual = async () => {
  try {
    const payload = await apiFetch<AnnualEnvelope>("/api/account/annual-summaries/annual_2026", { query: { locale: locale.value === "ja" ? "ja" : "zh" } });
    return { payload, error: "" };
  } catch (error) {
    return { payload: null, error: await resolveViewerError(error, t("annualSummary.state.loadFailed")) };
  }
};

const fetchBindings = async () => {
  try {
    const payload = await apiFetch<{ bindings: VersionSummaryBinding[]; currentBinding: VersionSummaryBinding | null }>("/api/account/bindings");
    return { bindings: payload.bindings || [], currentBinding: payload.currentBinding || null, error: "" };
  } catch (error) {
    return { bindings: [], currentBinding: null, error: await resolveViewerError(error, t("annualSummary.state.loadFailed")) };
  }
};

const { data: annualState, pending, refresh: reloadAnnual } = await useAsyncData("account-annual-summary-v4", fetchAnnual, { default: () => ({ payload: null, error: "" }) });
const { data: bindingState, refresh: reloadBindings } = await useAsyncData("account-annual-summary-bindings", fetchBindings, { default: () => ({ bindings: [], currentBinding: null, error: "" }) });

const envelope = computed(() => annualState.value?.payload || null);
const schemaMismatch = computed(() => Boolean(envelope.value?.summary && envelope.value.summary.schemaVersion !== 4));
const summary = computed(() => {
  if (!envelope.value?.summary || schemaMismatch.value) return null;
  try {
    const normalized = normalizeAnnualSummary(envelope.value.summary, locale.value === "ja" ? "ja" : "zh", (key, params) => t(key, params || {}));
    const existingShare = envelope.value.share;
    normalized.activeShare = existingShare?.url ? {
      id: existingShare.id,
      url: existingShare.url,
      expiresAt: existingShare.expiresAt,
      locale: existingShare.locale,
      posterUrl: existingShare.posterUrl
    } : null;
    return normalized;
  } catch {
    return null;
  }
});
const currentBinding = computed(() => envelope.value?.currentBinding || bindingState.value?.currentBinding || null);
const bindings = computed(() => bindingState.value?.bindings?.length ? bindingState.value.bindings : currentBinding.value ? [currentBinding.value] : []);
const selectedVersion = computed(() => envelope.value?.selectedVersion || {
  key: "annual_2026", name: t("annualSummary.name"), startDate: "2026-01-01", endDate: "2026-10-01"
});
const pageError = computed(() => schemaMismatch.value ? t("annualSummary.state.schemaMismatch") : annualState.value?.error || bindingState.value?.error || "");
const jobStatusLabel = computed(() => {
  if (!jobStatus.value) return "";
  const key: Record<AnnualJob["status"], string> = {
    queued: "annualSummary.state.jobQueued",
    running: "annualSummary.state.jobRunning",
    completed: "annualSummary.state.jobCompleted",
    failed: "annualSummary.state.jobFailed",
    expired: "annualSummary.state.jobFailed",
    cancelled: "annualSummary.state.jobFailed"
  };
  return t(key[jobStatus.value.status]);
});

const sleep = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));
const pollJob = async (jobId: string, generation: number) => {
  const deadline = Date.now() + 15 * 60 * 1000;
  while (Date.now() < deadline && generation === pollGeneration) {
    const payload = await apiFetch<{ job: AnnualJob; summary?: AnnualSummaryV4 }>(`/api/account/annual-summary-jobs/${encodeURIComponent(jobId)}`);
    jobStatus.value = payload.job;
    if (payload.job.status === "completed") {
      await reloadAnnual();
      return;
    }
    if (["failed", "expired", "cancelled"].includes(payload.job.status)) {
      throw new Error(payload.job.error?.message || "ANNUAL_BUILD_FAILED");
    }
    await sleep(1200);
  }
  throw new Error("ANNUAL_BUILD_TIMEOUT");
};

const resumeJob = async (job: AnnualJob) => {
  if (pollingJobId === job.id) return;
  const generation = ++pollGeneration;
  pollingJobId = job.id;
  building.value = true;
  try {
    await pollJob(job.id, generation);
  } catch (error) {
    if (generation === pollGeneration && !["failed", "expired", "cancelled"].includes(jobStatus.value?.status || "")) {
      ElMessage.error(await resolveViewerError(error, t("annualSummary.state.buildFailed")));
    }
  } finally {
    if (pollingJobId === job.id) pollingJobId = "";
    if (generation === pollGeneration) building.value = false;
  }
};

const buildSummary = async (retryFailed = false) => {
  if (building.value) return;
  const generation = ++pollGeneration;
  building.value = true;
  try {
    const payload = await apiFetch<{ job: AnnualJob; summary?: AnnualSummaryV4 }>("/api/account/annual-summaries/annual_2026/build", {
      method: "POST", body: { locale: locale.value === "ja" ? "ja" : "zh", retryFailed }
    });
    jobStatus.value = payload.job;
    if (payload.summary || payload.job.status === "completed") await reloadAnnual();
    else await pollJob(payload.job.id, generation);
    storyStarted.value = false;
    drawerOpen.value = false;
    ElMessage.success(t("annualSummary.state.buildReady"));
  } catch (error) {
    if (jobStatus.value?.error?.code !== "INSUFFICIENT_DATA") ElMessage.error(await resolveViewerError(error, t("annualSummary.state.buildFailed")));
  } finally {
    pollingJobId = "";
    if (generation === pollGeneration) building.value = false;
  }
};

const handleBindingChange = async (bindingId: number | null) => {
  if (!bindingId || bindingId === currentBinding.value?.id || switchingBindingId.value) return;
  switchingBindingId.value = bindingId;
  try {
    await apiFetch("/api/account/bindings/current", { method: "POST", body: { bindingId } });
    jobStatus.value = null;
    await Promise.all([reloadBindings(), reloadAnnual()]);
    storyStarted.value = false;
  } catch (error) {
    selectedBindingId.value = currentBinding.value?.id ?? null;
    ElMessage.error(await resolveViewerError(error, t("annualSummary.state.loadFailed")));
  } finally {
    switchingBindingId.value = null;
  }
};

watch(storyStarted, (value) => { immersiveStory.value = value; }, { immediate: true });
watch(currentBinding, (value) => { selectedBindingId.value = value?.id ?? null; }, { immediate: true });
watch(envelope, (value) => {
  if (value?.buildJob && !summary.value && !building.value) {
    jobStatus.value = value.buildJob;
    if (value.buildJob.status === "queued" || value.buildJob.status === "running") {
      void resumeJob(value.buildJob);
    }
  } else if (value?.state === "missing" && !summary.value && !pageError.value && !building.value) {
    void buildSummary();
  }
}, { immediate: true });
watch(locale, async () => { storyStarted.value = false; drawerOpen.value = false; await reloadAnnual(); });
watch(() => summary.value?.summaryId, (value, oldValue) => { if (value && value !== oldValue) storyStarted.value = false; });

onMounted(() => {
  let generation = 0;
  stopArtworkPreload = watch(summary, async (value) => {
    const currentGeneration = ++generation;
    openingCriticalAssetsReadyId.value = "";
    if (!value) return;
    const [artworkReady, bgmReady] = await Promise.all([
      preloadAnnualOpeningArtwork(),
      preloadAnnualBgm(),
      preloadAnnualOpeningCovers(value)
    ]).then(([artwork, bgm]) => [artwork, bgm] as const);
    if (!artworkReady || !bgmReady) {
      console.warn("[annual] opening critical asset preload failed", { artworkReady, bgmReady });
    }
    if (currentGeneration === generation) { openingCriticalAssetsReadyId.value = value.summaryId; beta.track("annual_report_open"); beta.track("annual_slide_view",{slide_key:"opening"}); }
  }, { immediate: true });
});

onBeforeUnmount(() => { immersiveStory.value = false; pollGeneration += 1; stopArtworkPreload?.(); });
</script>

<template>
  <div class="annual-page">
    <div v-if="pending && !envelope" class="annual-state annual-state--loading">
      <div class="annual-state__drum" aria-hidden="true"><i></i></div>
      <p>{{ t("annualSummary.state.loading") }}</p>
    </div>

    <div v-else-if="jobStatus?.error?.code === 'INSUFFICIENT_DATA'" class="annual-state"><h1>{{t('account.versionSummary')}}</h1><p>{{locale==='ja'?'この年度の記録が不足しているため、まだレポートを作成できません。':'当前年度记录不足，暂时无法生成年度报告。'}}</p><NuxtLink :to="localePath('/account/sync')">{{t('annualSummary.state.openSync')}}</NuxtLink><el-button :loading="building" @click="buildSummary(true)">{{locale==='ja'?'更新後に再試行':'更新数据后重试'}}</el-button></div>
    <AnnualBuildPrelude
      v-else-if="!summary && (building || jobStatus)"
      :status="jobStatus?.status || 'queued'"
      :stage="jobStatus?.progressStage"
      :percent="jobStatus?.progressPercent"
      :detail="jobStatus?.progressDetail"
      :error="jobStatus?.error?.message || ''"
      @retry="buildSummary(true)"
      @sync="navigateTo(localePath('/account/sync'))"
    />

    <div v-else-if="!summary" class="annual-state">
      <p class="annual-state__eyebrow">{{ t("annualSummary.entry.eyebrow") }}</p>
      <h1>{{ t("account.versionSummary") }}</h1>
      <p>{{ pageError || t("annualSummary.state.missing") }}</p>
      <div class="annual-state__actions">
        <el-button @click="navigateTo(localePath('/account/profile'))">{{ t("annualSummary.state.openProfile") }}</el-button>
        <el-button @click="navigateTo(localePath('/account/sync'))">{{ t("annualSummary.state.openSync") }}</el-button>
      </div>
      <small v-if="jobStatusLabel">{{ jobStatusLabel }}</small>
    </div>

    <div v-else-if="openingCriticalAssetsReadyId !== summary.summaryId" class="annual-state annual-state--loading">
      <div class="annual-state__drum" aria-hidden="true"><i></i></div>
      <p>{{ t("annualSummary.state.loading") }}</p>
    </div>

    <template v-else>
      <StoryDrawer
        v-model="drawerOpen" :summary="summary" :selected-version="selectedVersion" :current-binding="currentBinding"
        :bindings="bindings" :selected-binding-id="selectedBindingId" :switching-binding-id="switchingBindingId"
        :story-started="storyStarted" :locale-code="locale === 'ja' ? 'ja' : 'zh'"
        @change-binding="handleBindingChange" @exit="navigateTo(localePath('/account/profile'))"
      />
      <StoryPlayer
        :summary="summary"
        :started="storyStarted"
        beta-tracking
        @slide-change="betaSlide = $event"
        @start="storyStarted = true"
        @open-drawer="drawerOpen = true"
      />
      <AnnualBetaFeedback :summary-id="summary.summaryId" :slide-key="betaSlide" />
    </template>
  </div>
</template>

<style scoped>
.annual-page{min-height:100vh;min-height:100svh;color:#17365d;background:linear-gradient(145deg,#f7fbff 0%,#e5f1ff 100%)}.annual-state{width:min(760px,calc(100vw - 28px));min-height:100vh;min-height:100svh;margin:auto;display:grid;align-content:center;justify-items:start;gap:16px}.annual-state__eyebrow{color:#3978c8!important;font-size:12px!important;font-weight:700;letter-spacing:.14em}.annual-state h1{margin:0;font:700 clamp(2.4rem,7vw,5rem)/1 var(--viewer-display-font);color:#17365d}.annual-state p{margin:0;max-width:42rem;color:#5c7697;font-size:15px;line-height:1.7}.annual-state small{color:#7890ab}.annual-state__actions{display:flex;flex-wrap:wrap;gap:10px}.annual-state__drum{width:90px;aspect-ratio:1;border-radius:50%;display:grid;place-items:center;background:#3978c8;box-shadow:inset 0 0 0 8px #f7fbff,0 16px 36px #17365d22}.annual-state__drum i{width:28px;height:28px;border-radius:50%;background:#ee7062;animation:pulse 1.2s ease-in-out infinite}.annual-entry{position:relative;width:min(1120px,calc(100vw - 32px));height:100vh;height:100svh;height:100dvh;margin:auto;padding:clamp(92px,13vh,140px) 0 max(24px,env(safe-area-inset-bottom));display:grid;grid-template-columns:minmax(0,1.2fr) minmax(260px,.8fr);grid-template-areas:"copy drum" "stats drum";gap:18px clamp(22px,5vw,70px);align-content:center}.annual-entry__copy{grid-area:copy;position:relative}.annual-entry__copy>p{margin:0;color:#3978c8;font-size:12px;font-weight:700;letter-spacing:.15em}.annual-entry__copy h1{margin:12px 0;color:#17365d;font:700 clamp(3rem,7vw,6.6rem)/.98 var(--viewer-display-font);text-wrap:balance}.annual-entry__copy>span{display:block;max-width:39rem;color:#5c7697;font-size:15px;line-height:1.7}.annual-entry__settings{position:absolute;right:0;top:-8px;padding:8px 13px;border:1px solid #3978c829;border-radius:99px;color:#3978c8;background:#f7fbffcc;cursor:pointer}.annual-entry__identity,.annual-entry__stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.annual-entry__identity{margin-top:18px}.annual-entry__stats{grid-area:stats;grid-template-columns:repeat(3,minmax(0,1fr))}.annual-entry article{min-width:0;padding:12px 14px;border-radius:17px;background:#f7fbffb8;border:1px solid #3978c829}.annual-entry article small,.annual-entry article span{display:block;color:#7890ab;font-size:11px}.annual-entry article strong{display:block;margin-top:5px;color:#17365d;font-size:clamp(1rem,2vw,1.35rem);overflow-wrap:anywhere}.annual-entry__stats article strong{font:700 clamp(1.5rem,3vw,2.4rem)/1 var(--viewer-display-font);color:#3978c8}.annual-entry__drum{grid-area:drum;align-self:center;width:min(100%,410px);aspect-ratio:1;position:relative;display:grid;place-content:center;gap:9px;padding:18%;border:0;border-radius:50%;text-align:center;color:#17365d;background:radial-gradient(circle,#fff 0 57%,#f7fbff 58% 66%,#3978c8 67% 83%,#17365d 84%);box-shadow:0 34px 80px #17365d2b;cursor:pointer;transition:transform .2s ease}.annual-entry__drum i{position:absolute;inset:18%;border-radius:50%;background:radial-gradient(circle at 42% 38%,#ee7062 0 16%,transparent 17%),radial-gradient(circle at 58% 38%,#3978c8 0 16%,transparent 17%)}.annual-entry__drum span,.annual-entry__drum strong{position:relative;z-index:1}.annual-entry__drum span{margin-top:38%;font-size:11px}.annual-entry__drum strong{font:700 clamp(1rem,2.5vw,1.5rem)/1.2 var(--viewer-display-font)}.annual-entry__drum:hover{transform:translateY(-4px) rotate(-1deg)}.annual-entry__drum:focus-visible,.annual-entry__settings:focus-visible{outline:3px solid #3978c8;outline-offset:4px}@keyframes pulse{50%{transform:scale(.72);opacity:.72}}@media(max-width:720px){.annual-state{width:calc(100vw - 24px)}.annual-entry{width:calc(100vw - 20px);padding:82px 0 max(12px,env(safe-area-inset-bottom));grid-template-columns:minmax(0,1fr) minmax(130px,42vw);grid-template-areas:"copy drum" "stats stats";gap:12px}.annual-entry__copy h1{font-size:clamp(2rem,10vw,3.5rem);padding-right:2.8rem}.annual-entry__copy>span{font-size:12px;line-height:1.45}.annual-entry__identity{grid-template-columns:1fr;margin-top:10px}.annual-entry__identity article:last-child{display:none}.annual-entry__stats{gap:6px}.annual-entry article{padding:8px 9px;border-radius:13px}.annual-entry__drum{width:100%;padding:12%}.annual-entry__drum span{display:none}.annual-entry__drum strong{margin-top:42%;font-size:12px}.annual-entry__settings{right:0;top:-4px;padding:6px 9px;font-size:11px}}@media(prefers-reduced-motion:reduce){.annual-entry__drum{transition:none}.annual-state__drum i{animation:none}}
.annual-state__actions :deep(.el-button) { min-height: 44px; }
</style>
