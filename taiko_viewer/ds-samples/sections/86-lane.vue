<script setup lang="ts">
// P0-25 samples: Lane — clickable, compact, overview link, empty, single day, extremes. Invented days; fact types
// are the contract's (LaneFactType = CanonicalFact["type"]).
import DsSampleShell from "../_shared/DsSampleShell.vue";
import DsSampleBlock from "../_shared/DsSampleBlock.vue";
import Lane from "~/components/ds/charts/Lane.vue";
import type { LaneDay, LaneFactType } from "~/utils/ds/charts";

defineOptions({ name: "DsSampleLane" });

const TODAY = "2026-11-17";
const iso = (offset: number) => new Date(Date.UTC(2026, 10, 17 + offset)).toISOString().slice(0, 10);
/** `pattern[i]` is the day's facts (oldest first); null = not played. */
const lane = (pattern: ReadonlyArray<ReadonlyArray<LaneFactType> | null>): LaneDay[] =>
  pattern.map((facts, i) => ({ date: iso(i - pattern.length + 1), played: facts !== null, facts: (facts ?? []).map((type) => ({ type })) }));

const P: Record<string, LaneFactType[]> = {
  pb: ["score-pb", "played", "played"],
  ka: ["ng-reduced"],
  rank: ["rank-upgrade", "score-pb"],
  fc: ["fc", "score-pb", "combo-improved"],
  df: ["df", "fc", "score-pb", "played"],
  goal: ["goal-completed"],
  clear: ["clear"],
  ghost: []
};
const normal = lane([P.pb, P.ka, null, P.ka, P.pb, null, null, null, P.ka, P.ka, null, P.rank, P.fc, P.pb, null, P.goal, P.ka, P.clear, P.pb, P.pb, P.df]);
const selected = ref<string | null>(TODAY);
const compactSel = ref<string | null>(null);
const single = lane([P.fc]);
const allRest = lane(Array.from({ length: 14 }, () => null));
const allDf = lane(Array.from({ length: 14 }, () => P.df));
const long = lane(Array.from({ length: 90 }, (_, i) => (i % 5 === 3 ? null : i % 7 === 0 ? P.fc : i % 3 === 0 ? P.ka : i % 4 === 0 ? P.ghost : P.pb)));
const week = normal.slice(-7);

const localePath = useLocalePath();
</script>

<template>
  <DsSampleShell title="lane">
    <DsSampleBlock name="Lane · normal (21 days, today, selected)">
      <div class="ds-chart-cell" data-testid="ds-lane-normal"><Lane v-model="selected" :days="normal" :today="TODAY" /></div>
    </DsSampleBlock>
    <DsSampleBlock name="Lane · compact">
      <div class="ds-chart-cell"><Lane v-model="compactSel" :days="normal" :today="TODAY" compact /></div>
    </DsSampleBlock>
    <DsSampleBlock name="Lane · overview link (7 days)">
      <div class="ds-chart-cell ds-narrow" data-testid="ds-lane-overview"><Lane :days="week" :today="TODAY" compact :to="localePath('/_ds/lane')" /></div>
    </DsSampleBlock>
    <DsSampleBlock name="Lane · empty">
      <div class="ds-chart-cell" data-testid="ds-lane-empty"><Lane :days="[]" /></div>
    </DsSampleBlock>
    <DsSampleBlock name="Lane · single day">
      <div class="ds-chart-cell" data-testid="ds-lane-single"><Lane :days="single" :today="TODAY" /></div>
    </DsSampleBlock>
    <DsSampleBlock name="Lane · extreme: all rest / all dfc">
      <div class="ds-chart-cell"><Lane :days="allRest" :today="TODAY" /></div>
      <div class="ds-chart-cell"><Lane :days="allDf" :today="TODAY" /></div>
    </DsSampleBlock>
    <DsSampleBlock name="Lane · extreme: 90 days (scrolls)">
      <div class="ds-chart-cell" data-testid="ds-lane-long"><Lane :days="long" :today="TODAY" /></div>
    </DsSampleBlock>
  </DsSampleShell>
</template>

<style scoped>
.ds-chart-cell {
  flex: 1 1 100%;
  min-inline-size: 0;
}
.ds-narrow {
  flex: 0 1 360px;
}
</style>
