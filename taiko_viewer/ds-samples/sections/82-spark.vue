<script setup lang="ts">
// P0-25 samples: Spark — normal, empty, single point, extremes, muted, labelled. Invented data.
import DsSampleShell from "../_shared/DsSampleShell.vue";
import DsSampleBlock from "../_shared/DsSampleBlock.vue";
import Spark from "~/components/ds/charts/Spark.vue";

defineOptions({ name: "DsSampleSpark" });

const normal = [11.2, 11.31, 11.28, 11.45, 11.5, 11.62, 11.58, 11.74, 11.97];
const huge = [0, 980_000, 3, 1_000_000, 12];
const flat = [9.5, 9.5, 9.5, 9.5];
const gaps = [3, 4, null, 6, 5, null, null, 8];
</script>

<template>
  <DsSampleShell title="spark">
    <DsSampleBlock name="Spark · normal">
      <span class="ds-row"><Spark :values="normal" data-testid="ds-spark-normal" /><b class="num">11.97</b></span>
      <span class="ds-row"><Spark :values="normal" :w="96" :h="22" /><b class="num">11.97</b></span>
    </DsSampleBlock>
    <DsSampleBlock name="Spark · muted">
      <span class="ds-row"><Spark :values="normal" tone="muted" /><b class="num">11.97</b></span>
    </DsSampleBlock>
    <DsSampleBlock name="Spark · empty">
      <span class="ds-row"><Spark :values="[]" data-testid="ds-spark-empty" /><b class="num">—</b></span>
    </DsSampleBlock>
    <DsSampleBlock name="Spark · single point">
      <span class="ds-row"><Spark :values="[11.97]" /><b class="num">11.97</b></span>
    </DsSampleBlock>
    <DsSampleBlock name="Spark · extreme: 0 – 1,000,000 / flat / gaps">
      <span class="ds-row"><Spark :values="huge" /><b class="num">12</b></span>
      <span class="ds-row"><Spark :values="flat" /><b class="num">9.50</b></span>
      <span class="ds-row"><Spark :values="gaps" /><b class="num">8</b></span>
    </DsSampleBlock>
    <DsSampleBlock name="Spark · labelled">
      <Spark :values="normal" labelled data-testid="ds-spark-labelled" />
      <Spark :values="[]" labelled />
      <Spark :values="[5]" labelled />
    </DsSampleBlock>
    <DsSampleBlock name="Spark · stage">
      <span class="stage ds-row ds-stage-pad"><Spark :values="normal" /><b class="num">11.97</b></span>
    </DsSampleBlock>
  </DsSampleShell>
</template>

<style scoped>
.ds-row {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  font-size: var(--fs-16);
}
.ds-stage-pad {
  padding: var(--sp-3) var(--sp-4);
  border-radius: var(--r-panel);
}
</style>
