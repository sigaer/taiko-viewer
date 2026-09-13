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
const songName = computed(() => props.summary.nearDondaful?.song?.name?.trim() || t("annualSummary.slides.near.unknownSong"));
const okCountText = computed(() => formatter.format(safeNumber(props.summary.nearDondaful?.okCount)));
const scoreText = computed(() => formatter.format(safeNumber(props.summary.nearDondaful?.score)));
// How close the chart is to a full-perfect run, and whether it is a ten-star
// chart at all, decide which sentence the player reads.
const narrative = computed(() => selectNarrative("nearDondaful", props.summary));
const narrativeCopy = computed(() => ({
  title: t(narrativeKey("nearDondaful", narrative.value, "title")),
  lead: t(narrativeKey("nearDondaful", narrative.value, "lead"))
}));
</script>
<template>
  <AnnualProfileStageFrame v-if="summary.nearDondaful" class="near-growth" tone="near" motion-preset="growth-near-rainbow" :active="active" :reduced-motion="reducedMotion" :save-data="saveData" :aria-label="summary.copy.nearDondaful.title">
    <template #header><span>{{ t("annualSummary.slides.near.eyebrow") }} · 2026</span><h1>{{ narrativeCopy.title }}</h1><p>{{ narrativeCopy.lead }}</p></template>
    <template #center><AnnualGrowthSongStage tone="near" size="large" :image-url="summary.nearDondaful.song.coverUrl" :image-alt="songName" fallback="2026" :active="active" :reduced-motion="reducedMotion" :save-data="saveData" /></template>
    <template #primary-panel><span>{{ t("annualSummary.slides.near.spotlight") }}</span><strong>{{ t("annualSummary.slides.near.songQuoted", { song: songName }) }}</strong><em>{{ t("annualSummary.slides.near.okBefore") }} <b>{{ t("annualSummary.slides.near.okCount", { count: okCountText }) }}</b></em></template>
    <template #secondary-panel><span>{{ t("annualSummary.slides.near.score") }}</span><strong>{{ scoreText }}</strong></template>
    <template #footer><p><span>{{ t("annualSummary.slides.near.footer1Before") }}<strong>{{ t("annualSummary.slides.near.footer1Strong") }}</strong>{{ t("annualSummary.slides.near.footer1After") }}</span><span>{{ t("annualSummary.slides.near.footer2") }}</span></p></template>
    <template #atmosphere>
      <div class="near-spectrum-atmosphere" aria-hidden="true">
        <i class="near-spectrum-atmosphere__aurora" />
        <i class="near-spectrum-atmosphere__arc is-left" />
        <i class="near-spectrum-atmosphere__arc is-right" />
        <i class="near-spectrum-atmosphere__beam is-left" />
        <i class="near-spectrum-atmosphere__beam is-right" />
      </div>
      <div v-if="!saveData" class="near-prism-dust" aria-hidden="true"><i v-for="index in 7" :key="index" /></div>
    </template>
  </AnnualProfileStageFrame>
</template>
<style scoped>
.near-growth :deep(.annual-profile-stage__backdrop) {
  background:
    radial-gradient(circle at 20% 28%, rgba(67, 226, 255, .31), transparent 31%),
    radial-gradient(circle at 78% 25%, rgba(211, 101, 255, .3), transparent 31%),
    radial-gradient(circle at 74% 58%, rgba(255, 195, 100, .22), transparent 29%),
    radial-gradient(circle at 27% 61%, rgba(95, 239, 188, .2), transparent 27%),
    radial-gradient(ellipse at 50% 40%, rgba(77, 170, 226, .58), transparent 38%),
    linear-gradient(162deg, #092a4e 0%, #174d77 43%, #392a66 72%, #112744 100%);
  filter: saturate(1.16);
}

.near-growth :deep(.annual-profile-stage__curtain) {
  opacity: .4;
  background: repeating-linear-gradient(102deg, rgba(68, 180, 219, .22) 0 11%, rgba(17, 42, 78, .42) 12% 23%);
}

.near-growth :deep(.annual-profile-stage__spotlight) {
  background:
    linear-gradient(104deg, rgba(86, 237, 255, .18), transparent 28%, transparent 72%, rgba(238, 116, 255, .17)),
    linear-gradient(180deg, rgba(223, 247, 255, .52), rgba(106, 190, 226, .16) 72%, transparent);
  filter: saturate(1.25) blur(1px);
}

.near-growth :deep(.annual-profile-stage__spotlight::after) {
  border-color: rgba(172, 232, 255, .64);
  background: linear-gradient(90deg, rgba(86, 232, 255, .13), rgba(206, 116, 255, .13), rgba(255, 197, 107, .12));
  box-shadow: -18px 0 44px rgba(73, 225, 255, .22), 18px 0 44px rgba(221, 109, 255, .2);
}

.near-growth :deep(.annual-profile-stage__stage-grid) {
  border-top-color: rgba(151, 226, 255, .42);
  background:
    linear-gradient(rgba(99, 214, 236, .1) 1px, transparent 1px),
    linear-gradient(90deg, rgba(188, 128, 255, .1) 1px, transparent 1px);
}

.near-growth :deep(.growth-song-stage__orbit i:nth-child(3)) {
  border-color: rgba(124, 224, 255, .3);
  box-shadow: 0 0 18px rgba(130, 176, 255, .08);
}

.near-growth :deep(.annual-profile-stage__primary) {
  background:
    linear-gradient(90deg, transparent 0 5%, rgba(18, 100, 151, .96) 5% 95%, transparent 95%),
    linear-gradient(90deg, transparent 4%, rgba(86, 235, 255, .55) 24%, rgba(122, 132, 255, .48) 41%, rgba(217, 108, 255, .44) 57%, rgba(255, 126, 156, .38) 72%, rgba(255, 214, 113, .36) 87%, transparent 96%);
  filter: drop-shadow(-7px 8px 17px rgba(63, 216, 255, .16)) drop-shadow(7px 8px 17px rgba(209, 107, 255, .14));
}

.near-growth :deep(.annual-profile-stage__primary::before),
.near-growth :deep(.annual-profile-stage__primary::after) {
  background: linear-gradient(90deg, #72e7ff, #a28aff, #ff9caa, #ffe17c);
  height: 2px;
  box-shadow: -5px 0 10px rgba(92, 229, 255, .54), 5px 0 10px rgba(231, 117, 255, .42);
}

.near-growth :deep(.annual-profile-stage__secondary) {
  border-image: linear-gradient(90deg, #69e6ff, #aa8cff, #ff9daf, #ffe27d) 1;
  color: #effbff;
  background: linear-gradient(90deg, rgba(7, 45, 78, .88), rgba(45, 32, 82, .86), rgba(7, 45, 78, .88));
  box-shadow: -8px 0 22px rgba(85, 226, 255, .14), 8px 0 22px rgba(218, 112, 255, .13);
}

.near-growth :deep(.annual-profile-stage__primary em) { display: block; margin-top: 3px; color: #d9f5ff; font-size: 11px; font-style: normal; line-height: 1.2; }
.near-growth :deep(.annual-profile-stage__primary em b) {
  color: #eaffff;
  font-weight: 800;
  white-space: nowrap;
  text-shadow: -1px 0 #5deaff, 1px 0 #ff87ad, 0 0 10px rgba(178, 127, 255, .68);
}

.near-growth :deep(.annual-profile-stage__header > span) {
  color: #c8f3ff;
  text-shadow: -1px 0 rgba(105, 230, 255, .72), 1px 0 rgba(255, 157, 175, .62);
}

.near-growth :deep(.annual-profile-stage__footer strong) {
  color: #fff;
  text-shadow: -1px 0 #69e6ff, 1px 0 #c590ff;
}

.near-spectrum-atmosphere,
.near-spectrum-atmosphere i { position: absolute; pointer-events: none; }

.near-spectrum-atmosphere { inset: 0; overflow: hidden; }
.near-spectrum-atmosphere__aurora {
  left: 7%;
  right: 7%;
  top: 15%;
  height: 57%;
  opacity: .8;
  background:
    radial-gradient(ellipse at 22% 50%, rgba(69, 229, 255, .25), transparent 38%),
    radial-gradient(ellipse at 78% 43%, rgba(215, 104, 255, .24), transparent 38%),
    radial-gradient(ellipse at 58% 67%, rgba(255, 202, 103, .17), transparent 34%);
  filter: blur(20px) saturate(1.35);
}

.near-spectrum-atmosphere__arc {
  top: 24%;
  width: 58%;
  aspect-ratio: 1;
  border: 2px solid transparent;
  border-radius: 50%;
  background: linear-gradient(#0000, #0000) padding-box, conic-gradient(from 215deg, #61e9ff, #8d87ff, #df77ff, #ff87a4, #ffd575, #64efba, #61e9ff) border-box;
  opacity: .29;
  filter: drop-shadow(0 0 14px rgba(159, 135, 255, .28));
}

.near-spectrum-atmosphere__arc.is-left { left: -37%; }
.near-spectrum-atmosphere__arc.is-right { right: -37%; transform: scaleX(-1); }
.near-spectrum-atmosphere__beam {
  top: -8%;
  width: 16%;
  height: 78%;
  opacity: .34;
  filter: blur(7px);
  transform-origin: 50% 0;
}
.near-spectrum-atmosphere__beam.is-left { left: 18%; background: linear-gradient(180deg, rgba(82, 234, 255, .58), transparent); transform: rotate(9deg); }
.near-spectrum-atmosphere__beam.is-right { right: 18%; background: linear-gradient(180deg, rgba(223, 111, 255, .5), rgba(255, 205, 103, .14) 62%, transparent); transform: rotate(-9deg); }

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
.near-prism-dust i:nth-child(6) { left: 18%; top: 31%; animation-delay: -2.8s; }
.near-prism-dust i:nth-child(7) { right: 18%; top: 58%; animation-delay: -5.2s; }

@keyframes near-prism-glint {
  0%, 84%, 100% { transform: scale(.8); opacity: .24; }
  90% { transform: scale(1.45); opacity: .72; }
}

.near-growth:not(.is-active) .near-prism-dust i { animation-play-state: paused !important; }
.near-growth.is-reduced .near-prism-dust i,
.near-growth.is-save-data .near-prism-dust i { animation: none !important; opacity: .34; }
.near-growth.is-save-data .near-spectrum-atmosphere__beam { display: none; }
.near-growth.is-reduced .near-spectrum-atmosphere__aurora,
.near-growth.is-save-data .near-spectrum-atmosphere__aurora { opacity: .55; filter: blur(20px); }
</style>
