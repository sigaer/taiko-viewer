<script setup lang="ts">
import { computed, ref, toRef } from "vue";
import type { AnnualMotionEffectScope } from "~/composables/useAnnualTimeline";
import { useAnnualTimeline } from "~/composables/useAnnualTimeline";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import AnnualOpeningBeatLane from "../AnnualOpeningBeatLane.vue";
import AnnualOpeningCarousel from "../AnnualOpeningCarousel.vue";
import AnnualOpeningFireworks from "../AnnualOpeningFireworks.vue";
import AnnualScene from "../AnnualScene.vue";
import ParticleLayer from "../ParticleLayer.vue";
import TaikoRipple from "../TaikoRipple.vue";

const props = defineProps<{
  summary: VersionSummaryViewModel;
  pageIndex: number;
  pageTotal: number;
  active: boolean;
  reducedMotion: boolean;
}>();

const emit = defineEmits<{ start: [] }>();
const { t } = useI18n();
const donIconUrl = "/api/content/assets/don";
const rippleTrigger = ref(0);
const startPending = ref(false);
const navigationSent = ref(false);
const drumPulse = ref(false);
const rootRef = ref<HTMLElement | null>(null);
let motionScope: AnnualMotionEffectScope | null = null;

const { onAnnualMotionActive } = useAnnualTimeline(
  rootRef,
  toRef(props, "active"),
  toRef(props, "reducedMotion"),
  { reenter: "restart" }
);

onAnnualMotionActive((scope) => {
  motionScope = scope;
  return () => {
    if (motionScope === scope) motionScope = null;
    drumPulse.value = false;
  };
});

const generatedAt = computed(() =>
  new Intl.DateTimeFormat(undefined, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(props.summary.generatedAt))
);

const completeStoryStart = () => {
  if (!startPending.value || navigationSent.value) return;
  startPending.value = false;
  navigationSent.value = true;
  emit("start");
};

const beginStory = () => {
  if (!props.active || startPending.value || navigationSent.value) return;
  startPending.value = true;
  drumPulse.value = true;
  rippleTrigger.value += 1;

  if (props.reducedMotion) {
    completeStoryStart();
    return;
  }

  motionScope?.setTimeout(() => { drumPulse.value = false; }, 430);
  // Navigation never relies on the ripple animation event alone.
  motionScope?.setTimeout(completeStoryStart, 960);
};
</script>

<template>
  <AnnualScene
    ref="rootRef"
    class="annual-opening"
    mood="rainbow-stage"
    intensity="high"
    :active="active"
    :reduced-motion="reducedMotion"
    :aria-label="summary.copy.opening.title"
  >
    <template #background>
      <div class="annual-opening__backdrop">
        <div class="annual-opening__rainbow" />
        <div class="annual-opening__stage-rays" />
        <div class="annual-opening__floor" />
      </div>
    </template>

    <template #atmosphere>
      <ParticleLayer :active="active" :reduced-motion="reducedMotion" density="high" palette="rainbow" />
      <AnnualOpeningFireworks :active="active" :reduced-motion="reducedMotion" />
      <div class="annual-opening__light-rings" aria-hidden="true"><i /><i /><i /></div>
    </template>

    <template #visual>
      <div class="annual-opening__carousel" data-annual-stage="visual">
        <AnnualOpeningCarousel :summary="summary" :active="active" :reduced-motion="reducedMotion" />
      </div>
      <div class="annual-opening__drum-stage" data-annual-stage="visual">
        <div class="annual-opening__drum-halo" aria-hidden="true" />
        <button
          type="button"
          class="annual-opening__start"
          :class="{ 'is-pulsing': drumPulse }"
          :disabled="startPending"
          :aria-label="t('annualSummary.controls.start')"
          @click="beginStory"
        >
          <span class="annual-opening__drum-shell">
            <img class="annual-opening__drum-face" :src="donIconUrl" alt="" aria-hidden="true" />
          </span>
          <strong>{{ t("annualSummary.openingCover.startTop") }}</strong>
          <em>{{ t("annualSummary.openingCover.startBottom") }}</em>
        </button>
      </div>
      <div class="annual-opening__beat" data-annual-stage="visual">
        <AnnualOpeningBeatLane :active="active" :reduced-motion="reducedMotion" />
      </div>
    </template>

    <template #data>
      <strong class="annual-opening__year" data-annual-stage="data">2026</strong>
      <span class="annual-opening__operator" data-annual-stage="data">@{{ summary.user.nickname }}</span>
    </template>

    <template #copy>
      <header class="annual-opening__headline">
        <span class="annual-opening__kicker" data-annual-stage="title">{{ t("annualSummary.openingCover.kicker") }}</span>
        <h1 data-annual-stage="title">
          <span class="annual-opening__headline-line">{{ t("annualSummary.openingCover.headline") }}</span>
          <span class="annual-opening__headline-line is-echo">{{ t("annualSummary.openingCover.subhead") }}</span>
        </h1>
      </header>
      <div class="annual-opening__footer" data-annual-stage="copy">
        <span>SAKURABOT · TAIKO ANNUAL STAGE</span>
        <span>{{ t("annualSummary.openingCover.generatedAt", { time: generatedAt }) }}</span>
      </div>
    </template>

    <template #transition>
      <TaikoRipple
        :active="active"
        :reduced-motion="reducedMotion"
        mode="burst"
        :trigger="rippleTrigger"
        origin-x="50%"
        origin-y="58%"
        @complete="completeStoryStart"
      />
    </template>
  </AnnualScene>
</template>

<style scoped>
.annual-opening {
  --opening-night: #071832;
  width: 100%; height: 100vh; height: 100svh; height: 100dvh;
  color: #fff; background: var(--opening-night);
}
.annual-opening :deep(.annual-scene__content) { pointer-events: none !important; }
.annual-opening__backdrop { position: absolute; inset: 0; overflow: hidden; background: radial-gradient(circle at 50% 49%, rgba(58,160,219,.42), transparent 27%), linear-gradient(180deg, #06142d 0%, #0b315c 56%, #07162d 100%); }
.annual-opening__rainbow { position: absolute; inset: -12% -48% 31%; opacity: .32; filter: blur(18px) saturate(1.25); background: conic-gradient(from 247deg at 50% 108%, #f15953, #f6ca57, #49c58c, #42b8e8, #745fe3, #f15953); mask-image: radial-gradient(ellipse at 50% 105%, transparent 0 37%, #000 38% 47%, transparent 49%); }
.annual-opening__stage-rays { position: absolute; inset: 35% -30% -10%; opacity: .18; background: repeating-conic-gradient(from -9deg at 50% 100%, rgba(255,255,255,.34) 0 2deg, transparent 2deg 12deg); mask-image: linear-gradient(transparent, #000 34%); }
.annual-opening__floor { position: absolute; inset: 72% -12% -16%; border-top: 1px solid rgba(115,213,255,.42); background: linear-gradient(rgba(90,190,233,.13) 1px, transparent 1px), linear-gradient(90deg, rgba(90,190,233,.13) 1px, transparent 1px); background-size: 36px 24px; transform: perspective(280px) rotateX(58deg); transform-origin: 50% 0; mask-image: linear-gradient(#000, transparent 88%); }
.annual-opening__light-rings { position: absolute; left: 50%; top: 58%; width: min(86vw,430px); aspect-ratio: 1; transform: translate(-50%,-50%); }
.annual-opening__light-rings i { position: absolute; inset: calc(var(--ring,0) * 9%); border: 1px solid rgba(121,215,255,.22); border-radius: 50%; box-shadow: 0 0 28px rgba(50,170,232,.12); }
.annual-opening__light-rings i:nth-child(2) { --ring: 1; border-style: dashed; } .annual-opening__light-rings i:nth-child(3) { --ring: 2; border-color: rgba(255,208,96,.26); }
.annual-opening__carousel { position: absolute; top: 25.5%; left: -5%; right: -5%; height: 29%; opacity: .66; transform: perspective(520px) rotateX(3deg) rotateZ(-2deg); filter: saturate(.92) brightness(.78); mask-image: linear-gradient(90deg, transparent, #000 10% 90%, transparent); }
.annual-opening__carousel :deep(.annual-cover-flow) { --cover-size: min(35vw,176px); } .annual-opening__carousel :deep(.annual-cover-flow__card) { border: 1px solid rgba(255,255,255,.2); } .annual-opening__carousel :deep(.annual-cover-flow::before), .annual-opening__carousel :deep(.annual-cover-flow::after) { display: none; }
.annual-opening__drum-stage { position: absolute; z-index: 3; left: 50%; top: 57.5%; width: min(48vw,220px); aspect-ratio: 1; transform: translate(-50%,-50%); }
.annual-opening__drum-halo { position: absolute; inset: -23%; border: 1px solid rgba(255,213,99,.5); border-radius: 50%; background: repeating-conic-gradient(from 5deg, rgba(255,217,111,.55) 0 1deg, transparent 1deg 12deg); mask-image: radial-gradient(transparent 0 62%, #000 63% 65%, transparent 66%); filter: drop-shadow(0 0 12px rgba(255,211,92,.35)); }
.annual-opening__start { position: absolute; inset: 0; display: grid; place-items: center; padding: 0; border: 0; border-radius: 50%; color: #fff; background: transparent; cursor: pointer; pointer-events: auto; }
.annual-opening__start:disabled { cursor: wait; } .annual-opening__start:focus-visible { outline: 4px solid #fff; outline-offset: 9px; }
.annual-opening__drum-shell { position: absolute; inset: 0; display: grid; place-items: center; border: clamp(7px,2vw,11px) solid #2e2b33; border-radius: 50%; background: radial-gradient(circle at 38% 28%, rgba(255,255,255,.9), transparent 27%), #f7ead3; box-shadow: 0 24px 52px rgba(0,8,24,.55), 0 0 0 5px #ead4aa, 0 0 0 8px #202938, inset 0 -13px 23px rgba(181,123,79,.18); }
.annual-opening__drum-shell::before { content: ""; position: absolute; inset: 8%; border: 2px dashed rgba(83,56,44,.28); border-radius: inherit; }
.annual-opening__drum-face { width: 65%; height: 65%; object-fit: contain; filter: drop-shadow(0 7px 5px rgba(74,40,35,.2)); }
.annual-opening__start > strong, .annual-opening__start > em { position: absolute; z-index: 2; left: 50%; width: 90%; transform: translateX(-50%); color: #102d50; font-family: var(--viewer-display-font); font-style: normal; text-shadow: 0 1px rgba(255,255,255,.8); }
.annual-opening__start > strong { top: 67%; font-size: 11px; } .annual-opening__start > em { top: 75%; font-size: 15px; font-weight: 800; }
.annual-opening__beat { position: absolute; z-index: 2; left: 0; right: 0; top: 75%; height: 5.5%; opacity: .9; box-shadow: 0 0 24px rgba(66,185,232,.28); }
.annual-opening__year { position: absolute; top: 7.4%; left: 50%; transform: translateX(-50%); color: rgba(255,255,255,.14); font: 900 clamp(5rem,25vw,8.4rem)/.8 var(--viewer-display-font); text-shadow: 0 0 40px rgba(70,190,242,.16); }
.annual-opening__operator { position: absolute; right: 5%; bottom: calc(max(20px,env(safe-area-inset-bottom)) + 35px); max-width: 48%; overflow: hidden; color: rgba(195,226,247,.72); font: 800 11px/1.2 var(--viewer-font-family); text-overflow: ellipsis; white-space: nowrap; }
.annual-opening__headline { position: absolute; z-index: 4; top: 9%; left: 7%; right: 7%; text-align: center; text-shadow: 0 4px 18px rgba(0,13,34,.8); }
.annual-opening__kicker { display: block; color: #f5d475; font: 800 11px/1.3 var(--viewer-font-family); }
.annual-opening__headline h1 { margin: 8px 0 0; font-family: var(--viewer-display-font); } .annual-opening__headline-line { display: block; font-size: clamp(2.25rem,10.8vw,4.1rem); line-height: .98; } .annual-opening__headline-line.is-echo { margin-top: 4px; color: #75d4f4; font-size: clamp(1.25rem,6.3vw,2.25rem); }
.annual-opening__footer { position: absolute; left: 5%; right: 5%; bottom: max(16px,env(safe-area-inset-bottom)); display: flex; justify-content: space-between; gap: 16px; color: rgba(191,222,242,.62); font: 700 10px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace; } .annual-opening__footer span:last-child { text-align: right; }
.annual-opening.is-active:not(.is-reduced) .annual-opening__drum-stage { animation: opening-drum-breathe 2.8s ease-in-out 2.3s infinite; } .annual-opening.is-active:not(.is-reduced) .annual-opening__drum-halo { animation: opening-halo-turn 13s linear infinite; } .annual-opening.is-active:not(.is-reduced) .annual-opening__headline-line { animation: opening-title-unmask .76s cubic-bezier(.2,.8,.2,1) both; } .annual-opening.is-active:not(.is-reduced) .annual-opening__headline-line.is-echo { animation-delay: .23s; } .annual-opening__start.is-pulsing .annual-opening__drum-shell { animation: opening-drum-hit .43s cubic-bezier(.2,.8,.25,1); }
@keyframes opening-drum-breathe { 0%,100% { transform: translate(-50%,-50%); filter: drop-shadow(0 0 0 rgba(87,206,255,0)); } 50% { transform: translate(-50%,-51.5%); filter: drop-shadow(0 0 15px rgba(87,206,255,.32)); } }
@keyframes opening-halo-turn { to { transform: rotate(360deg); } } @keyframes opening-title-unmask { from { clip-path: inset(0 50% 0 50%); filter: blur(9px); } to { clip-path: inset(0); filter: blur(0); } } @keyframes opening-drum-hit { 0%,100% { transform: scale(1); } 32% { transform: scale(1.085); } 63% { transform: scale(.975); } }
@media (min-width:521px) { .annual-opening__carousel { left: calc(50% - 300px); right: calc(50% - 300px); } }
@media (orientation:landscape) and (max-height:460px) { .annual-opening__headline { top: 8%; left: 3%; right: auto; width: 38%; text-align: left; } .annual-opening__headline-line { font-size: clamp(1.9rem,5.4vw,3rem); } .annual-opening__headline-line.is-echo { font-size: clamp(1.05rem,3.2vw,1.65rem); } .annual-opening__year { top: 10%; left: 17%; font-size: 5rem; } .annual-opening__carousel { top: 8%; left: 34%; right: 3%; height: 68%; } .annual-opening__drum-stage { top: 50%; left: 65%; width: min(43vh,190px); } .annual-opening__beat { top: auto; bottom: 0; right: 42%; height: 13%; } .annual-opening__operator { right: 3%; bottom: 12px; } .annual-opening__footer { left: 3%; right: 52%; bottom: 16%; display: block; } .annual-opening__footer span { display: block; margin-top: 4px; text-align: left!important; } }
@media (max-height:690px) and (orientation:portrait) { .annual-opening__headline { top: 6%; } .annual-opening__carousel { top: 23%; } .annual-opening__drum-stage { top: 56%; width: min(43vw,190px); } .annual-opening__beat { top: 73%; } .annual-opening__footer { bottom: max(10px,env(safe-area-inset-bottom)); } }
@media (prefers-reduced-motion:reduce) { .annual-opening__drum-stage, .annual-opening__drum-halo, .annual-opening__headline-line, .annual-opening__drum-shell { animation: none!important; } }
</style>
