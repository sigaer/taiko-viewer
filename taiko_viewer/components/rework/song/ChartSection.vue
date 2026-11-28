<script setup lang="ts">
// "Chart" card of the song detail page: single / P1 / P2 switch (only when the chart has P1 / P2 variants),
// difficulty, star and max notes, the chart image excerpt (expandable) and the audio preview. The chart actions
// (practice player, full chart, TJA+OGG) are in the header card and, on phones, the bottom bar (ReworkSongActions).
import type { PropType } from "vue";
import type { SongBranchAudioVariants } from "~/types/content";

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
  branchVariants: { type: Object as PropType<SongBranchAudioVariants>, required: true }
});
const side = defineModel<Side>("side", { required: true });
const { t } = useI18n();
const sideLabel = (value: Side) => (value === "single" ? t("rework.songDetail.side.single") : value.toUpperCase());
</script>

<template>
  <ReworkPanel class="chart" :title="t('rework.songDetail.chart.title')">
    <template v-if="sides.some((value) => value !== 'single')" #actions>
      <div class="seg rw-seg" role="group" :aria-label="t('rework.songDetail.side.label')">
        <button v-for="value in sides" :key="value" type="button" :aria-pressed="side === value" @click="side = value">{{ sideLabel(value) }}</button>
      </div>
    </template>
    <p class="chart-id">
      <span>{{ label }} <b class="num">{{ starLabel }}</b></span>
      <span>{{ t("rework.songDetail.chart.notes") }} <b class="num">{{ comboLabel }}</b></span>
    </p>
    <ReworkSongChartSheet v-if="label" :song-id="songId" :song-title="songTitle" :difficulty="difficulty" :side="side" :label="label" :star="starLabel" />
    <ReworkSongAudioPreview class="audio" :song-id="songId" :selected-track="track" :branch-variants="branchVariants" />
  </ReworkPanel>
</template>

<style scoped>
.chart-id {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--sp-1) var(--sp-5);
  margin: 0 0 var(--sp-3);
  font-size: var(--fs-14);
  color: var(--ink-2);
}
.chart-id b {
  font-size: var(--fs-16);
  color: var(--ink);
}
.audio {
  margin-top: var(--sp-4);
}
</style>
