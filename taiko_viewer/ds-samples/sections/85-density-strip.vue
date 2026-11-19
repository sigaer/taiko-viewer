<script setup lang="ts">
// P0-25 samples: DensityStrip — invented per-measure density only. There is no production data source yet
// (23 §2.10, RK-58); nothing here reads one.
import DsSampleShell from "../_shared/DsSampleShell.vue";
import DsSampleBlock from "../_shared/DsSampleBlock.vue";
import DensityStrip from "~/components/ds/charts/DensityStrip.vue";

defineOptions({ name: "DsSampleDensityStrip" });

const normal = Array.from({ length: 64 }, (_, i) => Math.round((0.35 + 0.3 * Math.sin(i / 4) + 0.25 * Math.sin(i / 1.7 + 1)) * 100) / 100);
const extreme = [0, 1, 0, 1, 1.6, -0.4, 0.72, 0.73, null, 0.5, 1, 0];
const allHot = Array.from({ length: 40 }, () => 1);
const allZero = Array.from({ length: 40 }, () => 0);
</script>

<template>
  <DsSampleShell title="density-strip">
    <DsSampleBlock name="DensityStrip · normal (64)">
      <div class="ds-chart-cell" data-testid="ds-density-normal"><DensityStrip :values="normal" /></div>
      <div class="ds-chart-cell"><DensityStrip :values="normal" :height="40" /></div>
    </DsSampleBlock>
    <DsSampleBlock name="DensityStrip · empty">
      <div class="ds-chart-cell" data-testid="ds-density-empty"><DensityStrip :values="[]" :height="40" /></div>
    </DsSampleBlock>
    <DsSampleBlock name="DensityStrip · single measure">
      <div class="ds-chart-cell" data-testid="ds-density-single"><DensityStrip :values="[0.8]" :height="40" /></div>
    </DsSampleBlock>
    <DsSampleBlock name="DensityStrip · extreme: out of range / threshold / missing">
      <div class="ds-chart-cell" data-testid="ds-density-extreme"><DensityStrip :values="extreme" :height="40" /></div>
    </DsSampleBlock>
    <DsSampleBlock name="DensityStrip · extreme: all 1 / all 0">
      <div class="ds-chart-cell"><DensityStrip :values="allHot" :height="40" /></div>
      <div class="ds-chart-cell"><DensityStrip :values="allZero" :height="40" /></div>
    </DsSampleBlock>
    <DsSampleBlock name="DensityStrip · stage">
      <div class="ds-chart-cell stage ds-stage-pad"><DensityStrip :values="normal" :height="40" /></div>
    </DsSampleBlock>
  </DsSampleShell>
</template>

<style scoped>
.ds-chart-cell {
  flex: 1 1 100%;
  min-inline-size: 0;
}
.ds-stage-pad {
  padding: var(--sp-4);
  border-radius: var(--r-panel);
}
</style>
