<script setup lang="ts">
// "Chart data" section of the song detail page: the V2 constants of the selected chart (ChartData) as the lead, then
// the five-ability radar and the six-dimension radar side by side from 1100 px — the six-dimension one from the rating file (shown unless the song is "other" and has no values, as before).
// The page computes the radar values (its data keys are the rating file's field names); this only draws them.
import type { PropType } from "vue";
import type { V2ConstantsItem } from "~/types/content";
import DsRadar from "~/components/ds/charts/Radar.vue";

defineProps({
  track: { type: String, required: true },
  chart: { type: Object as PropType<V2ConstantsItem | null | undefined>, default: null },
  pending: { type: Boolean, default: false },
  failed: { type: Boolean, default: false },
  rtTo: { type: String, required: true },
  showShape: { type: Boolean, default: false },
  shapeAxes: { type: Array as PropType<{ key: string; label: string; value: number }[]>, default: () => [] },
  shapeMax: { type: Number, default: 10 },
  shapeLevel: { type: [String, Number] as PropType<string | number | null>, default: null }
});
const emit = defineEmits<{ retry: [] }>();
const { t } = useI18n();
</script>

<template>
  <ReworkPanel plain :title="t('rework.songDetail.data.title')">
    <template #actions>
      <NuxtLink class="rw-link more" :to="rtTo">{{ t("tools.rtCalculator") }} →</NuxtLink>
    </template>
    <ReworkSongChartData :track="track" :chart="chart" :pending="pending" :failed="failed" @retry="emit('retry')">
      <figure v-if="showShape" class="shape">
        <figcaption>
          <span class="cap-title">{{ t("rework.songDetail.shape.title") }}</span>
          <span v-if="shapeAxes.length" class="shape-meta">
            <span>{{ t("rework.songDetail.shape.range", { max: shapeMax }) }}</span>
            <span v-if="shapeLevel">{{ t("rework.songDetail.shape.level", { level: shapeLevel }) }}</span>
          </span>
        </figcaption>
        <DsRadar v-if="shapeAxes.length" :axes="shapeAxes" :domain="[0, shapeMax]" :size="248" :name="t('rework.songDetail.shape.title')" />
        <ReworkState v-else kind="empty" compact :title="t('rework.songDetail.shape.empty')" />
      </figure>
    </ReworkSongChartData>
  </ReworkPanel>
</template>

<style scoped>
.more {
  display: inline-flex;
  align-items: center;
  min-height: var(--hit);
  font-size: var(--fs-14);
}
.shape {
  display: grid;
  justify-items: center;
  align-content: start;
  gap: var(--sp-2);
  min-width: 0;
  margin: 0;
}
figcaption {
  justify-self: stretch;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--sp-1) var(--sp-3);
}
.cap-title {
  font-size: var(--fs-13);
  font-weight: 600;
  color: var(--ink-2);
}
.shape-meta {
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--sp-1) var(--sp-3);
  font-size: var(--fs-12);
  color: var(--ink-3);
}
</style>
