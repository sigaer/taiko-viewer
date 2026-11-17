<script setup lang="ts">
// Density strip (P0-25; 04 §9; 19 G3): one bar per measure, height = density 0–1. Ordinary measures use
// --density-bar; measures above the threshold are hard sections in the softened data vermilion (--don-data).
// Stage 0 has no production data source for per-measure density (23 §2.10, RK-58): the input is prepared numbers
// supplied by the caller, and the sample page uses invented data.
import { DENSITY_HOT, densityBars } from "~/utils/ds/charts";

const props = withDefaults(
  defineProps<{
    values: ReadonlyArray<number | null>;
    height?: number;
    threshold?: number;
    /** Accessible name; defaults to ds.chart.density.name. */
    name?: string;
  }>(),
  { height: 56, threshold: DENSITY_HOT, name: "" }
);

const { t } = useI18n();
const UNIT = 10;
const BAR = 8;
const bars = computed(() => densityBars(props.values, props.threshold));
const ariaLabel = computed(() => {
  const name = props.name || t("ds.chart.density.name");
  if (!bars.value.length) return t("ds.chart.summary.empty", { name });
  return t("ds.chart.density.summary", { name, count: bars.value.length, hot: bars.value.filter((b) => b.hot).length });
});
</script>

<template>
  <svg
    v-if="bars.length"
    class="ds-density"
    :viewBox="`0 0 ${bars.length * UNIT} 100`"
    preserveAspectRatio="none"
    :height="height"
    role="img"
    :aria-label="ariaLabel"
  >
    <template v-for="(b, i) in bars" :key="i">
      <rect v-if="!b.missing && b.v > 0" :x="i * UNIT + (UNIT - BAR) / 2" :y="100 - Math.max(b.v * 100, 4)" :width="BAR" :height="Math.max(b.v * 100, 4)" class="ds-density__bar" :class="{ 'is-hot': b.hot }" />
    </template>
  </svg>
  <div v-else class="ds-density__empty" :style="{ blockSize: `${height}px` }" role="img" :aria-label="ariaLabel">
    <span aria-hidden="true">{{ t("ds.chart.empty") }}</span>
  </div>
</template>

<style scoped>
.ds-density {
  display: block;
  inline-size: 100%;
  border-block-end: 1px solid var(--line);
}
.ds-density__bar {
  fill: var(--density-bar);
}
.ds-density__bar.is-hot {
  fill: var(--don-data);
}
.ds-density__empty {
  display: grid;
  place-items: center;
  inline-size: 100%;
  border-block-end: 1px solid var(--line);
  color: var(--ink-3);
  font-size: var(--fs-13);
}
</style>
