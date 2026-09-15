<script setup lang="ts">
import { gsap } from "gsap";
import { computed, nextTick, onBeforeUnmount, onMounted, provide, readonly, ref, toRef, watch, type ComponentPublicInstance } from "vue";
import { onBeforeRouteLeave } from "vue-router";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import { createAnnualBgmSession, type AnnualBgmSession } from "~/utils/annualBgm.client";
import { ANNUAL_COVER_PHASE_KEY, ANNUAL_COVER_STREAM_DURATION_MS } from "~/utils/annualCoverClock";
import {
  PERIOD_OVERVIEW_DURATION_MS,
  clampPeriodOverviewTime
} from "~/utils/annualTransition";
import AnnualPeriodOverviewScene from "./AnnualPeriodOverviewScene.vue";
import StoryProgress from "./StoryProgress.vue";
import { ANNUAL_NAVIGATION_MOTION_KEY, type AnnualNavigationMotion } from "~/utils/annualNavigationMotion";

type AnnualNetworkConnection = {
  saveData?: boolean;
  addEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
  removeEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
};

// Pre-rendered, locally owned PCM one-shot; no runtime oscillator or background loop.
const DRUM_SOUND = "data:audio/wav;base64,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";

const props = withDefaults(defineProps<{ summary: VersionSummaryViewModel; started: boolean; profileFallback?: 'viewer' | 'summary' }>(), { profileFallback: 'viewer' });
const emit = defineEmits<{ "open-drawer": []; start: [] }>();
const { t, locale } = useI18n();
const route = useRoute();
const { pages: slides } = useAnnualPages(toRef(props, "summary"), locale);

const containerRef = ref<HTMLElement | null>(null);
const slideRefs = ref<Array<HTMLElement | null>>([]);
const activeIndex = ref(0);
const reducedMotion = ref(false);
const reducedData = ref(false);
const soundEnabled = ref(true);
const bgmPlaying = ref(false);
const periodOverviewTime = ref(0);
const coverStreamPhase = ref(0);
const transitionOverlayVisible = ref(false);
const transitionRunning = ref(false);
const pairEndpoint = ref(false);
const documentVisible = ref(true);
let motionMedia: MediaQueryList | null = null;
let dataConnection: AnnualNetworkConnection | null = null;
let updateMotionHandler: (() => void) | null = null;
let scrollFrame = 0;
let coverClockFrame = 0;
let coverClockTimestamp = 0;
let bgmSession: AnnualBgmSession | null = null;
let audioDisposed = false;
let routeLeaving = false;
let autoplayRetryBound = false;
let transitionTween: gsap.core.Tween | null = null;
let transitionWatchdog = 0;
let transitionResolve: (() => void) | null = null;
let transitionGeneration = 0;
let transitionTargetTime: number | null = null;
let touchStart: { x: number; y: number } | null = null;
const transitionClock = { value: 0 };
const transitionForward = ref(true);
// Annual number motion is one-shot: once a slide has been left, returning to it
// must render the settled value instead of replaying count-up/count-down.
const navigationMotion: AnnualNavigationMotion = { visited: new Set<number>(), direction: "initial" };
provide(ANNUAL_NAVIGATION_MOTION_KEY, navigationMotion);
provide(ANNUAL_COVER_PHASE_KEY, readonly(coverStreamPhase));

const periodIndex = computed(() => slides.value.findIndex((page) => page.key === "period"));
const overviewIndex = computed(() => slides.value.findIndex((page) => page.key === "overview"));
const debugTransitionTime = computed<number | null>(() => {
  if (!import.meta.dev) return null;
  const raw = Array.isArray(route.query.transitionTime) ? route.query.transitionTime[0] : route.query.transitionTime;
  if (raw === undefined || raw === null || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? clampPeriodOverviewTime(value) : null;
});
const visibleTransitionTime = computed(() => debugTransitionTime.value ?? periodOverviewTime.value);

const progressItems = computed(() => slides.value.map((page) => ({
  key: page.key,
  label: page.labelText,
  chapter: page.chapter,
  chapterLabel: page.chapterLabel
})));

const acquireBgmSession = () => {
  if (!bgmSession) bgmSession = createAnnualBgmSession((playing) => { bgmPlaying.value = playing; });
  return bgmSession;
};

const clearAutoplayRetry = () => {
  if (!autoplayRetryBound) return;
  window.removeEventListener("pointerdown", retryAutoplay, true);
  window.removeEventListener("keydown", retryAutoplay, true);
  autoplayRetryBound = false;
};

const retryAutoplay = () => {
  clearAutoplayRetry();
  void playBgm();
};

const armAutoplayRetry = () => {
  if (autoplayRetryBound || audioDisposed || !soundEnabled.value) return;
  autoplayRetryBound = true;
  window.addEventListener("pointerdown", retryAutoplay, { capture: true, once: true });
  window.addEventListener("keydown", retryAutoplay, { capture: true, once: true });
};

const playBgm = async () => {
  if (!soundEnabled.value || audioDisposed || document.hidden) return;
  const played = await acquireBgmSession().play();
  if (played && !audioDisposed && soundEnabled.value) {
    clearAutoplayRetry();
  } else if (!audioDisposed && soundEnabled.value) {
    bgmPlaying.value = false;
    armAutoplayRetry();
  }
};

const pauseBgm = (reset = false) => {
  bgmSession?.pause(reset);
  bgmPlaying.value = false;
};

const disposeAudio = (releaseDelay = 0) => {
  if (audioDisposed) return;
  audioDisposed = true;
  clearAutoplayRetry();
  const session = bgmSession;
  bgmSession = null;
  bgmPlaying.value = false;
  if (releaseDelay > 0) window.setTimeout(() => session?.release(), releaseDelay);
  else session?.release();
};

const toggleSound = async () => {
  if (!soundEnabled.value) {
    soundEnabled.value = true;
    await playBgm();
  } else {
    soundEnabled.value = false;
    clearAutoplayRetry();
    pauseBgm();
  }
};

const setSlideRef = (index: number, element: Element | ComponentPublicInstance | null) => {
  slideRefs.value[index] = element instanceof HTMLElement ? element : null;
};

const getViewportIndex = () => {
  const container = containerRef.value;
  if (!container) return activeIndex.value;
  return Math.max(0, Math.min(
    slides.value.length - 1,
    Math.round(container.scrollTop / Math.max(container.clientHeight, 1))
  ));
};

const syncPairEndpoint = () => {
  const container = containerRef.value;
  const index = activeIndex.value;
  const target = slideRefs.value[index];
  pairEndpoint.value = Boolean(
    container
    && target
    && (index === periodIndex.value || index === overviewIndex.value)
    && Math.abs(container.scrollTop - target.offsetTop) <= 2
  );
};

const syncActiveIndex = () => {
  if (!containerRef.value || transitionRunning.value) return;
  if (scrollFrame) cancelAnimationFrame(scrollFrame);
  scrollFrame = requestAnimationFrame(() => {
    const container = containerRef.value;
    if (!container) return;
    activeIndex.value = getViewportIndex();
    syncPairEndpoint();
  });
};

const commitPage = async (index: number, behavior: ScrollBehavior = "auto") => {
  activeIndex.value = index;
  await nextTick();
  const target = slideRefs.value[index];
  if (!containerRef.value || !target) return;
  containerRef.value.scrollTo({ top: target.offsetTop, behavior });
  if (behavior === "auto") syncPairEndpoint();
};

const clearTransitionWatchdog = () => {
  if (!transitionWatchdog) return;
  window.clearTimeout(transitionWatchdog);
  transitionWatchdog = 0;
};

const settleTransitionMotion = (writeTarget = true) => {
  clearTransitionWatchdog();
  transitionTween?.kill();
  transitionTween = null;
  if (writeTarget && transitionTargetTime !== null) {
    transitionClock.value = transitionTargetTime;
    periodOverviewTime.value = transitionTargetTime;
  }
  const resolve = transitionResolve;
  transitionResolve = null;
  resolve?.();
};

const cancelPeriodOverviewTransition = () => {
  transitionGeneration += 1;
  settleTransitionMotion(false);
  transitionTargetTime = null;
  transitionRunning.value = false;
  transitionOverlayVisible.value = false;
};

const runPeriodOverviewTransition = async (targetIndex: number) => {
  if (transitionRunning.value || debugTransitionTime.value !== null) return;
  const generation = ++transitionGeneration;
  const forward = targetIndex === overviewIndex.value;
  transitionForward.value = forward;
  const sourceTime = forward ? 0 : PERIOD_OVERVIEW_DURATION_MS;
  const targetTime = forward ? PERIOD_OVERVIEW_DURATION_MS : 0;
  transitionTargetTime = targetTime;

  if (reducedMotion.value || !documentVisible.value) {
    transitionClock.value = targetTime;
    periodOverviewTime.value = targetTime;
    await commitPage(targetIndex);
    transitionTargetTime = null;
    return;
  }

  transitionRunning.value = true;
  pairEndpoint.value = false;
  periodOverviewTime.value = sourceTime;
  transitionClock.value = sourceTime;
  transitionOverlayVisible.value = true;
  await nextTick();

  await new Promise<void>((resolve) => {
    transitionResolve = resolve;
    transitionTween = gsap.to(transitionClock, {
      value: targetTime,
      duration: PERIOD_OVERVIEW_DURATION_MS / 1000,
      ease: "none",
      onUpdate: () => { periodOverviewTime.value = transitionClock.value; },
      onComplete: () => settleTransitionMotion()
    });
    transitionWatchdog = window.setTimeout(
      () => settleTransitionMotion(),
      PERIOD_OVERVIEW_DURATION_MS + 300
    );
  });

  if (generation !== transitionGeneration || routeLeaving) return;
  await commitPage(targetIndex);
  if (generation !== transitionGeneration || routeLeaving) return;
  await nextTick();
  transitionOverlayVisible.value = false;
  transitionRunning.value = false;
  transitionTargetTime = null;
  syncPairEndpoint();
};

const goToPage = async (index: number, instant = false) => {
  const safeIndex = Math.max(0, Math.min(slides.value.length - 1, index));
  if (transitionRunning.value) return;
  const viewportIndex = getViewportIndex();
  if (
    !instant
    && ((viewportIndex === periodIndex.value && safeIndex === overviewIndex.value)
      || (viewportIndex === overviewIndex.value && safeIndex === periodIndex.value))
  ) {
    await runPeriodOverviewTransition(safeIndex);
    return;
  }
  await commitPage(safeIndex, instant || reducedMotion.value ? "auto" : "smooth");
};

const navigateFromPair = (direction: -1 | 1) => {
  const index = activeIndex.value;
  if (index === periodIndex.value && direction === 1) void goToPage(overviewIndex.value);
  else if (index === overviewIndex.value && direction === -1) void goToPage(periodIndex.value);
  else void goToPage(index + direction);
};

const handleWheel = (event: WheelEvent) => {
  if (!pairEndpoint.value || Math.abs(event.deltaY) < 8) return;
  event.preventDefault();
  navigateFromPair(event.deltaY > 0 ? 1 : -1);
};

const handleTouchStart = (event: TouchEvent) => {
  if (!pairEndpoint.value || event.touches.length !== 1) return;
  touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
};

const handleTouchEnd = (event: TouchEvent) => {
  if (!touchStart || !pairEndpoint.value || !event.changedTouches.length) {
    touchStart = null;
    return;
  }
  const deltaX = event.changedTouches[0].clientX - touchStart.x;
  const deltaY = event.changedTouches[0].clientY - touchStart.y;
  touchStart = null;
  if (Math.abs(deltaY) < 42 || Math.abs(deltaY) <= Math.abs(deltaX)) return;
  navigateFromPair(deltaY < 0 ? 1 : -1);
};

const handleTouchCancel = () => { touchStart = null; };

const startStory = async () => {
  soundEnabled.value = true;
  emit("start");
  await nextTick();
  await goToPage(Math.min(1, slides.value.length - 1));
};

// The opening cover offers a direct entry into the closing page. It starts the
// story and jumps to the last slide without replaying the intermediate chapters.
const startStoryAtEnd = async () => {
  soundEnabled.value = true;
  emit("start");
  await nextTick();
  await commitPage(Math.max(0, slides.value.length - 1));
};

const isInteractiveTarget = (target: EventTarget | null) => {
  const element = target instanceof HTMLElement ? target : null;
  return Boolean(element?.closest("button, a, input, textarea, select, [role='button'], [contenteditable='true']"));
};

const handleKeydown = (event: KeyboardEvent) => {
  if (!props.started || isInteractiveTarget(event.target)) return;
  const viewportIndex = getViewportIndex();
  if (["ArrowDown", "PageDown", " "].includes(event.key)) {
    event.preventDefault();
    goToPage(viewportIndex + 1);
  } else if (["ArrowUp", "PageUp"].includes(event.key)) {
    event.preventDefault();
    goToPage(viewportIndex - 1);
  } else if (event.key === "Home") {
    event.preventDefault();
    goToPage(0);
  } else if (event.key === "End") {
    event.preventDefault();
    goToPage(slides.value.length - 1);
  }
};

const preloadNextArtwork = () => {
  if (!process.client || reducedData.value || document.hidden) return;
  const urls = [
    props.summary.favoriteSong?.coverUrl,
    props.summary.obsessionSong?.coverUrl,
    props.summary.nearDondaful?.song.coverUrl,
    props.summary.challenge?.song.coverUrl,
    props.summary.highScore?.song.coverUrl,
    props.summary.profileCard?.myDonUrl
  ].filter((url): url is string => Boolean(url));
  const index = Math.min(activeIndex.value + 1, urls.length - 1);
  if (urls[index]) new Image().src = urls[index];
};

const updateCoverClock = (timestamp: number) => {
  coverClockFrame = 0;
  if (!documentVisible.value || reducedMotion.value || routeLeaving) return;
  // The shared cover phase must keep advancing during the Period <-> Overview
  // transition. The original implementation skipped it whenever the transition
  // was running, which is why the covers froze while the rotation played: the
  // slots' CSS animation is paused and their position comes from this phase.
  if (coverClockTimestamp) {
    coverStreamPhase.value = (coverStreamPhase.value + timestamp - coverClockTimestamp) % ANNUAL_COVER_STREAM_DURATION_MS;
  }
  coverClockTimestamp = timestamp;
  coverClockFrame = requestAnimationFrame(updateCoverClock);
};

const stopCoverClock = () => {
  if (coverClockFrame) cancelAnimationFrame(coverClockFrame);
  coverClockFrame = 0;
  coverClockTimestamp = 0;
};

const startCoverClock = () => {
  if (coverClockFrame || !documentVisible.value || reducedMotion.value || routeLeaving) return;
  coverClockFrame = requestAnimationFrame(updateCoverClock);
};

watch(activeIndex, (value, oldValue) => {
  if (value !== oldValue) {
    navigationMotion.direction = value > oldValue ? "forward" : "backward";
    navigationMotion.visited.add(oldValue);
  }
  preloadNextArtwork();
});

watch(() => props.summary.summaryId, async () => {
  cancelPeriodOverviewTransition();
  navigationMotion.visited.clear();
  navigationMotion.direction = "initial";
  periodOverviewTime.value = 0;
  activeIndex.value = 0;
  slideRefs.value = [];
  await nextTick();
  containerRef.value?.scrollTo({ top: 0, behavior: "auto" });
});

// A page can drop out of the registry when a section becomes unavailable, which
// shrinks the story under a viewport that is already scrolled. Re-anchor on the
// page the player was reading so the visible slide always matches activeIndex.
watch(slides, async (next, previous) => {
  if (next.length === previous?.length) return;
  if (activeIndex.value >= next.length) activeIndex.value = Math.max(0, next.length - 1);
  slideRefs.value.length = next.length;
  await nextTick();
  await commitPage(activeIndex.value);
});

watch(reducedMotion, (isReduced) => {
  if (isReduced) {
    stopCoverClock();
    if (transitionRunning.value) settleTransitionMotion();
  } else {
    startCoverClock();
  }
});

const syncMotionPreference = () => {
  reducedData.value = Boolean(dataConnection?.saveData);
  reducedMotion.value = Boolean(motionMedia?.matches) || reducedData.value;
};

onMounted(async () => {
  motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
  dataConnection = (navigator as Navigator & { connection?: AnnualNetworkConnection }).connection || null;
  updateMotionHandler = syncMotionPreference;
  syncMotionPreference();
  motionMedia.addEventListener("change", updateMotionHandler);
  dataConnection?.addEventListener?.("change", updateMotionHandler);
  window.addEventListener("keydown", handleKeydown);
  window.addEventListener("pagehide", handlePageHide);
  window.addEventListener("pageshow", handlePageShow);
  audioDisposed = false;
  acquireBgmSession();
  soundEnabled.value = true;
  activeIndex.value = 0;
  await nextTick();
  containerRef.value?.focus({ preventScroll: true });
  await goToPage(debugTransitionTime.value === null ? 0 : periodIndex.value, true);
  preloadNextArtwork();
  document.addEventListener("visibilitychange", handleVisibilityChange);
  documentVisible.value = !document.hidden;
  startCoverClock();
  void playBgm();
});

const handleVisibilityChange = () => {
  documentVisible.value = !document.hidden;
  if (!documentVisible.value) {
    if (scrollFrame) cancelAnimationFrame(scrollFrame);
    scrollFrame = 0;
    stopCoverClock();
    if (transitionRunning.value) settleTransitionMotion();
    pauseBgm();
  } else {
    startCoverClock();
    void playBgm();
  }
};

const handlePageHide = () => {
  documentVisible.value = false;
  stopCoverClock();
  if (transitionRunning.value) settleTransitionMotion();
  disposeAudio();
};
const handlePageShow = () => {
  audioDisposed = false;
  documentVisible.value = !document.hidden;
  startCoverClock();
  if (soundEnabled.value) {
    acquireBgmSession();
    void playBgm();
  }
};

onBeforeRouteLeave(() => {
  routeLeaving = true;
  documentVisible.value = false;
  soundEnabled.value = false;
  stopCoverClock();
  cancelPeriodOverviewTransition();
  disposeAudio();
});

onBeforeUnmount(() => {
  if (scrollFrame) cancelAnimationFrame(scrollFrame);
  stopCoverClock();
  cancelPeriodOverviewTransition();
  if (motionMedia && updateMotionHandler) motionMedia.removeEventListener("change", updateMotionHandler);
  if (dataConnection?.removeEventListener && updateMotionHandler) dataConnection.removeEventListener("change", updateMotionHandler);
  window.removeEventListener("keydown", handleKeydown);
  window.removeEventListener("pagehide", handlePageHide);
  window.removeEventListener("pageshow", handlePageShow);
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  const remountingAnnual = !routeLeaving && window.location.pathname.includes("/account/version-summary");
  disposeAudio(remountingAnnual ? 50 : 0);
});
</script>

<template>
  <div
    class="story-player"
    :class="{ 'is-live': started }"
    :data-document-visible="documentVisible"
    :data-reduced-motion="reducedMotion"
    :data-save-data="reducedData"
  >
    <button v-if="started" type="button" class="story-player__drawer-trigger" :aria-label="t('annualSummary.controls.settings')" @click="emit('open-drawer')">
      <span></span><span></span><span></span>
    </button>
    <button
      v-if="started" type="button" class="story-player__sound-trigger" :class="{ 'is-playing': bgmPlaying }" :aria-pressed="soundEnabled"
      :aria-label="soundEnabled ? t('annualSummary.controls.soundOff') : t('annualSummary.controls.soundOn')"
      @click="toggleSound"
    >
      <span aria-hidden="true">{{ soundEnabled ? "♪" : "×" }}</span>
    </button>

    <StoryProgress
      v-if="started"
      :items="progressItems" :active-index="activeIndex"
      :aria-label="t('annualSummary.controls.progress')" @select="goToPage"
    />

    <div
      ref="containerRef"
      class="story-player__viewport"
      :class="{ 'is-pair-endpoint': pairEndpoint }"
      tabindex="0"
      @scroll.passive="syncActiveIndex"
      @wheel="handleWheel"
      @touchstart.passive="handleTouchStart"
      @touchend="handleTouchEnd"
      @touchcancel="handleTouchCancel"
    >
      <div
        v-for="(slide, index) in slides" :key="slide.key"
        :ref="(element) => setSlideRef(index, element)"
        class="story-player__slide" :data-page-key="slide.key"
        :data-chapter="slide.chapter"
        :data-scene-type="slide.sceneType"
        :data-main-focus="slide.mainFocus"
        :data-motion-preset="slide.motionPreset"
        :data-bg-mood="slide.mood"
        :data-intensity="slide.intensity"
        :data-transition-in="slide.transitionIn"
        :data-transition-out="slide.transitionOut"
        :aria-hidden="activeIndex !== index"
        :inert="activeIndex !== index"
      >
        <component
          :is="slide.component"
          v-if="Math.abs(activeIndex - index) <= 1"
          :summary="summary" :page-index="index" :page-total="slides.length"
          :profile-fallback="props.profileFallback"
          :active="documentVisible && activeIndex === index" :reduced-motion="reducedMotion" :save-data="reducedData"
          :flowing="documentVisible && (activeIndex === periodIndex || activeIndex === overviewIndex)"
          @start="startStory"
          @jump-to-end="startStoryAtEnd"
          @next="goToPage(index + 1)"
        />
      </div>
    </div>

    <div
      v-if="transitionOverlayVisible || debugTransitionTime !== null"
      class="story-player__transition-overlay"
      :class="{ 'is-debug': debugTransitionTime !== null }"
    >
      <AnnualPeriodOverviewScene
        :summary="summary"
        :period-page-index="periodIndex"
        :page-total="slides.length"
        :active="documentVisible"
        :flowing="documentVisible && (activeIndex === periodIndex || activeIndex === overviewIndex)"
        :reduced-motion="reducedMotion"
        :transition-time="visibleTransitionTime"
        :reverse-transition="!transitionForward"
      />
    </div>

    <div v-if="started" class="story-player__nav" :aria-label="t('annualSummary.controls.pageNavigation')">
      <button type="button" :disabled="activeIndex === 0" :aria-label="t('annualSummary.controls.previous')" @click="goToPage(activeIndex - 1)">←</button>
      <button type="button" :disabled="activeIndex === slides.length - 1" :aria-label="t('annualSummary.controls.next')" @click="goToPage(activeIndex + 1)">→</button>
    </div>
  </div>
</template>

<style scoped>
.story-player{position:relative;--story-slide-top-padding:4.7rem;--story-slide-bottom-padding:3.8rem;color:#17365d;background:#f7fbff}.story-player,.story-player__viewport,.story-player__slide{height:100vh;height:100svh;height:100dvh}.story-player__viewport{position:relative;overflow-y:auto;overflow-x:hidden;scroll-snap-type:y mandatory;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;scrollbar-width:none;touch-action:pan-y}.story-player__viewport.is-pair-endpoint{touch-action:none}.story-player:not(.is-live) .story-player__viewport{overflow-y:hidden;touch-action:none}.story-player__viewport::-webkit-scrollbar{display:none}.story-player__slide{min-height:100vh;min-height:100svh;min-height:100dvh;scroll-snap-align:start;scroll-snap-stop:always;overflow:hidden;background:#f7fbff}.story-player__transition-overlay{position:absolute;z-index:20;inset:0;overflow:hidden;pointer-events:none}.story-player__drawer-trigger,.story-player__sound-trigger{position:fixed;top:max(16px,env(safe-area-inset-top));z-index:30;width:42px;height:42px;border-radius:50%;display:grid;place-items:center;color:#17365d;background:#f7fbffed;border:1px solid #3978c829;box-shadow:0 10px 30px #17365d1f;cursor:pointer}.story-player__drawer-trigger{right:18px;gap:3px}.story-player__sound-trigger{right:68px;font-weight:700}.story-player__drawer-trigger span{display:block;width:16px;height:2px;border-radius:99px;background:#3978c8}.story-player__drawer-trigger:focus-visible,.story-player__sound-trigger:focus-visible,.story-player__nav button:focus-visible{outline:3px solid #3978c8;outline-offset:3px}.story-player__nav{position:fixed;right:18px;bottom:max(18px,env(safe-area-inset-bottom));z-index:30;display:flex;gap:7px}.story-player__nav button{width:42px;height:42px;border-radius:50%;border:1px solid #3978c829;background:#f7fbffed;color:#17365d;font-size:18px;box-shadow:0 10px 30px #17365d1a;cursor:pointer}.story-player__nav button:disabled{opacity:.3;cursor:default}@media(max-width:720px){.story-player{--story-slide-top-padding:3.3rem;--story-slide-bottom-padding:3.5rem}.story-player__drawer-trigger,.story-player__sound-trigger{top:max(8px,env(safe-area-inset-top));width:36px;height:36px}.story-player__drawer-trigger{right:8px}.story-player__sound-trigger{right:49px}.story-player__nav{right:8px;bottom:max(8px,env(safe-area-inset-bottom));gap:5px}.story-player__nav button{width:36px;height:36px}}@media(orientation:landscape) and (min-width:721px) and (max-height:460px){.story-player{--story-slide-top-padding:3.25rem;--story-slide-bottom-padding:2.65rem}.story-player__drawer-trigger,.story-player__sound-trigger{top:10px;width:34px;height:34px}.story-player__drawer-trigger{right:10px}.story-player__sound-trigger{right:50px}.story-player__nav{right:10px;bottom:8px;gap:5px}.story-player__nav button{width:34px;height:34px}}@media(prefers-reduced-motion:reduce){.story-player__viewport{scroll-behavior:auto}}
.story-player__slide[data-bg-mood="rainbow-stage"]{--annual-scene-bg:linear-gradient(155deg,#0d396e,#326aa5 48%,#97c8e8)}.story-player__slide[data-bg-mood="stage-blue"],.story-player__slide[data-bg-mood="profile-stage"]{--annual-scene-bg:linear-gradient(145deg,#f7fbff,#dcecff)}.story-player__slide[data-bg-mood="bright-impact"]{--annual-scene-bg:linear-gradient(145deg,#f7fbff,#d6eaff 58%,#fff3cf)}.story-player__slide[data-bg-mood="cover-spectrum"]{--annual-scene-bg:linear-gradient(145deg,#f7fbff,#e8e7ff 52%,#dff6ff)}.story-player__slide[data-bg-mood="time-blue"]{--annual-scene-bg:linear-gradient(155deg,#f7fbff,#dbeaff 58%,#e8e4ff)}.story-player__slide[data-bg-mood="midnight"]{--annual-scene-bg:linear-gradient(155deg,#101d47,#223870 56%,#492e70)}.story-player__slide[data-bg-mood="award-purple"]{--annual-scene-bg:linear-gradient(155deg,#f7f4ff,#e7e2ff 52%,#e9f3ff)}.story-player__slide[data-bg-mood="award-stage"]{--annual-scene-bg:radial-gradient(circle at 50% 18%,#60512e 0,#1c2547 35%,#0b1028 78%)}
</style>
