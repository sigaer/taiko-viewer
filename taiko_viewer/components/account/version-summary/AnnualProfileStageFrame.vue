<script setup lang="ts">
import { computed, ref, toRef } from "vue";
import { useAnnualTimeline } from "~/composables/useAnnualTimeline";
import { createAnnualGrowthTimeline, type GrowthMotionPreset } from "~/utils/annualGrowthMotion";
import AnnualScene from "./AnnualScene.vue";

const props = withDefaults(defineProps<{
  active: boolean;
  reducedMotion: boolean;
  saveData?: boolean;
  tone?: "near" | "challenge";
  motionPreset?: GrowthMotionPreset;
  ariaLabel?: string;
  debugAlignment?: boolean;
}>(), { saveData: false, tone: "near", motionPreset: "growth-near-rainbow", ariaLabel: "", debugAlignment: false });

const rootRef = ref<HTMLElement | null>(null);
const debugAlignmentEnabled = computed(() => props.debugAlignment || (
  import.meta.dev
  && process.client
  && new URLSearchParams(window.location.search).has("annualAlignmentDebug")
));
useAnnualTimeline(rootRef, toRef(props, "active"), toRef(props, "reducedMotion"), {
  reenter: "restart",
  configureTimeline: createAnnualGrowthTimeline(() => props.motionPreset)
});
</script>

<template>
  <AnnualScene
    ref="rootRef"
    class="annual-profile-stage"
    :class="[`annual-profile-stage--${tone}`, `annual-profile-stage--${motionPreset}`, { 'is-save-data': saveData, 'is-debug-alignment': debugAlignmentEnabled }]"
    :data-motion-preset="motionPreset"
    mood="profile-stage"
    intensity="medium"
    :active="active"
    :reduced-motion="reducedMotion"
    :aria-label="ariaLabel"
  >
    <template #background>
      <div class="annual-profile-stage__backdrop">
        <div class="annual-profile-stage__curtain is-left" />
        <div class="annual-profile-stage__curtain is-right" />
        <div class="annual-profile-stage__stage-grid" />
      </div>
    </template>
    <template #atmosphere>
      <div class="annual-profile-stage__spotlight" aria-hidden="true"><i /><i /></div>
      <div v-if="!saveData" class="annual-profile-stage__beam-lines" aria-hidden="true"><i /><i /><i /></div>
      <slot name="atmosphere" />
    </template>
    <template #visual>
      <div class="annual-profile-stage__stage-slot">
        <div class="annual-profile-stage__stage-motion" data-annual-stage="visual">
          <div class="annual-profile-stage__center-shadow" aria-hidden="true" />
          <slot name="center" />
        </div>
      </div>
    </template>
    <template #data>
      <div class="annual-profile-stage__panels">
        <div class="annual-profile-stage__primary-slot">
          <div class="annual-profile-stage__primary" data-annual-stage="data"><slot name="primary-panel" /></div>
        </div>
        <div class="annual-profile-stage__secondary-slot">
          <div class="annual-profile-stage__secondary" data-annual-stage="data"><slot name="secondary-panel" /></div>
        </div>
      </div>
    </template>
    <template #copy>
      <header class="annual-profile-stage__header" data-annual-stage="title"><slot name="header" /></header>
      <footer class="annual-profile-stage__footer" data-annual-stage="copy"><slot name="footer" /></footer>
    </template>
    <template #transition><slot name="transition" /></template>
    <div v-if="debugAlignmentEnabled" class="annual-profile-stage__alignment-debug" aria-hidden="true">
      <i class="is-page-axis" />
      <i class="is-stage-bounds" />
      <i class="is-stage-center" />
      <i class="is-primary-center" />
      <i class="is-secondary-center" />
      <i class="is-footer-boundary" />
    </div>
  </AnnualScene>
</template>

<style scoped>
.annual-profile-stage {
  --stage-ink: #061226;
  --stage-cyan: #66d8ff;
  --stage-center-x: 50%;
  --stage-top: clamp(180px, 24.8dvh, 240px);
  --stage-size: clamp(230px, 61vw, 300px);
  --panel-gap: clamp(24px, 2.9dvh, 30px);
  --main-panel-height: clamp(68px, 8.2dvh, 78px);
  --secondary-gap: clamp(12px, 1.6dvh, 18px);
  --secondary-panel-height: 48px;
  --nav-reserved-height: 84px;
  --footer-copy-bottom: calc(env(safe-area-inset-bottom) + var(--nav-reserved-height));
  --main-panel-top: calc(var(--stage-top) + var(--stage-size) + var(--panel-gap));
  --secondary-panel-top: calc(var(--main-panel-top) + var(--main-panel-height) + var(--secondary-gap));
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  overflow: hidden;
  color: #fff;
  background: var(--stage-ink);
}

.annual-profile-stage__backdrop {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background:
    radial-gradient(ellipse at 50% 39%, rgba(38, 139, 207, .52), transparent 34%),
    linear-gradient(165deg, #061328 0%, #0b3260 54%, #061326 100%);
}

.annual-profile-stage__curtain {
  position: absolute;
  top: -8%;
  bottom: -8%;
  width: 43%;
  opacity: .66;
  background: repeating-linear-gradient(102deg, rgba(28, 88, 143, .34) 0 11%, rgba(3, 17, 39, .72) 12% 23%);
  filter: drop-shadow(0 0 30px rgba(0, 0, 0, .48));
}

.annual-profile-stage__curtain.is-left { left: -20%; transform: skewX(-7deg); }
.annual-profile-stage__curtain.is-right { right: -20%; transform: scaleX(-1) skewX(-7deg); }

.annual-profile-stage__stage-grid {
  position: absolute;
  left: -25%;
  right: -25%;
  bottom: -13%;
  height: 39%;
  border-top: 1px solid rgba(91, 211, 242, .34);
  background:
    linear-gradient(rgba(91, 211, 242, .12) 1px, transparent 1px),
    linear-gradient(90deg, rgba(91, 211, 242, .12) 1px, transparent 1px);
  background-size: 44px 25px;
  transform: perspective(330px) rotateX(62deg);
  transform-origin: 50% 0;
  mask-image: linear-gradient(#000, transparent 88%);
}

.annual-profile-stage__spotlight {
  position: absolute;
  inset: -6% 0 25%;
  overflow: hidden;
  clip-path: polygon(45% 0, 55% 0, 76% 100%, 24% 100%);
  background: linear-gradient(180deg, rgba(182, 229, 255, .46), rgba(63, 169, 224, .13) 74%, transparent);
  filter: blur(1px);
}

.annual-profile-stage__spotlight::after {
  content: "";
  position: absolute;
  left: 20%;
  right: 20%;
  bottom: -7%;
  height: 17%;
  border: 1px solid rgba(116, 219, 255, .5);
  border-radius: 50%;
  background: rgba(76, 190, 235, .11);
  box-shadow: 0 0 48px rgba(74, 193, 241, .34);
}

.annual-profile-stage__spotlight i {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: linear-gradient(transparent, rgba(255, 255, 255, .5), transparent);
}

.annual-profile-stage__spotlight i:first-child { left: 37%; transform: rotate(-8deg); }
.annual-profile-stage__spotlight i:last-child { right: 37%; transform: rotate(8deg); }

.annual-profile-stage__beam-lines i {
  position: absolute;
  top: 8%;
  bottom: 8%;
  width: 1px;
  background: linear-gradient(transparent, rgba(119, 223, 255, .18), transparent);
  transform: rotate(10deg);
}

.annual-profile-stage__beam-lines i:first-child { left: 20%; }
.annual-profile-stage__beam-lines i:nth-child(2) { right: 20%; transform: rotate(-10deg); }
.annual-profile-stage__beam-lines i:nth-child(3) { left: 50%; opacity: .28; }

.annual-profile-stage__stage-slot {
  position: absolute;
  z-index: 2;
  left: var(--stage-center-x);
  top: var(--stage-top);
  width: var(--stage-size);
  height: var(--stage-size);
  transform: translateX(-50%);
}

.annual-profile-stage__stage-motion {
  position: relative;
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  transform-origin: 50% 50%;
}

.annual-profile-stage__center-shadow {
  position: absolute;
  left: 10%;
  right: 10%;
  bottom: -8%;
  height: 15%;
  border-radius: 50%;
  background: rgba(0, 8, 27, .58);
  filter: blur(13px);
}

.annual-profile-stage__stage-motion :deep(.growth-song-stage) { --stage-size: 100%; }
.annual-profile-stage__panels { position: absolute; inset: 0; }

.annual-profile-stage__primary-slot,
.annual-profile-stage__secondary-slot {
  position: absolute;
  left: var(--stage-center-x);
  transform: translateX(-50%);
}

.annual-profile-stage__primary-slot {
  top: var(--main-panel-top);
  width: min(88%, 410px);
  height: var(--main-panel-height);
}

.annual-profile-stage__secondary-slot {
  top: var(--secondary-panel-top);
  width: fit-content;
  min-width: 142px;
  max-width: 82%;
  height: var(--secondary-panel-height);
}

.annual-profile-stage__primary {
  position: relative;
  z-index: 2;
  width: 100%;
  height: 100%;
  padding: 8px 38px 9px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center;
  color: #fff;
  text-align: center;
  background:
    linear-gradient(90deg, transparent 0 5%, #0c65a4 5% 95%, transparent 95%),
    linear-gradient(90deg, transparent, rgba(91, 211, 242, .4), transparent);
  clip-path: polygon(0 50%, 7% 0, 93% 0, 100% 50%, 93% 100%, 7% 100%);
  filter: drop-shadow(0 8px 14px rgba(0, 10, 34, .48));
}

.annual-profile-stage__primary::before,
.annual-profile-stage__primary::after {
  content: "";
  position: absolute;
  top: 50%;
  width: 33px;
  height: 1px;
  background: rgba(143, 222, 255, .8);
}

.annual-profile-stage__primary::before { left: 3%; }
.annual-profile-stage__primary::after { right: 3%; }
.annual-profile-stage__primary :deep(span) { display: block; color: rgba(204, 235, 250, .72); font-size: 10px; }
.annual-profile-stage__primary :deep(strong) { display: block; margin-top: 3px; overflow-wrap: anywhere; font-size: clamp(.92rem, 4vw, 1.18rem); line-height: 1.16; }

.annual-profile-stage__secondary {
  position: relative;
  z-index: 3;
  width: 100%;
  height: 100%;
  min-width: 142px;
  padding: 6px 18px 7px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center;
  border-top: 1px solid rgba(113, 218, 255, .58);
  border-bottom: 1px solid rgba(113, 218, 255, .58);
  color: #dff7ff;
  background: rgba(5, 24, 50, .84);
  text-align: center;
  box-shadow: 0 0 20px rgba(91, 211, 242, .14);
}

.annual-profile-stage__secondary :deep(span) { display: block; color: rgba(204, 235, 250, .72); font-size: 10px; }
.annual-profile-stage__secondary :deep(strong) { display: block; margin-top: 2px; overflow-wrap: anywhere; font-size: 12px; }

.annual-profile-stage__header {
  position: absolute;
  z-index: 4;
  top: max(6.5%, calc(env(safe-area-inset-top) + 48px));
  left: 7%;
  right: 7%;
  text-align: center;
}

.annual-profile-stage__header :deep(span) {
  color: #92dcff;
  font: 800 10px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: .14em;
}

.annual-profile-stage__header :deep(h1) {
  margin: 6px 0 0;
  color: #e6f8ff;
  font: 800 clamp(1.2rem, 5.4vw, 1.9rem)/1.08 var(--viewer-display-font);
}

.annual-profile-stage__header :deep(p) {
  max-width: 560px;
  margin: 6px auto 0;
  color: rgba(210, 237, 249, .75);
  font: 600 12px/1.4 var(--viewer-font-family);
}

.annual-profile-stage__footer {
  position: absolute;
  z-index: 4;
  left: 9%;
  right: 9%;
  bottom: var(--footer-copy-bottom);
  margin: 0;
  color: rgba(218, 241, 252, .82);
  font: 600 12px/1.55 var(--viewer-font-family);
  text-align: center;
}

.annual-profile-stage__footer :deep(p) { max-width: 560px; margin: 0 auto; }
.annual-profile-stage__footer :deep(span) { display: block; }
.annual-profile-stage__footer :deep(strong) { color: #fff; font-weight: 800; }

.annual-profile-stage--growth-challenge-knock.is-active:not(.is-reduced):not(.is-save-data) .annual-profile-stage__stage-grid {
  animation: profile-stage-pressure-breathe 7s ease-in-out 1.7s infinite;
}

.annual-profile-stage:not(.is-active) * { animation-play-state: paused !important; }
.annual-profile-stage.is-reduced *,
.annual-profile-stage.is-save-data * { animation: none !important; transition: none !important; }

@keyframes profile-stage-pressure-breathe {
  0%, 72%, 100% { opacity: .72; }
  80% { opacity: 1; }
}

@media (max-width: 720px) {
  .annual-profile-stage {
    --stage-top: clamp(178px, 24.8dvh, 232px);
    --stage-size: clamp(218px, 61vw, 272px);
  }
  .annual-profile-stage__header { top: max(6.2%, calc(env(safe-area-inset-top) + 46px)); left: 6%; right: 6%; }
  .annual-profile-stage__header :deep(h1) { font-size: clamp(1.16rem, 5.5vw, 1.55rem); }
  .annual-profile-stage__header :deep(p) { margin-top: 5px; font-size: 11px; line-height: 1.35; }
  .annual-profile-stage__primary-slot { width: 92%; }
  .annual-profile-stage__primary { padding: 7px 30px 8px; }
  .annual-profile-stage__secondary-slot { max-width: 84%; }
  .annual-profile-stage__secondary { padding: 6px 14px; }
  .annual-profile-stage__footer { left: 7%; right: 7%; font-size: 11px; line-height: 1.5; }
}

@media (max-height: 700px) and (orientation: portrait) {
  .annual-profile-stage {
    --stage-top: 118px;
    --stage-size: clamp(170px, 55vw, 220px);
    --panel-gap: 14px;
    --main-panel-height: 58px;
    --secondary-gap: 8px;
    --secondary-panel-height: 50px;
    --nav-reserved-height: 62px;
  }
  .annual-profile-stage__header { top: max(5.5%, calc(env(safe-area-inset-top) + 42px)); }
  .annual-profile-stage__header :deep(p) { display: none; }
  .annual-profile-stage__footer { line-height: 1.42; }
}

@media (orientation: landscape) and (max-height: 460px) {
  .annual-profile-stage {
    --stage-center-x: 27%;
    --stage-top: calc(50% - var(--stage-size) / 2);
    --stage-size: min(64vh, 275px);
    --main-panel-top: 42%;
    --secondary-panel-top: 65%;
    --main-panel-height: 66px;
    --secondary-panel-height: 50px;
    --footer-copy-bottom: 4%;
  }
  .annual-profile-stage__header { top: 12%; left: 48%; right: 5%; text-align: left; }
  .annual-profile-stage__primary-slot { left: 70%; width: 45%; }
  .annual-profile-stage__secondary-slot { left: 70%; }
  .annual-profile-stage__footer { left: 49%; right: 8%; text-align: left; }
  .annual-profile-stage__spotlight { right: 44%; clip-path: polygon(40% 0, 60% 0, 94% 100%, 6% 100%); }
}

.annual-profile-stage__alignment-debug {
  position: absolute;
  z-index: 30;
  inset: 0;
  pointer-events: none;
}

.annual-profile-stage__alignment-debug i { position: absolute; display: block; }
.annual-profile-stage__alignment-debug .is-page-axis { top: 0; bottom: 0; left: 50%; width: 1px; background: rgba(255, 70, 130, .78); }
.annual-profile-stage__alignment-debug .is-stage-bounds { top: var(--stage-top); left: var(--stage-center-x); width: var(--stage-size); height: var(--stage-size); border: 1px solid rgba(93, 255, 215, .92); border-radius: 50%; transform: translateX(-50%); }
.annual-profile-stage__alignment-debug .is-stage-center { top: calc(var(--stage-top) + var(--stage-size) / 2); left: var(--stage-center-x); width: 9px; height: 9px; border: 1px solid #fff; border-radius: 50%; background: #ff4682; transform: translate(-50%, -50%); }
.annual-profile-stage__alignment-debug .is-primary-center,
.annual-profile-stage__alignment-debug .is-secondary-center { left: 5%; right: 5%; height: 1px; background: rgba(255, 227, 94, .9); }
.annual-profile-stage__alignment-debug .is-primary-center { top: calc(var(--main-panel-top) + var(--main-panel-height) / 2); }
.annual-profile-stage__alignment-debug .is-secondary-center { top: calc(var(--secondary-panel-top) + var(--secondary-panel-height) / 2); background: rgba(119, 207, 255, .95); }
.annual-profile-stage__alignment-debug .is-footer-boundary { left: 0; right: 0; bottom: var(--footer-copy-bottom); height: 1px; background: rgba(255, 120, 82, .95); }

@media (prefers-reduced-motion: reduce) {
  .annual-profile-stage * { animation: none !important; transition: none !important; }
}
</style>
