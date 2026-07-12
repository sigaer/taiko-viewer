<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    labels: string[];
    values: number[];
    maxValue?: number;
    ariaLabel?: string;
  }>(),
  {
    maxValue: 0,
    ariaLabel: "Radar chart"
  }
);

const size = 260;
const center = size / 2;
const radius = 86;
const angleOffset = -Math.PI / 2;
const gridLevels = [0.25, 0.5, 0.75, 1];

const resolvedMax = computed(() => {
  const explicit = Number(props.maxValue || 0);
  if (explicit > 0) return explicit;
  const maxValue = Math.max(...props.values, 0);
  if (maxValue <= 0) return 10;
  return Math.max(10, Math.ceil(maxValue * 2) / 2);
});

const getPoint = (ratio: number, index: number, extra = 0) => {
  const angle = (Math.PI * 2 * index) / Math.max(props.labels.length, 1) + angleOffset;
  const scopedRadius = radius * ratio + extra;
  return {
    x: center + scopedRadius * Math.cos(angle),
    y: center + scopedRadius * Math.sin(angle)
  };
};

const gridPolygons = computed(() =>
  gridLevels.map((level) =>
    props.labels
      .map((_, index) => {
        const point = getPoint(level, index);
        return `${point.x},${point.y}`;
      })
      .join(" ")
  )
);

const axisLines = computed(() =>
  props.labels.map((_, index) => {
    const start = getPoint(0, index);
    const end = getPoint(1, index);
    return {
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y
    };
  })
);

const dataPoints = computed(() =>
  props.labels.map((_, index) => {
    const value = Number(props.values[index] || 0);
    const ratio = Math.min(1, value / resolvedMax.value);
    const point = getPoint(ratio, index);
    return {
      x: point.x,
      y: point.y
    };
  })
);

const dataPolygon = computed(() => dataPoints.value.map((point) => `${point.x},${point.y}`).join(" "));

const labelPoints = computed(() =>
  props.labels.map((label, index) => {
    const point = getPoint(1, index, 22);
    const deltaX = point.x - center;
    const anchor = deltaX > 10 ? "start" : deltaX < -10 ? "end" : "middle";
    return {
      label,
      x: point.x,
      y: point.y + 4,
      anchor
    };
  })
);
</script>

<template>
  <svg class="story-radar-chart" viewBox="0 0 260 260" role="img" :aria-label="ariaLabel">
    <polygon v-for="(polygon, index) in gridPolygons" :key="`grid-${index}`" class="story-radar-chart__grid" :points="polygon" />
    <line
      v-for="(line, index) in axisLines"
      :key="`axis-${index}`"
      class="story-radar-chart__axis"
      :x1="line.x1"
      :y1="line.y1"
      :x2="line.x2"
      :y2="line.y2"
    />
    <polygon class="story-radar-chart__area" :points="dataPolygon" />
    <circle
      v-for="(point, index) in dataPoints"
      :key="`point-${index}`"
      class="story-radar-chart__point"
      :cx="point.x"
      :cy="point.y"
      r="3.2"
    />
    <text
      v-for="label in labelPoints"
      :key="label.label"
      class="story-radar-chart__label"
      :x="label.x"
      :y="label.y"
      :text-anchor="label.anchor"
    >
      {{ label.label }}
    </text>
  </svg>
</template>

<style scoped>
.story-radar-chart {
  width: min(100%, 20rem);
  height: auto;
  aspect-ratio: 1;
  display: block;
  overflow: visible;
}

.story-radar-chart__grid {
  fill: rgba(247, 251, 255, 0.42);
  stroke: rgba(57, 120, 200, 0.18);
  stroke-width: 1;
}

.story-radar-chart__axis {
  stroke: rgba(57, 120, 200, 0.22);
  stroke-width: 1;
}

.story-radar-chart__area {
  fill: rgba(57, 120, 200, 0.2);
  stroke: rgba(57, 120, 200, 0.92);
  stroke-width: 2;
}

.story-radar-chart__point {
  fill: #f7fbff;
  stroke: rgba(23, 54, 93, 0.9);
  stroke-width: 1.4;
}

.story-radar-chart__label {
  fill: #5c7697;
  font-size: 12px;
  letter-spacing: 0.04em;
}

@media (max-width: 720px) {
  .story-radar-chart {
    width: min(100%, 10.5rem);
  }

  .story-radar-chart__label {
    font-size: 10px;
  }
}
</style>
