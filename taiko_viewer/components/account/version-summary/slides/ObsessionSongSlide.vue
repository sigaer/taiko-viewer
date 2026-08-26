<script setup lang="ts">
import { computed } from "vue";
import AnnualObsessionGreenEchoScene from "../AnnualObsessionGreenEchoScene.vue";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import { hasUsableText } from "~/utils/annualPresentation";

const props = defineProps<{
  summary: VersionSummaryViewModel;
  pageIndex: number;
  pageTotal: number;
  active: boolean;
  reducedMotion: boolean;
}>();

const formatter = new Intl.NumberFormat("zh-CN");
const song = computed(() => props.summary.obsessionSong);

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
const songName = computed(() => safeText(song.value?.name, "这首歌"));
const coverUrl = computed(() => safeCoverUrl(song.value?.coverUrl));
</script>

<template>
  <AnnualObsessionGreenEchoScene
    :active="active"
    :reduced-motion="reducedMotion"
    :active-days-text="activeDaysText"
    :play-count-text="playCountText"
    :song-name="songName"
    :cover-url="coverUrl"
  />
</template>
