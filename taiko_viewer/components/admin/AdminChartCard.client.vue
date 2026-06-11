<script setup lang="ts">
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
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
let chart: echarts.ECharts | null = null;

const renderChart = () => {
  if (!chartEl.value) return;
  if (!chart) {
    chart = echarts.init(chartEl.value);
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
  renderChart();
  window.addEventListener("resize", handleResize);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", handleResize);
  chart?.dispose();
  chart = null;
});
</script>

<template>
  <div class="admin-chart-card">
    <div class="admin-chart-card__head">
      <div>
        <h3>{{ title }}</h3>
        <p v-if="subtitle">{{ subtitle }}</p>
      </div>
    </div>
    <div ref="chartEl" class="admin-chart-card__canvas" :style="{ height: `${height}px` }"></div>
  </div>
</template>

<style scoped>
.admin-chart-card {
  padding: 22px;
  border-radius: 24px;
  background: rgba(255, 252, 246, 0.92);
  border: 1px solid rgba(193, 174, 142, 0.22);
  box-shadow: 0 18px 40px rgba(133, 115, 89, 0.12);
}

.admin-chart-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.admin-chart-card__head h3 {
  margin: 0;
  font-size: 19px;
  color: #1f2937;
}

.admin-chart-card__head p {
  margin: 6px 0 0;
  color: #7b6d5c;
  font-size: 13px;
}

.admin-chart-card__canvas {
  width: 100%;
}
</style>
