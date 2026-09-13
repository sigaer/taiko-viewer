<script setup lang="ts">
import { computed } from "vue";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import AnnualArtworkFallback from "../AnnualArtworkFallback.vue";
import AnnualFavoriteShiftGinkgoScene from "../AnnualFavoriteShiftGinkgoScene.vue";
import { hasUsableText, isUsableMetric } from "~/utils/annualPresentation";
import { narrativeKey, selectNarrative } from "~/utils/annualNarrative";

const props = defineProps<{
  summary: VersionSummaryViewModel;
  pageIndex: number;
  pageTotal: number;
  active: boolean;
  reducedMotion: boolean;
}>();

const { t } = useI18n();
const formatter = new Intl.NumberFormat("zh-CN");
const favoriteShift = computed(() => props.summary.favoriteShift);
// Which of the two songs holds the larger share of the anchors decides the closing pair.
const narrative = computed(() => selectNarrative("favoriteShift", props.summary));
const narrativeCopy = computed(() => ({
  line1: t(narrativeKey("favoriteShift", narrative.value, "line1")),
  line2: t(narrativeKey("favoriteShift", narrative.value, "line2"))
}));
const shiftLabels = computed(() => ({
  oldLabel: t("annualSummary.slides.shift.oldLabel"),
  newLabel: t("annualSummary.slides.shift.newLabel"),
  timesColon: t("annualSummary.slides.shift.timesColon"),
  timesUnit: t("annualSummary.slides.shift.timesUnit"),
  newTimesPrefix: t("annualSummary.slides.shift.newTimesPrefix"),
  newTimesSuffix: t("annualSummary.slides.shift.newTimesSuffix"),
  sceneLabel: t("annualSummary.slides.shift.sceneLabel")
}));
const safeSongName = (value: unknown) => hasUsableText(value)
  && !["undefined", "null", "nan"].includes(value.trim().toLowerCase())
  ? value.trim()
  : t("annualSummary.slides.shift.unknownSong");
const safeCoverUrl = (value: unknown) => hasUsableText(value)
  && !["undefined", "null"].includes(value.trim().toLowerCase())
  ? value.trim()
  : "";
const formatPlayCount = (value: unknown) => isUsableMetric(value)
  ? formatter.format(Math.round(value))
  : "";

const oldSongName = computed(() => safeSongName(favoriteShift.value?.oldFavorite.name));
const newSongName = computed(() => safeSongName(favoriteShift.value?.newFavorite.name));
const oldCoverUrl = computed(() => safeCoverUrl(favoriteShift.value?.oldFavorite.coverUrl));
const newCoverUrl = computed(() => safeCoverUrl(favoriteShift.value?.newFavorite.coverUrl));
const oldPlayCountText = computed(() => formatPlayCount(favoriteShift.value?.oldFavorite.playCount));
const newPlayCountText = computed(() => formatPlayCount(favoriteShift.value?.newFavorite.playCount));
</script>

<template>
  <AnnualFavoriteShiftGinkgoScene
    v-if="favoriteShift"
    :active="active"
    :reduced-motion="reducedMotion"
    :old-song-name="oldSongName"
    :old-play-count-text="oldPlayCountText"
    :new-song-name="newSongName"
    :new-play-count-text="newPlayCountText"
    :line1="narrativeCopy.line1"
    :line2="narrativeCopy.line2"
    :labels="shiftLabels"
  >
    <template #oldCover>
      <el-image v-if="oldCoverUrl" :src="oldCoverUrl" :alt="oldSongName" fit="cover">
        <template #error>
          <AnnualArtworkFallback :label="t('annualSummary.common.songCover')" />
        </template>
      </el-image>
      <AnnualArtworkFallback v-else :label="t('annualSummary.common.songCover')" />
    </template>

    <template #newCover>
      <el-image v-if="newCoverUrl" :src="newCoverUrl" :alt="newSongName" fit="cover">
        <template #error>
          <AnnualArtworkFallback :label="t('annualSummary.common.songCover')" />
        </template>
      </el-image>
      <AnnualArtworkFallback v-else :label="t('annualSummary.common.songCover')" />
    </template>
  </AnnualFavoriteShiftGinkgoScene>
</template>
