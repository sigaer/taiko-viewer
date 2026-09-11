<script setup lang="ts">
import { computed } from "vue";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import AnimatedNumber from "../AnimatedNumber.vue";
import AnnualDrumWindow from "../AnnualDrumWindow.vue";
import AnnualScene from "../AnnualScene.vue";
import ParticleLayer from "../ParticleLayer.vue";
import { isUsableMetric, segmentAnnualTitle } from "~/utils/annualPresentation";

const props = defineProps<{
  summary: VersionSummaryViewModel;
  pageIndex: number;
  pageTotal: number;
  active: boolean;
  reducedMotion: boolean;
}>();

const emit = defineEmits<{ next: [] }>();
const { t } = useI18n();

const hasBreakthrough = computed(() =>
  Boolean(props.summary.breakthrough.type && props.summary.breakthrough.type !== "none")
);

const titleText = computed(() =>
  props.summary.finalTitle.title
  || (hasBreakthrough.value ? props.summary.breakthrough.title : "")
  || t("annualSummary.slides.finale.missingTitle")
);
const bodyText = computed(() =>
  props.summary.finalTitle.body
  || (hasBreakthrough.value ? props.summary.breakthrough.body : t("annualSummary.slides.finale.missingBody"))
);
const titleSegments = computed(() => segmentAnnualTitle(titleText.value));

const breakthroughTime = computed(() => props.summary.breakthrough.happenedLabel || "");
const songName = computed(() => props.summary.breakthrough.song?.name || "");
const songSubtitle = computed(() => props.summary.breakthrough.song?.subtitle || "");
const evidenceTags = computed(() => props.summary.breakthrough.evidence.slice(0, 3));

const metricEntries = computed(() => [
  { key: "plays", value: props.summary.overview.playCount, label: t("annualSummary.slides.overview.plays") },
  { key: "activeDays", value: props.summary.period.activeDays, label: t("annualSummary.slides.overview.activeDays") },
  { key: "songs", value: props.summary.overview.uniqueSongs, label: t("annualSummary.slides.overview.songs") }
].filter((entry) => isUsableMetric(entry.value)));
</script>

<template>
  <AnnualScene
    class="annual-finale-scene"
    :class="{ 'is-active': active, 'is-reduced': reducedMotion }"
    :active="active"
    :reduced-motion="reducedMotion"
    mood="award-stage"
    intensity="high"
    data-visual-style="annual-finale"
  >
    <template #background>
      <div class="annual-finale-scene__sky" aria-hidden="true"></div>
    </template>
    <template #atmosphere>
      <ParticleLayer :active="active" :reduced-motion="reducedMotion" density="high" palette="gold" />
    </template>

    <div class="annual-finale-scene__content">
      <div v-if="hasBreakthrough" class="annual-finale-scene__flash" :aria-label="t('annualSummary.slides.finale.flashEyebrow')">
        <span class="annual-finale-scene__flash-eyebrow">{{ t("annualSummary.slides.finale.flashEyebrow") }} · {{ breakthroughTime }}</span>
        <strong class="annual-finale-scene__flash-song">{{ songName }}</strong>
        <small v-if="songSubtitle" class="annual-finale-scene__flash-sub">{{ songSubtitle }}</small>
        <div v-if="evidenceTags.length" class="annual-finale-scene__flash-tags">
          <b v-for="item in evidenceTags" :key="item.key">{{ item.value }}</b>
        </div>
      </div>

      <div class="annual-finale-scene__medal" aria-hidden="true">
        <AnnualDrumWindow
          size="large"
          fallback-kind="don"
          :image-url="summary.profileCard?.myDonUrl"
          :image-alt="summary.profileCard?.nickname || summary.user.nickname"
          :fallback="t('annualSummary.common.defaultDon')"
        />
        <i class="annual-finale-scene__medal-ring"></i>
      </div>

      <p class="annual-finale-scene__eyebrow">{{ t("annualSummary.slides.finale.eyebrow") }}</p>
      <h2 class="annual-finale-scene__title" :aria-label="titleText">
        <span v-for="(segment, index) in titleSegments" :key="`${segment}-${index}`" class="annual-finale-scene__char" :style="{ '--char-index': index }">{{ segment }}</span>
      </h2>
      <p class="annual-finale-scene__body">{{ bodyText }}</p>

      <div v-if="metricEntries.length" class="annual-finale-scene__stats">
        <span v-for="(entry, index) in metricEntries" :key="entry.key" :style="{ '--stat-index': index }">
          <strong><AnimatedNumber :value="entry.value" :active="active" :reduced-motion="reducedMotion" :delay="2400 + index * 160" /></strong>
          {{ entry.label }}
        </span>
      </div>

      <button type="button" class="annual-finale-scene__cta" @click="emit('next')">
        {{ t("annualSummary.controls.viewPoster") }}
        <span aria-hidden="true">→</span>
      </button>
    </div>
  </AnnualScene>
</template>

<style scoped>
.annual-finale-scene {
  width: 100%;
  height: 100vh;
  height: 100svh;
  height: 100dvh;
  color: #fff4d5;
  background:
    radial-gradient(circle at 50% 12%, rgba(148, 116, 46, 0.6), transparent 30%),
    radial-gradient(circle at 50% 88%, rgba(44, 60, 120, 0.5), transparent 46%),
    linear-gradient(155deg, #171b35 0%, #0b1028 74%);
}
.annual-finale-scene__sky,
.annual-finale-scene__content {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.annual-finale-scene__sky {
  overflow: hidden;
  background:
    radial-gradient(1.5px 1.5px at 18% 26%, rgba(255, 255, 255, 0.9), transparent 100%),
    radial-gradient(1.2px 1.2px at 72% 14%, rgba(255, 255, 255, 0.7), transparent 100%),
    radial-gradient(1.4px 1.4px at 44% 38%, rgba(255, 255, 255, 0.55), transparent 100%),
    radial-gradient(1.1px 1.1px at 86% 48%, rgba(255, 255, 255, 0.6), transparent 100%),
    radial-gradient(1.3px 1.3px at 30% 62%, rgba(255, 255, 255, 0.5), transparent 100%),
    radial-gradient(1.2px 1.2px at 62% 72%, rgba(255, 255, 255, 0.45), transparent 100%);
}
.annual-finale-scene__content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(6px, 1.1vh, 14px);
  padding: max(54px, calc(env(safe-area-inset-top) + 40px)) clamp(18px, 5vw, 34px) max(86px, calc(env(safe-area-inset-bottom) + 74px));
  box-sizing: border-box;
  text-align: center;
}

.annual-finale-scene__flash {
  position: absolute;
  top: max(56px, calc(env(safe-area-inset-top) + 42px));
  left: 50%;
  width: min(92%, 460px);
  transform: translateX(-50%);
  padding: 14px 16px;
  border: 1px solid rgba(180, 214, 255, 0.62);
  border-radius: 20px;
  background: rgba(8, 28, 62, 0.58);
  backdrop-filter: blur(10px);
  display: grid;
  gap: 6px;
  animation: annual-finale-flash 2.5s ease-in-out both;
}
.annual-finale-scene__flash-eyebrow {
  color: #ffffff;
  font-size: 12px;
  letter-spacing: 0.1em;
}
.annual-finale-scene__flash-song {
  color: #ffffff;
  font: 700 clamp(1.05rem, 4vw, 1.5rem) / 1.1 var(--viewer-display-font);
  overflow-wrap: anywhere;
}
.annual-finale-scene__flash-sub {
  color: rgba(235, 245, 255, 0.9);
  font-size: 12px;
}
.annual-finale-scene__flash-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
  margin-top: 2px;
}
.annual-finale-scene__flash-tags b {
  padding: 3px 10px;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.24);
  border: 1px solid rgba(220, 238, 255, 0.62);
  color: #ffffff;
  font-size: 12px;
  font-weight: 650;
}

.annual-finale-scene__medal {
  position: relative;
  width: clamp(120px, 32vw, 180px);
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  animation: annual-finale-medal-in 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: 1.15s;
}
.annual-finale-scene__medal :deep(.drum-window) {
  --drum-size: clamp(120px, 32vw, 180px);
}
.annual-finale-scene__medal-ring {
  position: absolute;
  inset: -8px;
  border-radius: 50%;
  border: 1px solid rgba(245, 203, 114, 0.4);
  box-shadow: 0 0 34px rgba(245, 203, 114, 0.28), inset 0 0 22px rgba(245, 203, 114, 0.16);
  animation: annual-finale-ring-glow 3.4s ease-in-out infinite;
}

.annual-finale-scene__eyebrow {
  margin: 0;
  color: rgba(255, 228, 156, 0.82);
  font-size: 12px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  animation: annual-finale-rise 0.6s ease-out both;
  animation-delay: 1.7s;
}
.annual-finale-scene__title {
  margin: 0;
  color: #fff4d5;
  font: 800 clamp(2.1rem, 9vw, 3.6rem) / 1.04 var(--viewer-display-font);
  letter-spacing: 0.01em;
  text-shadow: 0 0 30px rgba(245, 203, 114, 0.35);
  overflow-wrap: anywhere;
}
.annual-finale-scene__char {
  display: inline-block;
  opacity: 1;
  transform: translateY(0);
}
.annual-finale-scene.is-active .annual-finale-scene__char {
  animation: annual-finale-char-in 0.52s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: calc(1.75s + var(--char-index) * 55ms);
}
.annual-finale-scene.is-reduced .annual-finale-scene__char { animation: none; }

.annual-finale-scene__body {
  margin: 0;
  max-width: 30rem;
  color: rgba(255, 239, 199, 0.78);
  font-size: clamp(12px, 3.4vw, 15px);
  line-height: 1.6;
  animation: annual-finale-rise 0.6s ease-out both;
  animation-delay: 2.05s;
}

.annual-finale-scene__stats {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 4px;
}
.annual-finale-scene__stats span {
  min-width: 92px;
  padding: 10px 14px;
  border-radius: 16px;
  border: 1px solid rgba(245, 203, 114, 0.22);
  background: rgba(11, 16, 40, 0.6);
  color: rgba(255, 239, 199, 0.74);
  font-size: 11px;
  letter-spacing: 0.04em;
  animation: annual-finale-rise 0.55s ease-out both;
  animation-delay: calc(2.35s + var(--stat-index) * 110ms);
}
.annual-finale-scene__stats strong {
  display: block;
  color: #fff4d5;
  font: 750 clamp(1.25rem, 5vw, 1.7rem) / 1.1 var(--viewer-display-font);
  font-variant-numeric: tabular-nums;
}

.annual-finale-scene__cta {
  margin-top: 8px;
  padding: 13px 26px;
  border-radius: 99px;
  border: 1px solid rgba(245, 203, 114, 0.6);
  background: linear-gradient(135deg, rgba(245, 203, 114, 0.22), rgba(245, 203, 114, 0.1));
  color: #fff4d5;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.04em;
  cursor: pointer;
  animation: annual-finale-rise 0.55s ease-out both;
  animation-delay: 2.9s;
}
.annual-finale-scene__cta span {
  display: inline-block;
  margin-left: 6px;
  transition: transform 0.2s ease;
}
.annual-finale-scene__cta:focus-visible {
  outline: 3px solid #f5cb72;
  outline-offset: 3px;
}

.annual-finale-scene.is-reduced .annual-finale-scene__flash {
  animation: none;
  opacity: 0.2;
  transform: translate(-50%, -8px) scale(0.94);
}
.annual-finale-scene.is-reduced :deep(*) { animation: none !important; }

@keyframes annual-finale-rise {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes annual-finale-char-in {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes annual-finale-medal-in {
  from { opacity: 0; transform: translateY(24px) scale(0.86); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes annual-finale-ring-glow {
  0%, 100% { opacity: 0.55; transform: scale(1); }
  50% { opacity: 0.95; transform: scale(1.05); }
}
@keyframes annual-finale-flash {
  0% { opacity: 0; transform: translate(-50%, 18px) scale(0.96); }
  16% { opacity: 1; transform: translate(-50%, 0) scale(1); }
  66% { opacity: 1; transform: translate(-50%, 0) scale(1); }
  100% { opacity: 0.52; transform: translate(-50%, -12px) scale(0.9); }
}

@media (max-width: 720px) {
  .annual-finale-scene__content { gap: clamp(5px, 1vh, 10px); padding-inline: 14px; }
  .annual-finale-scene__medal { width: clamp(104px, 28vw, 140px); }
  .annual-finale-scene__medal :deep(.drum-window) { --drum-size: clamp(104px, 28vw, 140px); }
  .annual-finale-scene__stats span { min-width: 78px; padding: 8px 10px; }
  .annual-finale-scene__cta { min-height: 46px; padding-block: 10px; }
}

@media (orientation: landscape) and (max-height: 460px) {
  .annual-finale-scene__content {
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px 18px;
    padding: 40px 54px 44px;
  }
  .annual-finale-scene__medal { width: 96px; }
  .annual-finale-scene__medal :deep(.drum-window) { --drum-size: 96px; }
  .annual-finale-scene__title { font-size: clamp(1.5rem, 6vw, 2rem); }
  .annual-finale-scene__flash { top: 34px; width: min(70%, 420px); }
}
</style>
