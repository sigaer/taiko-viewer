<script setup lang="ts">
import type { SkillPassportSegment, SkillPassportTrendDimension } from '~/types/player-growth';
import { passportMetricRuns } from '~/utils/passportNarrative';
const props = defineProps<{ segments: SkillPassportSegment[]; dimension: SkillPassportTrendDimension; label: string; from: string; to: string }>();
const { t, locale } = useI18n();
const chartElement = ref<SVGSVGElement | null>(null);
const chartWidth = ref(720);
let resizeObserver: ResizeObserver | null = null;
watch(chartElement, element => {
  resizeObserver?.disconnect();
  if (!element) return;
  const resize = () => { chartWidth.value = Math.max(240, element.getBoundingClientRect().width); };
  resize();
  resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(element);
}, { flush: 'post' });
onBeforeUnmount(() => resizeObserver?.disconnect());
const runs = computed(() => passportMetricRuns(props.segments, props.dimension));
const points = computed(() => runs.value.flatMap(run => run.points));
const selectedId = ref('');
watch(() => [props.dimension, props.segments], () => { selectedId.value = ''; });
const selected = computed(() => points.value.find(p => p.id === selectedId.value) || points.value.at(-1));
const selectedIndex = computed(() => points.value.findIndex(p => p.id === selected.value?.id));
const stepPoint = (step: number) => { const point = points.value[selectedIndex.value + step]; if (point) selectedId.value = point.id; };
const dateFormatter = computed(() => new Intl.DateTimeFormat(locale.value === 'ja' ? 'ja-JP' : 'zh-CN', { year: props.from.slice(0, 4) !== props.to.slice(0, 4) ? 'numeric' : undefined, month: 'short', day: 'numeric', timeZone: 'Asia/Shanghai' }));
const date = (day: string) => dateFormatter.value.format(new Date(`${day}T12:00:00+08:00`));
const bounds = computed(() => {
  if (props.dimension !== 'rating') return { min: 0, max: 15.5 };
  if (!points.value.length) return { min: 0, max: 1 };
  const values = points.value.map(p => p.value), min = Math.min(...values), max = Math.max(...values);
  const padding = Math.max((max - min) * .12, .25);
  return { min: min - padding, max: max + padding };
});
const ticks = computed(() => props.dimension === 'rating'
  ? [bounds.value.min, (bounds.value.min + bounds.value.max) / 2, bounds.value.max]
  : [0, 5, 10, 15.5]);
const x = (day: string) => 44 + (Date.parse(day) - Date.parse(props.from)) / Math.max(86400000, Date.parse(props.to) - Date.parse(props.from)) * (chartWidth.value - 92);
const y = (value: number) => 190 - (value - bounds.value.min) / (bounds.value.max - bounds.value.min) * 152;
const path = (rows: typeof points.value) => rows.map((p, i) => `${i ? 'L' : 'M'}${x(p.day).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
const pointLabel = (p: typeof points.value[number]) => t('passport.trend.pointLabel', { day: date(p.day), dimension: props.label, value: p.value.toFixed(2) });
const summary = computed(() => {
  const first = points.value[0], last = points.value.at(-1);
  if (!first || !last) return t('passport.trend.noPoints');
  if (points.value.length === 1) return t('passport.trend.onePoint', { day: date(first.day), dimension: props.label, value: first.value.toFixed(2) });
  if (runs.value.length > 1) return t(runs.value.every(run => run.points.length === 1) ? 'passport.trend.discrete' : 'passport.trend.independent', { count: points.value.length, dimension: props.label });
  return t('passport.trend.summary', { dimension: props.label, fromDay: date(first.day), from: first.value.toFixed(2), toDay: date(last.day), to: last.value.toFixed(2) });
});
</script>
<template>
  <div class="passport-metric" :data-metric="dimension">
    <p class="passport-chart-summary" :id="`summary-${dimension}`">{{ summary }}</p>
    <span v-if="runs.length > 1" :id="`groups-${dimension}`" class="sr-only">{{ t('passport.trend.groups', { count: runs.length }) }}</span>
    <template v-if="points.length">
      <svg ref="chartElement" class="passport-chart" :viewBox="`0 0 ${chartWidth} 225`" role="group" :aria-labelledby="`summary-${dimension}`" :aria-describedby="runs.length > 1 ? `groups-${dimension}` : undefined">
        <g v-for="tick in ticks" :key="tick" aria-hidden="true">
          <line x1="44" :y1="y(tick)" :x2="chartWidth - 48" :y2="y(tick)" class="axis" />
          <text x="34" :y="y(tick) + 4" text-anchor="end">{{ dimension === 'rating' ? tick.toFixed(2) : tick }}</text>
        </g>
        <g v-for="run in runs" :key="run.id" class="passport-chart__segment">
          <path v-if="run.points.length >= 2" :d="path(run.points)" />
          <g v-for="point in run.points" :key="point.id">
            <circle :cx="x(point.day)" :cy="y(point.value)" r="4" aria-hidden="true" :class="{ 'is-selected': selected?.id === point.id }" />
            <circle class="passport-chart__hit" :cx="x(point.day)" :cy="y(point.value)" r="22" tabindex="0" role="button" :aria-label="pointLabel(point)" @pointermove="selectedId = point.id" @click="selectedId = point.id" @focus="selectedId = point.id" @keydown.enter.prevent="selectedId = point.id" @keydown.space.prevent="selectedId = point.id" />
          </g>
        </g>
        <text x="44" y="218">{{ date(from) }}</text><text :x="chartWidth - 48" y="218" text-anchor="end">{{ date(to) }}</text>
      </svg>
      <div v-if="selected" class="passport-chart-selection">
        <button v-if="points.length > 1" type="button" :disabled="selectedIndex <= 0" :aria-label="t('passport.trend.previousPoint', { dimension: label })" @click="stepPoint(-1)"><span aria-hidden="true">←</span></button>
        <p class="passport-chart-detail" role="status">{{ date(selected.day) }} · {{ label }} · {{ selected.value.toFixed(2) }}</p>
        <button v-if="points.length > 1" type="button" :disabled="selectedIndex >= points.length - 1" :aria-label="t('passport.trend.nextPoint', { dimension: label })" @click="stepPoint(1)"><span aria-hidden="true">→</span></button>
      </div>
    </template>
  </div>
</template>
<style scoped>
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
.passport-metric { min-width: 0; }
.passport-chart-summary { color:var(--viewer-text-muted); font-size: 13px; line-height: 1.6; margin: 12px 0; }
.passport-scale { color:var(--viewer-text-muted); font-size: 12px; }
.passport-chart { width: 100%; height: 240px; display: block; overflow: visible; }
.axis { stroke: var(--viewer-border); }
text { fill: var(--viewer-text-muted); font-size: 12px; }
path { fill: none; stroke: var(--viewer-accent-strong); stroke-width: 2; stroke-linejoin: round; }
circle { fill: var(--viewer-surface); stroke: var(--viewer-accent-strong); stroke-width: 2; }
circle.is-selected { fill: var(--viewer-accent-strong); }
circle.passport-chart__hit { fill: transparent; stroke: transparent; cursor: pointer; }
circle:focus-visible { outline: 2px solid var(--viewer-accent-strong); outline-offset: 2px; }
.passport-chart-selection { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
.passport-chart-selection button { flex: 0 0 44px; min-height: 44px; border: 1px solid var(--viewer-border); border-radius: 8px; color:var(--viewer-text); background:var(--viewer-surface); cursor: pointer; }
.passport-chart-selection button:disabled { opacity: .4; cursor: default; }
.passport-chart-selection button:focus-visible { outline: 2px solid var(--viewer-accent-strong); outline-offset: 2px; }
.passport-chart-detail { min-height: 22px; margin: 0; text-align: right; color:var(--viewer-text); font-size: 13px; font-variant-numeric: tabular-nums; }
</style>
