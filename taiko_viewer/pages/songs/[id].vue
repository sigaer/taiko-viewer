<script setup lang="ts">
import { computed, ref, watch } from "vue";
import SongDifficultyTabs from "~/components/song/SongDifficultyTabs.vue";
import SongChartPreview from "~/components/song/SongChartPreview.vue";
import SongAudioPreview from "~/components/song/SongAudioPreview.vue";
import type { AccountSongScoresPayload } from "~/types/account-song";
import type { RatingContentItem, SongCatalogItem } from "~/types/content";
import type { ChartDifficultyCode } from "~/types/ugc";
import { buildPageDescription } from "~/utils/seo";
import { buildSongCoverThumbnailUrl } from "~/utils/songCover";

const route = useRoute();
const { t, locale } = useI18n();
const localePath = useLocalePath();
const coverFallbackId = 1384;
const coverError = ref(false);
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
watch(() => route.query.difficulty, value => { selectedTrack.value = levelTrackMap[Number(value) as ChartDifficultyCode] || "ONI"; });

const songId = computed(() => Number(route.params.id));
const selectedDifficultyCode = computed(() => trackLevelMap[selectedTrack.value] || 4);
const apiFetch = useViewerApiFetch();
const { accountUser, resolveAccountUser } = useAccountAuthStatus();

definePageMeta({
  pageTitleKey: "songs.detail",
  pageDescKey: "page.songs.detail.desc",
  navKey: "/songs/available",
  hidePageHeader: true,
  shellAppearance: "song-detail"
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
  if (route.query.list === "other") return "/songs/other";
  if (route.query.list === "available") return "/songs/available";
  const status = normalizedShelfStatus(song.value?.shelf_status);
  if (status === 1) return "/songs/removed";
  if (status === 2) return "/songs/other";
  return "/songs/available";
});
const songListLabelKey = computed(() => {
  if (songListPath.value === "/songs/removed") return "nav.songsRemoved";
  if (songListPath.value === "/songs/other") return "nav.songsOther";
  return "nav.songsAvailable";
});

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
        version: "実装バージョン",
        artists: "作曲 / 歌唱",
        radar: "六次元レーダー",
        radarAria: "六次元レーダーチャート",
        radarRange: "座標範囲",
        radarLevel: "レベル",
        radarEmpty: "この楽曲 ID に対応する六次元データはありません"
      }
    : {
        detailTitle: "歌曲详情",
        errorTitle: "歌曲不存在或加载失败",
        errorSubtitle: "请返回歌曲列表后重试。",
        backToList: "返回歌曲列表",
        back: "← 返回列表",
        releaseDate: "发布日期",
        subtitle: "副标题",
        version: "实装版本",
        artists: "作曲/演唱",
        radar: "六维雷达",
        radarAria: "六维雷达图",
        radarRange: "坐标范围",
        radarLevel: "层级",
        radarEmpty: "暂无该歌曲 ID 对应的六维数据"
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
  const catalogCombo = comboList?.[index];
  if (catalogCombo !== undefined && catalogCombo !== null && catalogCombo !== "") return String(catalogCombo);
  const analysis = songDetail.value.ratingEntries.find(item => Number(item.id) === songId.value && Number(item.level) === index + 1);
  return analysis?.combo === undefined || analysis.combo === null || analysis.combo === "" ? "—" : String(analysis.combo);
};

const fumenDefs = computed(() => {
  const base = [
    { key: "easy", label: t("songs.levels.easy"), folder: "Kantan" },
    { key: "normal", label: t("songs.levels.normal"), folder: "Futsuu" },
    { key: "hard", label: t("songs.levels.hard"), folder: "Muzukashii" },
    { key: "oni", label: t("songs.levels.oni"), folder: "Oni" }
  ];
  return hasEditDifficulty.value ? [...base, { key: "inner", label: t("songs.levels.edit"), folder: "InnerOni" }] : base;
});

const practiceDifficulty: Record<string, number> = { easy: 1, normal: 2, hard: 3, oni: 4, inner: 5 };

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

// Invalid EDIT deep links fall back to an available chart, including after route changes.
watch([hasEditDifficulty, selectedTrack], ([hasEdit, track]) => {
  if (!hasEdit && track === "EDIT") selectedTrack.value = "ONI";
}, { immediate: true });
const selectedFumen = computed(() => fumenDefs.value.find(item => practiceDifficulty[item.key] === selectedDifficultyCode.value));
const difficultyTabs = computed(() => trackDefs.value.map(track => ({ ...track, star: getTrackStarLabel(track.key) })));
const selectedAccountScores = computed(() => accountScores.value.items.filter(item => item.level === selectedDifficultyCode.value));
const titleParts = computed(() => {
  const full = getSongPrimaryTitle(song.value), suffix = full.match(/\([^()]*\)$/)?.[0] || "";
  return { name: suffix ? full.slice(0, -suffix.length) : full, suffix };
});
// Match the existing song-list taxonomy without changing catalog values.
const songCategory = computed(() => {
  const category = song.value?.type || "";
  const japaneseLabels: Record<string, string> = {
    南梦宫原创音乐: "ナムコオリジナル", 流行音乐: "ポップス", 儿童音乐: "キッズ", 古典音乐: "クラシック",
    综合音乐: "バラエティ", 游戏音乐: "ゲームミュージック", 博歌乐音乐: "ボーカロイド", 动漫音乐: "アニメ"
  };
  return locale.value === "ja" ? japaneseLabels[category] || category : category;
});
const sectionCopy = computed(() => locale.value === "ja" ? {
  analysis: "譜面の特徴と分析", info: "楽曲情報", personal: "自分の成績", empty: "この譜面の成績はまだ同期されていません", signIn: "ログインして、この譜面の成績を確認できます。", login: "ログイン", allScores: "すべての成績 →", volume: "打音の音量"
} : { analysis: "谱面特征与分析", info: "歌曲资料", personal: "我的成绩", empty: "这张谱面还没有同步到成绩记录", signIn: "登录后查看这张谱面的成绩。", login: "登录", allScores: "全部成绩 →", volume: "鼓点音量" });

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
    <el-card v-if="pending" class="panel-card"><el-skeleton :rows="8" animated /></el-card>
    <el-card v-else-if="error || !song" class="panel-card">
      <el-result icon="error" :title="copy.errorTitle" :sub-title="copy.errorSubtitle"><template #extra><NuxtLink :to="localePath(songListPath)"><el-button type="primary">{{ copy.backToList }}</el-button></NuxtLink></template></el-result>
    </el-card>
    <template v-else>
      <NuxtLink class="back-link" :to="localePath(songListPath)">{{ copy.back }}</NuxtLink>
      <header class="song-heading">
        <SongCoverImage :song-id="song.id" :alt="getSongPrimaryTitle(song)" sizes="(max-width: 767px) 80px, 112px" fit="contain" priority class="cover-image" @error="coverError = true" />
        <div class="song-title-group">
          <p class="song-category">{{ songCategory }}</p>
          <h1>{{ titleParts.name }}<wbr v-if="titleParts.suffix"><span class="song-title-version">{{ titleParts.suffix }}</span></h1>
        </div>
        <p class="secondary-title" :lang="locale === 'ja' ? 'zh-CN' : 'ja'">{{ getSongSecondaryTitle(song) }}</p>
        <div class="song-meta"><span>BPM {{ song.bpm || '—' }}</span><span>ID {{ song.id }}</span><span>{{ copy.releaseDate }} {{ song.open_day || '—' }}</span></div>
      </header>

      <SongDifficultyTabs v-model="selectedTrack" :tracks="difficultyTabs" />

      <div class="song-reading-layout">
        <div class="song-main-column">
          <SongChartPreview v-if="selectedFumen" :song-id="songId" :song-title="getSongPrimaryTitle(song)" :difficulty="selectedDifficultyCode" :track="selectedTrack" :label="selectedFumen.label" :star="getFumenStarLabel(selectedFumen.key)" :combo="getFumenComboLabel(selectedFumen.key)" :folder="selectedFumen.folder" :tja-bundle-url="tjaBundleUrl">
            <SongAudioPreview :song-id="songId" :selected-track="selectedTrack" :branch-variants="branchAudioVariants" />
          </SongChartPreview>

          <details class="song-analysis">
            <summary>{{ sectionCopy.analysis }}</summary>
            <SongV2Constants v-if="normalizedShelfStatus(song.shelf_status) === 2" :key="songId" :song-id="songId" :track="selectedTrack" />
          <div v-if="normalizedShelfStatus(song.shelf_status) !== 2 || hasRadarData" class="radar-card">
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
              <svg class="radar-chart" viewBox="-48 0 356 260" role="img" :aria-label="copy.radarAria">
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
          </details>
          <details class="song-information">
            <summary>{{ sectionCopy.info }}</summary>
            <dl class="song-facts"><div><dt>{{ copy.subtitle }}</dt><dd>{{ song.subtitle || '—' }}</dd></div><div><dt>{{ copy.version }}</dt><dd>{{ formatList(song.version) }}</dd></div><div><dt>{{ copy.artists }}</dt><dd>{{ formatList(song.artists) }}</dd></div></dl>
          </details>
        </div>

        <aside class="song-reading-rail">
          <div class="song-personal">
            <AccountSongScores v-if="accountUser" :items="selectedAccountScores" :pending="accountScoresPending" :unavailable="accountScores.unavailable" :empty-text="sectionCopy.empty" appearance="song-detail">
              <template #heading-action><NuxtLink class="all-scores-link" :to="localePath('/account/songs')">{{ sectionCopy.allScores }}</NuxtLink></template>
            </AccountSongScores>
            <section v-else class="song-sign-in"><h2>{{ sectionCopy.personal }}</h2><p>{{ sectionCopy.signIn }}</p><button type="button" class="song-login" @click="goToChartUgcLogin">{{ sectionCopy.login }}</button></section>
            <RecommendationGoalAction v-if="accountUser && typeof route.query.recommendation === 'string' && selectedDifficultyCode === Number(route.query.difficulty)" :key="route.query.recommendation" :token="route.query.recommendation" :song-id="songId" :difficulty-type="selectedDifficultyCode" />
          </div>
          <ForumSongRelatedDiscussions :key="`${songId}-${selectedDifficultyCode}`" :song-id="songId" :difficulty-type="selectedDifficultyCode" appearance="song-detail" />
        </aside>
      </div>
      <div class="song-community">
      <ChartUgcSection
        v-if="chartUgcSummary"
        appearance="song-detail"
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
      </div>
    </template>
  </div>
</template>

<style scoped>
.song-detail-page {
  --el-bg-color:var(--song-paper);--el-text-color-primary:var(--song-ink);--el-border-color:var(--song-control);
  padding:8px 0 32px; color:var(--song-ink); min-width:0;
}
.back-link{display:inline-flex;align-items:center;min-height:44px;margin-bottom:18px;color:var(--song-link);font-size:14px;text-decoration:none;}
.song-heading{display:grid;grid-template-columns:112px minmax(0,1fr);gap:0 26px;align-items:center;}
.cover-image{width:112px;height:112px;grid-row:1/4;border-radius:10px;overflow:hidden;background:var(--song-paper);}
.song-title-group{min-width:0;}
.song-category{margin:0 0 8px;color:var(--song-muted);font-size:14px;}
h1{font-size:30px;line-height:1.4;font-weight:600;letter-spacing:-.015em;margin:0;overflow-wrap:anywhere;}
.song-title-version{white-space:nowrap;}
.secondary-title{font-size:15px;line-height:1.7;color:var(--song-muted);margin:8px 0 0;overflow-wrap:anywhere;grid-column:2;}
.secondary-title:lang(zh-CN){font-family:var(--song-zh-font);}
.secondary-title:lang(ja){font-family:var(--song-ja-font);}
.song-meta{display:flex;flex-wrap:wrap;gap:8px 22px;margin-top:12px;font-size:14px;line-height:1.6;color:var(--song-muted);}
.song-reading-layout{display:grid;grid-template-columns:minmax(0,1fr) 264px;gap:40px;align-items:start;}
.song-main-column{min-width:0;}
.song-reading-rail{display:grid;gap:36px;min-width:0;align-content:start;}
.song-personal{min-width:0;background:var(--song-paper);padding:22px 24px 12px;border-radius:14px;}
.all-scores-link{display:inline-flex;align-items:center;min-height:44px;color:var(--song-link);font-size:14px;text-decoration:none;}
.song-sign-in h2{font-size:18px;line-height:1.5;margin:0 0 16px;font-weight:600;}.song-sign-in p{font-size:15px;line-height:1.7;color:var(--song-muted);margin:0 0 12px;}
.song-login{min-height:44px;padding:9px 16px;border:1px solid var(--song-control);border-radius:7px;color:var(--song-ink);background:var(--song-paper);font:inherit;font-size:15px;cursor:pointer;}
.song-personal :deep(.recommendation-goal-action){margin-top:18px;}
.song-analysis,.song-information{padding:0;margin-top:8px;}
summary{display:list-item;min-height:48px;align-content:center;cursor:pointer;font-size:15px;color:var(--song-ink);}
.song-analysis[open],.song-information[open]{padding-bottom:24px;}
.song-facts{font-size:14px;display:grid;gap:16px;margin:18px 0 0;}.song-facts>div{display:grid;grid-template-columns:100px minmax(0,1fr);gap:16px;}.song-facts dt{color:var(--song-muted);}.song-facts dd{margin:0;overflow-wrap:anywhere;}
.radar-card{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0 24px;margin-top:16px;}
.section-title{grid-column:1/-1;display:flex;gap:8px;align-items:center;font-size:17px;font-weight:600;margin-bottom:14px;}.title-icon{display:none;}
.radar-chart{width:100%;max-width:356px;display:block;grid-row:2/5;}.radar-grid{fill:none;stroke:var(--song-rule);stroke-width:1;}.radar-axis{stroke:var(--song-rule);stroke-width:1;}.radar-area{fill:#007c8622;stroke:var(--song-link);stroke-width:1.8;}.radar-point{fill:var(--song-link);}.radar-label{font-size:14px;fill:var(--song-muted);}
.radar-meta{display:flex;flex-wrap:wrap;gap:8px 18px;font-size:14px;color:var(--song-muted);}.radar-values{margin:16px 0 0;padding:0;list-style:none;display:grid;gap:10px;font-size:14px;}.radar-values li{display:flex;justify-content:space-between;gap:12px;}.radar-values strong{font-weight:500;}.radar-empty{grid-column:1/-1;font-size:14px;color:var(--song-muted);}.radar-empty-image{display:none;}
.song-community{margin-top:36px;}
.back-link:focus-visible,.all-scores-link:focus-visible,summary:focus-visible,.song-login:focus-visible{outline:3px solid var(--song-link);outline-offset:3px;}
@media(max-width:1190px){.song-reading-layout{grid-template-columns:minmax(0,1fr);gap:32px}.song-reading-rail{grid-template-columns:repeat(2,minmax(0,1fr));gap:36px}.song-heading h1{font-size:28px}}
@media(max-width:960px){.back-link{display:none;}}
@media(max-width:767px){
 .song-detail-page{padding:0 0 24px;}
 .song-heading{grid-template-columns:80px minmax(0,1fr);gap:0 16px;align-items:center;}
 .cover-image{width:80px;height:80px;grid-row:1;}
 .song-category{font-size:14px;margin-bottom:6px;line-height:1.5;}
 .song-heading h1{font-size:22px;line-height:1.4;}
 .secondary-title{grid-column:1/-1;font-size:14px;line-height:1.7;margin-top:16px;}
 .song-meta{grid-column:1/-1;font-size:14px;gap:6px 16px;margin-top:10px;}
 .song-reading-rail{grid-template-columns:1fr;gap:24px;}
 .song-reading-layout{gap:24px;}
 .song-personal{padding:20px 20px 12px;}
 .song-analysis,.song-information{margin-top:4px;}
 .radar-card{grid-template-columns:1fr;gap:16px;}.radar-chart{grid-row:auto;margin:auto;}.radar-meta{grid-column:1;}.radar-values{margin:0;}
 .song-facts>div{grid-template-columns:80px minmax(0,1fr);gap:12px;}
 .song-community{margin-top:32px;}
}
</style>
