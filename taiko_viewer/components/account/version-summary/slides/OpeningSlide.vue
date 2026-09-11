<script setup lang="ts">
import { computed, ref, toRef } from "vue";
import type { AnnualMotionEffectScope } from "~/composables/useAnnualTimeline";
import { useAnnualTimeline } from "~/composables/useAnnualTimeline";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import AnnualOpeningBeatLane from "../AnnualOpeningBeatLane.vue";
import AnnualOpeningCarousel from "../AnnualOpeningCarousel.vue";
import AnnualOpeningFireworks from "../AnnualOpeningFireworks.vue";
import AnnualScene from "../AnnualScene.vue";

const props = defineProps<{
  summary: VersionSummaryViewModel;
  pageIndex: number;
  pageTotal: number;
  active: boolean;
  reducedMotion: boolean;
}>();

const emit = defineEmits<{ start: []; "jump-to-end": [] }>();
const { t, locale } = useI18n();
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

const reportYear = computed(() => {
  const keyYear = props.summary.version.key.match(/20\d{2}/)?.[0];
  const dateYear = props.summary.version.startDate.match(/20\d{2}/)?.[0];
  return keyYear || dateYear || "2026";
});
// Display-only cover label. The opening cover advertises the edition by its
// public name; `reportYear` stays the machine-readable annual_2026 key that the
// rest of the report (calendar, summaries, API) is built on.
const reportYearLabel = computed(() => t("annualSummary.openingCover.yearLabel"));
// The cover prints only the edition line of the report title; the game-name line
// stays in the artwork and in the section aria-label.
const reportTitleLines = computed(() => {
  const lines = t("annualSummary.openingCover.reportTitle").split("\n");
  return lines.length > 1 ? lines.slice(1) : lines;
});
const formatDate = (value: string | null | undefined) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale.value === "ja" ? "ja-JP" : "zh-CN", {
    year: "numeric", month: "2-digit", day: "2-digit"
  }).format(date);
};
const periodLabel = computed(() => {
  const start = formatDate(props.summary.version.startDate) || reportYear.value;
  const end = formatDate(props.summary.version.effectiveEndDate) || formatDate(props.summary.version.endDate) || start;
  return `${start} — ${end}`;
});

const completeStoryStart = (direct: boolean) => {
  if (navigationSent.value || !startPending.value) return;
  startPending.value = false;
  navigationSent.value = true;
  if (direct) emit("jump-to-end");
  else emit("start");
};

const requestStart = (direct: boolean) => {
  if (!props.active || startPending.value || navigationSent.value) return;
  startPending.value = true;
  drumPulse.value = true;
  if (props.reducedMotion) {
    motionScope?.setTimeout(() => { drumPulse.value = false; }, 160);
    motionScope?.setTimeout(() => completeStoryStart(direct), 180);
    return;
  }
  motionScope?.setTimeout(() => { drumPulse.value = false; }, 430);
  motionScope?.setTimeout(() => completeStoryStart(direct), 960);
};

const beginStory = () => requestStart(false);
const jumpToResultPage = () => requestStart(true);
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
        <div class="annual-opening__sky" />
        <div class="annual-opening__info-surface" />
        <div class="annual-opening__horizon" />
      </div>
    </template>

    <template #atmosphere>
      <AnnualOpeningFireworks :active="active" :reduced-motion="reducedMotion" />
    </template>

    <template #visual>
      <div class="annual-opening__carousel" data-annual-stage="visual">
        <AnnualOpeningCarousel :summary="summary" :active="active" :reduced-motion="reducedMotion" />
      </div>
      <div class="annual-opening__beat" data-annual-stage="visual">
        <AnnualOpeningBeatLane :active="active" :reduced-motion="reducedMotion" />
      </div>
    </template>

    <template #data>
      <strong class="annual-opening__year" data-annual-stage="data">{{ reportYearLabel }}</strong>
    </template>

    <template #copy>
      <img class="annual-opening__title-art" src="/title.png" alt="" data-annual-stage="title" />
      <section class="annual-opening__cover-info" :aria-label="t('annualSummary.openingCover.reportTitle')">
        <div class="annual-opening__info-head" data-annual-stage="copy">
          <span class="annual-opening__generated">{{ t("annualSummary.openingCover.generatedBy") }}</span>
          <button
            type="button"
            class="annual-opening__direct"
            :disabled="startPending"
            :aria-label="t('annualSummary.openingCover.resultPage')"
            @click="jumpToResultPage"
          >
            <img src="/to_end.png" alt="" aria-hidden="true" />
            <span>{{ t("annualSummary.openingCover.resultPage") }}</span>
          </button>
        </div>
        <div class="annual-opening__info-main">
          <div class="annual-opening__info-copy" data-annual-stage="data">
            <span class="annual-opening__info-year-label">{{ reportYearLabel }}</span>
            <h1>
              <span v-for="line in reportTitleLines" :key="line">{{ line }}</span>
            </h1>
          </div>
          <button
            type="button"
            class="annual-opening__start"
            :class="{ 'is-pulsing': drumPulse }"
            :disabled="startPending"
            :aria-label="t('annualSummary.controls.start')"
            data-annual-stage="copy"
            @click="beginStory"
          >
            <span class="annual-opening__start-icon"><img src="/icon.png" alt="" aria-hidden="true" /></span>
            <strong>{{ t("annualSummary.openingCover.startTop") }}</strong>
            <em>{{ t("annualSummary.openingCover.startBottom") }}</em>
          </button>
        </div>
        <footer class="annual-opening__legal" data-annual-stage="copy">
          <span>{{ t("annualSummary.openingCover.period", { period: periodLabel }) }}</span>
          <span>{{ t("annualSummary.openingCover.consent") }}</span>
        </footer>
      </section>
    </template>

    <template #transition>
    </template>
  </AnnualScene>
</template>

<style scoped>
.annual-opening { --opening-night: #071b42; width: 100%; height: 100vh; height: 100svh; height: 100dvh; color: #fff; background: var(--opening-night); }
.annual-opening :deep(.annual-scene__content) { pointer-events: none !important; }
.annual-opening__backdrop, .annual-opening__sky, .annual-opening__info-surface { position: absolute; inset: 0; }
.annual-opening__backdrop { overflow: hidden; background: var(--opening-night); }
.annual-opening__sky { bottom: 33%; background: radial-gradient(circle at 50% 38%, rgba(56, 119, 177, .28), transparent 42%), linear-gradient(180deg, #071a41 0%, #0c3a70 62%, #124f83 100%); }
.annual-opening__sky::after { content: ""; position: absolute; inset: 0; opacity: .3; background: radial-gradient(circle at 11% 28%, #a3c6d0 0 1px, transparent 2px), radial-gradient(circle at 84% 20%, #819aa9 0 1px, transparent 2px); background-size: 79px 67px, 102px 91px; }
.annual-opening__info-surface { top: 66%; bottom: 0; background: linear-gradient(160deg, #8ec7e1 0%, #6ea5cb 48%, #a8c7df 100%); }
.annual-opening__info-surface::before { content: ""; position: absolute; inset: 0; opacity: .22; background: linear-gradient(110deg, rgba(255,255,255,.36), transparent 28% 74%, rgba(15,61,110,.25)); }
.annual-opening__horizon { position: absolute; top: 66%; left: 0; right: 0; height: 2px; background: rgba(255, 238, 204, .75); box-shadow: 0 -4px 14px rgba(162, 225, 248, .4); }
.annual-opening__title-art { position: absolute; z-index: 5; top: -2%; left: 50%; width: min(96vw, 470px); height: auto; transform: translateX(-50%); filter: drop-shadow(0 4px 10px rgba(3, 17, 43, .3)); }
.annual-opening__carousel { position: absolute; z-index: 2; top: 29%; left: 0; right: 0; height: 37%; }
.annual-opening__beat { position: absolute; z-index: 4; top: 64.2%; left: 0; right: 0; height: clamp(40px, 5.1vh, 48px); }
.annual-opening__year { position: absolute; z-index: 3; top: 74%; left: 5%; color: rgba(255,255,255,.96); font: 400 clamp(3.7rem, 18vw, 7.4rem)/.78 Arial, Helvetica, sans-serif; text-shadow: 0 3px 0 rgba(28,89,139,.18); }
.annual-opening__cover-info { position: absolute; z-index: 4; inset: 69% 0 0; padding: clamp(9px, 2.2vw, 18px) clamp(18px, 5vw, 36px) max(10px, env(safe-area-inset-bottom)); }
.annual-opening__info-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; min-height: 34px; }
.annual-opening__generated { margin-left: clamp(58px, 16vw, 76px); color: rgba(255,255,255,.96); font: 700 clamp(11px, 2.9vw, 15px)/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .02em; text-shadow: 0 1px 3px rgba(18,59,96,.28); }
.annual-opening__direct { display: grid; width: clamp(46px, 12vw, 56px); margin-top: -4px; padding: 0; border: 0; place-items: center; gap: 1px; color: inherit; background: transparent; cursor: pointer; pointer-events: auto; }
.annual-opening__direct:disabled { cursor: wait; opacity: .82; }
.annual-opening__direct:focus-visible { outline: 3px solid #fff; outline-offset: 3px; border-radius: 12px; }
.annual-opening__direct img { display: block; width: 100%; aspect-ratio: 1; object-fit: contain; filter: drop-shadow(0 2px 2px rgba(24,57,88,.22)); }
.annual-opening__direct span { min-height: 22px; margin-top: 1px; overflow-wrap: anywhere; color: rgba(255,255,255,.88); font: 700 10px/1.1 var(--viewer-font-family); text-shadow: 0 1px 3px rgba(18,59,96,.28); }
.annual-opening__info-main { position: relative; display: flex; align-items: center; justify-content: space-between; min-height: 148px; padding: 5px 0 0; }
.annual-opening__info-copy { position: relative; z-index: 2; display: grid; gap: 4px; margin-top: 0.6rem; }
.annual-opening__info-year-label { display: none; }
.annual-opening__info-copy h1 { display: grid; gap: 0.8rem; margin: 0; color: #fffdf8; font: 800 clamp(1.65rem, 8.5vw, 3.15rem)/.9 var(--viewer-display-font); letter-spacing: .02em; text-shadow: 0 2px 0 rgba(37,91,127,.24), 0 4px 12px rgba(31,70,105,.22); -webkit-text-stroke: .35px rgba(255,255,255,.6); }
.annual-opening__start { position: relative; z-index: 3; display: grid; min-width: 84px; min-height: 104px; place-items: center; align-content: center; gap: 1px; padding: 4px; border: 0; color: #fff; background: transparent; cursor: pointer; pointer-events: auto; text-shadow: 0 2px 4px rgba(33,71,108,.32); }
.annual-opening__start:disabled { cursor: wait; opacity: .82; }
.annual-opening__start:focus-visible { outline: 3px solid #fff; outline-offset: 4px; border-radius: 12px; }
.annual-opening__start-icon { display: grid; width: clamp(64px, 18vw, 88px); aspect-ratio: 1; place-items: center; border-radius: 50%; background: rgba(255,255,255,.62); box-shadow: 0 4px 11px rgba(28,76,111,.24); }
.annual-opening__start-icon img { width: 92%; height: 92%; object-fit: contain; }
.annual-opening__start strong, .annual-opening__start em { display: block; font-family: var(--viewer-display-font); font-style: normal; line-height: 1.1; }
.annual-opening__start strong { font-size: clamp(10px, 2.9vw, 14px); }
.annual-opening__start em { font-size: clamp(13px, 3.6vw, 17px); font-weight: 800; }
.annual-opening__start.is-pulsing .annual-opening__start-icon { animation: opening-start-hit .43s cubic-bezier(.2,.8,.25,1); }
.annual-opening__legal { position: absolute; right: clamp(18px, 5vw, 36px); bottom: max(8px, env(safe-area-inset-bottom)); left: clamp(18px, 5vw, 36px); display: grid; gap: 3px; color: rgba(246,251,255,.82); font: 500 clamp(10px, 2.25vw, 11px)/1.25 var(--viewer-font-family); text-align: left; text-shadow: 0 1px 3px rgba(29,66,102,.18); }
@keyframes opening-start-hit { 0%, 100% { transform: scale(1); } 32% { transform: scale(1.1); } 63% { transform: scale(.97); } }
@media (max-width: 370px) { .annual-opening__info-main { min-height: 132px; } .annual-opening__info-copy h1 { font-size: clamp(1.42rem, 8vw, 2.2rem); } .annual-opening__start { min-width: 76px; } .annual-opening__start-icon { width: 65px; } .annual-opening__direct { width: clamp(42px, 11vw, 48px); } .annual-opening__direct span { font-size: 10px; } }
@media (max-height: 690px) and (orientation: portrait) { .annual-opening__title-art { top: -7%; } .annual-opening__carousel { top: 27%; height: 36%; } .annual-opening__cover-info { padding-top: 8px; } .annual-opening__info-main { min-height: 125px; } .annual-opening__legal { font-size: 10px; } }
@media (orientation: landscape) and (max-height: 460px) { .annual-opening__title-art { top: -16%; left: 24%; width: min(54vw, 390px); } .annual-opening__carousel { top: 5%; left: 34%; right: 2%; height: 59%; } .annual-opening__beat { top: auto; right: 3%; bottom: 0; left: 34%; height: 44px; } .annual-opening__info-surface { top: 0; right: 66%; bottom: 0; } .annual-opening__cover-info { top: 0; right: 66%; padding: 8px 16px; } .annual-opening__horizon { top: 0; bottom: 0; left: 34%; width: 2px; height: auto; } .annual-opening__year { top: 54%; left: 6%; font-size: 4rem; } .annual-opening__info-main { min-height: 150px; align-items: end; } .annual-opening__info-copy h1 { font-size: 1.7rem; } .annual-opening__direct { display: none; } .annual-opening__legal { left: 16px; right: 16px; text-align: left; } }
@media (prefers-reduced-motion: reduce) { .annual-opening__start-icon { animation: none !important; } }
</style>
