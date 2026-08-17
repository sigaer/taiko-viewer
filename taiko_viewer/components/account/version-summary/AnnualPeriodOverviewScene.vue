<script setup lang="ts">
import { gsap } from "gsap";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import { PERIOD_OVERVIEW_DURATION_MS } from "~/utils/annualTransition";
import AnimatedNumber from "./AnimatedNumber.vue";
import AnnualVerticalCoverStream from "./AnnualVerticalCoverStream.vue";
import ParticleLayer from "./ParticleLayer.vue";
import TaikoRipple from "./TaikoRipple.vue";
import { isUsableMetric } from "~/utils/annualPresentation";

const props = defineProps<{
  summary: VersionSummaryViewModel;
  periodPageIndex: number;
  pageTotal: number;
  active: boolean;
  reducedMotion: boolean;
  transitionTime: number;
}>();

const { formatDate } = useViewerDateTime();
const { locale, n, t } = useI18n();
const rootRef = ref<HTMLElement | null>(null);
const donIconUrl = "/api/content/assets/don";
let context: gsap.Context | null = null;
let timeline: gsap.core.Timeline | null = null;

const safeTime = computed(() => Math.max(0, Math.min(PERIOD_OVERVIEW_DURATION_MS, props.transitionTime)));
const overviewProgress = computed(() => Math.max(0, Math.min(1, (safeTime.value - 520) / (PERIOD_OVERVIEW_DURATION_MS - 520))));
const overviewRippleTrigger = computed(() => safeTime.value >= 520 ? 1 : 0);
const overviewCompleteTrigger = ref(0);
const stateClass = computed(() => safeTime.value <= 0
  ? "is-period-state"
  : safeTime.value >= PERIOD_OVERVIEW_DURATION_MS
    ? "is-overview-state"
    : "is-transition-state");
const anchorDate = computed(() => props.summary.period.firstRecordAt || props.summary.version.startDate);
const latestDate = computed(() => props.summary.period.lastRecordAt || props.summary.version.effectiveEndDate);
const centerText = computed(() => locale.value === "ja"
  ? {
      first: props.summary.period.firstRecordAt ? "最初の一打が記録された日" : "この物語が始まった日",
      latest: "ここまで記録された日",
      elapsed: "物語が続いた日",
      active: "記録した日"
    }
  : {
      first: props.summary.period.firstRecordAt ? "第一次留下鼓点" : "这一版故事开始",
      latest: "故事写到这里",
      elapsed: "故事走过的日子",
      active: "记录的日期"
    }
);

const setTimelineTime = () => timeline?.pause(safeTime.value / 1000, false);
const onOverviewComplete = () => {
  if (!props.active || overviewCompleteTrigger.value) return;
  overviewCompleteTrigger.value = 1;
};

const buildTimeline = async () => {
  if (!rootRef.value) return;
  await nextTick();
  context?.revert();
  context = gsap.context(() => {
    const coverPlanes = rootRef.value!.querySelector(".period-overview-scene__cover-planes");
    const upperPlanes = coverPlanes?.querySelectorAll(".vertical-cover-stream__zone.is-upper .vertical-cover-stream__plane");
    const lowerPlanes = coverPlanes?.querySelectorAll(".vertical-cover-stream__zone.is-lower .vertical-cover-stream__plane");
    const previousCopy = rootRef.value!.querySelector(".period-overview-scene__period-copy");
    const nextCopy = rootRef.value!.querySelector(".period-overview-scene__overview-copy");
    const previousPage = rootRef.value!.querySelector(".period-overview-scene__page--period");
    const nextPage = rootRef.value!.querySelector(".period-overview-scene__page--overview");
    const previousIntro = rootRef.value!.querySelector(".period-overview-scene__period-intro");
    const previousStory = rootRef.value!.querySelector(".period-overview-scene__period-story");
    const previousFacts = rootRef.value!.querySelector(".period-overview-scene__period-facts");
    const previousLatest = rootRef.value!.querySelector(".period-overview-scene__period-latest");
    const nextHeading = rootRef.value!.querySelector(".period-overview-scene__overview-heading");
    const nextFacts = rootRef.value!.querySelector(".period-overview-scene__overview-facts");
    const nextAnchor = rootRef.value!.querySelector(".period-overview-scene__overview-anchor");
    const nextDuration = rootRef.value!.querySelector(".period-overview-scene__overview-duration");

    timeline = gsap.timeline({ paused: true });
    if (props.reducedMotion) {
      timeline
        .set([nextCopy, nextPage], { autoAlpha: 0 }, 0)
        .to([previousCopy, previousPage], { autoAlpha: 0, duration: 1.6, ease: "none" }, 0)
        .to([nextCopy, nextPage], { autoAlpha: 1, duration: 1.6, ease: "none" }, 0);
      return;
    }

    timeline
      .set([nextCopy, nextPage], { autoAlpha: 0 }, 0)
      .set([upperPlanes, lowerPlanes], { rotationZ: 0 }, 0)
      .to(previousIntro, { y: -12, autoAlpha: 0, duration: .3, ease: "power2.in" }, 0)
      .to(previousStory, { y: -9, autoAlpha: 0, duration: .32, ease: "power1.in" }, .04)
      .to(previousFacts, { y: -7, autoAlpha: 0, duration: .24, ease: "power1.in" }, .12)
      .to(previousLatest, { autoAlpha: 0, duration: .2, ease: "power1.in" }, .16)
      .to(previousPage, { autoAlpha: 0, duration: .24, ease: "power1.in" }, .08)
      .to(upperPlanes, { rotationZ: 45, duration: .9, ease: "power2.inOut" }, .08)
      .to(lowerPlanes, { rotationZ: 45, duration: .9, ease: "power2.inOut" }, .08)
      .to(nextPage, { autoAlpha: 1, duration: .3, ease: "power2.out" }, .48)
      .to(nextCopy, { autoAlpha: 1, duration: .16, ease: "power1.out" }, .52)
      .fromTo(nextHeading, { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .4, ease: "power2.out" }, .52)
      .fromTo(nextFacts, { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .32, ease: "power2.out" }, .6)
      .fromTo(nextAnchor, { scale: .92, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: .36, ease: "power2.out" }, .58)
      .fromTo(nextDuration, { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .4, ease: "power2.out" }, .84);
  }, rootRef.value);
  setTimelineTime();
};

watch(() => props.transitionTime, setTimelineTime);
watch(() => props.reducedMotion, () => void buildTimeline());
onMounted(() => void buildTimeline());
onBeforeUnmount(() => {
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
  >
    <div class="period-overview-scene__cover-planes" aria-hidden="true">
      <AnnualVerticalCoverStream :summary="summary" :active="active" :reduced-motion="reducedMotion" />
    </div>
    <ParticleLayer class="period-overview-scene__particles" :active="active && overviewProgress > 0" :reduced-motion="reducedMotion" density="medium" palette="rainbow" />
    <TaikoRipple :active="active" :reduced-motion="reducedMotion" :trigger="overviewRippleTrigger" origin-y="50%" />
    <TaikoRipple :active="active" :reduced-motion="reducedMotion" :trigger="overviewCompleteTrigger" mode="ambient" origin-y="50%" />

    <span class="period-overview-scene__page period-overview-scene__page--period">
      {{ String(periodPageIndex + 1).padStart(2, "0") }} / {{ String(pageTotal).padStart(2, "0") }}
    </span>
    <span class="period-overview-scene__page period-overview-scene__page--overview">
      {{ String(periodPageIndex + 2).padStart(2, "0") }} / {{ String(pageTotal).padStart(2, "0") }}
    </span>

    <div class="period-overview-scene__period-copy">
      <div class="period-overview-scene__period-intro">
        <p>{{ centerText.first }}</p>
        <time :datetime="anchorDate">{{ formatDate(anchorDate) }}</time>
      </div>
      <div class="period-overview-scene__period-story">
        <img :src="donIconUrl" alt="" aria-hidden="true" />
        <h2>{{ summary.copy.period.title }}</h2>
        <p>{{ summary.copy.period.body }}</p>
      </div>
      <div class="period-overview-scene__period-facts">
        <span><b>{{ n(summary.period.totalDays) }}</b>{{ centerText.elapsed }}</span>
        <span v-if="summary.timeCoverage?.status !== 'unavailable' && isUsableMetric(summary.period.activeDays)"><b>{{ n(summary.period.activeDays) }}</b>{{ centerText.active }}</span>
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
        <strong><AnimatedNumber :value="summary.overview.playCount" :active="active" :reduced-motion="reducedMotion" :progress="overviewProgress" @complete="onOverviewComplete" /></strong>
        <span>{{ t("annualSummary.slides.overview.plays") }}</span>
      </div>
      <div class="period-overview-scene__overview-facts">
        <span v-if="isUsableMetric(summary.overview.uniqueSongs)"><b><AnimatedNumber :value="summary.overview.uniqueSongs" :active="active" :reduced-motion="reducedMotion" :progress="overviewProgress" /></b>{{ t("annualSummary.slides.overview.songs") }}</span>
        <span v-if="isUsableMetric(summary.overview.uniqueCharts)"><b><AnimatedNumber :value="summary.overview.uniqueCharts" :active="active" :reduced-motion="reducedMotion" :progress="overviewProgress" /></b>{{ t("annualSummary.slides.overview.charts") }}</span>
      </div>
      <img class="period-overview-scene__overview-anchor" :src="donIconUrl" alt="" aria-hidden="true" />
      <div class="period-overview-scene__overview-duration">
        <span>{{ t("annualSummary.slides.overview.estimated") }}</span>
        <strong v-if="isUsableMetric(summary.overview.estimatedSeconds)">{{ summary.overview.estimatedTimeText }}</strong>
      </div>
    </div>
  </section>
</template>

<style scoped>
.period-overview-scene{position:relative;width:100%;height:100vh;height:100svh;height:100dvh;overflow:hidden;color:#17365d;background:linear-gradient(90deg,rgba(210,232,255,.16),rgba(255,255,255,.58) 44% 58%,rgba(198,226,255,.18)),url("/annual-period-background.webp") center/cover no-repeat,#c7e2ff;perspective:900px;perspective-origin:50% 50%}
.period-overview-scene::before{content:"";position:absolute;z-index:0;inset:0;background:linear-gradient(162deg,rgba(255,255,255,.22),transparent 29%,rgba(54,137,225,.08) 50%,rgba(255,255,255,.28) 72%,rgba(54,137,225,.1));opacity:.9}
.period-overview-scene::after{content:"";position:absolute;z-index:1;inset:31% 0;background:linear-gradient(90deg,rgba(244,250,255,.4),rgba(255,255,255,.72) 18% 82%,rgba(244,250,255,.4));box-shadow:0 -28px 46px rgba(247,251,255,.42),0 28px 46px rgba(247,251,255,.42);backdrop-filter:blur(4px)}
.period-overview-scene__cover-planes{position:absolute;z-index:0;inset:0;transform-style:preserve-3d}
.period-overview-scene__particles{z-index:2;opacity:0;transition:opacity .4s ease}
.period-overview-scene.is-transition-state .period-overview-scene__particles,.period-overview-scene.is-overview-state .period-overview-scene__particles{opacity:.54}
.period-overview-scene__page{position:absolute;z-index:4;top:max(18px,env(safe-area-inset-top));left:18px;padding:6px 9px;border:1px solid rgba(57,120,200,.2);border-radius:99px;color:#3978c8;background:rgba(247,251,255,.82);font:700 10px/1 var(--viewer-font-family)}
.period-overview-scene__period-copy,.period-overview-scene__overview-copy{position:absolute;z-index:3;top:50%;left:50%;width:min(88%,610px);transform:translate(-50%,-50%);text-align:center;will-change:opacity}
.period-overview-scene__period-intro>p,.period-overview-scene__overview-heading>p{margin:0;color:#3978c8;font-size:12px;font-weight:800;letter-spacing:0}
.period-overview-scene__period-intro time{display:block;margin-top:6px;color:#486bb3;font:700 clamp(1.7rem,5.8vw,3.3rem)/1 var(--viewer-display-font)}
.period-overview-scene__period-story img,.period-overview-scene__overview-anchor{display:block;width:clamp(46px,9vh,72px);margin:11px auto 7px;filter:drop-shadow(0 8px 10px rgba(57,120,200,.18))}
.period-overview-scene__period-story h2,.period-overview-scene__overview-heading h2{margin:0;color:#17365d;font:700 clamp(1.65rem,5vw,3.25rem)/1.08 var(--viewer-display-font);text-wrap:balance}
.period-overview-scene__period-story>p{max-width:520px;margin:8px auto 0;color:#5c7697;font-size:clamp(11px,1.5vw,14px);line-height:1.55;text-wrap:balance}
.period-overview-scene__period-facts,.period-overview-scene__overview-facts{display:flex;justify-content:center;gap:clamp(22px,8vw,64px);margin-top:12px}
.period-overview-scene__period-facts span,.period-overview-scene__overview-facts span{display:grid;gap:2px;color:#5c7697;font-size:11px}
.period-overview-scene__period-facts b,.period-overview-scene__overview-facts b{color:#3978c8;font:700 clamp(1.35rem,4vw,2.25rem)/1 var(--viewer-display-font)}
.period-overview-scene__period-latest{display:block;margin-top:8px;color:#7991ad;font-size:10px}
.period-overview-scene__overview-copy{display:grid;justify-items:center}
.period-overview-scene__overview-heading{display:grid;justify-items:center;gap:7px}
.period-overview-scene__overview-heading small{display:block;max-width:480px;color:#5c7697;font-size:clamp(11px,1.5vw,14px);line-height:1.5;text-wrap:balance}
.period-overview-scene__overview-play-count{display:grid;justify-items:center;gap:2px;margin-top:10px;color:#5c7697;font-size:11px}
.period-overview-scene__overview-play-count strong{color:#17365d;font:800 clamp(3.6rem,14vw,8.8rem)/.82 var(--viewer-display-font);letter-spacing:-.06em;text-shadow:0 10px 30px rgba(57,120,200,.14)}
.period-overview-scene__overview-facts{margin-top:16px}
.period-overview-scene__overview-anchor{margin-block:16px 10px}
.period-overview-scene__overview-duration{display:grid;gap:4px;color:#5c7697;font-size:11px}
.period-overview-scene__overview-duration strong{color:#17365d;font:700 clamp(1.75rem,5vw,3rem)/1 var(--viewer-display-font)}
.period-overview-scene.is-period-state .period-overview-scene__overview-copy,.period-overview-scene.is-period-state .period-overview-scene__page--overview,.period-overview-scene.is-overview-state .period-overview-scene__period-copy,.period-overview-scene.is-overview-state .period-overview-scene__page--period{visibility:hidden;opacity:0}
.period-overview-scene.is-overview-state .period-overview-scene__overview-copy,.period-overview-scene.is-overview-state .period-overview-scene__page--overview{visibility:visible;opacity:1}
@media(max-height:700px) and (orientation:portrait){.period-overview-scene__period-story img{margin-block:5px 3px}.period-overview-scene__period-story>p{margin-top:4px;line-height:1.35}.period-overview-scene__period-facts{margin-top:7px}.period-overview-scene__overview-heading{gap:4px}.period-overview-scene__overview-play-count{margin-top:5px}.period-overview-scene__overview-play-count strong{font-size:clamp(3rem,12vw,5rem)}.period-overview-scene__overview-facts{margin-top:6px}.period-overview-scene__overview-anchor{margin-block:5px 3px}}
@media(orientation:landscape) and (max-height:460px){.period-overview-scene::after{inset:0 31%;background:linear-gradient(rgba(247,251,255,.68),rgba(247,251,255,.9) 16% 84%,rgba(247,251,255,.68));box-shadow:-18px 0 32px rgba(247,251,255,.58),18px 0 32px rgba(247,251,255,.58)}.period-overview-scene__period-copy,.period-overview-scene__overview-copy{width:min(38%,520px)}.period-overview-scene__period-intro time{font-size:clamp(1.35rem,3.5vw,2rem)}.period-overview-scene__period-story img,.period-overview-scene__overview-anchor{width:38px;margin-block:4px 2px}.period-overview-scene__period-story h2,.period-overview-scene__overview-heading h2{font-size:clamp(1.25rem,3vw,1.8rem)}.period-overview-scene__period-story>p,.period-overview-scene__overview-heading small{display:none}.period-overview-scene__overview-play-count{margin-top:3px}.period-overview-scene__overview-play-count strong{font-size:clamp(2.4rem,8vw,4rem)}.period-overview-scene__period-facts,.period-overview-scene__overview-facts{margin-top:4px}.period-overview-scene__period-facts b,.period-overview-scene__overview-facts b{font-size:1.15rem}.period-overview-scene__overview-anchor{display:none}.period-overview-scene__overview-duration strong{font-size:1.35rem}}
@media(prefers-reduced-motion:reduce){.period-overview-scene *{animation:none!important}}
</style>
