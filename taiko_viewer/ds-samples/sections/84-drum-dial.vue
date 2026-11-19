<script setup lang="ts">
// P0-25 samples: DrumDial — Rating scale, goal progress scale, empty, single rivet, extremes. Invented values.
import DsSampleShell from "../_shared/DsSampleShell.vue";
import DsSampleBlock from "../_shared/DsSampleBlock.vue";
import DrumDial from "~/components/ds/charts/DrumDial.vue";

defineOptions({ name: "DsSampleDrumDial" });
</script>

<template>
  <DsSampleShell title="drum-dial">
    <DsSampleBlock name="DrumDial · normal (15.5 / 0.5)">
      <DrumDial :value="11.97" name="Rating" data-testid="ds-dial-normal">
        <span class="ds-dial-cap">Rating</span>
        <b class="num ds-dial-num">11.97</b>
        <span class="num ds-dial-sub">/ 15.5</span>
      </DrumDial>
      <DrumDial :value="11.97" :size="120" />
    </DsSampleBlock>
    <DsSampleBlock name="DrumDial · goal (1 / 24)">
      <DrumDial :value="0.5" :max="1" :step="1 / 24" :size="120" tone="mark" :digits="2" data-testid="ds-dial-goal" />
    </DsSampleBlock>
    <DsSampleBlock name="DrumDial · empty">
      <DrumDial :value="null" data-testid="ds-dial-empty" />
    </DsSampleBlock>
    <DsSampleBlock name="DrumDial · single rivet">
      <DrumDial :value="1" :max="1" :step="1" :size="120" data-testid="ds-dial-single" />
    </DsSampleBlock>
    <DsSampleBlock name="DrumDial · extreme: 0 / 15.5 / 99 / -3">
      <DrumDial :value="0" :size="120" />
      <DrumDial :value="15.5" :size="120" />
      <DrumDial :value="99" :size="120" data-testid="ds-dial-over" />
      <DrumDial :value="-3" :size="120" />
    </DsSampleBlock>
    <DsSampleBlock name="DrumDial · stage">
      <div class="stage ds-stage-pad"><DrumDial :value="11.97" /></div>
    </DsSampleBlock>
  </DsSampleShell>
</template>

<style scoped>
.ds-dial-cap {
  font-size: var(--fs-11);
  color: var(--ink-3);
}
.ds-dial-num {
  font-size: var(--fs-48);
  font-weight: 700;
  line-height: var(--lh-tight);
  color: var(--emph-num);
}
.ds-dial-sub {
  font-size: var(--fs-11);
  color: var(--ink-3);
}
.ds-stage-pad {
  padding: var(--sp-4);
  border-radius: var(--r-panel);
}
</style>
