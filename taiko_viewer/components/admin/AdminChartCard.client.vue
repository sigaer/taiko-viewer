<script setup lang="ts">
import type { ECharts, EChartsOption } from "echarts";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
    option: EChartsOption;
    height?: number;
  }>(),
  {
    subtitle: "",
    height: 320
  }
);

const chartEl = ref<HTMLElement | null>(null);
let chart: ECharts | null = null;
let echartsModule: typeof import("echarts") | null = null;
let resizeObserver: ResizeObserver | null = null;

const renderChart = async () => {
  if (!chartEl.value) return;
  echartsModule ||= await import("echarts");
  if (!chartEl.value) return;
  if (!chart) {
    chart = echartsModule.init(chartEl.value);
  }
  chart.setOption(props.option, true);
  chart.resize();
};

const handleResize = () => {
  chart?.resize();
};

watch(
  () => props.option,
  () => renderChart(),
  { deep: true }
);

onMounted(() => {
  void renderChart();
  if (typeof ResizeObserver !== "undefined" && chartEl.value) {
    resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartEl.value);
  } else {
    window.addEventListener("resize", handleResize);
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  window.removeEventListener("resize", handleResize);
  chart?.dispose();
  chart = null;
});
</script>

<template>
  <section class="admin-chart-card">
    <header class="admin-chart-card__head">
      <div class="admin-chart-card__titles">
        <h3>{{ title }}</h3>
        <p v-if="subtitle">{{ subtitle }}</p>
      </div>
      <div v-if="$slots.actions" class="admin-chart-card__actions">
        <slot name="actions" />
      </div>
    </header>
    <div class="admin-chart-card__canvas" :style="{ minHeight: `${height}px` }">
      <div ref="chartEl" class="admin-chart-card__chart"></div>
    </div>
  </section>
</template>

<style scoped>
.admin-chart-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 18px 20px 12px;
  border-radius: var(--admin-radius, 12px);
  border: 1px solid var(--admin-border, #e3e8e8);
  background: var(--admin-surface, #ffffff);
}

.admin-chart-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-bottom: 8px;
}

.admin-chart-card__titles {
  min-width: 0;
}

.admin-chart-card__head h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--admin-ink, #1b2426);
}

.admin-chart-card__head p {
  margin: 4px 0 0;
  color: var(--admin-ink-secondary, #5d6b6e);
  font-size: 12px;
}

.admin-chart-card__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.admin-chart-card__canvas {
  position: relative;
  flex: 1 1 auto;
  width: 100%;
  min-width: 0;
}

.admin-chart-card__chart {
  position: absolute;
  inset: 0;
}
</style>
