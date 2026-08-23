<script setup lang="ts">
import { computed } from "vue";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import AnnualArtworkFallback from "../AnnualArtworkFallback.vue";
import AnnualLateNightFireworksScene from "../AnnualLateNightFireworksScene.vue";
import { hasUsableText, isUsableMetric } from "~/utils/annualPresentation";

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
    : "某个深夜";
});
const safeSongName = computed(() => {
  const value = lateNight.value?.song?.name;
  return hasUsableText(value) && !["undefined", "null"].includes(value.trim().toLowerCase())
    ? value.trim()
    : "这首歌";
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
</script>

<template>
  <AnnualLateNightFireworksScene
    v-if="summary.lateNight"
    :active="active"
    :reduced-motion="reducedMotion"
    :latest-label="safeLatestLabel"
    :song-name="safeSongName"
    :active-days-text="activeDaysText"
    :play-count-text="playCountText"
  >
    <template #cover>
      <el-image v-if="safeCoverUrl" :src="safeCoverUrl" fit="cover">
        <template #error>
          <AnnualArtworkFallback label="歌曲封面" />
        </template>
      </el-image>
      <AnnualArtworkFallback v-else label="歌曲封面" />
    </template>
  </AnnualLateNightFireworksScene>
</template>
