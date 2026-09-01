<script setup lang="ts">
import { ref, toRef } from "vue";
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
}>(), { saveData: false, tone: "near", motionPreset: "growth-near-rainbow", ariaLabel: "" });

const rootRef = ref<HTMLElement | null>(null);
useAnnualTimeline(rootRef, toRef(props, "active"), toRef(props, "reducedMotion"), {
  reenter: "restart",
  configureTimeline: createAnnualGrowthTimeline(() => props.motionPreset)
});
</script>

<template>
  <AnnualScene
    ref="rootRef"
    class="annual-profile-stage"
    :class="[`annual-profile-stage--${tone}`, `annual-profile-stage--${motionPreset}`, { 'is-save-data': saveData }]"
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
      <div class="annual-profile-stage__orbit" aria-hidden="true"><i /><i /><i /></div>
      <div v-if="!saveData" class="annual-profile-stage__beam-lines" aria-hidden="true"><i /><i /><i /></div>
      <slot name="atmosphere" />
    </template>
    <template #visual>
      <div class="annual-profile-stage__center" data-annual-stage="visual">
        <div class="annual-profile-stage__center-shadow" aria-hidden="true" />
        <slot name="center" />
      </div>
    </template>
    <template #data>
      <div class="annual-profile-stage__panels">
        <div class="annual-profile-stage__primary" data-annual-stage="data"><slot name="primary-panel" /></div>
        <div class="annual-profile-stage__secondary" data-annual-stage="data"><slot name="secondary-panel" /></div>
      </div>
    </template>
    <template #copy>
      <header class="annual-profile-stage__header" data-annual-stage="title"><slot name="header" /></header>
      <footer class="annual-profile-stage__footer" data-annual-stage="copy"><slot name="footer" /></footer>
    </template>
    <template #transition><slot name="transition" /></template>
  </AnnualScene>
</template>

<style scoped>
.annual-profile-stage {
  --stage-ink: #061226;
  --stage-cyan: #66d8ff;
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

.annual-profile-stage__orbit {
  position: absolute;
  left: 50%;
  top: 42%;
  width: min(72vw, 390px);
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
}

.annual-profile-stage__orbit i {
  position: absolute;
  inset: 0;
  border: 1px solid rgba(91, 211, 242, .17);
  border-radius: 50%;
}

.annual-profile-stage__orbit i:nth-child(2) { inset: 7%; border-style: dashed; }
.annual-profile-stage__orbit i:nth-child(3) { inset: 14%; border-color: rgba(102, 216, 255, .16); }

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

.annual-profile-stage__center {
  position: absolute;
  z-index: 2;
  left: 50%;
  top: 41%;
  width: min(64vw, 340px);
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
  display: grid;
  place-items: center;
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

.annual-profile-stage__center :deep(.growth-song-stage) { --stage-size: min(43vh, 64vw, 315px); }
.annual-profile-stage__panels { position: absolute; inset: 0; }

.annual-profile-stage__primary {
  position: absolute;
  z-index: 2;
  top: 67.2%;
  left: 50%;
  width: min(88%, 410px);
  min-height: 50px;
  padding: 8px 38px 9px;
  transform: translateX(-50%);
  box-sizing: border-box;
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
  position: absolute;
  z-index: 3;
  top: 76%;
  left: 50%;
  min-width: 142px;
  max-width: 82%;
  padding: 6px 18px 7px;
  transform: translateX(-50%);
  box-sizing: border-box;
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
  bottom: max(10%, calc(env(safe-area-inset-bottom) + 76px));
  margin: 0;
  color: rgba(218, 241, 252, .82);
  font: 600 12px/1.55 var(--viewer-font-family);
  text-align: center;
}

.annual-profile-stage__footer :deep(p) { max-width: 560px; margin: 0 auto; }
.annual-profile-stage__footer :deep(span) { display: block; }
.annual-profile-stage__footer :deep(strong) { color: #fff; font-weight: 800; }

.annual-profile-stage--growth-near-rainbow.is-active:not(.is-reduced):not(.is-save-data) .annual-profile-stage__orbit i:nth-child(2) {
  animation: profile-stage-ring-breathe 7s ease-in-out 1.8s infinite;
}

.annual-profile-stage--growth-challenge-knock.is-active:not(.is-reduced):not(.is-save-data) .annual-profile-stage__stage-grid {
  animation: profile-stage-pressure-breathe 7s ease-in-out 1.7s infinite;
}

.annual-profile-stage:not(.is-active) * { animation-play-state: paused !important; }
.annual-profile-stage.is-reduced *,
.annual-profile-stage.is-save-data * { animation: none !important; transition: none !important; }

@keyframes profile-stage-ring-breathe {
  0%, 82%, 100% { opacity: .42; }
  88% { opacity: .76; }
}

@keyframes profile-stage-pressure-breathe {
  0%, 72%, 100% { opacity: .72; }
  80% { opacity: 1; }
}

@media (max-width: 720px) {
  .annual-profile-stage__header { top: max(6.2%, calc(env(safe-area-inset-top) + 46px)); left: 6%; right: 6%; }
  .annual-profile-stage__header :deep(h1) { font-size: clamp(1.16rem, 5.5vw, 1.55rem); }
  .annual-profile-stage__header :deep(p) { margin-top: 5px; font-size: 11px; line-height: 1.35; }
  .annual-profile-stage__center { top: 38.4%; width: min(61vw, 260px); }
  .annual-profile-stage__center :deep(.growth-song-stage) { --stage-size: min(36vh, 61vw, 250px); }
  .annual-profile-stage__orbit { top: 40.5%; width: min(73vw, 310px); }
  .annual-profile-stage__primary { top: 64.8%; width: 92%; padding: 7px 30px 8px; }
  .annual-profile-stage__secondary { top: 73.6%; max-width: 84%; padding: 6px 14px; }
  .annual-profile-stage__footer { left: 7%; right: max(7%, 92px); bottom: max(9.4%, calc(env(safe-area-inset-bottom) + 72px)); font-size: 11px; line-height: 1.5; }
}

@media (max-width: 720px) and (min-height: 880px) {
  .annual-profile-stage__center { top: 39.5%; }
  .annual-profile-stage__primary { top: 65.8%; }
  .annual-profile-stage__secondary { top: 74.2%; }
  .annual-profile-stage__footer { bottom: max(9.2%, calc(env(safe-area-inset-bottom) + 74px)); }
}

@media (max-height: 700px) and (orientation: portrait) {
  .annual-profile-stage__header { top: max(5.5%, calc(env(safe-area-inset-top) + 42px)); }
  .annual-profile-stage__header :deep(p) { display: none; }
  .annual-profile-stage__center { top: 35.5%; width: min(55vw, 230px); }
  .annual-profile-stage__center :deep(.growth-song-stage) { --stage-size: min(34vh, 55vw, 220px); }
  .annual-profile-stage__primary { top: 60.5%; }
  .annual-profile-stage__secondary { top: 70.5%; }
  .annual-profile-stage__footer { bottom: max(9%, calc(env(safe-area-inset-bottom) + 62px)); line-height: 1.42; }
}

@media (orientation: landscape) and (max-height: 460px) {
  .annual-profile-stage__header { top: 12%; left: 48%; right: 5%; text-align: left; }
  .annual-profile-stage__center { top: 49%; left: 27%; width: min(64vh, 285px); }
  .annual-profile-stage__center :deep(.growth-song-stage) { --stage-size: min(64vh, 275px); }
  .annual-profile-stage__primary { top: 50%; left: 70%; width: 45%; }
  .annual-profile-stage__secondary { top: 68%; left: 70%; }
  .annual-profile-stage__footer { left: 49%; right: 8%; bottom: 7%; text-align: left; }
  .annual-profile-stage__spotlight { right: 44%; clip-path: polygon(40% 0, 60% 0, 94% 100%, 6% 100%); }
}

@media (prefers-reduced-motion: reduce) {
  .annual-profile-stage * { animation: none !important; transition: none !important; }
}
</style>
