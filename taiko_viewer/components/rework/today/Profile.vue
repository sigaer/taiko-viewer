<script setup lang="ts">
// Rating and the six dimensions of the signed-in home (frozen Today.vue deck, left part). Rating: DsDrumDial against
// 15.5 (/api/account/growth/overview playerState.overallRating). Dimensions: DsRadar of playerState.skills (a value
// that is not above zero is left out, as before); the focused dimension is the priority dimension unless the
// dimensions are tied. No 30-day comparison, rank position or play streak: the overview does not return them.
import type { PlayerRatingDimension } from "~/types/recommendation-intelligence";
import DsDrumDial from "~/components/ds/charts/DrumDial.vue";
import DsRadar from "~/components/ds/charts/Radar.vue";
import { GROWTH_DIMENSION_ORDER } from "~/utils/playerGrowth";
import { dimensionLabelKey, radarAxes, radarHasData } from "~/utils/rework/today";

const props = defineProps<{
  rating: number | null;
  skills: PlayerRatingDimension[];
  focus: string | null;
  observation: string;
}>();
const { t } = useI18n();
const localePath = useLocalePath();
const axes = computed(() => {
  const values = Object.fromEntries(props.skills.map((s) => [s.key, Number(s.value) > 0 ? Number(s.value) : null]));
  return radarAxes(GROWTH_DIMENSION_ORDER, (key) => t(dimensionLabelKey(key)), values);
});
const showRadar = computed(() => radarHasData(axes.value));
</script>

<template>
  <section class="tpf growth-focus" :aria-label="t('passport.skillOverview')">
    <div class="tpf-rating">
      <DsDrumDial :value="rating" :size="248" name="Rating">
        <span class="tpf-k">Rating</span>
        <b class="num tpf-v">{{ rating === null ? "—" : rating.toFixed(2) }}</b>
        <span class="tpf-k num">/ 15.5</span>
      </DsDrumDial>
    </div>
    <div class="tpf-radar">
      <DsRadar v-if="showRadar" :axes="axes" :focus="focus" :size="248" centered :name="t('passport.skillOverview')" />
    </div>
    <div class="tpf-support">
      <p class="tpf-say">{{ observation }}</p>
      <NuxtLink class="rw-link tpf-link" :to="localePath('/my/growth')">{{ t("passport.title") }}</NuxtLink>
    </div>
  </section>
</template>

<style scoped>
.tpf {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: center;
  gap: var(--sp-2) var(--sp-6);
  height: 100%;
  box-sizing: border-box;
  padding: var(--sp-4) var(--sp-6);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
}
.tpf-rating,
.tpf-radar {
  display: grid;
  place-items: center;
  min-width: 0;
}
.tpf-rating { grid-row: 1 / span 2; }
.tpf-k {
  color: var(--ink-3);
  font-size: var(--fs-13);
}
.tpf-v {
  font-size: var(--fs-48);
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.01em;
}
.tpf-support {
  grid-column: 2;
  display: grid;
  justify-items: center;
  gap: var(--sp-2);
  min-width: 0;
}
.tpf-radar :deep(svg) {
  max-width: 100%;
  height: auto;
}
.tpf-say {
  margin: 0;
  max-width: 32em;
  color: var(--ink-2);
  font-size: var(--fs-14);
  line-height: var(--lh-body);
  text-align: center;
}
.tpf-link {
  display: inline-flex;
  align-items: center;
  min-height: var(--hit);
  font-size: var(--fs-13);
}
@media (max-width: 767px) {
  .tpf {
    grid-template-columns: minmax(0, 1fr);
    padding: var(--sp-4) var(--sp-3);
  }
  .tpf-support {
    grid-column: 1;
  }
  .tpf-rating { grid-row: auto; }
}
</style>
