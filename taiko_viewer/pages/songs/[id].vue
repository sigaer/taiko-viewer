<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { AccountSongScoresPayload } from "~/types/account-song";
import type { RatingContentItem, SongCatalogItem, V2ConstantsItem } from "~/types/content";
import type { ChartDifficultyCode } from "~/types/ugc";
import { buildPageDescription } from "~/utils/seo";
import { buildSongCoverThumbnailUrl } from "~/utils/songCover";
import { catalogLocation, detailFallbackShelf, locationHref } from "~/utils/rework/catalog";

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
const selectedSide = ref<'single' | 'p1' | 'p2'>('single');
// The page is kept alive per song (its key includes the id), so an instance stays on its own song and only follows
// the address while that address is its own: other routes (another song, any page) must not refetch or rewrite it.
const instanceSongId = Number(route.params.id);
const songId = computed(() => instanceSongId);
const isOwnRoute = () => Number(route.params.id) === instanceSongId;
watch(() => route.query.difficulty, value => { if (isOwnRoute()) selectedTrack.value = levelTrackMap[Number(value) as ChartDifficultyCode] || "ONI"; });
const selectedDifficultyCode = computed(() => trackLevelMap[selectedTrack.value] || 4);
const apiFetch = useViewerApiFetch();
const { accountUser, resolveAccountUser } = useAccountAuthStatus();

definePageMeta({
  contentLayout: "wide",
  pageTitleKey: "songs.detail",
  pageDescKey: "page.songs.detail.desc",
  navKey: "/songs",
  hidePageHeader: true,
});

const [songDetailState, chartUgcState] = await Promise.all([
  useSongDetail(songId),
  useChartUgc(songId, selectedDifficultyCode)
]);
const { data: songDetail, pending, error, refresh: refreshSongDetail } = songDetailState;
if (songDetail.value.song && Number(songDetail.value.song.id) !== songId.value) {
  await navigateTo(localePath({ path: `/songs/${songDetail.value.song.id}`, query: route.query }), { redirectCode: 301, replace: true });
}
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
// V2 constants of every chart of the song (was fetched inside SongV2Constants.vue; same request and key). The page
// owns it now so the difficulty tabs show each chart's constant.
const { data: v2Constants, pending: v2Pending, error: v2Error, refresh: refreshV2Constants } = useLazyAsyncData(
  () => `song-v2-constants-${songId.value}`,
  () => apiFetch<{ items: V2ConstantsItem[] }>(`/api/content/songs/${songId.value}/v2`),
  { default: () => ({ items: [] }), watch: [songId] }
);
const v2Chart = (track: string) => v2Constants.value.items.find((item) => item.difficulty === track.toLowerCase());
const branchAudioVariants = computed(() => songDetail.value.branchAudioVariants || {});
const tjaBundleUrl = computed(() => songDetail.value.tjaBundleUrl || "");
const normalizedShelfStatus = (value: SongCatalogItem["shelf_status"]) => {
  if (value === undefined || value === null || value === "") return 0;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};
const songListShelf = computed(() => detailFallbackShelf(route.query.list, song.value?.shelf_status));
const songListPath = computed(() => locationHref(catalogLocation({ shelf: songListShelf.value })));
// "Back to list" returns to the library state this tab came from; otherwise the song's shelf.
const songListReturn = useLibraryReturn(() => localePath(songListPath.value));
const songListLabelKey = computed(() => {
  if (songListShelf.value === "removed") return "nav.songsRemoved";
  if (songListShelf.value === "other") return "nav.songsOther";
  return "nav.songsAvailable";
});

// The address names the song shelf (list=removed / list=other) when it does not already name one, so the shell back
// button and the breadcrumb, which only see the address, return to that shelf (slice G added "other": without a
// remembered library location an "other" song used to go back to /songs).
watch(
  () => [song.value?.shelf_status, route.query.list] as const,
  async ([shelfStatus, listQuery]) => {
    if (!song.value || !isOwnRoute() || listQuery === "removed" || listQuery === "available") return;
    const status = normalizedShelfStatus(shelfStatus);
    const list = status === 1 ? "removed" : status === 2 && listQuery !== "other" ? "other" : null;
    if (!list) return;
    await navigateTo(
      {
        path: route.path,
        query: { ...route.query, list }
      },
      { replace: true }
    );
  },
  { immediate: true }
);
const getSongPrimaryTitle = (target: SongCatalogItem | null) =>
  target ? (locale.value === "ja" && target.song_name_jp ? target.song_name_jp : target.song_name) : "";
// SEO title only; the visible copy is in rework.songDetail.*.
const copy = computed(() => ({ detailTitle: t("songs.detail") }));

const coverUrl = computed(() => {
  const id = coverError.value || !song.value ? coverFallbackId : song.value.id;
  return buildSongCoverThumbnailUrl(id, 400);
});

const hasEditDifficulty = computed(() => {
  const value = song.value?.level_5;
  return Number(value) > 0 || Boolean(song.value?.ourtaiko_difficulties?.some(row => row.difficulty === 5 && row.side !== 'single'));
});

const availableSides = computed(() => {
  const rows = song.value?.ourtaiko_difficulties?.filter(row => row.difficulty === selectedDifficultyCode.value) || [];
  const sides = new Set<'single' | 'p1' | 'p2'>(rows.filter(row => row.side !== 'single').map(row => row.side));
  if (Number(song.value?.[`level_${selectedDifficultyCode.value}` as keyof SongCatalogItem]) > 0) sides.add('single');
  return (['single', 'p1', 'p2'] as const).filter(side => sides.has(side));
});
const trackDefs = computed(() => {
  const base = [
    { key: "EASY", label: t("songs.levels.easy") },
    { key: "NORMAL", label: t("songs.levels.normal") },
    { key: "HARD", label: t("songs.levels.hard") },
    { key: "ONI", label: t("songs.levels.oni") }
  ];
  const tracks = hasEditDifficulty.value ? [...base, { key: "EDIT", label: t("songs.levels.edit") }] : base;
  const rows = song.value?.ourtaiko_difficulties || [];
  return rows.length ? tracks.filter(track => rows.some(row => row.difficulty === trackLevelMap[track.key] && row.side !== 'single')
    || Number(song.value?.[`level_${trackLevelMap[track.key]}` as keyof SongCatalogItem]) > 0) : tracks;
});
watch(trackDefs, tracks => {
  if (tracks.length && !tracks.some(track => track.key === selectedTrack.value)) selectedTrack.value = tracks.at(-1)!.key;
}, { immediate: true });
watch(availableSides, sides => {
  if (!sides.length) { selectedSide.value = 'single'; return; }
  if (!sides.includes(selectedSide.value)) selectedSide.value = sides.includes('single') ? 'single' : sides[0]!;
}, { immediate: true });

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

/** Star value of a track for the selected side (raw, as the catalog has it). */
const getTrackStar = (key: string) => selectedSide.value === 'single'
  ? levelMap.value[key as keyof typeof levelMap.value]
  : song.value?.ourtaiko_difficulties?.find(row => row.difficulty === trackLevelMap[key] && row.side === selectedSide.value)?.level;
const getTrackStarLabel = (key: string) => formatStar(getTrackStar(key));

const fumenKeyMap: Record<string, keyof typeof levelMap.value> = {
  easy: "EASY",
  normal: "NORMAL",
  hard: "HARD",
  oni: "ONI",
  inner: "EDIT"
};

const getFumenStarLabel = (key: string) => getTrackStarLabel(fumenKeyMap[key]);

const comboIndexMap: Record<string, number> = {
  easy: 0,
  normal: 1,
  hard: 2,
  oni: 3,
  inner: 4
};

const getFumenComboLabel = (key: string) => {
  if (selectedSide.value !== 'single') return '—';
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
const radarLabelKeys = ["complex", "avgDensity", "peakDensity", "rhythm", "bpm", "hs"] as const;
const radarLabels = computed(() => radarLabelKeys.map((key) => t(`rework.songDetail.shape.axes.${key}`)));

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
// The six values on the shared DS radar (same values, same 0 – radarMax range as before).
const radarAxes = computed(() => radarLabelKeys.map((key, index) => ({ key, label: radarLabels.value[index]!, value: radarValues.value[index]! })));

// Invalid EDIT deep links fall back to an available chart, including after route changes.
watch([hasEditDifficulty, selectedTrack], ([hasEdit, track]) => {
  if (!hasEdit && track === "EDIT") selectedTrack.value = "ONI";
}, { immediate: true });
const selectedFumen = computed(() => fumenDefs.value.find(item => practiceDifficulty[item.key] === selectedDifficultyCode.value));
// DsDiffTabs: one entry per available chart — star for the selected side, V2 constant where the source has one.
const difficultyTabs = computed(() => trackDefs.value.map(track => ({
  difficulty: trackLevelMap[track.key]!,
  star: getTrackStar(track.key) ?? null,
  constant: v2Chart(track.key)?.mainConstant ?? null
})));
const selectDifficulty = (difficulty: number) => {
  const track = levelTrackMap[difficulty as ChartDifficultyCode];
  if (track) selectedTrack.value = track;
};
const selectedAccountScores = computed(() => accountScores.value.items.filter(item => item.level === selectedDifficultyCode.value));
const rtCalculatorTo = computed(() => localePath({ path: "/tools/rt-calculator", query: { songId: String(songId.value), level: String(selectedDifficultyCode.value) } }));
const detailState = computed(() => (pending.value ? "loading" : error.value ? "failed" : !song.value ? "missing" : "ready"));
const loginRedirect = computed(() => `${localePath(`/songs/${songId.value}`)}?difficulty=${selectedDifficultyCode.value}`);
const showRecommendationGoal = computed(() =>
  Boolean(accountUser.value) && typeof route.query.recommendation === 'string' && selectedDifficultyCode.value === Number(route.query.difficulty)
);

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
  <ReworkSongDetailFrame
    :state="detailState"
    :back-href="songListReturn"
    panel-id="song-chart-workspace"
    :tab-id="`song-chart-workspace-tab-${selectedDifficultyCode}`"
    @retry="refreshSongDetail()"
  >
    <template #head>
      <ReworkSongDetailHead v-if="song" :song="song">
        <template #actions>
          <ReworkSongActions :song-id="songId" :difficulty="selectedDifficultyCode" :side="selectedSide" :tja-bundle-url="tjaBundleUrl" />
        </template>
      </ReworkSongDetailHead>
    </template>
    <template #tabs>
      <DsDiffTabs :charts="difficultyTabs" :model-value="selectedDifficultyCode" controls="song-chart-workspace" size="lg" @update:model-value="selectDifficulty" />
    </template>
    <template #side>
      <ReworkSongMyScore
        :items="accountScores.items"
        :difficulty="selectedDifficultyCode"
        :star="getTrackStar(selectedTrack) ?? null"
        :constant="v2Chart(selectedTrack)?.mainConstant ?? null"
        :signed-in="Boolean(accountUser)"
        :pending="accountScoresPending"
        :unavailable="Boolean(accountScores.unavailable)"
        :redirect="loginRedirect"
        @select="selectDifficulty"
      >
        <RecommendationGoalAction
          v-if="showRecommendationGoal"
          :key="String(route.query.recommendation)"
          :token="String(route.query.recommendation)"
          :song-id="songId"
          :difficulty-type="selectedDifficultyCode"
        />
      </ReworkSongMyScore>
    </template>

    <ReworkSongChartSection
      v-if="song"
      v-model:side="selectedSide"
      :song-id="songId"
      :song-title="getSongPrimaryTitle(song)"
      :difficulty="selectedDifficultyCode"
      :track="selectedTrack"
      :sides="availableSides"
      :label="selectedFumen?.label || ''"
      :star-label="getTrackStarLabel(selectedTrack)"
      :combo-label="selectedFumen ? getFumenComboLabel(selectedFumen.key) : '—'"
      :branch-variants="branchAudioVariants"
    />
    <ReworkSongDataSection
      v-if="song"
      :key="songId"
      :track="selectedTrack"
      :chart="v2Chart(selectedTrack)"
      :pending="v2Pending"
      :failed="Boolean(v2Error)"
      :rt-to="rtCalculatorTo"
      :show-shape="normalizedShelfStatus(song.shelf_status) !== 2 || hasRadarData"
      :shape-axes="hasRadarData ? radarAxes : []"
      :shape-max="radarMax"
      :shape-level="selectedRating?.level ?? null"
      @retry="refreshV2Constants()"
    />
    <template #aside>
      <ReworkSongChartUgc
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
      <ReworkSongDiscussions :key="`${songId}-${selectedDifficultyCode}`" :song-id="songId" :difficulty-type="selectedDifficultyCode" />
    </template>
    <template v-if="song" #dock>
      <ReworkSongActions variant="dock" :song-id="songId" :difficulty="selectedDifficultyCode" :side="selectedSide" :tja-bundle-url="tjaBundleUrl" />
    </template>
  </ReworkSongDetailFrame>
</template>
