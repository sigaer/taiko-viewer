<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
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
const clientReady = ref(false);

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
const showStory = computed(() => storyStarted.value || !clientReady.value);

const resetStoryState = () => {
  storyStarted.value = false;
  drawerOpen.value = false;
};

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

onMounted(() => {
  clientReady.value = true;
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

      <section class="story-entry" :class="{ 'is-hidden': storyStarted && clientReady }">
        <div class="story-entry__main">
          <p class="story-entry__eyebrow">虹2025 / {{ t("account.versionSummary") }}</p>
          <h1>{{ summary.copy.opening.title }}</h1>
          <p class="story-entry__lead">{{ summary.copy.opening.subtitle }}</p>

          <div class="story-entry__actions">
            <el-button type="primary" size="large" round @click="openStory">
              {{ uiText.startStory }}
            </el-button>
            <el-button size="large" round @click="drawerOpen = true">
              {{ uiText.settings }}
            </el-button>
          </div>

          <div class="story-entry__chips">
            <div class="story-entry__chip">
              <span>{{ uiText.bindingLabel }}</span>
              <strong>{{ bindingPreviewText }}</strong>
            </div>
            <div class="story-entry__chip">
              <span>{{ uiText.keywordLabel }}</span>
              <strong>{{ summary.finalTitle.title }}</strong>
            </div>
          </div>
        </div>

        <div class="story-entry__preview">
          <article class="story-entry__poster">
            <span>{{ uiText.summaryLabel }}</span>
            <strong>{{ summary.version.name }}</strong>
            <p>{{ summary.poster.periodLabel }}</p>
            <div class="story-entry__poster-stats">
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
          </article>

          <article class="story-entry__favorite">
            <el-image v-if="summary.favoriteSong" :src="summary.favoriteSong.coverUrl" fit="cover" class="story-entry__favorite-cover">
              <template #error>
                <div class="story-entry__favorite-cover story-entry__favorite-cover--fallback">{{ uiText.coverFallback }}</div>
              </template>
            </el-image>
            <div class="story-entry__favorite-meta">
              <span>{{ uiText.favoriteLabel }}</span>
              <strong>{{ summary.favoriteSong?.name || summary.poster.favoriteSong }}</strong>
              <small>{{ summary.copy.favoriteSong.body }}</small>
            </div>
          </article>
        </div>
      </section>

      <StoryPlayer
        v-show="showStory"
        :summary="summary"
        :started="storyStarted"
        @open-drawer="drawerOpen = true"
      />
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
  width: min(1180px, calc(100vw - 24px));
  min-height: 100vh;
  min-height: 100svh;
  margin: 0 auto;
  padding: 8.6rem 0 2rem;
  display: grid;
  grid-template-columns: minmax(0, 1.04fr) minmax(300px, 0.96fr);
  gap: 22px;
  align-items: center;
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

.story-entry__main,
.story-entry__poster,
.story-entry__favorite {
  border-radius: 34px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(18px);
  box-shadow: 0 28px 64px rgba(5, 10, 27, 0.36);
}

.story-entry__main {
  padding: 32px 28px;
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

.story-entry__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 26px;
}

.story-entry__actions :deep(.el-button) {
  min-width: 180px;
  min-height: 50px;
}

.story-entry__chips {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 26px;
}

.story-entry__chip,
.story-entry__poster,
.story-entry__favorite {
  padding: 20px 22px;
}

.story-entry__chip span,
.story-entry__poster span,
.story-entry__favorite-meta span,
.story-entry__poster-stats span {
  display: block;
  color: rgba(255, 230, 196, 0.68);
  letter-spacing: 0.14em;
  font-size: 12px;
  text-transform: uppercase;
}

.story-entry__chip strong,
.story-entry__poster strong,
.story-entry__favorite-meta strong,
.story-entry__poster-stats strong {
  display: block;
  margin-top: 8px;
  color: #fff8ed;
  line-height: 1.12;
}

.story-entry__chip strong {
  font-size: clamp(1.2rem, 2vw, 1.7rem);
}

.story-entry__preview {
  display: grid;
  gap: 16px;
}

.story-entry__poster {
  background:
    radial-gradient(circle at top right, rgba(255, 183, 98, 0.18), transparent 38%),
    rgba(255, 255, 255, 0.08);
}

.story-entry__poster strong {
  font-family: var(--viewer-display-font);
  font-size: clamp(2rem, 4vw, 3.6rem);
}

.story-entry__poster p {
  margin: 12px 0 0;
  color: rgba(255, 237, 214, 0.78);
}

.story-entry__poster-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 18px;
}

.story-entry__poster-stats div {
  padding: 14px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.story-entry__favorite {
  display: grid;
  grid-template-columns: 132px minmax(0, 1fr);
  gap: 16px;
  align-items: center;
}

.story-entry__favorite-cover {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 24px;
  overflow: hidden;
  background: linear-gradient(135deg, rgba(255, 190, 104, 0.24), rgba(255, 116, 78, 0.28));
}

.story-entry__favorite-cover--fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 248, 237, 0.86);
  font-family: var(--viewer-display-font);
  font-size: clamp(1.5rem, 3vw, 2.2rem);
  letter-spacing: 0.08em;
}

.story-entry__favorite-meta strong {
  font-size: clamp(1.5rem, 3vw, 2.5rem);
}

.story-entry__favorite-meta small {
  display: block;
  margin-top: 12px;
  color: rgba(255, 237, 214, 0.76);
  line-height: 1.82;
}

@media (max-width: 960px) {
  .story-entry {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .story-entry {
    width: min(100vw - 16px, 100%);
    padding-top: 7.6rem;
  }

  .story-entry__main,
  .story-entry__poster,
  .story-entry__favorite {
    padding: 18px;
    border-radius: 28px;
  }

  .story-entry__chips,
  .story-entry__poster-stats,
  .story-entry__favorite {
    grid-template-columns: 1fr;
  }

  .story-entry__actions :deep(.el-button) {
    width: 100%;
  }
}
</style>
