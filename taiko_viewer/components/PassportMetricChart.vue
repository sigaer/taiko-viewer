<script setup lang="ts">
import type { SkillPassportSegment, SkillPassportTrendDimension } from '~/types/player-growth';
import { passportMetricRuns } from '~/utils/passportNarrative';
const props = defineProps<{ segments: SkillPassportSegment[]; dimension: SkillPassportTrendDimension; label: string; from: string; to: string }>();
const { t, locale } = useI18n();
const runs = computed(() => passportMetricRuns(props.segments, props.dimension));
const points = computed(() => runs.value.flatMap(run => run.points));
const scattered = computed(() => points.value.length > 0 && runs.value.every(run => run.points.length === 1));
const selectedId = ref('');
watch(() => [props.dimension, props.segments], () => { selectedId.value = ''; });
const selected = computed(() => points.value.find(p => p.id === selectedId.value) || points.value.at(-1));
const date = (day: string) => new Intl.DateTimeFormat(locale.value === 'ja' ? 'ja-JP' : 'zh-CN', { month: 'short', day: 'numeric', timeZone: 'Asia/Shanghai' }).format(new Date(`${day}T12:00:00+08:00`));
const bounds = computed(() => {
  if (props.dimension !== 'rating') return { min: 0, max: 15 };
  const values = points.value.map(p => p.value), min = Math.min(...values), max = Math.max(...values);
  const padding = Math.max((max - min) * .12, .25);
  return { min: min - padding, max: max + padding };
});
const x = (day: string) => 44 + (Date.parse(day) - Date.parse(props.from)) / Math.max(86400000, Date.parse(props.to) - Date.parse(props.from)) * 628;
const y = (value: number) => 190 - (value - bounds.value.min) / (bounds.value.max - bounds.value.min) * 152;
const path = (rows: typeof points.value) => rows.map((p, i) => `${i ? 'L' : 'M'}${x(p.day).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
const pointLabel = (p: typeof points.value[number]) => t('passport.trend.pointLabel', { day: date(p.day), dimension: props.label, value: p.value.toFixed(2) });
const summary = computed(() => {
  const first = points.value[0], last = points.value.at(-1);
  if (!first || !last) return t('passport.trend.noPoints');
  if (points.value.length === 1) return t('passport.trend.onePoint', { day: date(first.day), dimension: props.label, value: first.value.toFixed(2) });
  if (runs.value.length > 1) return t('passport.trend.independent', { count: points.value.length, dimension: props.label });
  return t('passport.trend.summary', { dimension: props.label, fromDay: date(first.day), from: first.value.toFixed(2), toDay: date(last.day), to: last.value.toFixed(2) });
});
</script>
<template>
  <div class="passport-metric" :data-metric="dimension">
    <p class="passport-chart-summary" :id="`summary-${dimension}`">{{ summary }}</p>
    <span v-if="runs.length > 1" :id="`groups-${dimension}`" class="sr-only">{{ t('passport.trend.groups', { count: runs.length }) }}</span>
    <p v-if="dimension !== 'rating'" class="passport-scale">{{ t('passport.skillScale') }}</p>
    <ol v-if="scattered" class="passport-point-records" :aria-label="summary" :aria-describedby="runs.length > 1 ? `groups-${dimension}` : undefined">
      <li v-for="point in points" :key="point.id"><time>{{ date(point.day) }}</time><strong>{{ point.value.toFixed(2) }}</strong></li>
    </ol>
    <template v-else-if="points.length">
      <svg class="passport-chart" viewBox="0 0 720 225" role="group" :aria-labelledby="`summary-${dimension}`" :aria-describedby="runs.length > 1 ? `groups-${dimension}` : undefined">
        <line x1="44" y1="190" x2="672" y2="190" class="axis" />
        <text x="4" y="42">{{ bounds.max.toFixed(dimension === 'rating' ? 2 : 0) }}</text>
        <text x="4" y="190">{{ bounds.min.toFixed(dimension === 'rating' ? 2 : 0) }}</text>
        <g v-for="run in runs" :key="run.id" class="passport-chart__segment">
          <path v-if="run.points.length >= 2" :d="path(run.points)" />
          <g v-for="point in run.points" :key="point.id">
            <circle :cx="x(point.day)" :cy="y(point.value)" r="4" aria-hidden="true" />
            <circle class="passport-chart__hit" :cx="x(point.day)" :cy="y(point.value)" r="26" tabindex="0" role="button" :aria-label="pointLabel(point)" @mouseenter="selectedId = point.id" @click="selectedId = point.id" @focus="selectedId = point.id" @keydown.enter.prevent="selectedId = point.id" @keydown.space.prevent="selectedId = point.id" />
          </g>
        </g>
        <text x="44" y="218">{{ date(from) }}</text><text x="672" y="218" text-anchor="end">{{ date(to) }}</text>
      </svg>
      <p v-if="selected" class="passport-chart-detail" role="status">{{ date(selected.day) }} · {{ label }} · {{ selected.value.toFixed(2) }}</p>
    </template>
  </div>
</template>
<style scoped>
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
.passport-metric { min-width: 0; }
.passport-chart-summary { color: var(--viewer-text-muted); font-size: 13px; line-height: 1.6; margin: 12px 0; }
.passport-scale { color: var(--viewer-text-muted); font-size: 12px; }
.passport-point-records { display: grid; grid-template-columns: repeat(auto-fit,minmax(100px,1fr)); list-style: none; gap: 16px; padding: 8px 0; margin: 0; }
.passport-point-records li { display: grid; gap: 6px; border-left: 1px solid var(--viewer-border); padding-left: 12px; }
.passport-point-records time { color: var(--viewer-text-muted); font-size: 12px; }
.passport-point-records strong { color: var(--viewer-text); font-size: 22px; font-variant-numeric: tabular-nums; }
.passport-chart { width: 100%; display: block; overflow: visible; }
.axis { stroke: var(--viewer-border); }
text { fill: var(--viewer-text-muted); font-size: 12px; }
path { fill: none; stroke: var(--viewer-accent-strong); stroke-width: 2; stroke-linejoin: round; }
circle { fill: var(--viewer-surface); stroke: var(--viewer-accent-strong); stroke-width: 2; }
circle.passport-chart__hit { fill: transparent; stroke: transparent; cursor: pointer; }
circle:focus-visible { outline: 2px solid var(--viewer-accent-strong); outline-offset: 2px; }
.passport-chart-detail { min-height: 22px; margin: 4px 0 0; text-align: right; color: var(--viewer-text); font-size: 13px; font-variant-numeric: tabular-nums; }
@media (max-width: 680px) { .passport-point-records { grid-template-columns: repeat(2,minmax(0,1fr)); } .passport-chart text { font-size: 22px; } .passport-chart__hit { r: 48px; } }
</style>
