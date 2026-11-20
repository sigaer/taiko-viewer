<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    values: number[];
    color?: string;
    width?: number;
    height?: number;
  }>(),
  {
    color: "var(--admin-primary, #006c76)",
    width: 240,
    height: 32
  }
);

const pad = 3;

const points = computed(() => {
  const values = props.values.map((value) => (Number.isFinite(value) ? value : 0));
  if (values.length < 2) return [] as Array<[number, number]>;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const innerW = props.width - pad * 2;
  const innerH = props.height - pad * 2;
  return values.map((value, index) => {
    const x = pad + (index / (values.length - 1)) * innerW;
    const y = max === min ? pad + innerH / 2 : pad + innerH - ((value - min) / span) * innerH;
    return [Number(x.toFixed(2)), Number(y.toFixed(2))] as [number, number];
  });
});

const linePath = computed(() =>
  points.value.map(([x, y], index) => `${index ? "L" : "M"}${x} ${y}`).join(" ")
);

const areaPath = computed(() => {
  if (!points.value.length) return "";
  const first = points.value[0];
  const last = points.value[points.value.length - 1];
  return `${linePath.value} L${last[0]} ${props.height} L${first[0]} ${props.height} Z`;
});
</script>

<template>
  <svg
    v-if="points.length"
    class="admin-sparkline"
    :viewBox="`0 0 ${width} ${height}`"
    preserveAspectRatio="none"
    aria-hidden="true"
    focusable="false"
  >
    <path :d="areaPath" :fill="color" fill-opacity="0.08" stroke="none" />
    <path
      :d="linePath"
      fill="none"
      :stroke="color"
      stroke-width="1.5"
      stroke-linejoin="round"
      stroke-linecap="round"
      vector-effect="non-scaling-stroke"
    />
  </svg>
</template>

<style scoped>
.admin-sparkline {
  display: block;
  width: 100%;
  height: 32px;
  overflow: visible;
}
</style>
