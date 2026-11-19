<script setup lang="ts">
// P0-25 samples: LineChart — normal, empty, single point, extremes, gaps. Invented data.
import DsSampleShell from "../_shared/DsSampleShell.vue";
import DsSampleBlock from "../_shared/DsSampleBlock.vue";
import LineChart from "~/components/ds/charts/LineChart.vue";

defineOptions({ name: "DsSampleLineChart" });

const day = (offset: number) => {
  const d = new Date(Date.UTC(2026, 9, 19 + offset));
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
};
const series = (n: number, f: (i: number) => number | null) => Array.from({ length: n }, (_, i) => ({ label: day(i), value: f(i) }));

const normal = series(30, (i) => Math.round((10.8 + i * 0.04 + 0.08 * Math.sin(i * 1.3)) * 100) / 100);
const marks = [
  { index: 11, text: "fc" },
  { index: 26, text: "dfc" }
];
const single = series(1, () => 11.97);
const flat = series(14, () => 12);
const huge = series(12, (i) => (i % 3 === 0 ? 0 : i * 98_000 + 4_321));
const long = series(365, (i) => Math.round((9 + i * 0.008 + 0.3 * Math.sin(i / 9)) * 100) / 100);
const gaps = series(20, (i) => ([4, 5, 9, 11, 12].includes(i) ? null : 11 + Math.cos(i / 3) * 0.4));
</script>

<template>
  <DsSampleShell title="line-chart">
    <DsSampleBlock name="LineChart · normal + marks">
      <div class="ds-chart-cell" data-testid="ds-line-normal"><LineChart :points="normal" :marks="marks" :height="210" /></div>
    </DsSampleBlock>
    <DsSampleBlock name="LineChart · empty">
      <div class="ds-chart-cell" data-testid="ds-line-empty"><LineChart :points="[]" :height="160" /></div>
    </DsSampleBlock>
    <DsSampleBlock name="LineChart · single point">
      <div class="ds-chart-cell" data-testid="ds-line-single"><LineChart :points="single" :height="160" /></div>
    </DsSampleBlock>
    <DsSampleBlock name="LineChart · extreme: flat">
      <div class="ds-chart-cell"><LineChart :points="flat" :height="160" /></div>
    </DsSampleBlock>
    <DsSampleBlock name="LineChart · extreme: 0 – 1,000,000">
      <div class="ds-chart-cell" data-testid="ds-line-huge"><LineChart :points="huge" :digits="0" :height="200" /></div>
    </DsSampleBlock>
    <DsSampleBlock name="LineChart · extreme: 365 points">
      <div class="ds-chart-cell" data-testid="ds-line-long"><LineChart :points="long" :height="200" /></div>
    </DsSampleBlock>
    <DsSampleBlock name="LineChart · gaps">
      <div class="ds-chart-cell"><LineChart :points="gaps" :height="160" /></div>
    </DsSampleBlock>
  </DsSampleShell>
</template>

<style scoped>
.ds-chart-cell {
  flex: 1 1 100%;
  min-inline-size: 0;
}
</style>
