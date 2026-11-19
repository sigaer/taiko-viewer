<script setup lang="ts">
// "Chart" section of the song detail page: single / P1 / P2 switch (only when the chart has P1 / P2 variants),
// difficulty and star, max notes, the practice player and TJA+OGG download (only with a TJA bundle), the full chart
// image, the excerpt and the audio preview.
import type { PropType } from "vue";
import type { SongBranchAudioVariants } from "~/types/content";
import { chartImageUrl } from "./ChartSheet.vue";

type Side = "single" | "p1" | "p2";
defineProps({
  songId: { type: Number, required: true },
  songTitle: { type: String, required: true },
  difficulty: { type: Number, required: true },
  track: { type: String, required: true },
  sides: { type: Array as PropType<readonly Side[]>, required: true },
  label: { type: String, default: "" },
  starLabel: { type: String, required: true },
  comboLabel: { type: String, required: true },
  tjaBundleUrl: { type: String, default: "" },
  branchVariants: { type: Object as PropType<SongBranchAudioVariants>, required: true }
});
const side = defineModel<Side>("side", { required: true });
const { t } = useI18n();
const localePath = useLocalePath();
const sideLabel = (value: Side) => (value === "single" ? t("rework.songDetail.side.single") : value.toUpperCase());
</script>

<template>
  <ReworkPanel plain class="chart" :title="t('rework.songDetail.chart.title')">
    <template v-if="sides.some((value) => value !== 'single')" #actions>
      <div class="seg" role="group" :aria-label="t('rework.songDetail.side.label')">
        <button v-for="value in sides" :key="value" type="button" :aria-pressed="side === value" @click="side = value">{{ sideLabel(value) }}</button>
      </div>
    </template>
    <div class="chart-bar">
      <p class="chart-id">
        <span>{{ label }} <b class="num">{{ starLabel }}</b></span>
        <span>{{ t("rework.songDetail.chart.notes") }} <b class="num">{{ comboLabel }}</b></span>
      </p>
      <div class="chart-actions">
        <NuxtLink v-if="tjaBundleUrl" class="rw-btn rw-btn--primary" :to="localePath(`/ourtaikoview/${songId}/${difficulty}`)" target="_blank" rel="noopener noreferrer">{{ t("rework.songDetail.chart.practice") }} ↗</NuxtLink>
        <a class="rw-btn" :href="chartImageUrl(songId, difficulty, side)" target="_blank" rel="noopener noreferrer">{{ t("rework.songDetail.chart.open") }} ↗</a>
        <a v-if="tjaBundleUrl" class="rw-btn rw-btn--ghost" :href="tjaBundleUrl">{{ t("rework.songDetail.chart.download") }}</a>
      </div>
    </div>
    <ReworkSongChartSheet v-if="label" :song-id="songId" :song-title="songTitle" :difficulty="difficulty" :side="side" :label="label" :star="starLabel" />
    <ReworkSongAudioPreview class="audio" :song-id="songId" :selected-track="track" :branch-variants="branchVariants" />
  </ReworkPanel>
</template>

<style scoped>
.seg {
  display: inline-flex;
  padding: 2px;
  border-radius: var(--r-ctl);
  background: var(--bg-sunk);
}
.seg button {
  min-width: var(--hit);
  min-height: var(--hit);
  padding: 0 var(--sp-3);
  border: 0;
  border-radius: calc(var(--r-ctl) - 2px);
  background: transparent;
  color: var(--ink-2);
  font: inherit;
  font-size: var(--fs-13);
  cursor: pointer;
}
.seg button[aria-pressed="true"] {
  background: var(--seg-on-bg);
  color: var(--seg-on-ink);
  font-weight: 700;
  box-shadow: 0 0 0 1px var(--seg-on-ring);
}
.seg button:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 1px;
}
.chart-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--sp-3) var(--sp-4);
  margin-bottom: var(--sp-3);
}
.chart-id {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--sp-1) var(--sp-5);
  margin: 0;
  font-size: var(--fs-14);
  color: var(--ink-2);
}
.chart-id b {
  font-size: var(--fs-16);
  color: var(--ink);
}
.chart-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}
.audio {
  margin-top: var(--sp-4);
}
</style>
