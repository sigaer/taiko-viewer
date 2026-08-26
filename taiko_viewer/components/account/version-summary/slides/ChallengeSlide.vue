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
  <AnnualProfileStageFrame v-if="summary.challenge" class="challenge-growth" tone="challenge" :active="active" :reduced-motion="reducedMotion" :save-data="saveData" :aria-label="summary.copy.challenge.title">
    <template #header><span>KEEP TRYING · 2026</span><h1>你还在敲这扇门</h1><p>答案还没有全部交出来，但你没有转身。</p></template>
    <template #center><AnnualGrowthSongStage tone="challenge" size="large" :image-url="summary.challenge.song.coverUrl" :image-alt="songName" fallback="2026" :active="active" :reduced-motion="reducedMotion" :save-data="saveData" /></template>
    <template #primary-panel><span>SONG IN THE SPOTLIGHT</span><strong>《{{ songName }}》</strong><em>你向它敲了 <b>{{ playCountText }} 次门</b></em></template>
    <template #secondary-panel><span>成绩表里的累计挑战</span><strong>{{ playCountText }} 次</strong><small v-if="showObservedCount">其中 {{ observedPlayCountText }} 次被这一版记录下来</small></template>
    <template #footer><p>它还没有完全打开，而你也没有转身。</p></template>
    <template #atmosphere><div class="challenge-pressure" aria-hidden="true"><i v-for="index in 5" :key="index" /></div></template>
  </AnnualProfileStageFrame>
</template>
<style scoped>
.challenge-growth :deep(.annual-profile-stage__spotlight){background:linear-gradient(180deg,rgba(132,194,239,.4),rgba(31,105,170,.2) 74%,transparent)}.challenge-growth :deep(.annual-profile-stage__primary){background:linear-gradient(90deg,transparent 0 5%,#0b5796 5% 95%,transparent 95%),linear-gradient(90deg,transparent,rgba(55,149,219,.42),transparent)}.challenge-growth :deep(.annual-profile-stage__primary em){display:block;margin-top:3px;color:#d9f5ff;font-size:11px;font-style:normal;line-height:1.2}.challenge-growth :deep(.annual-profile-stage__primary em b){color:#9edaff;font-weight:800;white-space:nowrap}.challenge-growth :deep(.annual-profile-stage__secondary){border-color:rgba(91,211,242,.58);color:#d9f5ff;background:rgba(5,24,50,.88);box-shadow:0 0 24px rgba(91,211,242,.16)}.challenge-growth :deep(.annual-profile-stage__secondary strong){font-size:clamp(1rem,4vw,1.35rem)}.challenge-growth :deep(.annual-profile-stage__secondary small){display:block;margin-top:3px;color:rgba(204,235,250,.72);font-size:10px;line-height:1.25}.challenge-pressure i{position:absolute;top:19%;bottom:14%;width:1px;background:linear-gradient(transparent,rgba(91,211,242,.28),transparent);transform:rotate(10deg);animation:challenge-pressure 3.6s ease-in-out infinite}.challenge-pressure i:nth-child(1){left:44%}.challenge-pressure i:nth-child(2){left:55%;animation-delay:-1.1s}.challenge-pressure i:nth-child(3){left:66%;animation-delay:-2.2s}.challenge-pressure i:nth-child(4){left:77%;animation-delay:-1.7s}.challenge-pressure i:nth-child(5){left:88%;animation-delay:-2.8s}@keyframes challenge-pressure{50%{opacity:.28;transform:translateX(10px) rotate(10deg)}}.challenge-growth:not(.is-active) .challenge-pressure i{animation-play-state:paused!important}.challenge-growth.is-reduced .challenge-pressure i{animation:none!important}
</style>
