<script setup lang="ts">
// The six dimensions of the signed-in home: DsRadar of /api/account/growth/overview playerState.skills (a value that
// is not above zero is left out, as before); the focused dimension is the priority dimension unless the dimensions are
// tied. The overall Rating moved to the vermilion card (today/Hero.vue, redesign 2026-11-27). No 30-day comparison,
// rank position or play streak: the overview does not return them.
import type { PlayerRatingDimension } from "~/types/recommendation-intelligence";
import DsRadar from "~/components/ds/charts/Radar.vue";
import { GROWTH_DIMENSION_ORDER } from "~/utils/playerGrowth";
import { dimensionLabelKey, radarAxes, radarHasData } from "~/utils/rework/today";

const props = defineProps<{
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
  <section class="tpf growth-focus" aria-labelledby="growth-focus-title">
    <header class="tpf-head">
      <h2 id="growth-focus-title" class="tpf-title">{{ t("passport.skillOverview") }}</h2>
      <NuxtLink class="rw-link tpf-link" :to="localePath('/my/growth')">{{ t("passport.title") }}</NuxtLink>
    </header>
    <div v-if="showRadar" class="tpf-radar">
      <DsRadar :axes="axes" :focus="focus" :size="232" centered :name="t('passport.skillOverview')" />
    </div>
    <p class="tpf-say">{{ observation }}</p>
  </section>
</template>

<style scoped>
.tpf {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  height: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: var(--sp-4) var(--sp-5) var(--sp-5);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
}
.tpf-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--sp-1) var(--sp-3);
}
.tpf-title {
  margin: 0;
  font-size: var(--fs-16);
  font-weight: 700;
  line-height: var(--lh-snug);
}
.tpf-link {
  display: inline-flex;
  align-items: center;
  min-height: var(--hit);
  font-size: var(--fs-13);
  font-weight: 600;
}
.tpf-radar {
  display: grid;
  place-items: center;
  min-width: 0;
}
.tpf-radar :deep(svg) {
  max-width: 100%;
  height: auto;
}
.tpf-say {
  margin: 0;
  color: var(--ink-2);
  font-size: var(--fs-14);
  line-height: var(--lh-body);
}
@media (max-width: 767px) {
  .tpf {
    padding: var(--sp-3) var(--sp-4) var(--sp-4);
  }
}
</style>
