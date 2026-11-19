<script setup lang="ts">
// "现在的我" on the growth page: the current Rating on DsDrumDial (against 15.5) and the six current dimensions on
// DsRadar (/api/account/growth/passport current.dimensions). The dashed outline is the comparable start point of the
// current period (currentSegmentChange.start, only when the change is comparable), labelled with its day.
// The observation sentence comes from the existing growth voice. Without a current measurement: the existing notice.
import type { GrowthMeasurementDimensions, SkillPassportResponse } from "~/types/player-growth";
import DsDrumDial from "~/components/ds/charts/DrumDial.vue";
import DsRadar from "~/components/ds/charts/Radar.vue";
import { GROWTH_DIMENSION_ORDER } from "~/utils/playerGrowth";
import { dimensionLabelKey, radarAxes, radarHasData } from "~/utils/rework/today";

const props = defineProps<{
  current: SkillPassportResponse["current"];
  start: { dimensions: GrowthMeasurementDimensions; day: string } | null;
  focus: string | null;
  observation: string;
  dayLabel: (day: string) => string;
}>();
const { t } = useI18n();
const axes = computed(() => radarAxes(GROWTH_DIMENSION_ORDER, (key) => t(dimensionLabelKey(key)), props.current?.dimensions, props.start?.dimensions || null));
const showRadar = computed(() => radarHasData(axes.value));
/** Values the radar does not show: the missing ones, or all of them when there are too few for a radar. */
const listed = computed(() => (showRadar.value ? axes.value.filter((a) => a.value === null) : axes.value));
</script>

<template>
  <section class="gn" aria-labelledby="gn-title">
    <h2 id="gn-title" class="gn-title">{{ t("passport.currentTitle") }}</h2>
    <template v-if="current">
      <div class="gn-rating passport-rating">
        <DsDrumDial :value="current.rating" :size="140" name="Rating">
          <span class="gn-k">Rating</span>
          <b class="num gn-v">{{ current.rating === null ? t("passport.noValue") : current.rating.toFixed(2) }}</b>
          <span class="gn-k num">/ 15.5</span>
        </DsDrumDial>
      </div>
      <DsRadar v-if="showRadar" class="gn-radar" :axes="axes" :focus="focus" :size="280" :name="t('passport.skillOverview')" />
      <p v-if="showRadar && start" class="gn-legend">
        <i class="gn-solid" aria-hidden="true" />{{ t("rework.growthPage.now") }}
        <i class="gn-dash" aria-hidden="true" />{{ t("rework.growthPage.since", { date: dayLabel(start.day) }) }}
      </p>
      <ul v-if="listed.length" class="gn-missing passport-skills" :aria-label="showRadar ? undefined : t('passport.skillOverview')">
        <li v-for="axis in listed" :key="axis.key" class="passport-skill">{{ axis.label }} <span :class="{ num: axis.value !== null }">{{ axis.value === null ? t("passport.noValue") : axis.value.toFixed(2) }}</span></li>
      </ul>
      <p class="gn-say passport-focus">{{ observation }}</p>
    </template>
    <p v-else class="gn-say passport-limited">{{ t("passport.noCurrent") }}</p>
  </section>
</template>

<style scoped>
.gn {
  display: grid;
  justify-items: center;
  gap: var(--sp-3);
  padding: var(--sp-4) var(--sp-5) var(--sp-5);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
  min-width: 0;
}
.gn-title {
  justify-self: start;
  margin: 0;
  font-size: var(--fs-18);
  font-weight: 700;
}
.gn-k {
  color: var(--ink-3);
  font-size: var(--fs-11);
}
.gn-v {
  font-size: var(--fs-28);
  font-weight: 700;
  line-height: 1;
}
.gn-radar {
  max-width: 100%;
  height: auto;
}
.gn-legend {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--sp-1) var(--sp-2);
  margin: 0;
  color: var(--ink-2);
  font-size: var(--fs-12);
}
.gn-solid,
.gn-dash {
  display: inline-block;
  width: 18px;
  border-top: 2px solid var(--series);
}
.gn-dash {
  margin-left: var(--sp-2);
  border-top: 2px dashed var(--ink-3);
}
.gn-missing {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-1) var(--sp-3);
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--ink-2);
  font-size: var(--fs-12);
}
.gn-missing span {
  color: var(--ink-3);
}
.gn-say {
  margin: 0;
  color: var(--ink-2);
  font-size: var(--fs-14);
  line-height: var(--lh-body);
  text-align: center;
}
</style>
