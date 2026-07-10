<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import type { VersionSummaryBinding, VersionSummaryPayload } from "~/types/account-version-summary";
import { buildPageDescription } from "~/utils/seo";
import { resolveViewerError, viewerErrorAlertType } from "~/utils/viewerError";

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
const { formatDate, formatDateTime } = useViewerDateTime();

definePageMeta({
  middleware: "account-auth",
  pageTitleKey: "account.versionSummary",
  pageDescKey: "page.account.versionSummary.desc",
  navKey: "/account/version-summary",
  breadcrumbs: [
    { labelKey: "account.title", to: "/account/profile" },
    { labelKey: "account.versionSummary", to: "/account/version-summary" }
  ]
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

const dimensionLabels = computed(() =>
  locale.value === "ja"
    ? {
        big_song: "大歌力",
        stamina: "体力",
        speed: "高速処理",
        accuracy: "精度力",
        rhythm: "リズム処理",
        complex: "複合処理"
      }
    : {
        big_song: "大歌力",
        stamina: "体力",
        speed: "高速处理",
        accuracy: "精度力",
        rhythm: "节奏处理",
        complex: "复合处理"
      }
);

const uiText = computed(() =>
  locale.value === "ja"
    ? {
        fallbackSummaryError: "バージョンサマリーの読み込みに失敗しました。",
        fallbackBindingError: "連携 ID の読み込みに失敗しました。",
        loading: "虹2025 を集計中です...",
        generatedAt: "生成時刻",
        openProfile: "プロフィールへ",
        openSync: "同期ページへ",
        retry: "再試行",
        bindingLabel: "連携 ID",
        partialStart: "窗口起点前缺少基线快照",
        switchSuccess: "連携 ID を切り替えました",
        switchFailed: "連携 ID の切り替えに失敗しました",
        refreshSuccess: "バージョンサマリーを更新しました",
        refreshFailed: "バージョンサマリーの更新に失敗しました",
        currentTitle: "現在の称号",
        snapshotCoverage: "快照覆盖",
        firstSnapshot: "首个快照",
        lastSnapshot: "最新快照",
        firstRecord: "最初の記録",
        lastRecord: "最後の記録",
        totalDays: "总天数",
        activeDays: "活跃日数",
        playCount: "游玩次数",
        uniqueSongs: "触れた曲数",
        estimatedTime: "推定时间",
        playCountUnit: "回",
        activeDaysUnit: "日",
        levelValue: "定数",
        scoreDelta: "分数提升",
        playDelta: "本次增量",
        insufficientNote: "まだデータは少なめですが、ページ構成は固定で表示します。"
      }
    : {
        fallbackSummaryError: "版本总结加载失败，请稍后重试。",
        fallbackBindingError: "绑定列表加载失败，请稍后重试。",
        loading: "正在统计虹2025...",
        generatedAt: "生成时间",
        openProfile: "前往个人档案",
        openSync: "前往多端同步",
        retry: "重新加载",
        bindingLabel: "当前绑定",
        partialStart: "窗口起点前缺少基线快照",
        switchSuccess: "已切换当前绑定",
        switchFailed: "切换当前绑定失败",
        refreshSuccess: "版本总结已重新生成",
        refreshFailed: "重新生成版本总结失败",
        currentTitle: "当前称号",
        snapshotCoverage: "快照覆盖",
        firstSnapshot: "首个快照",
        lastSnapshot: "最新快照",
        firstRecord: "第一条记录",
        lastRecord: "最后一条记录",
        totalDays: "总天数",
        activeDays: "活跃天数",
        playCount: "游玩次数",
        uniqueSongs: "涉及歌曲",
        estimatedTime: "估算时长",
        playCountUnit: "次",
        activeDaysUnit: "天",
        levelValue: "定数",
        scoreDelta: "分数提升",
        playDelta: "本次增量",
        insufficientNote: "当前数据还不算多，但 8 页结构会保持不变。"
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
const currentBinding = computed(() => summaryPayload.value?.currentBinding || bindingState.value?.currentBinding || null);
const bindings = computed(() =>
  bindingState.value?.bindings?.length
    ? bindingState.value.bindings
    : currentBinding.value
      ? [currentBinding.value]
      : []
);
const pageError = computed(() => summaryState.value?.error || bindingState.value?.error || "");

watch(
  currentBinding,
  (value) => {
    selectedBindingId.value = value?.id ?? null;
  },
  { immediate: true }
);

watch(locale, async (value, oldValue) => {
  if (value !== oldValue) {
    await refreshSummaryState(false);
  }
});

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

const bindingOptionLabel = (binding: VersionSummaryBinding) => {
  const title = String(binding.currentTitle || binding.verifiedTitle || "").trim();
  return title ? `${binding.taikoId} · ${title}` : binding.taikoId;
};

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
    ElMessage.success(uiText.value.switchSuccess);
  } catch (error) {
    selectedBindingId.value = currentBinding.value?.id ?? null;
    ElMessage.error(await resolveViewerError(error, uiText.value.switchFailed));
  } finally {
    switchingBindingId.value = null;
  }
};

const handleRefresh = async () => {
  await refreshSummaryState(true);
  if (summaryState.value?.error) {
    ElMessage.warning(summaryState.value.error || uiText.value.refreshFailed);
    return;
  }
  ElMessage.success(uiText.value.refreshSuccess);
};

const radarEntries = computed(() => {
  if (!summary.value?.keyword) return [];
  const radarValues = summary.value.keyword.radarValues || {};
  return Object.entries(radarValues)
    .map(([key, value]) => ({
      key,
      label: dimensionLabels.value[key as keyof typeof dimensionLabels.value] || key,
      value: Number(value || 0)
    }))
    .sort((a, b) => b.value - a.value);
});

const formatRadarWidth = (value: number) => {
  const numeric = Number(value || 0);
  const scaled = numeric <= 1 ? numeric * 100 : numeric;
  return `${Math.max(8, Math.min(100, scaled))}%`;
};

const formatRadarValue = (value: number) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return "0";
  return numeric <= 1 ? `${(numeric * 100).toFixed(1)}%` : numeric.toFixed(1);
};

const formatSlideIndex = (index: number) => String(index).padStart(2, "0");
</script>

<template>
  <div class="version-summary-page">
    <div class="version-summary-toolbar panel-card">
      <div class="version-summary-toolbar__main">
        <p class="version-summary-toolbar__eyebrow">虹2025</p>
        <h1>{{ t("account.versionSummary") }}</h1>
        <p v-if="summary" class="version-summary-toolbar__desc">
          {{ summary.copy.opening.subtitle }}
        </p>
        <p v-else class="version-summary-toolbar__desc">
          {{ t("page.account.versionSummary.desc") }}
        </p>
      </div>

      <div class="version-summary-toolbar__controls">
        <div class="toolbar-field">
          <span>{{ summary?.copy.controls.versionLabel || t("account.versionSummary") }}</span>
          <div class="toolbar-field__value">
            {{ summaryPayload?.selectedVersion.name || "虹2025" }}
          </div>
        </div>

        <div class="toolbar-field">
          <span>{{ summary?.copy.controls.bindingLabel || uiText.bindingLabel }}</span>
          <el-select
            v-model="selectedBindingId"
            class="toolbar-select"
            :disabled="!bindings.length || Boolean(switchingBindingId)"
            @change="handleBindingChange"
          >
            <el-option
              v-for="binding in bindings"
              :key="binding.id"
              :label="bindingOptionLabel(binding)"
              :value="binding.id"
            />
          </el-select>
        </div>

        <el-button type="primary" :loading="manualRefreshing" @click="handleRefresh">
          {{ summary?.copy.controls.refresh || uiText.retry }}
        </el-button>
      </div>
    </div>

    <div v-if="pageError && summary" class="version-summary-alert">
      <el-alert :title="pageError" :type="viewerErrorAlertType(pageError)" :closable="false" show-icon />
    </div>

    <div v-if="summaryPending && !summary" class="version-summary-loading panel-card">
      <div class="story-orb"></div>
      <p>{{ uiText.loading }}</p>
    </div>

    <div v-else-if="!summary" class="version-summary-empty panel-card">
      <h2>{{ t("account.versionSummary") }}</h2>
      <p>{{ pageError || uiText.fallbackSummaryError }}</p>
      <div class="version-summary-empty__actions">
        <el-button @click="openProfile">{{ uiText.openProfile }}</el-button>
        <el-button @click="openSync">{{ uiText.openSync }}</el-button>
        <el-button type="primary" @click="handleRefresh">{{ uiText.retry }}</el-button>
      </div>
    </div>

    <template v-else>
      <div class="version-summary-meta">
        <div class="meta-chip">
          <strong>{{ uiText.generatedAt }}</strong>
          <span>{{ formatDateTime(summary.generatedAt) }}</span>
        </div>
        <div v-if="currentBinding?.currentTitle" class="meta-chip">
          <strong>{{ uiText.currentTitle }}</strong>
          <span>{{ currentBinding.currentTitle }}</span>
        </div>
        <div v-if="summary.flags.newcomer || summary.flags.insufficientData" class="meta-chip meta-chip--soft">
          <strong>Note</strong>
          <span>{{ uiText.insufficientNote }}</span>
        </div>
      </div>

      <div class="story-stack">
        <section class="story-card story-card--opening">
          <div class="story-card__index">{{ formatSlideIndex(1) }}</div>
          <div class="story-card__content">
            <p class="story-card__eyebrow">{{ summary.copy.opening.eyebrow }}</p>
            <h2 class="story-card__headline">{{ summary.copy.opening.title }}</h2>
            <p class="story-card__lead">{{ summary.copy.opening.subtitle }}</p>

            <div class="opening-ribbon">
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
          </div>
        </section>

        <section class="story-card">
          <div class="story-card__index">{{ formatSlideIndex(2) }}</div>
          <div class="story-card__content">
            <p class="story-card__eyebrow">{{ summary.copy.period.eyebrow }}</p>
            <h2 class="story-card__headline">{{ summary.copy.period.title }}</h2>
            <p class="story-card__lead">{{ summary.copy.period.body }}</p>

            <div class="stat-grid stat-grid--compact">
              <div class="stat-tile">
                <span>{{ uiText.firstRecord }}</span>
                <strong>{{ formatDateTime(summary.period.firstRecordAt) }}</strong>
              </div>
              <div class="stat-tile">
                <span>{{ uiText.lastRecord }}</span>
                <strong>{{ formatDateTime(summary.period.lastRecordAt) }}</strong>
              </div>
              <div class="stat-tile">
                <span>{{ uiText.totalDays }}</span>
                <strong>{{ summary.period.totalDays }}</strong>
              </div>
              <div class="stat-tile">
                <span>{{ uiText.activeDays }}</span>
                <strong>{{ summary.period.activeDays }}</strong>
              </div>
            </div>

            <div class="coverage-strip">
              <div>
                <span>{{ uiText.snapshotCoverage }}</span>
                <strong>{{ summary.coverage.snapshotCount }}</strong>
              </div>
              <div>
                <span>{{ uiText.firstSnapshot }}</span>
                <strong>{{ formatDate(summary.coverage.firstSnapshotAt) }}</strong>
              </div>
              <div>
                <span>{{ uiText.lastSnapshot }}</span>
                <strong>{{ formatDate(summary.coverage.lastSnapshotAt) }}</strong>
              </div>
              <div v-if="summary.coverage.partialStart" class="coverage-strip__flag">
                {{ uiText.partialStart }}
              </div>
            </div>
          </div>
        </section>

        <section class="story-card story-card--overview">
          <div class="story-card__index">{{ formatSlideIndex(3) }}</div>
          <div class="story-card__content">
            <p class="story-card__eyebrow">{{ summary.copy.overview.eyebrow }}</p>
            <h2 class="story-card__headline">{{ summary.copy.overview.title }}</h2>
            <p class="story-card__lead">{{ summary.copy.overview.body }}</p>

            <div class="stat-grid">
              <div class="stat-tile stat-tile--accent">
                <span>{{ uiText.playCount }}</span>
                <strong>{{ summary.overview.playCount }}</strong>
                <small>{{ uiText.playCountUnit }}</small>
              </div>
              <div class="stat-tile">
                <span>{{ uiText.uniqueSongs }}</span>
                <strong>{{ summary.overview.uniqueSongs }}</strong>
              </div>
              <div class="stat-tile">
                <span>{{ uiText.activeDays }}</span>
                <strong>{{ summary.period.activeDays }}</strong>
                <small>{{ uiText.activeDaysUnit }}</small>
              </div>
              <div class="stat-tile">
                <span>{{ uiText.estimatedTime }}</span>
                <strong>{{ summary.overview.estimatedTimeText }}</strong>
              </div>
            </div>
          </div>
        </section>

        <section class="story-card story-card--song">
          <div class="story-card__index">{{ formatSlideIndex(4) }}</div>
          <div class="story-card__content">
            <p class="story-card__eyebrow">{{ summary.copy.favoriteSong.eyebrow }}</p>
            <h2 class="story-card__headline">{{ summary.copy.favoriteSong.title }}</h2>
            <p class="story-card__lead">{{ summary.copy.favoriteSong.body }}</p>

            <div v-if="summary.favoriteSong" class="song-panel">
              <el-image :src="summary.favoriteSong.coverUrl" fit="cover" class="song-panel__cover">
                <template #error>
                  <div class="song-panel__cover song-panel__cover--fallback">NO COVER</div>
                </template>
              </el-image>
              <div class="song-panel__meta">
                <strong>{{ summary.favoriteSong.name }}</strong>
                <span v-if="summary.favoriteSong.subtitle">{{ summary.favoriteSong.subtitle }}</span>
                <div class="song-panel__stats">
                  <div>
                    <span>{{ uiText.playCount }}</span>
                    <strong>{{ summary.favoriteSong.playCount || 0 }}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="story-card story-card--song">
          <div class="story-card__index">{{ formatSlideIndex(5) }}</div>
          <div class="story-card__content">
            <p class="story-card__eyebrow">{{ summary.copy.obsessionSong.eyebrow }}</p>
            <h2 class="story-card__headline">{{ summary.copy.obsessionSong.title }}</h2>
            <p class="story-card__lead">{{ summary.copy.obsessionSong.body }}</p>

            <div v-if="summary.obsessionSong" class="song-panel">
              <el-image :src="summary.obsessionSong.coverUrl" fit="cover" class="song-panel__cover">
                <template #error>
                  <div class="song-panel__cover song-panel__cover--fallback">NO COVER</div>
                </template>
              </el-image>
              <div class="song-panel__meta">
                <strong>{{ summary.obsessionSong.name }}</strong>
                <span v-if="summary.obsessionSong.subtitle">{{ summary.obsessionSong.subtitle }}</span>
                <div class="song-panel__stats">
                  <div>
                    <span>{{ uiText.activeDays }}</span>
                    <strong>{{ summary.obsessionSong.activeDays || 0 }}</strong>
                  </div>
                  <div>
                    <span>{{ uiText.playCount }}</span>
                    <strong>{{ summary.obsessionSong.playCount || 0 }}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="story-card story-card--keyword">
          <div class="story-card__index">{{ formatSlideIndex(6) }}</div>
          <div class="story-card__content">
            <p class="story-card__eyebrow">{{ summary.copy.keyword.eyebrow }}</p>
            <h2 class="story-card__headline">{{ summary.copy.keyword.title }}</h2>
            <p class="story-card__lead">{{ summary.copy.keyword.body }}</p>

            <div v-if="summary.keyword" class="keyword-card">
              <div class="keyword-card__hero">
                <span>{{ summary.keyword.dimensionLabel }}</span>
                <strong>{{ summary.keyword.title }}</strong>
                <small>{{ summary.keyword.body }}</small>
              </div>
              <div class="keyword-radar">
                <div v-for="entry in radarEntries" :key="entry.key" class="keyword-radar__row">
                  <span>{{ entry.label }}</span>
                  <div class="keyword-radar__track">
                    <i :style="{ width: formatRadarWidth(entry.value) }"></i>
                  </div>
                  <strong>{{ formatRadarValue(entry.value) }}</strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="story-card story-card--breakthrough">
          <div class="story-card__index">{{ formatSlideIndex(7) }}</div>
          <div class="story-card__content">
            <p class="story-card__eyebrow">{{ summary.copy.breakthrough.eyebrow }}</p>
            <h2 class="story-card__headline">{{ summary.breakthrough.title }}</h2>
            <p class="story-card__lead">{{ summary.breakthrough.body }}</p>

            <div class="breakthrough-panel">
              <div v-if="summary.breakthrough.song" class="song-panel song-panel--compact">
                <el-image :src="summary.breakthrough.song.coverUrl" fit="cover" class="song-panel__cover">
                  <template #error>
                    <div class="song-panel__cover song-panel__cover--fallback">NO COVER</div>
                  </template>
                </el-image>
                <div class="song-panel__meta">
                  <strong>{{ summary.breakthrough.song.name }}</strong>
                  <span v-if="summary.breakthrough.song.subtitle">{{ summary.breakthrough.song.subtitle }}</span>
                  <span v-if="summary.breakthrough.song.level !== null">
                    {{ uiText.levelValue }} {{ summary.breakthrough.song.level }}
                  </span>
                </div>
              </div>

              <div class="stat-grid stat-grid--compact">
                <div class="stat-tile">
                  <span>{{ uiText.lastRecord }}</span>
                  <strong>{{ summary.breakthrough.happenedLabel }}</strong>
                </div>
                <div class="stat-tile">
                  <span>{{ uiText.scoreDelta }}</span>
                  <strong>+{{ summary.breakthrough.scoreDelta }}</strong>
                </div>
                <div class="stat-tile">
                  <span>{{ uiText.playDelta }}</span>
                  <strong>+{{ summary.breakthrough.playDelta }}</strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="story-card story-card--poster">
          <div class="story-card__index">{{ formatSlideIndex(8) }}</div>
          <div class="story-card__content">
            <p class="story-card__eyebrow">{{ summary.copy.poster.eyebrow }}</p>
            <div class="poster-board">
              <div class="poster-board__hero">
                <span>{{ summary.version.name }}</span>
                <h2>{{ summary.poster.title }}</h2>
                <p>{{ summary.poster.subtitle }}</p>
              </div>
              <div class="poster-board__facts">
                <div v-for="item in summary.poster.stats" :key="item.label" class="poster-board__fact">
                  <span>{{ item.label }}</span>
                  <strong>{{ item.value }}</strong>
                </div>
              </div>
              <div class="poster-board__footer">
                <div>
                  <span>Favorite</span>
                  <strong>{{ summary.poster.favoriteSong }}</strong>
                </div>
                <div>
                  <span>Keyword</span>
                  <strong>{{ summary.poster.keyword }}</strong>
                </div>
              </div>
              <p class="poster-board__copy">{{ summary.poster.shareCopy }}</p>
            </div>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.version-summary-page {
  --summary-ink: #2f241b;
  --summary-muted: #746457;
  --summary-accent: #d9732d;
  --summary-accent-strong: #be5126;
  --summary-accent-soft: rgba(217, 115, 45, 0.15);
  --summary-panel: rgba(255, 250, 244, 0.92);
  --summary-panel-strong: rgba(255, 245, 236, 0.97);
  --summary-line: rgba(116, 100, 87, 0.14);
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.version-summary-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(300px, 0.9fr);
  gap: 18px;
  padding: 22px 24px;
  background:
    radial-gradient(circle at top right, rgba(255, 191, 123, 0.25), transparent 38%),
    linear-gradient(135deg, rgba(255, 251, 245, 0.95), rgba(250, 241, 230, 0.92));
  border: 1px solid var(--summary-line);
  border-radius: 28px;
  box-shadow: 0 18px 44px rgba(139, 91, 57, 0.12);
}

.version-summary-toolbar__eyebrow,
.story-card__eyebrow {
  margin: 0 0 8px;
  color: var(--summary-accent-strong);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-size: 12px;
  font-weight: 700;
}

.version-summary-toolbar h1 {
  margin: 0;
  font-size: 30px;
  color: var(--summary-ink);
}

.version-summary-toolbar__desc {
  margin: 12px 0 0;
  color: var(--summary-muted);
  line-height: 1.7;
}

.version-summary-toolbar__controls {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  align-content: start;
}

.toolbar-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.toolbar-field span {
  color: var(--summary-muted);
  font-size: 13px;
}

.toolbar-field__value,
.toolbar-select :deep(.el-input__wrapper) {
  min-height: 42px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.76);
  box-shadow: inset 0 0 0 1px rgba(116, 100, 87, 0.12);
}

.toolbar-field__value {
  display: flex;
  align-items: center;
  padding: 0 14px;
  color: var(--summary-ink);
  font-weight: 600;
}

.version-summary-loading,
.version-summary-empty {
  position: relative;
  overflow: hidden;
  border-radius: 28px;
  padding: 42px 28px;
  background: var(--summary-panel);
  border: 1px solid var(--summary-line);
}

.version-summary-loading p,
.version-summary-empty p {
  position: relative;
  z-index: 1;
  color: var(--summary-muted);
}

.story-orb {
  position: absolute;
  width: 220px;
  height: 220px;
  right: -40px;
  top: -60px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 182, 109, 0.34), transparent 72%);
}

.version-summary-empty__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 20px;
}

.version-summary-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.meta-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(255, 250, 245, 0.85);
  border: 1px solid rgba(116, 100, 87, 0.12);
  color: var(--summary-muted);
}

.meta-chip strong {
  color: var(--summary-ink);
  font-size: 13px;
}

.meta-chip--soft {
  background: rgba(255, 243, 229, 0.92);
}

.story-stack {
  display: grid;
  gap: 22px;
  scroll-snap-type: y proximity;
}

.story-card {
  position: relative;
  overflow: hidden;
  min-height: 74vh;
  padding: 28px;
  border-radius: 34px;
  background:
    radial-gradient(circle at top right, rgba(244, 157, 80, 0.16), transparent 34%),
    linear-gradient(180deg, var(--summary-panel) 0%, var(--summary-panel-strong) 100%);
  border: 1px solid rgba(116, 100, 87, 0.12);
  box-shadow: 0 22px 54px rgba(126, 92, 66, 0.12);
  scroll-snap-align: start;
}

.story-card__index {
  position: absolute;
  right: 26px;
  top: 24px;
  font-size: 72px;
  line-height: 1;
  font-weight: 700;
  color: rgba(217, 115, 45, 0.12);
}

.story-card__content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.story-card__headline {
  margin: 0;
  max-width: 720px;
  color: var(--summary-ink);
  font-size: clamp(32px, 4.8vw, 58px);
  line-height: 1.08;
}

.story-card__lead {
  margin: 0;
  max-width: 760px;
  color: var(--summary-muted);
  line-height: 1.8;
  font-size: 16px;
}

.opening-ribbon,
.coverage-strip,
.poster-board__facts,
.song-panel__stats,
.stat-grid {
  display: grid;
  gap: 14px;
}

.opening-ribbon {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: auto;
}

.opening-ribbon div,
.coverage-strip div,
.poster-board__fact,
.song-panel__stats div,
.stat-tile {
  padding: 18px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(116, 100, 87, 0.1);
}

.opening-ribbon span,
.coverage-strip span,
.poster-board__fact span,
.song-panel__stats span,
.stat-tile span {
  display: block;
  color: var(--summary-muted);
  font-size: 13px;
}

.opening-ribbon strong,
.coverage-strip strong,
.poster-board__fact strong,
.song-panel__stats strong,
.stat-tile strong {
  display: block;
  margin-top: 8px;
  color: var(--summary-ink);
  font-size: 24px;
  line-height: 1.2;
}

.coverage-strip {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.coverage-strip__flag {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--summary-accent-strong);
  font-weight: 700;
  text-transform: uppercase;
}

.stat-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.stat-grid--compact {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.stat-tile--accent {
  background: linear-gradient(145deg, rgba(241, 118, 48, 0.18), rgba(255, 255, 255, 0.82));
}

.stat-tile small {
  display: block;
  margin-top: 6px;
  color: var(--summary-muted);
}

.song-panel {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 22px;
  align-items: center;
  padding: 20px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.74);
  border: 1px solid rgba(116, 100, 87, 0.1);
}

.song-panel--compact {
  grid-template-columns: 160px minmax(0, 1fr);
}

.song-panel__cover {
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 24px;
  overflow: hidden;
  background: linear-gradient(135deg, rgba(244, 157, 80, 0.3), rgba(190, 81, 38, 0.18));
}

.song-panel__cover--fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(47, 36, 27, 0.52);
  font-size: 13px;
  letter-spacing: 0.12em;
}

.song-panel__meta {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.song-panel__meta strong {
  font-size: clamp(24px, 3.6vw, 40px);
  color: var(--summary-ink);
  line-height: 1.1;
}

.song-panel__meta span {
  color: var(--summary-muted);
}

.song-panel__stats {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 10px;
}

.keyword-card {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 24px;
  padding: 22px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.74);
  border: 1px solid rgba(116, 100, 87, 0.1);
}

.keyword-card__hero {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 18px;
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(255, 237, 220, 0.92), rgba(255, 255, 255, 0.9));
}

.keyword-card__hero span {
  color: var(--summary-accent-strong);
  font-weight: 700;
}

.keyword-card__hero strong {
  color: var(--summary-ink);
  font-size: 34px;
  line-height: 1.1;
}

.keyword-card__hero small {
  color: var(--summary-muted);
  line-height: 1.7;
}

.keyword-radar {
  display: grid;
  gap: 12px;
}

.keyword-radar__row {
  display: grid;
  grid-template-columns: 100px minmax(0, 1fr) 60px;
  gap: 12px;
  align-items: center;
}

.keyword-radar__row span,
.keyword-radar__row strong {
  color: var(--summary-ink);
}

.keyword-radar__track {
  height: 12px;
  border-radius: 999px;
  background: rgba(116, 100, 87, 0.1);
  overflow: hidden;
}

.keyword-radar__track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--summary-accent), var(--summary-accent-strong));
}

.breakthrough-panel,
.poster-board {
  display: grid;
  gap: 18px;
}

.poster-board {
  padding: 26px;
  border-radius: 32px;
  background:
    radial-gradient(circle at top right, rgba(255, 187, 110, 0.24), transparent 32%),
    linear-gradient(160deg, rgba(255, 246, 238, 0.96), rgba(254, 251, 247, 0.88));
  border: 1px solid rgba(116, 100, 87, 0.12);
}

.poster-board__hero span {
  color: var(--summary-accent-strong);
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.poster-board__hero h2 {
  margin: 10px 0 12px;
  color: var(--summary-ink);
  font-size: clamp(30px, 4vw, 54px);
  line-height: 1.08;
}

.poster-board__hero p,
.poster-board__copy {
  margin: 0;
  color: var(--summary-muted);
  line-height: 1.8;
}

.poster-board__facts {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.poster-board__footer {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.poster-board__footer div {
  padding: 18px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(116, 100, 87, 0.1);
}

.poster-board__footer span {
  display: block;
  color: var(--summary-muted);
  font-size: 13px;
}

.poster-board__footer strong {
  display: block;
  margin-top: 8px;
  color: var(--summary-ink);
  font-size: 22px;
}

@media (max-width: 1080px) {
  .version-summary-toolbar,
  .keyword-card {
    grid-template-columns: 1fr;
  }

  .stat-grid,
  .opening-ribbon,
  .coverage-strip,
  .poster-board__facts,
  .poster-board__footer {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .version-summary-toolbar {
    padding: 18px;
  }

  .version-summary-toolbar__controls,
  .stat-grid,
  .stat-grid--compact,
  .opening-ribbon,
  .coverage-strip,
  .poster-board__facts,
  .poster-board__footer,
  .song-panel,
  .song-panel--compact,
  .song-panel__stats {
    grid-template-columns: 1fr;
  }

  .story-card {
    min-height: auto;
    padding: 22px 18px;
  }

  .story-card__index {
    font-size: 44px;
    right: 18px;
    top: 18px;
  }

  .story-card__headline {
    font-size: 32px;
  }
}
</style>
