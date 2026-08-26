<script setup lang="ts">
import { computed } from "vue";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import AnnualGrowthSongStage from "../AnnualGrowthSongStage.vue";
import AnnualProfileStageFrame from "../AnnualProfileStageFrame.vue";
const props = withDefaults(defineProps<{ summary: VersionSummaryViewModel; pageIndex: number; pageTotal: number; active: boolean; reducedMotion: boolean; saveData?: boolean }>(), { saveData: false });
const formatter = new Intl.NumberFormat("zh-CN");
const safeNumber = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : 0;
const songName = computed(() => props.summary.nearDondaful?.song?.name?.trim() || "这首歌");
const okCountText = computed(() => formatter.format(safeNumber(props.summary.nearDondaful?.okCount)));
const scoreText = computed(() => formatter.format(safeNumber(props.summary.nearDondaful?.score)));
</script>
<template>
  <AnnualProfileStageFrame v-if="summary.nearDondaful" tone="near" :active="active" :reduced-motion="reducedMotion" :save-data="saveData" :aria-label="summary.copy.nearDondaful.title">
    <template #header><span>ALMOST DONDAFUL · 2026</span><h1>离全良只差最后一步</h1><p>这一首歌，正在等你把最后一槌落下。</p></template>
    <template #center><AnnualGrowthSongStage tone="near" size="large" :image-url="summary.nearDondaful.song.coverUrl" :image-alt="songName" fallback="2026" :active="active" :reduced-motion="reducedMotion" :save-data="saveData" /></template>
    <template #primary-panel><span>SONG IN THE SPOTLIGHT</span><strong>《{{ songName }}》</strong><em>离全良只差 <b>{{ okCountText }} 个可</b></em></template>
    <template #secondary-panel><span>已经写下的最高分</span><strong>{{ scoreText }}</strong></template>
    <template #footer><p>鼓面已经亮到最后一小步。下一次落槌，也许就是满屏金光。</p></template>
  </AnnualProfileStageFrame>
</template>
<style scoped>
.near-growth :deep(.annual-profile-stage__primary em){display:block;margin-top:3px;color:#d9f5ff;font-size:11px;font-style:normal;line-height:1.2}.near-growth :deep(.annual-profile-stage__primary em b){color:#ffe08a;font-weight:800;white-space:nowrap}.near-growth :deep(.annual-profile-stage__header p){color:rgba(210,237,249,.72)}
</style>
