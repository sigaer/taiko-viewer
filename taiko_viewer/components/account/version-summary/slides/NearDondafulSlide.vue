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
  <AnnualProfileStageFrame v-if="summary.nearDondaful" class="near-growth" tone="near" motion-preset="growth-near-rainbow" :active="active" :reduced-motion="reducedMotion" :save-data="saveData" :aria-label="summary.copy.nearDondaful.title">
    <template #header><span>ALMOST DONDAFUL · 2026</span><h1>离全良只差最后一步</h1><p>这一首歌，正在等你把最后一槌落下。</p></template>
    <template #center><AnnualGrowthSongStage tone="near" size="large" :image-url="summary.nearDondaful.song.coverUrl" :image-alt="songName" fallback="2026" :active="active" :reduced-motion="reducedMotion" :save-data="saveData" /></template>
    <template #primary-panel><span>SONG IN THE SPOTLIGHT</span><strong>《{{ songName }}》</strong><em>离全良只差 <b>{{ okCountText }} 个可</b></em></template>
    <template #secondary-panel><span>已经写下的最高分</span><strong>{{ scoreText }}</strong></template>
    <template #footer><p><span>鼓面已经亮到<strong>最后一小步</strong>。</span><span>下一次落槌，也许就会亮成完整彩虹。</span></p></template>
    <template #atmosphere><div v-if="!saveData" class="near-prism-dust" aria-hidden="true"><i v-for="index in 5" :key="index" /></div></template>
  </AnnualProfileStageFrame>
</template>
<style scoped>
.near-growth :deep(.annual-profile-stage__backdrop) {
  background:
    radial-gradient(ellipse at 50% 38%, rgba(62, 170, 224, .56), transparent 34%),
    radial-gradient(circle at 68% 34%, rgba(144, 107, 255, .13), transparent 21%),
    linear-gradient(165deg, #07162d 0%, #0c3b6b 54%, #07152b 100%);
}

.near-growth :deep(.annual-profile-stage__orbit i:nth-child(3)) {
  border-color: rgba(124, 224, 255, .3);
  box-shadow: 0 0 18px rgba(130, 176, 255, .08);
}

.near-growth :deep(.annual-profile-stage__primary) {
  background:
    linear-gradient(90deg, transparent 0 5%, #0b619e 5% 95%, transparent 95%),
    linear-gradient(90deg, transparent 8%, rgba(90, 228, 255, .3) 31%, rgba(190, 111, 255, .22) 51%, rgba(255, 178, 115, .2) 69%, transparent 92%);
}

.near-growth :deep(.annual-profile-stage__primary::before),
.near-growth :deep(.annual-profile-stage__primary::after) {
  background: linear-gradient(90deg, #72e7ff, #a28aff, #ff9caa, #ffe17c);
  box-shadow: 0 0 8px rgba(149, 207, 255, .42);
}

.near-growth :deep(.annual-profile-stage__secondary) {
  border-image: linear-gradient(90deg, #69e6ff, #aa8cff, #ff9daf, #ffe27d) 1;
  color: #effbff;
  box-shadow: 0 0 18px rgba(134, 185, 255, .14);
}

.near-growth :deep(.annual-profile-stage__primary em) { display: block; margin-top: 3px; color: #d9f5ff; font-size: 11px; font-style: normal; line-height: 1.2; }
.near-growth :deep(.annual-profile-stage__primary em b) {
  color: #f8fbff;
  font-weight: 800;
  white-space: nowrap;
  text-shadow: -1px 0 #69e6ff, 1px 0 #ff9daf;
}

.near-growth :deep(.annual-profile-stage__header > span) {
  color: #c8f3ff;
  text-shadow: -1px 0 rgba(105, 230, 255, .72), 1px 0 rgba(255, 157, 175, .62);
}

.near-growth :deep(.annual-profile-stage__footer strong) {
  color: #fff;
  text-shadow: -1px 0 #69e6ff, 1px 0 #c590ff;
}

.near-prism-dust i {
  position: absolute;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #bff6ff;
  box-shadow: -4px 0 10px rgba(104, 232, 255, .72), 4px 0 10px rgba(255, 126, 152, .58);
  animation: near-prism-glint 6s ease-in-out infinite;
}

.near-prism-dust i:first-child { left: 25%; top: 40%; }
.near-prism-dust i:nth-child(2) { right: 24%; top: 45%; animation-delay: -1.1s; }
.near-prism-dust i:nth-child(3) { left: 32%; top: 55%; animation-delay: -2.2s; }
.near-prism-dust i:nth-child(4) { right: 31%; top: 34%; animation-delay: -3.4s; }
.near-prism-dust i:nth-child(5) { left: 50%; top: 25%; animation-delay: -4.6s; }

@keyframes near-prism-glint {
  0%, 84%, 100% { transform: scale(.8); opacity: .24; }
  90% { transform: scale(1.45); opacity: .72; }
}

.near-growth:not(.is-active) .near-prism-dust i { animation-play-state: paused !important; }
.near-growth.is-reduced .near-prism-dust i,
.near-growth.is-save-data .near-prism-dust i { animation: none !important; opacity: .34; }
</style>
