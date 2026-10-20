<script setup lang="ts">
import type { V2ConstantsItem } from "~/types/content";

const props = defineProps<{ songId: number; track: string }>();
const { locale, t } = useI18n();
const apiFetch = useViewerApiFetch();
const { data, pending, error, refresh } = useLazyAsyncData(
  () => `song-v2-constants-${props.songId}`,
  () => apiFetch<{ items: V2ConstantsItem[] }>(`/api/content/songs/${props.songId}/v2`),
  { default: () => ({ items: [] }), watch: [() => props.songId] }
);
const chart = computed(() => data.value.items.find((item) => item.difficulty === props.track.toLowerCase()));
const supported = computed(() => ["HARD", "ONI", "EDIT"].includes(props.track));
const copy = computed(() => locale.value === "ja" ? {
  title: "V2 定数", main: "主定数", low: "75% 定数", high: "99% 定数",
  metrics: ["体力", "速度", "瞬発力", "複合", "リズム"], notes: "ノーツ",
  loading: "読み込み中…", empty: "この難易度の V2 定数はありません", unavailable: "V2 定数を読み込めませんでした",
  unsupported: "V2 定数はむずかしい・おに・裏おにに対応しています", retry: "再試行"
} : {
  title: "V2 定数", main: "主定数", low: "75% 定数", high: "99% 定数",
  metrics: ["体力", "手速", "爆发", "复合", "节奏"], notes: "音符数",
  loading: "加载中…", empty: "暂无该难度的 V2 定数", unavailable: "V2 定数加载失败",
  unsupported: "V2 定数支持困难、魔王和里魔王", retry: "重试"
});
const metricKeys = ["stamina", "handspeed", "burst", "complex", "rhythm"] as const;
const difficultyCode: Record<string, number> = { HARD: 3, ONI: 4, EDIT: 5, EASY: 1, NORMAL: 2 };
const format = (value: number) => value.toFixed(2);
</script>

<template>
  <section class="v2-card" :aria-label="copy.title" :aria-busy="pending">
    <div class="v2-heading">
      <h2>{{ copy.title }}</h2>
      <span>{{ t(`difficulty.${difficultyCode[track]}`) }}</span>
    </div>
    <p v-if="!supported" class="v2-state">{{ copy.unsupported }}</p>
    <p v-else-if="pending" class="v2-state" role="status">{{ copy.loading }}</p>
    <div v-else-if="error" class="v2-state" role="status">
      <p>{{ copy.unavailable }}</p>
      <el-button size="small" @click="refresh()">{{ copy.retry }}</el-button>
    </div>
    <template v-else-if="chart">
      <dl class="v2-summary">
        <div><dt>{{ copy.low }}</dt><dd>{{ format(chart.subConstant1) }}</dd></div>
        <div class="v2-main"><dt>{{ copy.main }}</dt><dd>{{ format(chart.mainConstant) }}</dd></div>
        <div><dt>{{ copy.high }}</dt><dd>{{ format(chart.subConstant2) }}</dd></div>
      </dl>
      <dl class="v2-metrics">
        <div v-for="(key, index) in metricKeys" :key="key">
          <dt>{{ copy.metrics[index] }}</dt><dd>{{ format(chart[key]) }}</dd>
        </div>
        <div class="v2-notes"><dt>{{ copy.notes }}</dt><dd>{{ chart.totalNotes }}</dd></div>
      </dl>
      <a class="v2-source" href="https://github.com/OurTaiko/Constants" target="_blank" rel="noopener noreferrer">OurTaiko / Constants ↗</a>
    </template>
    <p v-else class="v2-state">{{ copy.empty }}</p>
  </section>
</template>

<style scoped>
.v2-card { border-radius: 16px; padding: 14px; background:var(--viewer-surface-subtle); border: 1px solid rgba(95, 143, 191, .22); color:#4a5f79; }
.v2-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.v2-heading h2 { margin: 0; font-size: 16px; color:#304b68; }
.v2-heading span, .v2-summary dt { font-size: 12px; }
.v2-summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin: 20px 0; text-align: center; }
.v2-summary dd { margin: 8px 0 0; font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; }
.v2-main { color:#2f5f95; }
.v2-metrics { margin: 0; }
.v2-metrics > div { display: flex; justify-content: space-between; gap: 10px; padding: 9px 0; border-bottom: 1px solid rgba(116, 145, 177, .18); font-size: 13px; }
.v2-metrics dd { margin: 0; font-weight: 600; font-variant-numeric: tabular-nums; }
.v2-notes { color:#5f7185; }
.v2-source { display: inline-block; margin-top: 16px; color:#3b6898; font-size: 12px; text-decoration: underline; text-underline-offset: 3px; }
.v2-source:focus-visible { outline: 2px solid #3b6898; outline-offset: 4px; }
.v2-state { padding: 22px 0; font-size: 13px; line-height: 1.6; }
body.theme-dark .v2-card { background:#242b33; border-color:#40536a; color:#d0dbe8; }
body.theme-dark .v2-heading h2,
body.theme-dark .v2-main,
body.theme-dark .v2-source { color:#a7cdf6; }
body.theme-dark .v2-notes { color:#b8c9dc; }
</style>
