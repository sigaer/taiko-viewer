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
  <AnnualProfileStageFrame v-if="summary.nearDondaful" class="near-growth" tone="near" motion-preset="growth-near-glow" :active="active" :reduced-motion="reducedMotion" :save-data="saveData" :aria-label="summary.copy.nearDondaful.title">
    <template #header><span>ALMOST DONDAFUL · 2026</span><h1>离全良只差最后一步</h1><p>这一首歌，正在等你把最后一槌落下。</p></template>
    <template #center><AnnualGrowthSongStage tone="near" size="large" :image-url="summary.nearDondaful.song.coverUrl" :image-alt="songName" fallback="2026" :active="active" :reduced-motion="reducedMotion" :save-data="saveData" /></template>
    <template #primary-panel><span>SONG IN THE SPOTLIGHT</span><strong>《{{ songName }}》</strong><em>离全良只差 <b>{{ okCountText }} 个可</b></em></template>
    <template #secondary-panel><span>已经写下的最高分</span><strong>{{ scoreText }}</strong></template>
    <template #footer><p><span>鼓面已经亮到最后一小步。</span><span>下一次落槌，也许就是满屏金光。</span></p></template>
    <template #atmosphere><div v-if="!saveData" class="near-finish-light" aria-hidden="true"><i v-for="index in 5" :key="index" /></div></template>
  </AnnualProfileStageFrame>
</template>
<style scoped>
.near-growth :deep(.annual-profile-stage__backdrop){background:radial-gradient(ellipse at 50% 39%,rgba(45,145,205,.58),transparent 34%),linear-gradient(165deg,#07162d 0%,#0d3b6b 54%,#07152b 100%)}.near-growth :deep(.annual-profile-stage__orbit i:nth-child(3)){border-color:rgba(255,211,105,.42)}.near-growth :deep(.annual-profile-stage__primary em){display:block;margin-top:3px;color:#d9f5ff;font-size:11px;font-style:normal;line-height:1.2}.near-growth :deep(.annual-profile-stage__primary em b){color:#ffe08a;font-weight:800;white-space:nowrap}.near-growth :deep(.annual-profile-stage__header p){color:rgba(210,237,249,.72)}.near-growth :deep(.growth-song-stage__rim){box-shadow:0 24px 55px rgba(31,88,148,.2),0 0 0 1px rgba(255,255,255,.62),0 0 30px rgba(242,196,95,.16)}.near-finish-light i{position:absolute;width:4px;height:4px;border-radius:50%;background:#ffe08a;box-shadow:0 0 11px rgba(255,211,105,.75);animation:near-final-glint 3.2s ease-in-out infinite}.near-finish-light i:first-child{left:22%;top:40%}.near-finish-light i:nth-child(2){right:23%;top:46%;animation-delay:-1.1s}.near-finish-light i:nth-child(3){left:31%;top:57%;animation-delay:-2.2s}.near-finish-light i:nth-child(4){right:30%;top:35%;animation-delay:-1.7s}.near-finish-light i:nth-child(5){left:50%;top:28%;animation-delay:-2.7s}@keyframes near-final-glint{50%{transform:scale(1.7);opacity:.35}}.near-growth:not(.is-active) .near-finish-light i{animation-play-state:paused!important}.near-growth.is-reduced .near-finish-light i{animation:none!important}
</style>
