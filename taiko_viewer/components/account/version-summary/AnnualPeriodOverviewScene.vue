<script setup lang="ts">
import { gsap } from "gsap";
import { createAnnualTimeline } from "~/utils/annualGsap";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import { PERIOD_OVERVIEW_DURATION_MS } from "~/utils/annualTransition";
import AnimatedNumber from "./AnimatedNumber.vue";
import AnnualCoverBackground from "./AnnualCoverBackground.vue";
import type { AnnualCoverState } from "~/utils/annualCoverMotion";
import { requireAnnualTargets } from "~/utils/annualGsap";
import ParticleLayer from "./ParticleLayer.vue";
import { isUsableMetric } from "~/utils/annualPresentation";

const props = defineProps<{
  summary: VersionSummaryViewModel;
  motionState: AnnualCoverState;
  countSettled?: boolean;
  periodPageIndex: number;
  pageTotal: number;
  active: boolean;
  reducedMotion: boolean;
  /** Keeps the ambient cover flow running independently of the page transition. */
  flowing?: boolean;
  transitionTime: number;
  reverseTransition?: boolean;
}>();

const { formatDate } = useViewerDateTime();
const { locale, n, t } = useI18n();
const rootRef = ref<HTMLElement | null>(null);
const mascotUrl = "/dance.gif";
let context: gsap.Context | null = null;
let timeline: gsap.core.Timeline | null = null;
let generation = 0;
let disposed = false;

const safeTime = computed(() => Math.max(0, Math.min(PERIOD_OVERVIEW_DURATION_MS, props.transitionTime)));

const overviewProgress = computed(() => (props.reverseTransition || props.countSettled)
  ? 1
  : Math.max(0, Math.min(1, (safeTime.value - 520) / (PERIOD_OVERVIEW_DURATION_MS - 520))));
const stateClass = computed(() => safeTime.value <= 0
  ? "is-period-state"
  : safeTime.value >= PERIOD_OVERVIEW_DURATION_MS
    ? "is-overview-state"
    : "is-transition-state");
const anchorDate = computed(() => props.summary.period.firstObservedDate || props.summary.version.startDate);
const latestDate = computed(() => props.summary.snapshotAsOf || props.summary.period.lastRecordAt || props.summary.version.effectiveEndDate);
const monthCount = computed(() => Math.max(0, Math.round(props.summary.period.totalDays / 30.4375)));
const centerText = computed(() => locale.value === "ja"
  ? {
      first: "このバージョンで最初に記録された日",
      elapsedPrefix: "あれから",
      elapsedUnit: "日",
      monthPrefix: "もうすぐ",
      monthUnit: "か月",
      latest: "ここまで記録された日",
    }
  : {
      first: "这个版本里首次留下记录",
      elapsedPrefix: "转眼过去",
      elapsedUnit: "天",
      monthPrefix: "已经快",
      monthUnit: "个月",
      latest: "故事写到这里",
    }
);

const setTimelineTime = () => {
  props.motionState.transitionTime = safeTime.value;
  timeline?.pause(safeTime.value / 1000, false);
};

const buildTimeline = async () => {
  const token = ++generation;
  await nextTick();
  const root = rootRef.value;
  if (disposed || token !== generation || !root?.isConnected) return;
  context?.revert();
  if (!requireAnnualTargets(root, ['.period-overview-scene__period-copy', '.period-overview-scene__overview-copy'])) return;
  context = gsap.context(() => {
    const previousCopy = rootRef.value!.querySelector(".period-overview-scene__period-copy");
    const nextCopy = rootRef.value!.querySelector(".period-overview-scene__overview-copy");
    const previousPage = rootRef.value!.querySelector(".period-overview-scene__page--period");
    const nextPage = rootRef.value!.querySelector(".period-overview-scene__page--overview");
    const previousIntro = rootRef.value!.querySelector(".period-overview-scene__period-intro");
    const previousStory = rootRef.value!.querySelector(".period-overview-scene__period-story");
    const previousFacts = rootRef.value!.querySelector(".period-overview-scene__period-facts");
    const previousLatest = rootRef.value!.querySelector(".period-overview-scene__period-latest");
    const nextHeading = rootRef.value!.querySelector(".period-overview-scene__overview-heading");
    const nextAnchor = rootRef.value!.querySelector(".period-overview-scene__overview-anchor");
    const nextDuration = rootRef.value!.querySelector(".period-overview-scene__overview-duration");

    timeline = createAnnualTimeline({ paused: true });
    if (props.reducedMotion) {
      timeline
        .set([nextCopy, nextPage], { autoAlpha: 0 }, 0)
        .fromTo([previousCopy, previousPage], { autoAlpha: 1 }, { autoAlpha: 0, duration: 1.6, ease: "none" }, 0)
        .to([nextCopy, nextPage], { autoAlpha: 1, duration: 1.6, ease: "none" }, 0);
      return;
    }

    timeline
      .set([nextCopy, nextPage], { autoAlpha: 0 }, 0)
      .to(previousIntro, { y: -12, autoAlpha: 0, duration: .3, ease: "power2.in" }, 0)
      .to(previousStory, { y: -9, autoAlpha: 0, duration: .32, ease: "power1.in" }, .04)
      .to(previousFacts, { y: -7, autoAlpha: 0, duration: .24, ease: "power1.in" }, .12)
      .to(previousLatest, { autoAlpha: 0, duration: .2, ease: "power1.in" }, .16)
      .to(previousPage, { autoAlpha: 0, duration: .24, ease: "power1.in" }, .08)
      .to(nextPage, { autoAlpha: 1, duration: .3, ease: "power2.out" }, .48)
      .to(nextCopy, { autoAlpha: 1, duration: .16, ease: "power1.out" }, .52)
      .fromTo(nextHeading, { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .4, ease: "power2.out" }, .52)
      .fromTo(nextAnchor, { scale: .92, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: .36, ease: "power2.out" }, .58)
      .fromTo(nextDuration, { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .4, ease: "power2.out" }, .84);
  }, rootRef.value);
  setTimelineTime();
};

watch(() => props.transitionTime, setTimelineTime);
watch(() => props.reducedMotion, () => void buildTimeline());
onMounted(() => void buildTimeline());
onBeforeUnmount(() => {
  disposed = true; generation++;
  timeline?.kill();
  context?.revert();
});
</script>

<template>
  <section
    ref="rootRef"
    class="period-overview-scene"
    :class="[stateClass, { 'is-active': active, 'is-reduced': reducedMotion }]"
    :data-transition-time="safeTime"
    data-visual-style="light-memory-tunnel"
  >
    <div class="period-overview-scene__cover-planes" aria-hidden="true">
      <AnnualCoverBackground :summary="summary" :state="motionState" :active="flowing ?? active" :reduced-motion="reducedMotion" />
    </div>
    <ParticleLayer class="period-overview-scene__particles" :active="active" :reduced-motion="reducedMotion" density="medium" palette="rainbow" />

    <span class="period-overview-scene__page period-overview-scene__page--period">
      {{ String(periodPageIndex + 1).padStart(2, "0") }} / {{ String(pageTotal).padStart(2, "0") }}
    </span>
    <span class="period-overview-scene__page period-overview-scene__page--overview">
      {{ String(periodPageIndex + 2).padStart(2, "0") }} / {{ String(pageTotal).padStart(2, "0") }}
    </span>

    <div class="period-overview-scene__period-copy">
      <div class="period-overview-scene__period-intro">
        <time :datetime="anchorDate">{{ formatDate(anchorDate) }}</time>
        <h2>{{ summary.snapshotAsOf ? (locale === "ja" ? "同期された日" : "本次同步日期") : centerText.first }}</h2>
      </div>
      <div class="period-overview-scene__period-story">
        <p>{{ summary.copy.period.body }}</p>
      </div>
      <div v-if="!summary.snapshotAsOf" class="period-overview-scene__period-facts">
        <img :src="mascotUrl" width="64" height="64" alt="" aria-hidden="true" />
        <span>{{ centerText.elapsedPrefix }} <b>{{ n(summary.period.totalDays) }}</b> {{ centerText.elapsedUnit }}</span>
        <span v-if="monthCount > 0">{{ centerText.monthPrefix }} <b>{{ n(monthCount) }}</b> {{ centerText.monthUnit }}</span>
      </div>
      <small class="period-overview-scene__period-latest">{{ centerText.latest }} · {{ formatDate(latestDate) }}</small>
    </div>

    <div class="period-overview-scene__overview-copy">
      <div class="period-overview-scene__overview-heading">
        <p>{{ summary.copy.overview.eyebrow }}</p>
        <h2>{{ summary.copy.overview.title }}</h2>
        <small>{{ summary.copy.overview.body }}</small>
      </div>
      <div class="period-overview-scene__overview-play-count" data-overview-play-count>
        <strong><AnimatedNumber :value="summary.overview.playCount" :active="true" :reduced-motion="reducedMotion" :progress="overviewProgress" /></strong>
        <span>{{ t("annualSummary.slides.overview.plays") }}</span>
      </div>
      <img class="period-overview-scene__overview-anchor" :src="mascotUrl" width="64" height="64" alt="" aria-hidden="true" />
      <div class="period-overview-scene__overview-duration">
        <span>{{ t("annualSummary.slides.overview.estimated") }}</span>
        <strong v-if="isUsableMetric(summary.overview.estimatedSeconds)">{{ summary.overview.estimatedTimeText }}</strong>
      </div>
    </div>
  </section>
</template>

<style scoped>
.period-overview-scene {
  --memory-white: #f8fcff;
  --memory-blue: #4b96e8;
  --memory-cyan: #6cc7f3;
  --memory-violet: #7d67d6;
  --memory-ink: #245f96;
  position: relative;
  width: 100%;
  height: 100%;
  container-type: size;
  overflow: hidden;
  color: var(--memory-ink);
  background:
    radial-gradient(circle at 50% 49%, rgba(255, 255, 255, .8) 0, rgba(255, 255, 255, .28) 32%, transparent 58%),
    url("/蓝色白色背景图.png") center / cover no-repeat,
    #b9ddff;
  perspective: 900px;
  perspective-origin: 50% 50%;
}

.period-overview-scene::before {
  content: "";
  position: absolute;
  z-index: 0;
  inset: -10%;
  background:
    radial-gradient(circle at 22% 22%, rgba(255, 255, 255, .72) 0 5%, transparent 18%),
    radial-gradient(circle at 79% 73%, rgba(255, 255, 255, .55) 0 4%, transparent 17%),
    radial-gradient(ellipse at 50% 50%, transparent 0 30%, rgba(108, 199, 243, .11) 48%, transparent 70%);
  opacity: .82;
  pointer-events: none;
}

.period-overview-scene::after {
  content: "";
  position: absolute;
  z-index: 1;
  inset: 29% -8%;
  background: radial-gradient(ellipse at 50% 50%, rgba(255, 255, 255, .96) 0 22%, rgba(247, 252, 255, .82) 45%, rgba(234, 247, 255, .28) 66%, transparent 78%);
  filter: blur(5px);
  pointer-events: none;
}

.period-overview-scene__cover-planes {
  position: absolute;
  z-index: 0;
  inset: 0;
  transform-style: preserve-3d;
}


.period-overview-scene__particles {
  z-index: 2;
  opacity: 0;
  transition: opacity .4s ease;
}

.period-overview-scene.is-transition-state .period-overview-scene__particles,
.period-overview-scene.is-overview-state .period-overview-scene__particles { opacity: .18; }

.period-overview-scene__page {
  position: absolute;
  z-index: 4;
  top: max(18px, env(safe-area-inset-top));
  left: 18px;
  padding: 6px 10px;
  border: 1px solid rgba(75, 150, 232, .22);
  border-radius: 99px;
  color: #397dc1;
  background: rgba(255, 255, 255, .54);
  box-shadow: 0 8px 22px rgba(55, 124, 192, .12), inset 0 1px rgba(255, 255, 255, .76);
  font: 800 10px/1 var(--viewer-font-family);
}

.period-overview-scene__period-copy,
.period-overview-scene__overview-copy {
  position: absolute;
  z-index: 3;
  top: 51.5%;
  left: 50%;
  width: min(88%, 610px);
  transform: translate(-50%, -50%);
  text-align: center;
  will-change: opacity;
}

.period-overview-scene__period-copy { top: 52%; }

.period-overview-scene__period-intro time,
.period-overview-scene__period-intro h2,
.period-overview-scene__overview-heading h2,
.period-overview-scene__overview-play-count strong {
  background: linear-gradient(110deg, #287fce 6%, var(--memory-blue) 44%, var(--memory-violet) 88%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.period-overview-scene__period-intro time,
.period-overview-scene__period-intro h2 {
  background-image: linear-gradient(110deg, #755fc8 6%, var(--memory-blue) 52%, #287fce 90%);
}

.period-overview-scene__period-intro time {
  display: block;
  font: 900 clamp(1.75rem, 6.4vw, 3.45rem)/1 var(--viewer-display-font);
  letter-spacing: 0;
  filter: drop-shadow(0 4px 12px rgba(70, 137, 210, .16));
}

.period-overview-scene__period-intro h2,
.period-overview-scene__overview-heading h2 {
  margin: 10px 0 0;
  font: 900 clamp(1.55rem, 5.4vw, 3rem)/1.08 var(--viewer-display-font);
  letter-spacing: 0;
  filter: drop-shadow(0 4px 12px rgba(92, 103, 192, .12));
  text-wrap: balance;
}

.period-overview-scene__period-story > p {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.period-overview-scene__period-facts {
  display: grid;
  justify-items: center;
  gap: 5px;
  margin-top: 14px;
  color: #3f84c5;
  font: 900 clamp(1.18rem, 4.7vw, 2.2rem)/1.14 var(--viewer-display-font);
  letter-spacing: 0;
  text-shadow: 0 2px rgba(255, 255, 255, .9), 0 5px 18px rgba(66, 137, 206, .14);
}

.period-overview-scene__period-facts span { white-space: nowrap; }

.period-overview-scene__period-facts b {
  color: var(--memory-violet);
  font: inherit;
}

.period-overview-scene__period-facts img,
.period-overview-scene__overview-anchor {
  display: block;
  width: clamp(48px, 8.3cqh, 68px);
  height: auto;
  aspect-ratio: 1;
  image-rendering: pixelated;
  filter: drop-shadow(0 8px 10px rgba(57, 120, 200, .18));
}

.period-overview-scene__period-facts img { margin-bottom: 16px; }

.period-overview-scene__period-facts span:last-child { margin-top: 13px; }

.period-overview-scene__period-latest {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.period-overview-scene__overview-copy {
  display: grid;
  justify-items: center;
  isolation: isolate;
}

.period-overview-scene__overview-copy > * { position: relative; z-index: 1; }

.period-overview-scene__overview-heading {
  display: grid;
  justify-items: center;
  gap: 6px;
}

.period-overview-scene__overview-heading > p {
  margin: 0;
  color: #4389cb;
  font: 900 11px/1.2 var(--viewer-font-family);
}

.period-overview-scene__overview-heading h2 {
  margin-top: 0;
  font-size: clamp(1.5rem, 4.8vw, 2.8rem);
}

.period-overview-scene__overview-heading small {
  display: block;
  max-width: 480px;
  color: rgba(41, 97, 146, .68);
  font: 700 clamp(10px, 2.6vw, 13px)/1.45 var(--viewer-font-family);
  text-wrap: balance;
}

.period-overview-scene__overview-play-count {
  width: min(100%, 36rem);
  min-width: 0;
  container-type: inline-size;
  display: grid;
  justify-items: center;
  gap: 4px;
  margin-top: 15px;
  color: rgba(46, 104, 155, .66);
  font: 800 10px/1 var(--viewer-font-family);
}

.period-overview-scene__overview-play-count strong {
  display: block;
  max-width: 100%;
  overflow: visible;
  font: 900 clamp(3.6rem, 24cqw, 7.2rem)/.86 var(--viewer-display-font);
  letter-spacing: 0;
  white-space: nowrap;
  text-overflow: clip;
  filter: drop-shadow(0 10px 19px rgba(67, 127, 198, .16));
}

.period-overview-scene__overview-anchor {
  width: clamp(36px, 6.5cqh, 52px);
  margin-block: 13px 8px;
}

.period-overview-scene__overview-duration {
  display: grid;
  gap: 3px;
  color: rgba(50, 108, 158, .58);
  font: 800 10px/1.2 var(--viewer-font-family);
}

.period-overview-scene__overview-duration strong {
  color: rgba(112, 88, 194, .82);
  font: 900 clamp(1.28rem, 3.8vw, 2.05rem)/1 var(--viewer-display-font);
  text-shadow: 0 2px rgba(255, 255, 255, .82);
}

.period-overview-scene.is-period-state .period-overview-scene__overview-copy,
.period-overview-scene.is-period-state .period-overview-scene__page--overview,
.period-overview-scene.is-overview-state .period-overview-scene__period-copy,
.period-overview-scene.is-overview-state .period-overview-scene__page--period {
  visibility: hidden;
  opacity: 0;
}

.period-overview-scene.is-overview-state .period-overview-scene__overview-copy,
.period-overview-scene.is-overview-state .period-overview-scene__page--overview {
  visibility: visible;
  opacity: 1;
}

@media (max-height: 700px) and (orientation: portrait) {
  .period-overview-scene__period-intro h2 { margin-top: 6px; }
  .period-overview-scene__period-facts { gap: 2px; margin-top: 7px; }
  .period-overview-scene__period-facts img { width: 44px; margin-bottom: 8px; }
  .period-overview-scene__period-facts span:last-child { margin-top: 3px; }
  .period-overview-scene__overview-heading { gap: 4px; }
  .period-overview-scene__overview-play-count { margin-top: 7px; }
  .period-overview-scene__overview-play-count strong { font-size: clamp(3.4rem, 14vw, 5.6rem); }
  .period-overview-scene__overview-anchor { margin-block: 6px 4px; }
}

@media (orientation: landscape) and (max-height: 460px) {
  .period-overview-scene::after {
    inset: -8% 28%;
    background: radial-gradient(ellipse at 50% 50%, rgba(255, 255, 255, .94) 0 28%, rgba(247, 252, 255, .52) 58%, transparent 78%);
  }
  .period-overview-scene__period-copy,
  .period-overview-scene__overview-copy { width: min(38%, 520px); }
  .period-overview-scene__period-intro time { font-size: clamp(1.35rem, 3.5vw, 2rem); }
  .period-overview-scene__period-intro h2,
  .period-overview-scene__overview-heading h2 { margin-top: 4px; font-size: clamp(1.2rem, 3vw, 1.75rem); }
  .period-overview-scene__overview-heading small { display: none; }
  .period-overview-scene__period-facts { gap: 1px; margin-top: 4px; font-size: 1.05rem; }
  .period-overview-scene__period-facts img { width: 36px; }
  .period-overview-scene__overview-play-count { margin-top: 3px; }
  .period-overview-scene__overview-play-count strong { font-size: clamp(2.8rem, 8vw, 4rem); }
  .period-overview-scene__overview-anchor { display: none; }
  .period-overview-scene__overview-duration strong { font-size: 1.35rem; }
}

.period-overview-scene.is-reduced .period-overview-scene__particles { display: none; }

@media (prefers-reduced-motion: reduce) {
  .period-overview-scene * { animation: none !important; }
}
</style>
