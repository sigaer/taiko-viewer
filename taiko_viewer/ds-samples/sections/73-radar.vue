<script setup lang="ts">
// P0-25 samples: Radar — six player dimensions (auto range, previous values, focus), five chart dimensions (fixed
// 0–15.5), empty, single axis, extremes. Axis names reuse existing locale keys; values are invented.
import DsSampleShell from "../_shared/DsSampleShell.vue";
import DsSampleBlock from "../_shared/DsSampleBlock.vue";
import Radar from "~/components/ds/charts/Radar.vue";

defineOptions({ name: "DsSampleRadar" });

const { t } = useI18n();
const dim = (key: string) => t(`annualSummary.keywords.dimensions.${key}`);
const col = (key: string) => t(`page.songs.v2Constants.columns.${key}`);

const player = computed(() => [
  { key: "big_song", label: dim("big_song"), value: 12.36, prev: 12.1 },
  { key: "stamina", label: dim("stamina"), value: 11.77, prev: 11.6 },
  { key: "speed", label: dim("speed"), value: 11.68, prev: 11.2 },
  { key: "accuracy", label: dim("accuracy"), value: 12.7, prev: 12.62 },
  { key: "rhythm", label: dim("rhythm"), value: 12.33, prev: 12.3 },
  { key: "complex", label: dim("complex"), value: 12.49, prev: 12.4 }
]);
const chart = computed(() => [
  { key: "stamina", label: col("stamina"), value: 8.58 },
  { key: "handspeed", label: col("handspeed"), value: 10.12 },
  { key: "burst", label: col("burst"), value: 9.4 },
  { key: "complex", label: col("complex"), value: 7.75 },
  { key: "rhythm", label: col("rhythm"), value: 9.96 }
]);
const single = computed(() => [{ key: "stamina", label: col("stamina"), value: 9.2 }]);
const extreme = computed(() => [
  { key: "stamina", label: col("stamina"), value: 15.5 },
  { key: "handspeed", label: col("handspeed"), value: 0 },
  { key: "burst", label: col("burst"), value: 99 },
  { key: "complex", label: col("complex"), value: -4 },
  { key: "rhythm", label: col("rhythm"), value: null }
]);
const equal = computed(() => player.value.map((a) => ({ key: a.key, label: a.label, value: 10 })));
</script>

<template>
  <DsSampleShell title="radar">
    <DsSampleBlock name="Radar · six, auto range, prev, focus">
      <Radar :axes="player" focus="speed" :size="300" data-testid="ds-radar-player" />
      <Radar :axes="player" focus="speed" :size="236" />
    </DsSampleBlock>
    <DsSampleBlock name="Radar · five, domain 0–15.5">
      <Radar :axes="chart" :domain="[0, 15.5]" :size="280" data-testid="ds-radar-chart" />
    </DsSampleBlock>
    <DsSampleBlock name="Radar · empty">
      <Radar :axes="[]" :size="200" data-testid="ds-radar-empty" />
    </DsSampleBlock>
    <DsSampleBlock name="Radar · single axis">
      <Radar :axes="single" :domain="[0, 15.5]" :size="240" data-testid="ds-radar-single" />
    </DsSampleBlock>
    <DsSampleBlock name="Radar · extreme: over / under / missing">
      <Radar :axes="extreme" :domain="[0, 15.5]" :size="280" data-testid="ds-radar-extreme" />
    </DsSampleBlock>
    <DsSampleBlock name="Radar · extreme: all equal">
      <Radar :axes="equal" :size="260" />
    </DsSampleBlock>
    <DsSampleBlock name="Radar · stage">
      <div class="stage ds-stage-pad"><Radar :axes="player" focus="speed" :size="260" /></div>
    </DsSampleBlock>
  </DsSampleShell>
</template>

<style scoped>
.ds-stage-pad {
  padding: var(--sp-4);
  border-radius: var(--r-panel);
  max-inline-size: 100%;
}
</style>
