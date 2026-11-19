<script setup lang="ts">
// Radar (P0-25; 04 §3, §9; V1.2 §9.24). Brand series stroke with a 12% fill (--series-fill); the focused dimension
// uses --series-focus; previous values are a dashed neutral outline. Without `domain` the range narrows to the data
// (floor(min − 0.6) … ceil(max + 0.1)) and is printed on the chart. Axis labels come from the caller (locale text);
// the drawing box grows to fit the longest label, so nothing is clipped at narrow widths.
import { formatFixed, radarGeometry, textWidth, type RadarAxisInput } from "~/utils/ds/charts";

const props = withDefaults(
  defineProps<{
    axes: ReadonlyArray<RadarAxisInput>;
    focus?: string | null;
    size?: number;
    domain?: [number, number] | null;
    digits?: number;
    /** Balance label extents around the plot center, for equal-width chart columns. */
    centered?: boolean;
    /** Accessible chart name; defaults to ds.chart.radar.name. */
    name?: string;
  }>(),
  { focus: null, size: 260, domain: null, digits: 2, centered: false, name: "" }
);

const { t } = useI18n();
const CX = 150;
const CY = 150;
const R = 92;
const LABEL = 12;
const VALUE = 15;

const geo = computed(() => radarGeometry(props.axes, { domain: props.domain, cx: CX, cy: CY, r: R, labelGap: 16 }));

const labels = computed(() =>
  props.axes.map((a, i) => {
    const l = geo.value.labels[i];
    const value = formatFixed(a.value, props.digits);
    const w = Math.max(textWidth(a.label, LABEL), textWidth(value, VALUE) * 0.85);
    const [labelY, valueY] = l.dy === "above" ? [l.y - 19, l.y - 2] : l.dy === "below" ? [l.y + 10, l.y + 27] : [l.y - 3, l.y + 14];
    const x0 = l.anchor === "start" ? l.x : l.anchor === "end" ? l.x - w : l.x - w / 2;
    return { key: a.key, label: a.label, value, x: l.x, anchor: l.anchor, labelY, valueY, box: [x0, labelY - LABEL, x0 + w, valueY + 4] as const, focus: a.key === props.focus };
  })
);

/** Fit the drawing box around rings and labels (4px margin). */
const viewBox = computed(() => {
  let [x0, y0, x1, y1] = [CX - R, CY - R, CX + R, CY + R];
  for (const l of labels.value) {
    x0 = Math.min(x0, l.box[0]);
    y0 = Math.min(y0, l.box[1]);
    x1 = Math.max(x1, l.box[2]);
    y1 = Math.max(y1, l.box[3]);
  }
  const m = 4;
  if (props.centered) {
    const halfWidth = Math.ceil(Math.max(CX - x0, x1 - CX) + m);
    const halfHeight = Math.ceil(Math.max(CY - y0, y1 - CY) + m);
    return { x: CX - halfWidth, y: CY - halfHeight, w: halfWidth * 2, h: halfHeight * 2 };
  }
  return { x: Math.floor(x0 - m), y: Math.floor(y0 - m), w: Math.ceil(x1 - x0 + 2 * m), h: Math.ceil(y1 - y0 + 2 * m) };
});
const pxHeight = computed(() => Math.round((props.size * viewBox.value.h) / viewBox.value.w));

const ariaLabel = computed(() => {
  const name = props.name || t("ds.chart.radar.name");
  if (!props.axes.length) return t("ds.chart.summary.empty", { name });
  const items = props.axes.map((a) => t("ds.chart.radar.item", { label: a.label, value: formatFixed(a.value, props.digits) })).join(t("ds.chart.radar.separator"));
  return t("ds.chart.radar.summary", { name, items });
});
</script>

<template>
  <svg
    v-if="axes.length"
    class="ds-radar"
    :viewBox="`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`"
    :width="size"
    :height="pxHeight"
    role="img"
    :aria-label="ariaLabel"
  >
    <template v-if="axes.length >= 3">
      <polygon v-for="(r, i) in geo.rings" :key="`r${i}`" :points="r.points" class="ds-radar__ring" />
    </template>
    <template v-else>
      <circle v-for="(r, i) in geo.rings" :key="`c${i}`" :cx="CX" :cy="CY" :r="r.r" class="ds-radar__ring" />
    </template>
    <line v-for="(s, i) in geo.spokes" :key="`s${i}`" :x1="CX" :y1="CY" :x2="s[0]" :y2="s[1]" class="ds-radar__ring" />
    <polygon v-if="geo.prev" :points="geo.prevPolygon" class="ds-radar__prev" />
    <polygon :points="geo.valuePolygon" class="ds-radar__now" />
    <template v-for="(p, i) in geo.value" :key="`d${i}`">
      <circle v-if="p" :cx="p[0]" :cy="p[1]" :r="axes[i].key === focus ? 5 : 3" class="ds-radar__dot" :class="{ 'is-focus': axes[i].key === focus }" />
    </template>
    <g v-for="l in labels" :key="`l${l.key}`" :text-anchor="l.anchor">
      <text :x="l.x" :y="l.labelY" class="ds-radar__label" :class="{ 'is-focus': l.focus }">{{ l.label }}</text>
      <text :x="l.x" :y="l.valueY" class="ds-radar__value">{{ l.value }}</text>
    </g>
    <text :x="CX + 4" :y="CY - R + 12" class="ds-radar__scale">{{ geo.domain[1] }}</text>
    <text :x="CX + 4" :y="CY - 4" class="ds-radar__scale">{{ geo.domain[0] }}</text>
  </svg>
  <div v-else class="ds-radar__empty" :style="{ inlineSize: `${size}px`, blockSize: `${size}px` }" role="img" :aria-label="ariaLabel">
    <span aria-hidden="true">{{ t("ds.chart.empty") }}</span>
  </div>
</template>

<style scoped>
.ds-radar {
  display: block;
  max-inline-size: 100%;
  block-size: auto;
}
.ds-radar__ring {
  fill: none;
  stroke: var(--line);
}
.ds-radar__prev {
  fill: none;
  stroke: var(--ink-3);
  stroke-width: 1.25;
  stroke-dasharray: 3 3;
}
.ds-radar__now {
  fill: color-mix(in srgb, var(--series) var(--series-fill), transparent);
  stroke: var(--series);
  stroke-width: 2;
  stroke-linejoin: round;
}
.ds-radar__dot {
  fill: var(--surface);
  stroke: var(--series);
  stroke-width: 2;
}
.ds-radar__dot.is-focus {
  fill: var(--series-focus);
  stroke: var(--surface);
}
.ds-radar__label {
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 500;
  fill: var(--ink-2);
}
.ds-radar__label.is-focus {
  fill: var(--series-focus-ink);
  font-weight: 700;
}
.ds-radar__value {
  font-family: var(--font-num);
  font-size: 15px;
  font-weight: 700;
  fill: var(--ink);
}
.ds-radar__scale {
  font-family: var(--font-num);
  font-size: 10px;
  fill: var(--ink-3);
}
.ds-radar__empty {
  display: grid;
  place-items: center;
  max-inline-size: 100%;
  border: 1px dashed var(--line);
  border-radius: 50%;
  color: var(--ink-3);
  font-size: var(--fs-13);
}
</style>
