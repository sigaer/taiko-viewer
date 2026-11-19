<script setup lang="ts">
// One measured series of the growth page (was components/PassportMetricChart.vue): Rating or one dimension over the
// selected range. The line is DsLineChart over the measured points only (passportMetricRuns); runs that cannot be
// compared are separated by a gap in the line. Points sit in measurement order, labelled with their day.
// The same summary sentence and point read-out as before: the chart is a focusable group, ← / → (Home / End) step
// through the points, the selected point is marked on the line, the previous / next buttons do the same.
import type { SkillPassportSegment, SkillPassportTrendDimension } from "~/types/player-growth";
import { metricLine, passportMetricRuns } from "~/utils/passportNarrative";

const props = defineProps<{
  title: string;
  segments: SkillPassportSegment[];
  dimension: SkillPassportTrendDimension;
  label: string;
  from: string;
  to: string;
}>();
const { t, locale } = useI18n();
const id = computed(() => `passport-metric-${props.dimension}`);

const runs = computed(() => passportMetricRuns(props.segments, props.dimension));
const dateFormatter = computed(() =>
  new Intl.DateTimeFormat(locale.value, {
    year: props.from.slice(0, 4) !== props.to.slice(0, 4) ? "numeric" : undefined,
    month: "short",
    day: "numeric",
    timeZone: "Asia/Shanghai"
  })
);
const axisFormatter = computed(() => new Intl.DateTimeFormat(locale.value, { month: "numeric", day: "numeric", timeZone: "Asia/Shanghai" }));
const date = (day: string) => dateFormatter.value.format(new Date(`${day}T12:00:00+08:00`));
const line = computed(() => metricLine(runs.value, (day) => axisFormatter.value.format(new Date(`${day}T12:00:00+08:00`))));
const points = computed(() => line.value.index);

const selectedId = ref("");
watch(() => [props.dimension, props.segments], () => { selectedId.value = ""; });
const selected = computed(() => points.value.find((p) => p.id === selectedId.value) || points.value.at(-1));
const selectedIndex = computed(() => points.value.findIndex((p) => p.id === selected.value?.id));
const stepPoint = (step: number) => {
  const point = points.value[selectedIndex.value + step];
  if (point) selectedId.value = point.id;
};
const jump = (to: "first" | "last") => {
  const point = to === "first" ? points.value[0] : points.value.at(-1);
  if (point) selectedId.value = point.id;
};
const marks = computed(() => (selected.value && points.value.length > 1 ? [{ index: selected.value.at, text: date(selected.value.day) }] : []));

const summary = computed(() => {
  const first = points.value[0];
  const last = points.value.at(-1);
  if (!first || !last) return t("passport.trend.noPoints");
  if (points.value.length === 1) return t("passport.trend.onePoint", { day: date(first.day), dimension: props.label, value: first.value.toFixed(2) });
  if (runs.value.length > 1)
    return t(runs.value.every((run) => run.points.length === 1) ? "passport.trend.discrete" : "passport.trend.independent", { count: points.value.length, dimension: props.label });
  return t("passport.trend.summary", { dimension: props.label, fromDay: date(first.day), from: first.value.toFixed(2), toDay: date(last.day), to: last.value.toFixed(2) });
});
</script>

<template>
  <section class="gmc passport-metric" :data-metric="dimension" :aria-labelledby="`${id}-title`">
    <div class="gmc-head">
      <h3 :id="`${id}-title`" class="gmc-title">{{ title }}</h3>
      <slot name="controls" />
    </div>
    <p :id="`${id}-summary`" class="gmc-summary passport-chart-summary">{{ summary }}</p>
    <span v-if="runs.length > 1" :id="`${id}-groups`" class="rw-vh">{{ t("passport.trend.groups", { count: runs.length }) }}</span>
    <template v-if="points.length">
      <div
        class="gmc-chart passport-chart"
        role="group"
        tabindex="0"
        :aria-labelledby="`${id}-summary`"
        :aria-describedby="runs.length > 1 ? `${id}-groups` : undefined"
        @keydown.left.prevent="stepPoint(-1)"
        @keydown.right.prevent="stepPoint(1)"
        @keydown.home.prevent="jump('first')"
        @keydown.end.prevent="jump('last')"
      >
        <DsChartsLineChart :points="line.points" :marks="marks" :name="label" :height="220" />
      </div>
      <div v-if="selected" class="gmc-readout">
        <button v-if="points.length > 1" type="button" class="rw-btn rw-btn--sm" :disabled="selectedIndex <= 0" :aria-label="t('passport.trend.previousPoint', { dimension: label })" @click="stepPoint(-1)">
          <ReworkIcon name="back" class="gmc-arrow" />
        </button>
        <p class="gmc-detail passport-chart-detail" role="status">
          <span>{{ date(selected.day) }}</span> · <span>{{ label }}</span> · <b class="num">{{ selected.value.toFixed(2) }}</b>
        </p>
        <button v-if="points.length > 1" type="button" class="rw-btn rw-btn--sm" :disabled="selectedIndex >= points.length - 1" :aria-label="t('passport.trend.nextPoint', { dimension: label })" @click="stepPoint(1)">
          <ReworkIcon name="forward" class="gmc-arrow" />
        </button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.gmc {
  display: grid;
  gap: var(--sp-2);
  min-width: 0;
}
.gmc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--sp-2) var(--sp-4);
}
.gmc-title {
  margin: 0;
  font-size: var(--fs-16);
  font-weight: 700;
}
.gmc-summary {
  margin: 0;
  color: var(--ink-2);
  font-size: var(--fs-13);
  line-height: var(--lh-body);
}
.gmc-chart {
  min-width: 0;
  border-radius: var(--r-ctl);
}
.gmc-chart:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 4px;
}
.gmc-readout {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--sp-2);
}
.gmc-detail {
  margin: 0;
  color: var(--ink);
  font-size: var(--fs-13);
  text-align: right;
}
.gmc-arrow {
  width: 18px;
  height: 18px;
}
</style>
