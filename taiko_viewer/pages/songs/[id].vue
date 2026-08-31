<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { type BranchVariant, useSongBranchAudio } from "~/composables/useSongBranchAudio";
import type { AccountSongScoresPayload } from "~/types/account-song";
import type { RatingContentItem, SongCatalogItem } from "~/types/content";
import type { ChartDifficultyCode } from "~/types/ugc";
import { buildPageDescription } from "~/utils/seo";
import { buildSongCoverThumbnailUrl } from "~/utils/songCover";

const route = useRoute();
const { t, locale } = useI18n();
const localePath = useLocalePath();
const apiBase = "https://static.sakura-bot.cn";
const coverFallbackId = 1384;
const coverError = ref(false);
const drumVolume = ref(1);
const drumMuted = ref(false);
const audioErrors = ref<Record<string, boolean>>({});
const drumAudioRefs = new Map<string, HTMLAudioElement>();
const trackLevelMap: Record<string, ChartDifficultyCode> = {
  EASY: 1,
  NORMAL: 2,
  HARD: 3,
  ONI: 4,
  EDIT: 5
};
const levelTrackMap: Record<ChartDifficultyCode, string> = {
  1: "EASY",
  2: "NORMAL",
  3: "HARD",
  4: "ONI",
  5: "EDIT"
};
const requestedDifficulty = Number(route.query.difficulty) as ChartDifficultyCode;
const selectedTrack = ref(levelTrackMap[requestedDifficulty] || "ONI");

const songId = computed(() => Number(route.params.id));
const selectedDifficultyCode = computed(() => trackLevelMap[selectedTrack.value] || 4);
const apiFetch = useViewerApiFetch();
const { accountUser, resolveAccountUser } = useAccountAuthStatus();

definePageMeta({
  pageTitleKey: "songs.detail",
  pageDescKey: "page.songs.detail.desc",
  navKey: "/songs/available"
});

const [songDetailState, chartUgcState] = await Promise.all([
  useSongDetail(songId),
  useChartUgc(songId, selectedDifficultyCode)
]);
const { data: songDetail, pending, error } = songDetailState;
const {
  publicSummary: chartUgcSummary,
  viewerState: chartUgcViewerState,
  difficultySaving: chartUgcDifficultySaving,
  tagSaving: chartUgcTagSaving,
  difficultyError: chartUgcDifficultyError,
  tagError: chartUgcTagError,
  tipSaving: chartUgcTipSaving,
  tipError: chartUgcTipError,
  helpfulSavingById: chartUgcHelpfulSavingById,
  helpfulErrorById: chartUgcHelpfulErrorById,
  reportSavingById: chartUgcReportSavingById,
  reportErrorById: chartUgcReportErrorById,
  reportSuccessById: chartUgcReportSuccessById,
  interactionUnavailable: chartUgcInteractionUnavailable,
  interactionPending: chartUgcInteractionPending,
  setDifficultyVote: setChartUgcDifficultyVote,
  setTagSlugs: setChartUgcTagSlugs,
  saveTip: saveChartUgcTip,
  deleteTip: deleteChartUgcTip,
  setHelpful: setChartUgcHelpful,
  reportTip: reportChartUgcTip,
  goToLogin: goToChartUgcLogin
} = chartUgcState;
const song = computed<SongCatalogItem | null>(() => songDetail.value.song);
const { data: accountScores, pending: accountScoresPending } = useLazyAsyncData<
  AccountSongScoresPayload & { unavailable?: boolean }
>(
  () => `account-song-scores-${songId.value}`,
  async () => {
    const user = await resolveAccountUser();
    if (!user || !accountUser.value) return { items: [] };
    try {
      return await apiFetch<AccountSongScoresPayload>(`/api/account/songs/${songId.value}`);
    } catch {
      return { items: [], unavailable: true };
    }
  },
  {
    default: () => ({ items: [] }),
    watch: [songId],
    server: false
  }
);
const branchAudioVariants = computed(() => songDetail.value.branchAudioVariants || {});
const tjaBundleUrl = computed(() => songDetail.value.tjaBundleUrl || "");
const normalizedShelfStatus = (value: SongCatalogItem["shelf_status"]) => {
  if (value === undefined || value === null || value === "") return 0;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};
const songListPath = computed(() => {
  if (route.query.list === "removed") return "/songs/removed";
  if (route.query.list === "available") return "/songs/available";
  return normalizedShelfStatus(song.value?.shelf_status) === 1 ? "/songs/removed" : "/songs/available";
});
const songListLabelKey = computed(() =>
  songListPath.value === "/songs/removed" ? "nav.songsRemoved" : "nav.songsAvailable"
);

watch(
  () => [song.value?.shelf_status, route.query.list] as const,
  async ([shelfStatus, listQuery]) => {
    if (!song.value || listQuery === "removed" || listQuery === "available") return;
    if (normalizedShelfStatus(shelfStatus) !== 1) return;
    await navigateTo(
      {
        path: route.path,
        query: { ...route.query, list: "removed" }
      },
      { replace: true }
    );
  },
  { immediate: true }
);
const getSongPrimaryTitle = (target: SongCatalogItem | null) =>
  target ? (locale.value === "ja" && target.song_name_jp ? target.song_name_jp : target.song_name) : "";
const getSongSecondaryTitle = (target: SongCatalogItem | null) =>
  target ? (locale.value === "ja" ? target.song_name || "-" : target.song_name_jp || "-") : "-";
const copy = computed(() =>
  locale.value === "ja"
    ? {
        detailTitle: "楽曲詳細",
        errorTitle: "楽曲が存在しないか、読み込みに失敗しました",
        errorSubtitle: "楽曲一覧へ戻って再試行してください。",
        backToList: "楽曲一覧へ戻る",
        back: "← 一覧へ戻る",
        releaseDate: "公開日",
        subtitle: "サブタイトル",
        jpName: "日本語名",
        version: "実装バージョン",
        artists: "作曲 / 歌唱",
        radar: "六次元レーダー",
        radarAria: "六次元レーダーチャート",
        radarRange: "座標範囲",
        radarLevel: "レベル",
        radarEmpty: "この楽曲 ID に対応する六次元データはありません",
        preview: "試聴",
        drum: "DRUM · 純ドラム音声",
        mix: "MIX · フルミックス音声",
        pure: "PURE · インスト音声",
        audioMissing: "音源が見つかりません",
        baseAudioMissing: "基本音源が見つかりません",
        pureAudioMissing: "インスト音源が見つかりません",
        unmute: "ミュート解除",
        mute: "ミュート",
        charts: "譜面プレビュー",
        maxNotes: "最大ノーツ",
        openChart: "新しいタブで開く",
        downloadTjaBundle: "TJA+OGG をダウンロード"
      }
    : {
        detailTitle: "歌曲详情",
        errorTitle: "歌曲不存在或加载失败",
        errorSubtitle: "请返回歌曲列表后重试。",
        backToList: "返回歌曲列表",
        back: "← 返回列表",
        releaseDate: "发布日期",
        subtitle: "副标题",
        jpName: "日文名",
        version: "实装版本",
        artists: "作曲/演唱",
        radar: "六维雷达",
        radarAria: "六维雷达图",
        radarRange: "坐标范围",
        radarLevel: "层级",
        radarEmpty: "暂无该歌曲 ID 对应的六维数据",
        preview: "试听",
        drum: "DRUM · 纯鼓点音效试听",
        mix: "MIX · 完整混音试听",
        pure: "PURE · 纯音乐试听",
        audioMissing: "音源不存在",
        baseAudioMissing: "基础音源不存在",
        pureAudioMissing: "纯音乐音源不存在",
        unmute: "取消静音",
        mute: "静音",
        charts: "谱面预览",
        maxNotes: "最大物量",
        openChart: "打开新页面预览",
        downloadTjaBundle: "下载 TJA+OGG"
      }
);

const coverUrl = computed(() => {
  const id = coverError.value || !song.value ? coverFallbackId : song.value.id;
  return buildSongCoverThumbnailUrl(id, 400);
});

const hasEditDifficulty = computed(() => {
  const value = song.value?.level_5;
  return value !== undefined && value !== null && value !== "-" && value !== "";
});

const trackDefs = computed(() => {
  const base = [
    { key: "EASY", label: t("songs.levels.easy") },
    { key: "NORMAL", label: t("songs.levels.normal") },
    { key: "HARD", label: t("songs.levels.hard") },
    { key: "ONI", label: t("songs.levels.oni") }
  ];
  return hasEditDifficulty.value ? [...base, { key: "EDIT", label: t("songs.levels.edit") }] : base;
});

const levelMap = computed(() => ({
  EASY: song.value?.level_1,
  NORMAL: song.value?.level_2,
  HARD: song.value?.level_3,
  ONI: song.value?.level_4,
  EDIT: song.value?.level_5
}));

const formatStar = (value?: number | string) => {
  if (value === undefined || value === null || value === "-" || value === "") return "—";
  return `${value}★`;
};

const getTrackStarLabel = (key: string) => formatStar(levelMap.value[key as keyof typeof levelMap.value]);

const fumenKeyMap: Record<string, keyof typeof levelMap.value> = {
  easy: "EASY",
  normal: "NORMAL",
  hard: "HARD",
  oni: "ONI",
  inner: "EDIT"
};

const getFumenStarLabel = (key: string) => formatStar(levelMap.value[fumenKeyMap[key]]);

const comboIndexMap: Record<string, number> = {
  easy: 0,
  normal: 1,
  hard: 2,
  oni: 3,
  inner: 4
};

const formatList = (input?: string[]) => {
  if (!input || !input.length) return "-";
  return input.join(" / ");
};

const getFumenComboLabel = (key: string) => {
  const comboList = song.value?.max_combo;
  const index = comboIndexMap[key];
  if (!comboList || comboList[index] === undefined || comboList[index] === null || comboList[index] === "") {
    return "—";
  }
  return String(comboList[index]);
};

const {
  activeBranchVariants,
  hasBranchVariants,
  getBaseAudioUrl,
  getVariantAudioUrl,
  getVariantDisplayLabel,
  getPureAudioUrl
} = useSongBranchAudio({
  apiBase,
  songId,
  selectedTrack,
  branchVariants: branchAudioVariants
});

const currentDrumAudio = computed(() => {
  if (!song.value) return "";
  return getBaseAudioUrl("drum");
});

const currentMixAudio = computed(() => {
  if (!song.value) return "";
  return getBaseAudioUrl("mix");
});

const currentPureAudio = computed(() => {
  if (!song.value) return "";
  return getPureAudioUrl();
});

const getDrumVariantAudioUrl = (variant: BranchVariant) => getVariantAudioUrl("drum", variant);
const getMixVariantAudioUrl = (variant: BranchVariant) => getVariantAudioUrl("mix", variant);

const fumenDefs = computed(() => {
  const base = [
    { key: "easy", label: t("songs.levels.easy"), folder: "Kantan" },
    { key: "normal", label: t("songs.levels.normal"), folder: "Futsuu" },
    { key: "hard", label: t("songs.levels.hard"), folder: "Muzukashii" },
    { key: "oni", label: t("songs.levels.oni"), folder: "Oni" }
  ];
  return hasEditDifficulty.value ? [...base, { key: "inner", label: t("songs.levels.edit"), folder: "InnerOni" }] : base;
});

const getFumenUrl = (folder: string) => `${apiBase}/fumen/${folder}/${songId.value}.png`;

const setDrumAudioRef = (key: string, el: Element | null) => {
  if (el instanceof HTMLAudioElement) {
    drumAudioRefs.set(key, el);
  } else {
    drumAudioRefs.delete(key);
  }
  syncDrumState();
};

const syncDrumState = () => {
  drumAudioRefs.forEach((audio) => {
    audio.volume = drumVolume.value;
    audio.muted = drumMuted.value;
  });
};

const markAudioError = (key: string) => {
  audioErrors.value = { ...audioErrors.value, [key]: true };
};

const hasAudioError = (key: string) => !!audioErrors.value[key];
const getAudioErrorKey = (mode: "drum" | "mix" | "pure", variant?: BranchVariant) => {
  if (mode === "pure") {
    return `pure-base-${songId.value}`;
  }
  return variant
    ? `${mode}-${songId.value}-${selectedTrack.value}-${variant.label}`
    : `${mode}-base-${songId.value}-${selectedTrack.value}`;
};

const radarDataKeys = ["复合处理", "平均密度", "瞬间密度", "叩き分け", "BPM变化", "hs变化"] as const;
const radarLabels = computed(() =>
  locale.value === "ja"
    ? ["複合処理", "平均密度", "瞬間密度", "叩き分け", "BPM変化", "HS変化"]
    : ["复合处理", "平均密度", "瞬间密度", "叩き分け", "BPM变化", "hs变化"]
);

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const ratingEntries = computed<RatingContentItem[]>(() => songDetail.value.ratingEntries || []);

const selectedRating = computed(() => {
  const entries = ratingEntries.value.filter((item) => Number(item.id) === songId.value);
  if (!entries.length) return null;
  const targetLevel = trackLevelMap[selectedTrack.value];
  const exactMatch = entries.find((item) => Number(item.level) === targetLevel);
  if (exactMatch) return exactMatch;
  return [...entries].sort((a, b) => (toNumber(b.level) ?? 0) - (toNumber(a.level) ?? 0))[0];
});

const hasRadarData = computed(() => {
  if (!selectedRating.value) return false;
  return radarDataKeys.some((label) => toNumber(selectedRating.value?.[label]) !== null);
});

const radarValues = computed(() => {
  if (!selectedRating.value) return radarLabels.value.map(() => 0);
  return radarDataKeys.map((label) => toNumber(selectedRating.value?.[label]) ?? 0);
});

const radarMax = computed(() => {
  const maxValue = Math.max(...radarValues.value, 0);
  if (maxValue <= 0) return 10;
  return Math.ceil(maxValue / 10) * 10;
});

const radarSize = 260;
const radarCenter = radarSize / 2;
const radarRadius = 86;
const radarAngleOffset = -Math.PI / 2;
const radarLevels = [0.25, 0.5, 0.75, 1];

const getRadarPoint = (ratio: number, index: number, extra = 0) => {
  const angle = (Math.PI * 2 * index) / radarLabels.value.length + radarAngleOffset;
  const radius = radarRadius * ratio + extra;
  return {
    x: radarCenter + radius * Math.cos(angle),
    y: radarCenter + radius * Math.sin(angle)
  };
};

const radarGridPolygons = computed(() =>
  radarLevels.map((level) =>
    radarLabels.value
      .map((_, index) => {
        const point = getRadarPoint(level, index);
        return `${point.x},${point.y}`;
      })
      .join(" ")
  )
);

const radarAxisLines = computed(() =>
  radarLabels.value.map((_, index) => {
    const start = getRadarPoint(0, index);
    const end = getRadarPoint(1, index);
    return {
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y
    };
  })
);

const radarDataPoints = computed(() =>
  radarLabels.value.map((_, index) => {
    const value = radarValues.value[index];
    const ratio = Math.min(1, value / radarMax.value);
    const point = getRadarPoint(ratio, index);
    return {
      x: point.x,
      y: point.y,
      value
    };
  })
);

const radarDataPolygon = computed(() => radarDataPoints.value.map((point) => `${point.x},${point.y}`).join(" "));

const radarLabelPoints = computed(() =>
  radarLabels.value.map((label, index) => {
    const point = getRadarPoint(1, index, 22);
    const deltaX = point.x - radarCenter;
    const anchor = deltaX > 10 ? "start" : deltaX < -10 ? "end" : "middle";
    return {
      label,
      x: point.x,
      y: point.y + 4,
      anchor
    };
  })
);

const radarSummary = computed(() =>
  radarLabels.value.map((label, index) => ({
    label,
    value: radarValues.value[index]
  }))
);

const formatRadarValue = (value: number) => {
  if (Number.isInteger(value)) return `${value}`;
  return value.toFixed(2);
};

watch([drumVolume, drumMuted], () => syncDrumState());
watch([songId, selectedTrack], () => {
  drumAudioRefs.clear();
});
watch(hasEditDifficulty, (value) => {
  if (!value && selectedTrack.value === "EDIT") {
    selectedTrack.value = "ONI";
  }
});

const pageDescription = computed(() => {
  if (!song.value) return buildPageDescription(t("page.songs.detail.desc"));
  const subtitle = song.value.subtitle?.trim();
  const detailParts = [song.value.type, song.value.bpm ? `BPM ${song.value.bpm}` : ""].filter(Boolean);
  const detailText = detailParts.length ? detailParts.join(locale.value === "ja" ? "、" : "，") : "";
  const songName = getSongPrimaryTitle(song.value);
  if (subtitle) {
    return buildPageDescription(
      locale.value === "ja"
        ? `${songName} の中国版太鼓の達人楽曲詳細です。${subtitle}${detailText ? `、${detailText}` : ""}。`
        : `${songName} 太鼓达人国行歌曲详情：${subtitle}${detailText ? `，${detailText}` : ""}。`
    );
  }
  return buildPageDescription(
    locale.value === "ja"
      ? detailText
        ? `${songName} の中国版太鼓の達人楽曲詳細です。${detailText}。`
        : `${songName} の中国版太鼓の達人楽曲詳細です。`
      : detailText
        ? `${songName} 太鼓达人国行歌曲详情，${detailText}。`
        : `${songName} 太鼓达人国行歌曲详情。`
  );
});

useViewerSeo(() => ({
  title: song.value ? `${getSongPrimaryTitle(song.value)} - ${copy.value.detailTitle}` : copy.value.detailTitle,
  description: pageDescription.value,
  path: `/songs/${songId.value}`,
  image: coverUrl.value,
  keywords: song.value ? [getSongPrimaryTitle(song.value), locale.value === "ja" ? "太鼓の達人楽曲" : "太鼓达人歌曲"] : [copy.value.detailTitle],
  breadcrumbs: [
    { name: t("nav.home"), path: "/" },
    { name: t(songListLabelKey.value), path: songListPath.value },
    { name: getSongPrimaryTitle(song.value) || copy.value.detailTitle, path: `/songs/${songId.value}` }
  ]
}));
</script>

<template>
  <div class="song-detail-page">
    <el-card v-if="pending" class="panel-card">
      <el-skeleton :rows="8" animated />
    </el-card>

    <el-card v-else-if="error || !song" class="panel-card">
      <el-result icon="error" :title="copy.errorTitle" :sub-title="copy.errorSubtitle">
        <template #extra>
          <NuxtLink :to="localePath(songListPath)">
            <el-button type="primary">{{ copy.backToList }}</el-button>
          </NuxtLink>
        </template>
      </el-result>
    </el-card>

    <el-card v-else class="panel-card detail-shell">
      <div class="back-row">
        <NuxtLink class="back-link" :to="localePath(songListPath)">{{ copy.back }}</NuxtLink>
      </div>

      <main class="detail-main">
        <section class="detail-left">
          <div class="cover-wrap">
            <SongCoverImage
              :song-id="song.id"
              :alt="getSongPrimaryTitle(song)"
              sizes="(max-width: 760px) 82vw, 360px"
              priority
              class="cover-image"
              @error="coverError = true"
            />
          </div>
          <h2>{{ getSongPrimaryTitle(song) }}</h2>
          <p class="jp-name">{{ getSongSecondaryTitle(song) }}</p>

          <div class="meta-list">
            <div class="meta-row">
              <span>{{ copy.releaseDate }}</span>
              <strong>{{ song.open_day || "-" }}</strong>
            </div>
            <div class="meta-row">
              <span>ID</span>
              <strong>#{{ song.id }}</strong>
            </div>
            <div class="meta-row">
              <span>{{ copy.subtitle }}</span>
              <strong>{{ song.subtitle || "-" }}</strong>
            </div>
            <div class="meta-row">
              <span>{{ copy.jpName }}</span>
              <strong>{{ song.song_name_jp || "-" }}</strong>
            </div>
            <div class="meta-row">
              <span>BPM</span>
              <strong>{{ song.bpm || "-" }}</strong>
            </div>
            <div class="meta-row">
              <span>{{ copy.version }}</span>
              <strong>{{ formatList(song.version) }}</strong>
            </div>
            <div class="meta-row">
              <span>{{ copy.artists }}</span>
              <strong>{{ formatList(song.artists) }}</strong>
            </div>
          </div>
        </section>

        <section class="detail-middle">
          <div class="radar-card">
            <div class="section-title">
              <span class="title-icon radar-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 4l7 4v8l-7 4-7-4V8l7-4z M12 4v16 M5 8l14 8 M19 8L5 16"
                    stroke="currentColor"
                    stroke-width="1.4"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
              <span>{{ copy.radar }}</span>
            </div>
            <template v-if="hasRadarData">
              <svg class="radar-chart" viewBox="0 0 260 260" role="img" :aria-label="copy.radarAria">
                <polygon
                  v-for="(polygon, index) in radarGridPolygons"
                  :key="`grid-${index}`"
                  class="radar-grid"
                  :points="polygon"
                />
                <line
                  v-for="(line, index) in radarAxisLines"
                  :key="`axis-${index}`"
                  class="radar-axis"
                  :x1="line.x1"
                  :y1="line.y1"
                  :x2="line.x2"
                  :y2="line.y2"
                />
                <polygon class="radar-area" :points="radarDataPolygon" />
                <circle
                  v-for="(point, index) in radarDataPoints"
                  :key="`point-${index}`"
                  class="radar-point"
                  :cx="point.x"
                  :cy="point.y"
                  r="3.2"
                />
                <text
                  v-for="label in radarLabelPoints"
                  :key="label.label"
                  class="radar-label"
                  :x="label.x"
                  :y="label.y"
                  :text-anchor="label.anchor"
                >
                  {{ label.label }}
                </text>
              </svg>
              <div class="radar-meta">
                <span>{{ copy.radarRange }}: 0 - {{ radarMax }}</span>
                <span v-if="selectedRating?.level">{{ copy.radarLevel }}: {{ selectedRating.level }}</span>
              </div>
              <ul class="radar-values">
                <li v-for="item in radarSummary" :key="item.label">
                  <span>{{ item.label }}</span>
                  <strong>{{ formatRadarValue(item.value) }}</strong>
                </li>
              </ul>
            </template>
            <div v-else class="radar-empty">
              <img src="/radar-empty.svg" :alt="copy.radarEmpty" class="radar-empty-image" />
              <p>{{ copy.radarEmpty }}</p>
            </div>
          </div>
        </section>

        <section class="detail-right">
          <div class="player-card">
            <div class="section-title">
              <span class="title-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M9 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z M17 15V6l-9 2.5v9.5"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
              <span>{{ copy.preview }}</span>
            </div>
            <div class="track-tabs">
              <button
                v-for="track in trackDefs"
                :key="track.key"
                type="button"
                class="track-btn"
                :class="{ active: selectedTrack === track.key }"
                @click="selectedTrack = track.key"
              >
                <span class="track-label">
                  <span>{{ track.label }}</span>
                  <span class="track-star">{{ getTrackStarLabel(track.key) }}</span>
                </span>
              </button>
            </div>

            <div class="audio-grid">
              <div class="audio-block">
                <div class="audio-head">
                  <strong>{{ copy.drum }}</strong>
                </div>
                <template v-if="hasBranchVariants">
                  <div class="variant-audios">
                    <div
                      v-for="variant in activeBranchVariants"
                      :key="`drum-${selectedTrack}-${variant.label}`"
                      class="variant-item"
                    >
                      <span class="variant-label" :class="{ merged: variant.aliases.length }">
                        {{ getVariantDisplayLabel(variant) }}
                      </span>
                      <audio
                        :ref="(el) => setDrumAudioRef(`drum-${selectedTrack}-${variant.label}`, el)"
                        :key="`drum-${songId}-${selectedTrack}-${variant.label}`"
                        :src="getDrumVariantAudioUrl(variant)"
                        class="audio-player"
                        controls
                        preload="none"
                        @loadedmetadata="syncDrumState"
                        @error="markAudioError(getAudioErrorKey('drum', variant))"
                      />
                      <p v-if="hasAudioError(getAudioErrorKey('drum', variant))" class="audio-error">{{ copy.audioMissing }}</p>
                    </div>
                  </div>
                </template>
                <template v-else>
                  <audio
                    :ref="(el) => setDrumAudioRef(getAudioErrorKey('drum'), el)"
                    :key="currentDrumAudio"
                    :src="currentDrumAudio"
                    class="audio-player"
                    controls
                    preload="none"
                    @loadedmetadata="syncDrumState"
                    @error="markAudioError(getAudioErrorKey('drum'))"
                  />
                  <p v-if="hasAudioError(getAudioErrorKey('drum'))" class="audio-error">{{ copy.baseAudioMissing }}</p>
                </template>
                <div class="volume-row">
                  <button class="volume-btn" type="button" @click="drumMuted = !drumMuted">
                    {{ drumMuted ? copy.unmute : copy.mute }}
                  </button>
                  <input v-model.number="drumVolume" class="volume-slider" type="range" min="0" max="1" step="0.01" />
                  <span>{{ Math.round(drumVolume * 100) }}%</span>
                </div>
              </div>

              <div class="audio-block">
                <div class="audio-head">
                  <strong>{{ copy.mix }}</strong>
                </div>
                <template v-if="hasBranchVariants">
                  <div class="variant-audios">
                    <div
                      v-for="variant in activeBranchVariants"
                      :key="`mix-${selectedTrack}-${variant.label}`"
                      class="variant-item"
                    >
                      <span class="variant-label" :class="{ merged: variant.aliases.length }">
                        {{ getVariantDisplayLabel(variant) }}
                      </span>
                      <audio
                        :key="`mix-${songId}-${selectedTrack}-${variant.label}`"
                        :src="getMixVariantAudioUrl(variant)"
                        class="audio-player"
                        controls
                        preload="none"
                        @error="markAudioError(getAudioErrorKey('mix', variant))"
                      />
                      <p v-if="hasAudioError(getAudioErrorKey('mix', variant))" class="audio-error">{{ copy.audioMissing }}</p>
                    </div>
                  </div>
                </template>
                <template v-else>
                  <audio
                    :key="`mix-base-${songId}-${selectedTrack}`"
                    :src="currentMixAudio"
                    class="audio-player"
                    controls
                    preload="none"
                    @error="markAudioError(getAudioErrorKey('mix'))"
                  />
                  <p v-if="hasAudioError(getAudioErrorKey('mix'))" class="audio-error">{{ copy.baseAudioMissing }}</p>
                </template>
              </div>

              <div class="audio-block">
                <div class="audio-head">
                  <strong>{{ copy.pure }}</strong>
                </div>
                <audio
                  :key="`pure-base-${songId}`"
                  :src="currentPureAudio"
                  class="audio-player"
                  controls
                  preload="none"
                  @error="markAudioError(getAudioErrorKey('pure'))"
                />
                <p v-if="hasAudioError(getAudioErrorKey('pure'))" class="audio-error">{{ copy.pureAudioMissing }}</p>
              </div>
            </div>
          </div>

          <div class="fumen-block">
            <div class="fumen-head">
              <div class="section-title">
                <span class="title-icon chart-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path
                      d="M4 6h6v6H4z M14 6h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z"
                      stroke="currentColor"
                      stroke-width="1.6"
                      stroke-linejoin="round"
                    />
                  </svg>
                </span>
                <span>{{ copy.charts }}</span>
              </div>
              <a v-if="tjaBundleUrl" class="tja-bundle-btn" :href="tjaBundleUrl">
                {{ copy.downloadTjaBundle }}
              </a>
            </div>
            <div class="fumen-grid">
              <div
                v-for="item in fumenDefs"
                :key="item.folder"
                :class="['fumen-card', `fumen-${item.key}`]"
              >
                <span class="fumen-label">{{ item.label }}</span>
                <span class="fumen-star">{{ getFumenStarLabel(item.key) }}</span>
                <span class="fumen-combo">{{ copy.maxNotes }} {{ getFumenComboLabel(item.key) }}</span>
                <a
                  class="fumen-link-btn"
                  :href="getFumenUrl(item.folder)"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {{ copy.openChart }}
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <ChartUgcSection
        v-if="chartUgcSummary"
        :summary="chartUgcSummary"
        :viewer-state="chartUgcViewerState"
        :authenticated="Boolean(accountUser)"
        :interaction-pending="chartUgcInteractionPending"
        :interaction-unavailable="chartUgcInteractionUnavailable"
        :difficulty-saving="chartUgcDifficultySaving"
        :tag-saving="chartUgcTagSaving"
        :difficulty-error-key="chartUgcDifficultyError"
        :tag-error-key="chartUgcTagError"
        :tip-saving="chartUgcTipSaving"
        :tip-error-key="chartUgcTipError"
        :helpful-saving-by-id="chartUgcHelpfulSavingById"
        :helpful-error-by-id="chartUgcHelpfulErrorById"
        :report-saving-by-id="chartUgcReportSavingById"
        :report-error-by-id="chartUgcReportErrorById"
        :report-success-by-id="chartUgcReportSuccessById"
        :difficulty-label="t(`difficulty.${selectedDifficultyCode}`)"
        @difficulty-change="setChartUgcDifficultyVote"
        @tags-change="setChartUgcTagSlugs"
        @tip-save="saveChartUgcTip"
        @tip-delete="deleteChartUgcTip"
        @helpful-change="setChartUgcHelpful"
        @report="reportChartUgcTip"
        @login="goToChartUgcLogin"
      />

      <SongRelatedDiscussions :song-id="songId" :difficulty-type="selectedDifficultyCode" />

      <AccountSongScores
        v-if="accountUser"
        :items="accountScores.items"
        :pending="accountScoresPending"
        :unavailable="accountScores.unavailable"
      />
    </el-card>
  </div>
</template>

<style scoped>
.song-detail-page {
  display: grid;
}

.back-row {
  margin-bottom: 14px;
}

.back-link {
  color: #8b5a2b;
  text-decoration: none;
  font-size: 13px;
  font-weight: 600;
}

.detail-main {
  display: flex;
  gap: 28px;
  align-items: flex-start;
}

.detail-left {
  width: min(360px, 100%);
  flex-shrink: 0;
}

.detail-middle {
  width: min(320px, 100%);
  flex-shrink: 0;
}

.cover-wrap {
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 16px 28px rgba(130, 95, 60, 0.2);
}

.cover-image {
  width: 100%;
  aspect-ratio: 1 / 1;
}

.detail-left h2 {
  margin: 16px 0 6px;
  font-size: 24px;
  line-height: 1.3;
}

.jp-name {
  margin: 0 0 14px;
  color: #7c6a58;
}

.meta-list {
  display: grid;
  gap: 10px;
}

.meta-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(155, 122, 90, 0.2);
}

.meta-row span {
  color: #786657;
  font-size: 13px;
}

.meta-row strong {
  text-align: right;
  font-size: 13px;
  word-break: break-all;
}

.detail-right {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 18px;
  max-width: 760px;
}

.radar-card {
  border-radius: 16px;
  padding: 14px;
  background: linear-gradient(145deg, rgba(236, 248, 255, 0.9), rgba(255, 255, 255, 0.96));
  border: 1px solid rgba(95, 143, 191, 0.22);
}

.radar-icon {
  background: rgba(76, 126, 179, 0.2);
  color: #3b6898;
}

.radar-chart {
  width: 100%;
  max-width: 270px;
  display: block;
  margin: 4px auto 0;
}

.radar-grid {
  fill: none;
  stroke: rgba(120, 146, 176, 0.3);
  stroke-width: 1;
}

.radar-axis {
  stroke: rgba(102, 131, 163, 0.35);
  stroke-width: 1;
}

.radar-area {
  fill: rgba(75, 136, 216, 0.26);
  stroke: #4a77aa;
  stroke-width: 1.8;
}

.radar-point {
  fill: #2f5f95;
}

.radar-label {
  fill: #4d5f75;
  font-size: 11px;
  font-weight: 600;
}

.radar-meta {
  margin-top: 2px;
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
  color: #5f7185;
}

.radar-values {
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 6px;
}

.radar-values li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
  color: #4a5f79;
  border-bottom: 1px solid rgba(116, 145, 177, 0.18);
  padding-bottom: 4px;
}

.radar-values strong {
  color: #2f5f95;
}

.radar-empty {
  min-height: 320px;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 8px;
  text-align: center;
}

.radar-empty-image {
  width: min(220px, 100%);
}

.radar-empty p {
  margin: 0;
  font-size: 13px;
  color: #5c6f84;
}

.player-card {
  border-radius: 16px;
  padding: 16px;
  background: linear-gradient(130deg, rgba(255, 243, 229, 0.85), rgba(255, 255, 255, 0.96));
  border: 1px solid rgba(161, 127, 95, 0.2);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 16px;
  font-weight: 700;
  color: #6f4b2f;
}

.title-icon {
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: rgba(196, 127, 79, 0.2);
  color: #9a6d47;
  font-size: 14px;
}

.title-icon svg {
  width: 14px;
  height: 14px;
}

.chart-icon {
  background: rgba(88, 136, 197, 0.2);
  color: #3c6aa6;
}

.track-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.track-btn {
  border: 1px solid rgba(139, 107, 77, 0.35);
  background: #fff;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  color: #7d5a3d;
  padding: 4px 12px;
  cursor: pointer;
}

.track-btn.active {
  background: #9a6d47;
  color: #fff;
  border-color: #9a6d47;
}

.track-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.track-star {
  font-size: 11px;
  font-weight: 700;
  color: inherit;
}

.audio-player {
  width: 100%;
  display: block;
  height: 40px;
  min-height: 40px;
  max-height: 40px;
  box-sizing: border-box;
}

.audio-grid {
  display: grid;
  gap: 12px;
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
}

.audio-block {
  border-radius: 12px;
  border: 1px solid rgba(161, 127, 95, 0.25);
  background: rgba(255, 255, 255, 0.7);
  padding: 10px;
}

.audio-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
  font-size: 13px;
}

.audio-tag {
  font-size: 11px;
  line-height: 1;
  border-radius: 999px;
  padding: 4px 8px;
  background: #fbe7d4;
  color: #8a5a35;
  font-weight: 700;
}

.mix-tag {
  background: #e8f1fb;
  color: #2d567e;
}

.volume-row {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #6f5d4c;
}
.volume-btn {
  border: 1px solid rgba(139, 107, 77, 0.35);
  background: #fff;
  color: #7d5a3d;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  cursor: pointer;
}

.volume-slider {
  flex: 1;
}

.variant-audios {
  display: grid;
  gap: 4px;
  margin-top: 2px;
}

.variant-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-auto-rows: max-content;
  align-content: start;
  gap: 4px;
}

.variant-item .audio-player {
  margin: 0;
}

.variant-label {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  font-weight: 600;
  color: #6f5d4c;
}

.variant-label::before {
  content: "";
  width: 14px;
  height: 7px;
  border-left: 2px solid #c47f4f;
  border-bottom: 2px solid #c47f4f;
  border-radius: 0 0 0 5px;
}

.variant-label.merged::before {
  border-top: 2px solid #c47f4f;
  border-radius: 5px 0 0 5px;
}

.audio-error {
  margin: 0;
  font-size: 11px;
  color: #c16a5a;
}

.fumen-block h3 {
  margin: 0 0 12px;
  font-size: 18px;
}

.fumen-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.fumen-head .section-title {
  margin-bottom: 0;
}

.tja-bundle-btn {
  text-decoration: none;
  border-radius: 999px;
  border: 1px solid rgba(83, 123, 186, 0.35);
  background: linear-gradient(135deg, rgba(79, 140, 214, 0.12), rgba(255, 255, 255, 0.95));
  color: #345f96;
  font-size: 12px;
  font-weight: 700;
  padding: 7px 12px;
  white-space: nowrap;
}

.fumen-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}

.fumen-card {
  color: #6f5d4c;
  border-radius: 12px;
  border: 1px solid rgba(161, 127, 95, 0.22);
  padding: 12px;
  background: rgba(255, 255, 255, 0.82);
  display: grid;
  gap: 8px;
  text-align: center;
}

.fumen-easy {
  border-top: 4px solid #7ddfa0;
  background: rgba(240, 252, 245, 0.85);
}

.fumen-normal {
  border-top: 4px solid #7db2ff;
  background: rgba(240, 246, 255, 0.85);
}

.fumen-hard {
  border-top: 4px solid #ffb15e;
  background: rgba(255, 246, 236, 0.85);
}

.fumen-oni {
  border-top: 4px solid #ff7b7b;
  background: rgba(255, 241, 241, 0.85);
}

.fumen-inner {
  border-top: 4px solid #c08dff;
  background: rgba(248, 241, 255, 0.85);
}

.fumen-card span {
  display: block;
  font-size: 13px;
  font-weight: 700;
}

.fumen-label {
  color: #6f5d4c;
}

.fumen-star {
  font-size: 12px;
  color: #8a6b52;
}

.fumen-combo {
  font-size: 12px;
  color: #6f5d4c;
}

.fumen-link-btn {
  text-decoration: none;
  border-radius: 8px;
  border: 1px solid rgba(139, 107, 77, 0.35);
  background: #fff;
  color: #7d5a3d;
  font-size: 12px;
  font-weight: 600;
  padding: 6px 8px;
}

@media (max-width: 1240px) {
  .detail-main {
    flex-direction: column;
  }

  .detail-left {
    width: 100%;
    max-width: 460px;
  }

  .detail-middle,
  .detail-right {
    width: 100%;
    max-width: 760px;
  }

  .audio-grid {
    max-width: none;
  }
}
</style>
