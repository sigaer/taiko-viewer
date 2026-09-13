<script setup lang="ts">
import { computed } from "vue";
import AnnualObsessionGreenEchoScene from "../AnnualObsessionGreenEchoScene.vue";
import { narrativeKey, selectNarrative } from "~/utils/annualNarrative";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import { hasUsableText } from "~/utils/annualPresentation";

const props = defineProps<{
  summary: VersionSummaryViewModel;
  pageIndex: number;
  pageTotal: number;
  active: boolean;
  reducedMotion: boolean;
}>();

const { t } = useI18n();
const formatter = new Intl.NumberFormat("zh-CN");
const song = computed(() => props.summary.obsessionSong);
// How often this one song kept coming back picks the closing couplet.
const narrative = computed(() => selectNarrative("obsession", props.summary));
const narrativeCopy = computed(() => ({
  closing1: t(narrativeKey("obsession", narrative.value, "closing1")),
  closing2: t(narrativeKey("obsession", narrative.value, "closing2"))
}));

const safeMetric = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric)) : 0;
};
const safeText = (value: unknown, fallback: string) => hasUsableText(value)
  && !["undefined", "null", "nan"].includes(value.trim().toLowerCase())
  ? value.trim()
  : fallback;
const safeCoverUrl = (value: unknown) => safeText(value, "")
  && !["undefined", "null"].includes(String(value).trim().toLowerCase())
  ? String(value).trim()
  : "";

const activeDaysText = computed(() => formatter.format(safeMetric(song.value?.activeDays)));
const playCountText = computed(() => formatter.format(safeMetric(song.value?.playCount)));
const songName = computed(() => safeText(song.value?.name, t("annualSummary.slides.obsession.unknownSong")));
const coverUrl = computed(() => safeCoverUrl(song.value?.coverUrl));

const headlineDaysSuffix = computed(() => t("annualSummary.slides.obsession.headlineDaysSuffix"));
const sceneLabel = computed(() => t("annualSummary.slides.obsession.sceneLabel", {
  days: activeDaysText.value,
  plays: playCountText.value,
  song: songName.value
}));
</script>

<template>
  <AnnualObsessionGreenEchoScene
    :active="active"
    :reduced-motion="reducedMotion"
    :headline-days-text="activeDaysText"
    :headline-days-suffix="headlineDaysSuffix"
    :headline-plays-before="t('annualSummary.slides.obsession.headlinePlaysBefore')"
    :headline-plays-after="t('annualSummary.slides.obsession.headlinePlaysAfter')"
    :closing1="narrativeCopy.closing1"
    :closing2="narrativeCopy.closing2"
    :scene-label="sceneLabel"
    :play-count-text="playCountText"
    :song-name="songName"
    :cover-url="coverUrl"
  />
</template>
