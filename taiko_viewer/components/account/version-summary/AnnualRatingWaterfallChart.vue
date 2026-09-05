<script setup lang="ts">
import { computed } from "vue";

export type RatingWaterfallRank = {
  key: string;
  label: string;
  order: number;
  colorGroup?: "low" | "mid" | "high";
  bins: {
    ratingMin: number;
    ratingMax: number;
    relative: number;
  }[];
};

const props = defineProps<{
  ratingB20: number;
  percentile: number;
  currentRankKey?: string;
  ranks: RatingWaterfallRank[];
  rankLabels?: string[];
}>();

const RANK_COUNT = 19;

const viewBoxWidth = 1200;
const viewBoxHeight = 1700;
const chartLeft = 90;
const chartRight = 1010;
const chartTop = 70;
const chartBottom = 1600;
const axisY = 1630;
const layerGap = 76;
const layerDepth = 3;
const maxPeakHeight = 162;
const fallbackRatingMax = 16;

const clamp = (value: number, minimum = 0, maximum = 1) =>
  Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));

const colorGroupForIndex = (index: number): "low" | "mid" | "high" =>
  index < 6 ? "low" : index < 13 ? "mid" : "high";

type RankEntry = {
  key: string;
  label: string;
  order: number;
  colorGroup: "low" | "mid" | "high";
  bins: RatingWaterfallRank["bins"];
};

const rankEntries = computed<RankEntry[]>(() => {
  const fallbackLabels = Array.isArray(props.rankLabels) ? props.rankLabels : [];
  if (props.ranks.length > 0) {
    return [...props.ranks]
      .sort((left, right) => left.order - right.order)
      .map((rank, index) => ({
        key: rank.key,
        label: rank.label,
        order: rank.order,
        colorGroup: rank.colorGroup || colorGroupForIndex(index),
        bins: [...rank.bins].sort((left, right) => left.ratingMin - right.ratingMin)
      }));
  }
  return Array.from({ length: RANK_COUNT }, (_, index) => ({
    key: `rank-${index + 1}`,
    label: fallbackLabels[index] || `${index + 1}`,
    order: index + 1,
    colorGroup: colorGroupForIndex(index),
    bins: []
  }));
});

const ratingRange = computed(() => {
  const bins = rankEntries.value.flatMap((rank) => rank.bins);
  const minimum = bins.length ? Math.min(...bins.map((bin) => bin.ratingMin)) : 0;
  const maximum = bins.length ? Math.max(...bins.map((bin) => bin.ratingMax)) : fallbackRatingMax;
  const span = maximum > minimum ? maximum - minimum : fallbackRatingMax;
  return { minimum, maximum, span };
});

const xForRating = (rating: number) =>
  chartLeft + ((rating - ratingRange.value.minimum) / ratingRange.value.span) * (chartRight - chartLeft);

const yForValue = (baseline: number, value: number) =>
  baseline - clamp(Math.sqrt(clamp(value)), 0, 1) * maxPeakHeight;

const buildSmoothEdge = (points: Array<{ x: number; y: number }>) => {
  if (points.length === 0) return "";
  if (points.length === 1) return `L ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  const segments: string[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] || points[index];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[index + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    segments.push(`C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`);
  }
  return segments.join(" ");
};

const createLayerPath = (rank: RankEntry, layerIndex: number) => {
  if (!rank.bins.length) return "";
  const baseline = chartBottom - layerIndex * layerGap;
  const offset = layerIndex * layerDepth;
  const points = rank.bins.map((bin) => ({
    x: xForRating((bin.ratingMin + bin.ratingMax) / 2) + offset,
    y: yForValue(baseline, bin.relative) - layerIndex * 1.8
  }));
  const firstX = xForRating(rank.bins[0].ratingMin) + offset;
  const lastX = xForRating(rank.bins[rank.bins.length - 1].ratingMax) + offset;
  const baseY = baseline;
  const edge = buildSmoothEdge(points);
  return `M ${firstX.toFixed(2)} ${baseY.toFixed(2)} L ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)} ${edge} L ${lastX.toFixed(2)} ${baseY.toFixed(2)} Z`;
};

const layers = computed(() =>
  rankEntries.value.map((rank, index) => {
    const baseline = chartBottom - index * layerGap;
    const isCurrent = Boolean(props.currentRankKey && rank.key === props.currentRankKey);
    return {
      ...rank,
      index,
      baseline,
      path: createLayerPath(rank, index),
      isCurrent
    };
  })
);

const formatTick = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

const verticalGrid = computed(() => {
  const divisions = 8;
  const output: Array<{ x: number; label: string }> = [];
  for (let index = 0; index <= divisions; index += 1) {
    const ratio = index / divisions;
    const value = ratingRange.value.minimum + ratingRange.value.span * ratio;
    output.push({
      x: chartLeft + (chartRight - chartLeft) * ratio,
      label: formatTick(value)
    });
  }
  return output;
});

const rankLabelItems = computed(() =>
  layers.value.map((layer) => ({
    key: layer.key,
    order: layer.order,
    label: layer.label,
    y: layer.baseline + 8,
    isCurrent: layer.isCurrent
  }))
);

const markerX = computed(() => xForRating(clamp(props.ratingB20, ratingRange.value.minimum, ratingRange.value.maximum)));
const hasMarker = computed(() => Number.isFinite(props.ratingB20) && props.ratingB20 > 0);
const percentileLabel = computed(() => `${Math.max(0, Math.min(100, props.percentile)).toFixed(2)}%`);
const isEmpty = computed(() => props.ranks.length === 0);
</script>

<template>
  <div
    class="annual-rating-waterfall-chart"
    role="img"
    :aria-label="`rating b20 ${ratingB20.toFixed(4)}，超过 ${percentileLabel} 的鼓手`"
  >
    <svg class="annual-rating-waterfall-chart__svg" :viewBox="`0 0 ${viewBoxWidth} ${viewBoxHeight}`" aria-hidden="true">
      <defs>
        <linearGradient id="rating-waterfall-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#fdf7ea" />
          <stop offset="100%" stop-color="#f4ead6" />
        </linearGradient>
        <linearGradient id="rating-waterfall-low" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#7cb6f5" stop-opacity=".85" />
          <stop offset="55%" stop-color="#5a93e8" stop-opacity=".72" />
          <stop offset="100%" stop-color="#3d6fce" stop-opacity=".6" />
        </linearGradient>
        <linearGradient id="rating-waterfall-mid" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#f6ecd3" stop-opacity=".9" />
          <stop offset="55%" stop-color="#f8d9a6" stop-opacity=".66" />
          <stop offset="100%" stop-color="#eeb57c" stop-opacity=".62" />
        </linearGradient>
        <linearGradient id="rating-waterfall-high" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#ff9a6b" stop-opacity=".88" />
          <stop offset="55%" stop-color="#f2604e" stop-opacity=".78" />
          <stop offset="100%" stop-color="#c02a38" stop-opacity=".8" />
        </linearGradient>
        <radialGradient id="rating-waterfall-horizon" cx="50%" cy="100%" r="78%">
          <stop offset="0%" stop-color="#e7d4ae" stop-opacity=".5" />
          <stop offset="60%" stop-color="#efe1c4" stop-opacity=".18" />
          <stop offset="100%" stop-color="#fbf4e8" stop-opacity="0" />
        </radialGradient>
        <filter id="rating-waterfall-soft-shadow" x="-15%" y="-12%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="#8a6d42" flood-opacity=".12" />
        </filter>
      </defs>

      <rect x="0" y="0" :width="viewBoxWidth" :height="viewBoxHeight" fill="url(#rating-waterfall-bg)" />
      <rect x="0" y="0" :width="viewBoxWidth" :height="viewBoxHeight" fill="url(#rating-waterfall-horizon)" />

      <g class="annual-rating-waterfall-chart__grid">
        <path
          v-for="grid in verticalGrid"
          :key="`grid-${grid.x}`"
          :d="`M ${grid.x.toFixed(2)} ${chartTop} L ${grid.x.toFixed(2)} ${chartBottom}`"
          stroke="#d5c6a9"
          stroke-dasharray="6 10"
          stroke-width="1"
          fill="none"
        />
      </g>

      <g class="annual-rating-waterfall-chart__baselines">
        <path
          v-for="layer in layers"
          :key="`baseline-${layer.key}`"
          :d="`M ${chartLeft} ${layer.baseline.toFixed(2)} L ${chartRight} ${layer.baseline.toFixed(2)}`"
          stroke="#c3b294"
          stroke-dasharray="7 8"
          stroke-width="1"
          fill="none"
          :opacity="layer.isCurrent ? 0.8 : 0.42"
        />
      </g>

      <g v-if="!isEmpty" filter="url(#rating-waterfall-soft-shadow)">
        <path
          v-for="layer in layers"
          :key="`layer-${layer.key}`"
          class="annual-rating-waterfall-chart__layer"
          :style="{ '--i': layer.index }"
          :d="layer.path"
          :fill="layer.colorGroup === 'high' ? 'url(#rating-waterfall-high)' : layer.colorGroup === 'mid' ? 'url(#rating-waterfall-mid)' : 'url(#rating-waterfall-low)'"
          :fill-opacity="layer.colorGroup === 'high' ? 0.72 : layer.colorGroup === 'mid' ? 0.56 : 0.62"
          :stroke="layer.isCurrent ? '#7a3a20' : '#6b7e90'"
          :stroke-opacity="layer.isCurrent ? 0.85 : 0.3"
          stroke-width="1.2"
          vector-effect="non-scaling-stroke"
        />
      </g>

      <g v-if="isEmpty" class="annual-rating-waterfall-chart__empty-hint">
        <path
          :d="`M ${chartLeft} ${chartBottom} L ${chartRight} ${chartBottom} L ${chartRight} ${chartBottom - 26} C ${chartRight - 180} ${chartBottom - 74}, ${chartLeft + 200} ${chartBottom - 66}, ${chartLeft} ${chartBottom - 24} Z`"
          fill="#d9c9a8"
          fill-opacity=".2"
        />
      </g>

      <g class="annual-rating-waterfall-chart__labels">
        <text
          v-for="grid in verticalGrid"
          :key="`axis-${grid.x}`"
          :x="grid.x"
          :y="axisY + 40"
          text-anchor="middle"
        >
          {{ grid.label }}
        </text>
      </g>

      <path :d="`M ${chartLeft} ${axisY} L ${chartRight} ${axisY}`" stroke="#8d7d69" stroke-opacity=".4" stroke-width="1.4" fill="none" />

      <g v-if="hasMarker" class="annual-rating-waterfall-chart__marker">
        <line :x1="markerX" :y1="axisY" :x2="markerX" :y2="chartBottom" stroke="#c2513c" stroke-opacity=".3" stroke-width="1.4" stroke-dasharray="3 5" />
        <circle :cx="markerX" :cy="axisY" r="20" fill="#e0553e" fill-opacity=".16" />
        <circle :cx="markerX" :cy="axisY" r="9" fill="#b83a2f" />
        <path
          :d="`M ${markerX} ${axisY - 12} L ${markerX + 2.6} ${axisY - 2.6} L ${markerX + 12} ${axisY} L ${markerX + 2.6} ${axisY + 2.6} L ${markerX} ${axisY + 12} L ${markerX - 2.6} ${axisY + 2.6} L ${markerX - 12} ${axisY} L ${markerX - 2.6} ${axisY - 2.6} Z`"
          fill="#fff6ec"
          stroke="#b83a2f"
          stroke-width="1"
        />
      </g>

      <g class="annual-rating-waterfall-chart__rank-tags">
        <text
          v-for="tag in rankLabelItems"
          :key="`rank-${tag.key}`"
          :x="chartRight + 26"
          :y="tag.y"
          :class="{ 'is-current': tag.isCurrent }"
        >
          {{ String(tag.order).padStart(2, "0") }} {{ tag.label }}
        </text>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.annual-rating-waterfall-chart {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: grid;
  place-items: stretch;
  contain: layout paint;
}
.annual-rating-waterfall-chart__svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}
.annual-rating-waterfall-chart__grid,
.annual-rating-waterfall-chart__baselines,
.annual-rating-waterfall-chart__labels,
.annual-rating-waterfall-chart__empty-hint {
  animation: annual-waterfall-fade 0.6s ease-out both;
}
.annual-rating-waterfall-chart__grid {
  animation-delay: 0.08s;
  animation-name: annual-waterfall-grid-in;
  transform-box: fill-box;
  transform-origin: 50% 50%;
}
.annual-rating-waterfall-chart__baselines {
  animation-delay: 0.16s;
}
.annual-rating-waterfall-chart__labels {
  animation-delay: 0.24s;
}
.annual-rating-waterfall-chart__empty-hint {
  animation-delay: 0.2s;
}
.annual-rating-waterfall-chart__layer {
  animation: annual-waterfall-layer-rise 0.85s cubic-bezier(0.22, 0.9, 0.32, 1) both;
  animation-delay: calc(var(--i, 0) * 46ms + 0.32s);
  transform-box: fill-box;
  transform-origin: 50% 100%;
}
.annual-rating-waterfall-chart__marker {
  animation: annual-waterfall-marker-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  animation-delay: 1.15s;
  transform-box: fill-box;
  transform-origin: 50% 50%;
}
.annual-rating-waterfall-chart__rank-tags {
  animation: annual-waterfall-fade 0.6s ease-out both;
  animation-delay: 0.3s;
}
.annual-rating-waterfall-chart__labels text,
.annual-rating-waterfall-chart__rank-tags text {
  fill: #7e6f5a;
  font: 600 28px/1 var(--viewer-font-family);
  letter-spacing: 0;
}
.annual-rating-waterfall-chart__rank-tags text {
  fill: #7d5f49;
  font-size: 26px;
  text-anchor: start;
}
.annual-rating-waterfall-chart__rank-tags text.is-current {
  fill: #b03b2a;
  font-weight: 700;
}
@keyframes annual-waterfall-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes annual-waterfall-grid-in {
  from { opacity: 0; transform: scaleY(0.9); }
  to { opacity: 1; transform: scaleY(1); }
}
@keyframes annual-waterfall-layer-rise {
  from { opacity: 0; transform: scaleY(0); }
  to { opacity: 1; transform: scaleY(1); }
}
@keyframes annual-waterfall-marker-in {
  from { opacity: 0; transform: scale(0.4); }
  to { opacity: 1; transform: scale(1); }
}
</style>
