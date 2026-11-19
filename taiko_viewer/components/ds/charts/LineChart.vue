<script setup lang="ts">
// Trend line, single series in the brand series colour (P0-25; 04 §3, §9; V1.2 §9.22).
// Prepared numbers only: `points` in x order, a null value breaks the line. No legend for one series, ≤ 4 y
// reference lines, x labels thinned so they never touch. Pointer hover / touch shows a read-out line.
// Width follows the container (measured after mount; SSR renders at the default width).
import { formatFixed, labelWidth, lineGeometry, nearestIndex, xLabelIndices } from "~/utils/ds/charts";

const props = withDefaults(
  defineProps<{
    points: ReadonlyArray<{ label: string; value: number | null }>;
    height?: number;
    digits?: number;
    /** Annotated points: a dashed rule and a neutral dot; the text shows in the read-out. */
    marks?: ReadonlyArray<{ index: number; text: string }>;
    /** Accessible chart name; defaults to ds.chart.line.name. */
    name?: string;
  }>(),
  { height: 220, digits: 2, marks: () => [], name: "" }
);

const { t } = useI18n();
const el = ref<HTMLElement | null>(null);
const width = ref(640);
let ro: ResizeObserver | null = null;
onMounted(() => {
  const measure = () => {
    if (el.value) width.value = Math.max(240, Math.floor(el.value.clientWidth));
  };
  measure();
  if (typeof ResizeObserver !== "undefined" && el.value) {
    ro = new ResizeObserver(measure);
    ro.observe(el.value);
  }
});
onBeforeUnmount(() => ro?.disconnect());

const values = computed(() => props.points.map((p) => p.value));
const geo = computed(() => lineGeometry(values.value, width.value, props.height));
const chartName = computed(() => props.name || t("ds.chart.line.name"));

const xLabels = computed(() => {
  const g = geo.value;
  if (!g) return [];
  const n = props.points.length;
  const widest = Math.max(0, ...props.points.map((p) => labelWidth(p.label)));
  return xLabelIndices(n, width.value - g.pad.l - g.pad.r, widest).map((i) => ({
    i,
    x: g.x(i),
    text: props.points[i].label,
    anchor: n === 1 ? "middle" : i === 0 ? "start" : i === n - 1 ? "end" : "middle"
  }));
});

const marks = computed(() => {
  const g = geo.value;
  if (!g) return [];
  return props.marks
    .map((m) => g.points.find((p) => p.i === m.index))
    .filter((p): p is NonNullable<typeof p> => !!p);
});

const last = computed(() => geo.value?.points[geo.value.points.length - 1] ?? null);

const ariaLabel = computed(() => {
  const g = geo.value;
  if (!g) return t("ds.chart.summary.empty", { name: chartName.value });
  if (g.points.length === 1) return t("ds.chart.summary.point", { name: chartName.value, value: `${props.points[g.points[0].i].label} ${formatFixed(g.points[0].v, props.digits)}` });
  return t("ds.chart.summary.series", {
    name: chartName.value,
    count: g.points.length,
    from: formatFixed(g.points[0].v, props.digits),
    to: formatFixed(g.points[g.points.length - 1].v, props.digits)
  });
});

/* ---- pointer read-out ---- */
const hover = ref<number | null>(null);
function onMove(e: PointerEvent) {
  const g = geo.value;
  if (!g || !el.value) return;
  const x = e.clientX - el.value.getBoundingClientRect().left;
  const i = nearestIndex(x, props.points.length, g.pad.l, width.value - g.pad.r);
  // Snap to the nearest index that has a value
  const withValue = g.points.reduce((best, p) => (best == null || Math.abs(p.i - i) < Math.abs(best - i) ? p.i : best), null as number | null);
  hover.value = withValue;
}
const hoverPoint = computed(() => (hover.value == null ? null : geo.value?.points.find((p) => p.i === hover.value) ?? null));
const hoverMark = computed(() => props.marks.find((m) => m.index === hover.value));
const tipLeft = computed(() => (hoverPoint.value ? Math.max(56, Math.min(width.value - 56, hoverPoint.value.x)) : 0));
</script>

<template>
  <div ref="el" class="ds-line" :style="{ height: `${height}px` }" @pointermove="onMove" @pointerleave="hover = null">
    <svg v-if="geo" :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`" role="img" :aria-label="ariaLabel" class="ds-line__svg">
      <g v-for="tk in geo.ticks" :key="tk.v">
        <line :x1="geo.pad.l" :x2="width - geo.pad.r" :y1="tk.y" :y2="tk.y" class="ds-line__grid" />
        <text :x="geo.pad.l - 8" :y="tk.y + 4" text-anchor="end" class="ds-line__ax">{{ tk.text }}</text>
      </g>
      <text v-for="xl in xLabels" :key="`x${xl.i}`" :x="xl.x" :y="height - 6" :text-anchor="xl.anchor" class="ds-line__ax">{{ xl.text }}</text>
      <path v-if="geo.area" :d="geo.area" class="ds-line__area" />
      <path v-if="geo.line" :d="geo.line" class="ds-line__path" />
      <circle v-for="p in geo.isolated" :key="`s${p.i}`" :cx="p.x" :cy="p.y" r="3.5" class="ds-line__dot" />
      <g v-for="p in marks" :key="`m${p.i}`">
        <line :x1="p.x" :x2="p.x" :y1="geo.pad.t" :y2="geo.baseline" class="ds-line__mark" />
        <circle :cx="p.x" :cy="p.y" r="5" class="ds-line__mark-dot" />
      </g>
      <circle v-if="last" :cx="last.x" :cy="last.y" r="4.5" class="ds-line__end" />
      <g v-if="hoverPoint">
        <line :x1="hoverPoint.x" :x2="hoverPoint.x" :y1="geo.pad.t" :y2="geo.baseline" class="ds-line__cross" />
        <circle :cx="hoverPoint.x" :cy="hoverPoint.y" r="5" class="ds-line__end" />
      </g>
    </svg>
    <div v-else class="ds-line__empty" role="img" :aria-label="ariaLabel">
      <span aria-hidden="true">{{ t("ds.chart.empty") }}</span>
    </div>
    <div v-if="hoverPoint" class="ds-line__tip" :style="{ left: `${tipLeft}px` }" aria-hidden="true">
      <b class="num">{{ formatFixed(hoverPoint.v, digits) }}</b>
      <span>{{ points[hoverPoint.i].label }}</span>
      <em v-if="hoverMark">{{ hoverMark.text }}</em>
    </div>
  </div>
</template>

<style scoped>
.ds-line {
  position: relative;
  inline-size: 100%;
  min-inline-size: 0;
  overflow: hidden;
  touch-action: pan-y;
}
.ds-line__svg {
  display: block;
}
.ds-line__grid {
  stroke: var(--line);
}
.ds-line__ax {
  font-family: var(--font-num);
  font-size: 12px;
  fill: var(--ink-3);
}
.ds-line__area {
  fill: color-mix(in srgb, var(--series) 9%, transparent);
}
.ds-line__path {
  fill: none;
  stroke: var(--series);
  stroke-width: 2.25;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.ds-line__dot,
.ds-line__end {
  fill: var(--series);
  stroke: var(--surface);
  stroke-width: 2;
}
.ds-line__mark {
  stroke: var(--chart-mark);
  stroke-dasharray: 2 3;
}
.ds-line__mark-dot {
  fill: var(--chart-mark);
  stroke: var(--surface);
  stroke-width: 2;
}
.ds-line__cross {
  stroke: var(--ink-3);
}
.ds-line__empty {
  display: grid;
  place-items: center;
  block-size: 100%;
  border: 1px dashed var(--line);
  border-radius: var(--r-ctl);
  color: var(--ink-3);
  font-size: var(--fs-13);
}
.ds-line__tip {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--sp-1) var(--sp-3);
  border-radius: var(--r-ctl);
  background: var(--overlay-bg);
  border: 1px solid var(--overlay-line);
  box-shadow: var(--shadow-lift);
  color: var(--ink-2);
  font-size: var(--fs-11);
  line-height: 1.3;
  pointer-events: none;
  white-space: nowrap;
}
.ds-line__tip b {
  font-size: var(--fs-16);
  color: var(--ink);
}
.ds-line__tip em {
  font-style: normal;
  color: var(--chart-mark);
}
</style>
