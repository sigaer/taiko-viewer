<script setup lang="ts">
import { computed } from "vue";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import AnnualArtworkFallback from "../AnnualArtworkFallback.vue";
import AnnualLateNightFireworksScene from "../AnnualLateNightFireworksScene.vue";
import { narrativeKey, selectNarrative } from "~/utils/annualNarrative";
import { hasUsableText, isUsableMetric } from "~/utils/annualPresentation";

const { t } = useI18n();
const props = defineProps<{
  summary: VersionSummaryViewModel;
  pageIndex: number;
  pageTotal: number;
  active: boolean;
  reducedMotion: boolean;
}>();

const formatter = new Intl.NumberFormat("zh-CN");
const lateNight = computed(() => props.summary.lateNight);
const safeLatestLabel = computed(() => {
  const value = lateNight.value?.latestLabel;
  return hasUsableText(value) && value.trim() !== "—" && !["undefined", "null"].includes(value.trim().toLowerCase())
    ? value.trim()
    : t("annualSummary.slides.late.unknownTime");
});
const safeSongName = computed(() => {
  const value = lateNight.value?.song?.name;
  return hasUsableText(value) && !["undefined", "null"].includes(value.trim().toLowerCase())
    ? value.trim()
    : t("annualSummary.slides.late.unknownSong");
});
const safeCoverUrl = computed(() => {
  const value = lateNight.value?.song?.coverUrl;
  return hasUsableText(value) && !["undefined", "null"].includes(value.trim().toLowerCase()) ? value.trim() : "";
});
const activeDaysText = computed(() => isUsableMetric(lateNight.value?.activeDays)
  ? formatter.format(Math.round(lateNight.value!.activeDays))
  : "");
const playCountText = computed(() => isUsableMetric(lateNight.value?.playCount)
  ? formatter.format(Math.round(lateNight.value!.playCount))
  : "");
// How often the year reached into the small hours picks the closing line.
const narrative = computed(() => selectNarrative("lateNight", props.summary));
const narrativeLine = computed(() => t(narrativeKey("lateNight", narrative.value, "line")));
</script>

<template>
  <AnnualLateNightFireworksScene
    v-if="summary.lateNight"
    :active="active"
    :reduced-motion="reducedMotion"
    :line="narrativeLine"
    :nights-before="t('annualSummary.slides.late.nightsBefore')"
    :nights-after="t('annualSummary.slides.late.nightsAfter')"
    :plays-before="t('annualSummary.slides.late.playsBefore')"
    :plays-after="t('annualSummary.slides.late.playsAfter')"
    :latest-label="safeLatestLabel"
    :song-name="safeSongName"
    :active-days-text="activeDaysText"
    :play-count-text="playCountText"
  >
    <template #cover>
      <el-image v-if="safeCoverUrl" :src="safeCoverUrl" fit="cover">
        <template #error>
          <AnnualArtworkFallback :label="t('annualSummary.common.songCover')" />
        </template>
      </el-image>
      <AnnualArtworkFallback v-else :label="t('annualSummary.common.songCover')" />
    </template>
  </AnnualLateNightFireworksScene>
</template>
