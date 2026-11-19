<script setup lang="ts">
// Spark line (P0-25; V1.2 §9.21): no axes, a supplement to the number next to it. Brand series colour by default,
// `muted` for a secondary trend. Hidden from assistive technology unless `labelled` (then ds.chart.summary.*).
// Empty input draws a faint dashed baseline; one value draws a single dot.
import { formatFixed, sparkGeometry } from "~/utils/ds/charts";

const props = withDefaults(
  defineProps<{
    values: ReadonlyArray<number | null>;
    w?: number;
    h?: number;
    tone?: "series" | "muted";
    digits?: number;
    labelled?: boolean;
    /** Accessible name when labelled; defaults to ds.chart.spark.name. */
    name?: string;
  }>(),
  { w: 96, h: 28, tone: "series", digits: 2, labelled: false, name: "" }
);

const { t } = useI18n();
const geo = computed(() => sparkGeometry(props.values, props.w, props.h));
const ariaLabel = computed(() => {
  if (!props.labelled) return undefined;
  const name = props.name || t("ds.chart.spark.name");
  const vs = props.values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (!vs.length) return t("ds.chart.summary.empty", { name });
  if (vs.length === 1) return t("ds.chart.summary.point", { name, value: formatFixed(vs[0], props.digits) });
  return t("ds.chart.summary.series", { name, count: vs.length, from: formatFixed(vs[0], props.digits), to: formatFixed(vs[vs.length - 1], props.digits) });
});
</script>

<template>
  <svg
    :width="w"
    :height="h"
    :viewBox="`0 0 ${w} ${h}`"
    class="ds-spark"
    :class="`ds-spark--${tone}`"
    :role="labelled ? 'img' : undefined"
    :aria-label="ariaLabel"
    :aria-hidden="labelled ? undefined : 'true'"
  >
    <template v-if="geo">
      <path v-if="geo.path" :d="geo.path" class="ds-spark__path" />
      <circle v-if="geo.last" :cx="geo.last.x" :cy="geo.last.y" r="2.5" class="ds-spark__dot" />
    </template>
    <line v-else x1="3" :x2="w - 3" :y1="h / 2" :y2="h / 2" class="ds-spark__none" />
  </svg>
</template>

<style scoped>
.ds-spark {
  --tone: var(--series);
  display: inline-block;
  flex: none;
  vertical-align: middle;
  overflow: visible;
}
.ds-spark--muted {
  --tone: var(--ink-2);
}
.ds-spark__path {
  fill: none;
  stroke: var(--tone);
  stroke-width: 1.75;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.ds-spark__dot {
  fill: var(--tone);
}
.ds-spark__none {
  stroke: var(--line-strong);
  stroke-dasharray: 2 3;
}
</style>
