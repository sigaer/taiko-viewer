<script setup lang="ts">
import { computed } from "vue";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import AnnualGrowthSongStage from "../AnnualGrowthSongStage.vue";
import AnnualProfileStageFrame from "../AnnualProfileStageFrame.vue";
const props = withDefaults(defineProps<{ summary: VersionSummaryViewModel; pageIndex: number; pageTotal: number; active: boolean; reducedMotion: boolean; saveData?: boolean }>(), { saveData: false });
const formatter = new Intl.NumberFormat("zh-CN");
const safeNumber = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : 0;
const songName = computed(() => props.summary.challenge?.song?.name?.trim() || "这首歌");
const playCountText = computed(() => formatter.format(safeNumber(props.summary.challenge?.playCount)));
const observedPlayCountText = computed(() => formatter.format(safeNumber(props.summary.challenge?.observedPlayCount)));
const showObservedCount = computed(() => safeNumber(props.summary.challenge?.observedPlayCount) !== safeNumber(props.summary.challenge?.playCount));
</script>
<template>
  <AnnualProfileStageFrame v-if="summary.challenge" class="challenge-growth" tone="challenge" motion-preset="growth-challenge-knock" :active="active" :reduced-motion="reducedMotion" :save-data="saveData" :aria-label="summary.copy.challenge.title">
    <template #header><span>KEEP TRYING · 2026</span><h1>你还在敲这扇门</h1><p>答案还没有全部交出来，但你没有转身。</p></template>
    <template #center><AnnualGrowthSongStage tone="challenge" size="large" :image-url="summary.challenge.song.coverUrl" :image-alt="songName" fallback="2026" :active="active" :reduced-motion="reducedMotion" :save-data="saveData" /></template>
    <template #primary-panel><span>SONG IN THE SPOTLIGHT</span><strong>《{{ songName }}》</strong><em>你向它敲了 <b>{{ playCountText }} 次门</b></em></template>
    <template #secondary-panel><span>成绩表里的累计挑战</span><strong>{{ playCountText }} 次</strong><small v-if="showObservedCount">其中 {{ observedPlayCountText }} 次被这一版记录下来</small></template>
    <template #footer><p><span>它还没有把答案全部交出来，</span><span>而你也没有转身。</span></p></template>
    <template #atmosphere><div class="challenge-pressure" aria-hidden="true"><i v-for="index in 5" :key="index" /></div></template>
  </AnnualProfileStageFrame>
</template>
<style scoped>
.challenge-growth :deep(.annual-profile-stage__backdrop) {
  background:
    radial-gradient(ellipse at 50% 39%, rgba(23, 98, 169, .46), transparent 31%),
    linear-gradient(165deg, #040d1d 0%, #08294f 54%, #030a17 100%);
}

.challenge-growth :deep(.annual-profile-stage__stage-grid) {
  border-top-color: rgba(127, 211, 249, .42);
  background:
    linear-gradient(rgba(91, 211, 242, .18) 1px, transparent 1px),
    linear-gradient(90deg, rgba(91, 211, 242, .18) 1px, transparent 1px);
  background-size: 34px 20px;
}

.challenge-growth :deep(.annual-profile-stage__spotlight) {
  background: linear-gradient(180deg, rgba(172, 218, 250, .48), rgba(26, 95, 156, .25) 72%, transparent);
}

.challenge-growth { --secondary-panel-height: 62px; }
.challenge-growth :deep(.growth-song-stage__orbit i) { border-color: rgba(116, 205, 247, .22); }
.challenge-growth :deep(.growth-song-stage__orbit i:nth-child(2)) { border-style: solid; opacity: .48; }
.challenge-growth :deep(.growth-song-stage__orbit i:nth-child(3)) { border-color: rgba(183, 229, 249, .12); }

.challenge-growth :deep(.annual-profile-stage__primary) {
  background:
    linear-gradient(90deg, transparent 0 5%, #0a4d86 5% 95%, transparent 95%),
    linear-gradient(90deg, transparent, rgba(74, 172, 226, .36), transparent);
}

.challenge-growth :deep(.annual-profile-stage__primary::before),
.challenge-growth :deep(.annual-profile-stage__primary::after) {
  background: rgba(175, 228, 250, .8);
  box-shadow: 0 0 7px rgba(108, 205, 244, .34);
}

.challenge-growth :deep(.annual-profile-stage__primary em) { display: block; margin-top: 3px; color: #d9f5ff; font-size: 11px; font-style: normal; line-height: 1.2; }
.challenge-growth :deep(.annual-profile-stage__primary em b) { color: #b7eaff; font-weight: 800; white-space: nowrap; text-shadow: 0 0 10px rgba(112, 205, 247, .36); }
.challenge-growth :deep(.annual-profile-stage__secondary) { border-color: rgba(128, 213, 248, .62); color: #e5f8ff; background: rgba(3, 19, 40, .9); box-shadow: 0 0 22px rgba(69, 157, 214, .18); }
.challenge-growth :deep(.annual-profile-stage__secondary strong) { font-size: clamp(1rem, 4vw, 1.35rem); text-shadow: 0 0 12px rgba(102, 205, 247, .28); }
.challenge-growth :deep(.annual-profile-stage__secondary small) { display: block; margin-top: 3px; color: rgba(204, 235, 250, .72); font-size: 10px; line-height: 1.25; }
.challenge-growth :deep(.annual-profile-stage__header > span) { color: #a9def5; }

.challenge-pressure i {
  position: absolute;
  top: 16%;
  bottom: 13%;
  width: 1px;
  background: linear-gradient(transparent 0 8%, rgba(155, 222, 250, .12) 24%, rgba(189, 232, 250, .44) 55%, rgba(79, 155, 211, .18) 76%, transparent);
  transform: rotate(9deg);
  animation: challenge-pressure 7s ease-in-out 1.7s infinite;
}

.challenge-pressure i:nth-child(1) { left: 37%; }
.challenge-pressure i:nth-child(2) { left: 49%; animation-delay: -.15s; }
.challenge-pressure i:nth-child(3) { left: 61%; animation-delay: -.3s; }
.challenge-pressure i:nth-child(4) { left: 73%; animation-delay: -.45s; }
.challenge-pressure i:nth-child(5) { left: 85%; animation-delay: -.6s; }

@keyframes challenge-pressure {
  0%, 72%, 100% { opacity: .22; transform: translateY(0) rotate(9deg); }
  78% { opacity: .58; transform: translateY(7px) rotate(9deg); }
  83% { opacity: .25; transform: translateY(0) rotate(9deg); }
  88% { opacity: .44; transform: translateY(4px) rotate(9deg); }
  92% { opacity: .22; transform: translateY(0) rotate(9deg); }
}

.challenge-growth:not(.is-active) .challenge-pressure i { animation-play-state: paused !important; }
.challenge-growth.is-reduced .challenge-pressure i,
.challenge-growth.is-save-data .challenge-pressure i { animation: none !important; opacity: .3; }
</style>
