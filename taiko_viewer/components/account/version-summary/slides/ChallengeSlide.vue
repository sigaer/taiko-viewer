<script setup lang="ts">
import { computed } from "vue";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import AnnualGrowthSongStage from "../AnnualGrowthSongStage.vue";
import AnnualProfileStageFrame from "../AnnualProfileStageFrame.vue";
import { narrativeKey, selectNarrative } from "~/utils/annualNarrative";
const props = withDefaults(defineProps<{ summary: VersionSummaryViewModel; pageIndex: number; pageTotal: number; active: boolean; reducedMotion: boolean; saveData?: boolean }>(), { saveData: false });
const { t } = useI18n();
const formatter = new Intl.NumberFormat("zh-CN");
const safeNumber = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : 0;
const songName = computed(() => props.summary.challenge?.song?.name?.trim() || t("annualSummary.slides.challenge.unknownSong"));
const playCountText = computed(() => formatter.format(safeNumber(props.summary.challenge?.playCount)));
const observedPlayCountText = computed(() => formatter.format(safeNumber(props.summary.challenge?.observedPlayCount)));
const showObservedCount = computed(() => safeNumber(props.summary.challenge?.observedPlayCount) !== safeNumber(props.summary.challenge?.playCount));
// How long the player has been knocking on this one door decides the wording.
const narrative = computed(() => selectNarrative("challenge", props.summary));
const narrativeCopy = computed(() => ({
  title: t(narrativeKey("challenge", narrative.value, "title")),
  lead: t(narrativeKey("challenge", narrative.value, "lead"))
}));
</script>
<template>
  <AnnualProfileStageFrame v-if="summary.challenge" class="challenge-growth" tone="challenge" motion-preset="growth-challenge-knock" :active="active" :reduced-motion="reducedMotion" :save-data="saveData" :aria-label="summary.copy.challenge.title">
    <template #header><span>{{ t("annualSummary.slides.challenge.eyebrow") }} · 2026</span><h1>{{ narrativeCopy.title }}</h1><p>{{ narrativeCopy.lead }}</p></template>
    <template #center><AnnualGrowthSongStage tone="challenge" size="large" :image-url="summary.challenge.song.coverUrl" :image-alt="songName" fallback="2026" :active="active" :reduced-motion="reducedMotion" :save-data="saveData" /></template>
    <template #primary-panel><span>{{ t("annualSummary.slides.challenge.spotlight") }}</span><strong>{{ t("annualSummary.slides.challenge.songQuoted", { song: songName }) }}</strong><em>{{ t("annualSummary.slides.challenge.knockBefore") }} <b>{{ playCountText }} {{ t("annualSummary.slides.challenge.knockAfter") }}</b></em></template>
    <template #secondary-panel><span>{{ t("annualSummary.slides.challenge.total") }}</span><strong>{{ t("annualSummary.slides.challenge.totalValue", { count: playCountText }) }}</strong><small v-if="showObservedCount">{{ t("annualSummary.slides.challenge.observedInPeriod", { count: observedPlayCountText }) }}</small></template>
    <template #footer><p><span>{{ t("annualSummary.slides.challenge.story1") }}</span><span>{{ t("annualSummary.slides.challenge.story2") }}</span></p></template>
    <template #atmosphere>
      <div class="challenge-door-light" aria-hidden="true"><i /><i /></div>
      <div class="challenge-pressure" aria-hidden="true"><i v-for="index in 7" :key="index" /></div>
    </template>
  </AnnualProfileStageFrame>
</template>
<style scoped>
.challenge-growth :deep(.annual-profile-stage__backdrop) {
  background:
    radial-gradient(ellipse at 50% 35%, rgba(21, 92, 158, .42), transparent 26%),
    linear-gradient(90deg, rgba(0, 4, 12, .76), transparent 27% 73%, rgba(0, 4, 12, .78)),
    linear-gradient(165deg, #010611 0%, #061a32 50%, #01040b 100%);
}

.challenge-growth :deep(.annual-profile-stage__curtain) {
  width: 48%;
  opacity: .8;
  background: repeating-linear-gradient(102deg, rgba(12, 38, 68, .32) 0 8%, rgba(0, 5, 14, .84) 9% 20%);
}

.challenge-growth :deep(.annual-profile-stage__stage-grid) {
  border-top-color: rgba(127, 211, 249, .42);
  background:
    linear-gradient(rgba(92, 188, 232, .16) 1px, transparent 1px),
    linear-gradient(90deg, rgba(66, 145, 204, .18) 1px, transparent 1px);
  background-size: 30px 18px;
  filter: brightness(.72);
}

.challenge-growth :deep(.annual-profile-stage__spotlight) {
  inset: -7% 10% 24%;
  clip-path: polygon(48% 0, 52% 0, 64% 100%, 36% 100%);
  background: linear-gradient(180deg, rgba(215, 242, 255, .52), rgba(44, 124, 184, .27) 70%, transparent);
  filter: contrast(1.12) blur(.4px);
}

.challenge-growth :deep(.annual-profile-stage__spotlight::after) {
  left: 29%;
  right: 29%;
  border-color: rgba(139, 211, 244, .52);
  background: rgba(43, 126, 185, .09);
  box-shadow: 0 0 52px rgba(56, 151, 213, .24);
}

.challenge-growth { --secondary-panel-height: 62px; }
.challenge-growth :deep(.growth-song-stage__orbit i) { border-color: rgba(116, 205, 247, .25); box-shadow: 0 0 15px rgba(47, 142, 203, .08); }
.challenge-growth :deep(.growth-song-stage__orbit i:nth-child(2)) { border-style: solid; opacity: .58; }
.challenge-growth :deep(.growth-song-stage__orbit i:nth-child(3)) { border-color: rgba(183, 229, 249, .14); }
.challenge-growth :deep(.growth-song-stage__membrane) { box-shadow: inset 0 0 42px rgba(4, 33, 66, .3), 0 0 0 6px rgba(218, 241, 255, .88), 0 0 26px rgba(50, 151, 216, .19); }

.challenge-growth :deep(.annual-profile-stage__primary) {
  background:
    linear-gradient(90deg, transparent 0 5%, rgba(4, 45, 81, .98) 5% 95%, transparent 95%),
    linear-gradient(90deg, transparent, rgba(100, 198, 241, .35), rgba(25, 96, 154, .18) 50%, rgba(100, 198, 241, .35), transparent);
  filter: drop-shadow(0 10px 18px rgba(0, 3, 12, .72));
}

.challenge-growth :deep(.annual-profile-stage__primary::before),
.challenge-growth :deep(.annual-profile-stage__primary::after) {
  background: rgba(175, 228, 250, .8);
  height: 2px;
  box-shadow: 0 0 12px rgba(111, 211, 252, .48);
}

.challenge-growth :deep(.annual-profile-stage__primary em) { display: block; margin-top: 3px; color: #d9f5ff; font-size: 11px; font-style: normal; line-height: 1.2; }
.challenge-growth :deep(.annual-profile-stage__primary em b) { color: #c6f1ff; font-weight: 900; white-space: nowrap; text-shadow: 0 0 14px rgba(112, 205, 247, .5); }
.challenge-growth :deep(.annual-profile-stage__secondary) { border-color: rgba(138, 221, 255, .7); color: #e5f8ff; background: linear-gradient(90deg, rgba(0, 8, 20, .96), rgba(6, 29, 55, .96), rgba(0, 8, 20, .96)); box-shadow: 0 0 28px rgba(50, 143, 204, .2), inset 0 0 20px rgba(52, 136, 192, .08); }
.challenge-growth :deep(.annual-profile-stage__secondary strong) { font-size: clamp(1.1rem, 4.4vw, 1.48rem); font-weight: 900; letter-spacing: .03em; text-shadow: 0 0 16px rgba(119, 216, 255, .45); }
.challenge-growth :deep(.annual-profile-stage__secondary small) { display: block; margin-top: 3px; color: rgba(204, 235, 250, .72); font-size: 10px; line-height: 1.25; }
.challenge-growth :deep(.annual-profile-stage__header > span) { color: #a9def5; }
.challenge-growth :deep(.annual-profile-stage__header h1) { text-shadow: 0 2px 20px rgba(78, 175, 226, .14); }

.challenge-door-light,
.challenge-door-light i { position: absolute; pointer-events: none; }
.challenge-door-light { inset: 0; overflow: hidden; }
.challenge-door-light i:first-child {
  top: 0;
  bottom: 14%;
  left: calc(50% - 1px);
  width: 2px;
  background: linear-gradient(transparent, rgba(218, 246, 255, .76) 22%, rgba(107, 204, 249, .5) 66%, transparent);
  box-shadow: 0 0 16px rgba(137, 219, 255, .62), 0 0 42px rgba(54, 151, 216, .28);
  opacity: .58;
}
.challenge-door-light i:last-child {
  left: 35%;
  right: 35%;
  top: 12%;
  height: 55%;
  background: linear-gradient(180deg, rgba(118, 207, 248, .2), transparent 72%);
  clip-path: polygon(48% 0, 52% 0, 70% 100%, 30% 100%);
  filter: blur(8px);
  opacity: .56;
}

.challenge-pressure i {
  position: absolute;
  top: 16%;
  bottom: 13%;
  width: 2px;
  background: linear-gradient(transparent 0 8%, rgba(155, 222, 250, .1) 22%, rgba(197, 237, 255, .5) 53%, rgba(65, 151, 211, .2) 78%, transparent);
  box-shadow: 0 0 8px rgba(91, 188, 235, .16);
  transform: rotate(9deg);
  animation: challenge-pressure 7s ease-in-out 1.7s infinite;
}

.challenge-pressure i:nth-child(1) { left: 37%; }
.challenge-pressure i:nth-child(2) { left: 49%; animation-delay: -.15s; }
.challenge-pressure i:nth-child(3) { left: 61%; animation-delay: -.3s; }
.challenge-pressure i:nth-child(4) { left: 73%; animation-delay: -.45s; }
.challenge-pressure i:nth-child(5) { left: 85%; animation-delay: -.6s; }
.challenge-pressure i:nth-child(6) { left: 25%; animation-delay: -.75s; }
.challenge-pressure i:nth-child(7) { left: 13%; animation-delay: -.9s; }

@keyframes challenge-pressure {
  0%, 72%, 100% { opacity: .22; transform: translateY(0) rotate(9deg); }
  78% { opacity: .58; transform: translateY(7px) rotate(9deg); }
  83% { opacity: .25; transform: translateY(0) rotate(9deg); }
  88% { opacity: .44; transform: translateY(4px) rotate(9deg); }
  92% { opacity: .22; transform: translateY(0) rotate(9deg); }
}

.challenge-growth:not(.is-active) .challenge-pressure i { animation-play-state: paused !important; }
.challenge-growth.is-reduced .challenge-pressure i,
.challenge-growth.is-save-data .challenge-pressure i { animation: none !important; opacity: .32; }
.challenge-growth.is-save-data .challenge-door-light i:last-child { display: none; }
</style>
