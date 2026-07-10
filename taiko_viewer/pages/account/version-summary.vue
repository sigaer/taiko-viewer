<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import StoryDrawer from "~/components/account/version-summary/StoryDrawer.vue";
import StoryPlayer from "~/components/account/version-summary/StoryPlayer.vue";
import type { VersionSummaryBinding, VersionSummaryPayload } from "~/types/account-version-summary";
import { buildPageDescription } from "~/utils/seo";
import { resolveViewerError } from "~/utils/viewerError";

type SummaryState = {
  payload: VersionSummaryPayload | null;
  error: string;
};

type BindingState = {
  bindings: VersionSummaryBinding[];
  currentBinding: VersionSummaryBinding | null;
  error: string;
};

const { t, locale } = useI18n();
const localePath = useLocalePath();
const apiFetch = useViewerApiFetch();

definePageMeta({
  layout: "story",
  middleware: "account-auth",
  keepalive: false,
  pageTitleKey: "account.versionSummary",
  pageDescKey: "page.account.versionSummary.desc"
});

useViewerSeo(() => ({
  title: t("account.versionSummary"),
  description: buildPageDescription(t("page.account.versionSummary.desc")),
  path: "/account/version-summary"
}));

const selectedVersionKey = ref("nijiiro_2025");
const refreshRequested = ref(false);
const manualRefreshing = ref(false);
const switchingBindingId = ref<number | null>(null);
const selectedBindingId = ref<number | null>(null);
const storyStarted = ref(false);
const drawerOpen = ref(false);
const immersiveStory = useState<boolean>("story-layout-immersive", () => false);

const uiText = computed(() =>
  locale.value === "ja"
    ? {
        fallbackSummaryError: "バージョンサマリーの読み込みに失敗しました。",
        fallbackBindingError: "連携 ID の読み込みに失敗しました。",
        loading: "虹2025 を整えています...",
        openProfile: "プロフィールへ",
        openSync: "同期ページへ",
        retry: "再試行",
        settings: "設定",
        startStory: "ストーリーを開く",
        bindingLabel: "連携 ID",
        summaryLabel: "今期の輪郭",
        favoriteLabel: "よく戻った曲",
        keywordLabel: "今期の呼び名",
        playCount: "プレイ回数",
        activeDays: "活動日数",
        uniqueSongs: "触れた曲数",
        coverFallback: "虹2025"
      }
    : {
        fallbackSummaryError: "版本总结加载失败，请稍后重试。",
        fallbackBindingError: "绑定列表加载失败，请稍后重试。",
        loading: "正在整理虹2025...",
        openProfile: "前往个人档案",
        openSync: "前往多端同步",
        retry: "重新加载",
        settings: "设置",
        startStory: "开启我的版本总结",
        bindingLabel: "当前绑定",
        summaryLabel: "这一版的轮廓",
        favoriteLabel: "反复回去的歌",
        keywordLabel: "这一版的称号",
        playCount: "游玩次数",
        activeDays: "活跃天数",
        uniqueSongs: "涉及歌曲",
        coverFallback: "虹2025"
      }
);

const fetchSummaryState = async (): Promise<SummaryState> => {
  try {
    const payload = await apiFetch<VersionSummaryPayload>("/api/account/version-summary", {
      query: {
        version: selectedVersionKey.value,
        refresh: refreshRequested.value ? "1" : undefined
      }
    });
    return { payload, error: "" };
  } catch (error) {
    return {
      payload: null,
      error: await resolveViewerError(error, uiText.value.fallbackSummaryError)
    };
  }
};

const fetchBindingState = async (): Promise<BindingState> => {
  try {
    const payload = await apiFetch<{
      bindings: VersionSummaryBinding[];
      currentBinding: VersionSummaryBinding | null;
    }>("/api/account/bindings");
    return {
      bindings: payload.bindings || [],
      currentBinding: payload.currentBinding || null,
      error: ""
    };
  } catch (error) {
    return {
      bindings: [],
      currentBinding: null,
      error: await resolveViewerError(error, uiText.value.fallbackBindingError)
    };
  }
};

const { data: summaryState, pending: summaryPending, refresh: reloadSummary } = await useAsyncData<SummaryState>(
  "account-version-summary-state",
  fetchSummaryState,
  {
    default: () => ({ payload: null, error: "" })
  }
);

const { data: bindingState, refresh: reloadBindings } = await useAsyncData<BindingState>(
  "account-version-summary-bindings",
  fetchBindingState,
  {
    default: () => ({ bindings: [], currentBinding: null, error: "" })
  }
);

const summaryPayload = computed(() => summaryState.value?.payload || null);
const summary = computed(() => summaryPayload.value?.summary || null);
const selectedVersion = computed<VersionSummaryPayload["selectedVersion"]>(() =>
  summaryPayload.value?.selectedVersion || {
    key: selectedVersionKey.value,
    name: summary.value?.version.name || "虹2025",
    startDate: summary.value?.version.startDate || "2026-01-01",
    endDate: summary.value?.version.endDate || null
  }
);
const currentBinding = computed(() => summaryPayload.value?.currentBinding || bindingState.value?.currentBinding || null);
const bindings = computed(() =>
  bindingState.value?.bindings?.length
    ? bindingState.value.bindings
    : currentBinding.value
      ? [currentBinding.value]
      : []
);
const pageError = computed(() => summaryState.value?.error || bindingState.value?.error || "");

const resetStoryState = () => {
  storyStarted.value = false;
  drawerOpen.value = false;
};

watch(
  storyStarted,
  (value) => {
    immersiveStory.value = value;
  },
  { immediate: true }
);

watch(
  currentBinding,
  (value) => {
    selectedBindingId.value = value?.id ?? null;
  },
  { immediate: true }
);

watch(locale, async (value, oldValue) => {
  if (value !== oldValue) {
    resetStoryState();
    await refreshSummaryState(false);
  }
});

watch(
  () => summary.value?.summaryId,
  (value, oldValue) => {
    if (value && value !== oldValue) {
      resetStoryState();
    }
  }
);

watch(
  () => currentBinding.value?.id,
  (value, oldValue) => {
    if (value && value !== oldValue) {
      resetStoryState();
    }
  }
);

const refreshSummaryState = async (force: boolean) => {
  refreshRequested.value = force;
  if (force) {
    manualRefreshing.value = true;
  }
  try {
    await reloadSummary();
  } finally {
    refreshRequested.value = false;
    if (force) {
      manualRefreshing.value = false;
    }
  }
};

const openProfile = () => navigateTo(localePath("/account/profile"));
const openSync = () => navigateTo(localePath("/account/sync"));

const handleBindingChange = async (bindingId: number | null) => {
  if (!bindingId || bindingId === currentBinding.value?.id || switchingBindingId.value) {
    return;
  }

  switchingBindingId.value = bindingId;
  try {
    await apiFetch("/api/account/bindings/current", {
      method: "POST",
      body: { bindingId }
    });
    await Promise.all([reloadBindings(), refreshSummaryState(true)]);
    resetStoryState();
    ElMessage.success(locale.value === "ja" ? "連携 ID を切り替えました" : "已切换当前绑定");
  } catch (error) {
    selectedBindingId.value = currentBinding.value?.id ?? null;
    ElMessage.error(
      await resolveViewerError(error, locale.value === "ja" ? "連携 ID の切り替えに失敗しました" : "切换当前绑定失败")
    );
  } finally {
    switchingBindingId.value = null;
  }
};

const handleRefresh = async () => {
  await refreshSummaryState(true);
  if (summaryState.value?.error) {
    ElMessage.warning(summaryState.value.error || uiText.value.retry);
    return;
  }
  resetStoryState();
  ElMessage.success(locale.value === "ja" ? "バージョンサマリーを更新しました" : "版本总结已重新生成");
};

const openStory = () => {
  storyStarted.value = true;
  drawerOpen.value = false;
};

const bindingPreviewText = computed(() => {
  if (!currentBinding.value) return "-";
  const title = String(currentBinding.value.currentTitle || currentBinding.value.verifiedTitle || "").trim();
  return title ? `${currentBinding.value.taikoId} · ${title}` : currentBinding.value.taikoId;
});

onBeforeUnmount(() => {
  immersiveStory.value = false;
});
</script>

<template>
  <div class="version-summary-story-page">
    <div v-if="summaryPending && !summary" class="story-state-card story-state-card--loading">
      <div class="story-state-card__orb"></div>
      <p>{{ uiText.loading }}</p>
    </div>

    <div v-else-if="!summary" class="story-state-card">
      <h1>{{ t("account.versionSummary") }}</h1>
      <p>{{ pageError || uiText.fallbackSummaryError }}</p>
      <div class="story-state-card__actions">
        <el-button @click="openProfile">{{ uiText.openProfile }}</el-button>
        <el-button @click="openSync">{{ uiText.openSync }}</el-button>
        <el-button type="primary" @click="handleRefresh">{{ uiText.retry }}</el-button>
      </div>
    </div>

    <template v-else>
      <StoryDrawer
        v-model="drawerOpen"
        :summary="summary"
        :selected-version="selectedVersion"
        :current-binding="currentBinding"
        :bindings="bindings"
        :selected-binding-id="selectedBindingId"
        :switching-binding-id="switchingBindingId"
        :manual-refreshing="manualRefreshing"
        :story-started="storyStarted"
        :locale-code="locale === 'ja' ? 'ja' : 'zh'"
        @change-binding="handleBindingChange"
        @refresh="handleRefresh"
        @exit="resetStoryState"
      />

      <section class="story-entry" :class="{ 'is-hidden': storyStarted }">
        <div class="story-entry__board">
          <button type="button" class="story-entry__settings" @click="drawerOpen = true">
            {{ uiText.settings }}
          </button>
          <p class="story-entry__eyebrow">虹2025 / {{ t("account.versionSummary") }}</p>
          <h1>{{ summary.copy.opening.title }}</h1>
          <p class="story-entry__lead">{{ summary.copy.opening.subtitle }}</p>

          <div class="story-entry__identity">
            <div>
              <span>{{ uiText.bindingLabel }}</span>
              <strong>{{ bindingPreviewText }}</strong>
            </div>
            <div>
              <span>{{ uiText.keywordLabel }}</span>
              <strong>{{ summary.finalTitle.title }}</strong>
            </div>
          </div>

          <div class="story-entry__stats">
            <div>
              <span>{{ uiText.playCount }}</span>
              <strong>{{ summary.overview.playCount }}</strong>
            </div>
            <div>
              <span>{{ uiText.activeDays }}</span>
              <strong>{{ summary.period.activeDays }}</strong>
            </div>
            <div>
              <span>{{ uiText.uniqueSongs }}</span>
              <strong>{{ summary.overview.uniqueSongs }}</strong>
            </div>
          </div>

          <button type="button" class="story-entry__drum-cta" @click="openStory">
            <span>{{ summary.version.name }}</span>
            <strong>{{ uiText.startStory }}</strong>
          </button>
        </div>
      </section>

      <StoryPlayer v-if="storyStarted" :summary="summary" :started="storyStarted" @open-drawer="drawerOpen = true" />
    </template>
  </div>
</template>

<style scoped>
.version-summary-story-page {
  position: relative;
  min-height: 100vh;
  min-height: 100svh;
}

.story-state-card {
  width: min(860px, calc(100vw - 32px));
  margin: 0 auto;
  min-height: 100vh;
  min-height: 100svh;
  display: grid;
  align-content: center;
  justify-items: start;
  gap: 18px;
  padding: 8rem 1rem 2rem;
  color: #fff6e8;
}

.story-state-card h1 {
  margin: 0;
  font-family: var(--viewer-display-font);
  font-size: clamp(2.6rem, 6vw, 4.6rem);
}

.story-state-card p {
  margin: 0;
  max-width: 38rem;
  color: rgba(255, 236, 212, 0.82);
  line-height: 1.9;
}

.story-state-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.story-state-card__orb {
  position: absolute;
  width: 24rem;
  height: 24rem;
  right: 6%;
  top: 12%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 155, 87, 0.28), rgba(255, 155, 87, 0));
  filter: blur(10px);
}

.story-entry {
  width: min(980px, calc(100vw - 24px));
  height: 100vh;
  height: 100svh;
  height: 100dvh;
  margin: 0 auto;
  padding: 7.4rem 0 1.4rem;
  display: grid;
  place-items: center;
  transition:
    opacity 0.35s ease,
    visibility 0.35s ease;
}

.story-entry.is-hidden {
  opacity: 0;
  visibility: hidden;
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.story-entry__board {
  position: relative;
  width: 100%;
  max-height: 100%;
  padding: clamp(22px, 4vw, 38px);
  border-radius: 34px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(18px);
  box-shadow: 0 28px 64px rgba(5, 10, 27, 0.36);
  background:
    radial-gradient(circle at 88% 18%, rgba(255, 190, 96, 0.16), transparent 32%),
    rgba(255, 255, 255, 0.08);
}

.story-entry__eyebrow {
  margin: 0 0 12px;
  color: rgba(255, 216, 174, 0.86);
  font-size: 12px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.story-entry h1 {
  margin: 0;
  color: #fff8ed;
  font-family: var(--viewer-display-font);
  font-size: clamp(2.8rem, 7vw, 5.6rem);
  line-height: 1.02;
  text-wrap: balance;
}

.story-entry__lead {
  margin: 18px 0 0;
  max-width: 40rem;
  color: rgba(255, 237, 214, 0.82);
  line-height: 1.92;
  font-size: 1.04rem;
}

.story-entry__identity {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 20px;
}

.story-entry__identity > div,
.story-entry__stats > div {
  min-width: 0;
  padding: 14px 16px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.story-entry__identity span,
.story-entry__stats span {
  display: block;
  color: rgba(255, 230, 196, 0.68);
  letter-spacing: 0.14em;
  font-size: 12px;
  text-transform: uppercase;
}

.story-entry__identity strong,
.story-entry__stats strong {
  display: block;
  margin-top: 8px;
  color: #fff8ed;
  line-height: 1.12;
}

.story-entry__identity strong {
  font-size: clamp(1rem, 2vw, 1.45rem);
  overflow-wrap: anywhere;
}

.story-entry__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 12px;
}

.story-entry__stats strong {
  font-size: clamp(1.3rem, 3vw, 2rem);
}

.story-entry__settings {
  position: absolute;
  top: 18px;
  right: 18px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  padding: 9px 14px;
  color: rgba(255, 243, 224, 0.82);
  background: rgba(9, 17, 40, 0.32);
  cursor: pointer;
}

.story-entry__drum-cta {
  width: min(15.5rem, 46vw);
  aspect-ratio: 1;
  margin: 18px auto 0;
  border: 0;
  border-radius: 50%;
  display: grid;
  place-content: center;
  gap: 8px;
  padding: 24px;
  text-align: center;
  color: #6a1f15;
  background: radial-gradient(circle at 50% 42%, #fff2ce 0 37%, #ffc574 62%, #ef6947 82%, #9f291e 100%);
  box-shadow: inset 0 0 0 10px rgba(122, 28, 21, 0.38), 0 22px 50px rgba(4, 10, 28, 0.38);
  cursor: pointer;
  transition: transform 0.2s ease, filter 0.2s ease;
}

.story-entry__drum-cta span { font-size: 11px; letter-spacing: 0.18em; }
.story-entry__drum-cta strong { font-family: var(--viewer-display-font); font-size: clamp(1.15rem, 2.8vw, 1.65rem); line-height: 1.18; }
.story-entry__drum-cta:hover { transform: translateY(-3px) scale(1.015); filter: brightness(1.04); }
.story-entry__drum-cta:active { transform: scale(0.98); }
.story-entry__drum-cta:focus-visible,
.story-entry__settings:focus-visible { outline: 3px solid #ffd083; outline-offset: 4px; }

@media (max-height: 900px) {
  .story-entry { padding-top: 6.7rem; }
  .story-entry__lead { margin-top: 12px; line-height: 1.65; }
  .story-entry__identity { margin-top: 14px; }
  .story-entry__drum-cta { width: min(12.5rem, 40vw); margin-top: 12px; }
}

@media (max-width: 720px) {
  .story-entry {
    width: min(100vw - 16px, 100%);
    padding: 6.3rem 0 calc(12px + env(safe-area-inset-bottom, 0px));
  }

  .story-entry__board { padding: 20px 16px 16px; border-radius: 28px; }
  .story-entry h1 { font-size: clamp(2.35rem, 12vw, 4rem); padding-right: 4rem; }
  .story-entry__lead { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .story-entry__identity { grid-template-columns: 1fr 1fr; gap: 8px; }
  .story-entry__identity > div, .story-entry__stats > div { padding: 10px; border-radius: 16px; }
  .story-entry__identity span, .story-entry__stats span { font-size: 10px; }
  .story-entry__drum-cta { width: min(11.5rem, 45vw); }
}

@media (max-width: 720px) and (max-height: 780px) {
  .story-entry { padding-top: 5.5rem; }
  .story-entry__eyebrow { margin-bottom: 7px; }
  .story-entry__lead { margin-top: 8px; -webkit-line-clamp: 1; }
  .story-entry__identity { margin-top: 9px; }
  .story-entry__stats { margin-top: 7px; }
  .story-entry__drum-cta { width: min(9.5rem, 38vw); margin-top: 8px; padding: 18px; }
}

@media (prefers-reduced-motion: reduce) {
  .story-entry__drum-cta { transition: none; }
}
</style>
