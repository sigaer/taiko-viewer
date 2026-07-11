<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import OpeningSlide from "./slides/OpeningSlide.vue";
import PeriodSlide from "./slides/PeriodSlide.vue";
import OverviewSlide from "./slides/OverviewSlide.vue";
import FavoriteSongSlide from "./slides/FavoriteSongSlide.vue";
import ObsessionSongSlide from "./slides/ObsessionSongSlide.vue";
import KeywordSlide from "./slides/KeywordSlide.vue";
import BreakthroughSlide from "./slides/BreakthroughSlide.vue";
import FinalTitleSlide from "./slides/FinalTitleSlide.vue";
import PosterSlide from "./slides/PosterSlide.vue";
import FavoriteShiftSlide from "./slides/FavoriteShiftSlide.vue";
import MonthlyFavoritesSlide from "./slides/MonthlyFavoritesSlide.vue";
import WeekdayActivitySlide from "./slides/WeekdayActivitySlide.vue";
import CalendarActivitySlide from "./slides/CalendarActivitySlide.vue";
import TimeOfDaySlide from "./slides/TimeOfDaySlide.vue";
import LateNightSlide from "./slides/LateNightSlide.vue";
import RatingRankSlide from "./slides/RatingRankSlide.vue";
import MilestonesSlide from "./slides/MilestonesSlide.vue";
import StoryProgress from "./StoryProgress.vue";

const props = defineProps<{
  summary: VersionSummaryViewModel;
  started: boolean;
}>();

const emit = defineEmits<{
  "open-drawer": [];
}>();

const { locale } = useI18n();
const containerRef = ref<HTMLElement | null>(null);
const slideRefs = ref<HTMLElement[]>([]);
const activeIndex = ref(0);
const reducedMotion = ref(false);
let motionMedia: MediaQueryList | null = null;
let updateMotionHandler: ((event: MediaQueryListEvent) => void) | null = null;
let scrollFrame = 0;

const slideRegistry: Record<string, { component: typeof OpeningSlide | typeof FavoriteShiftSlide }> = {
  opening: { component: OpeningSlide }, period: { component: PeriodSlide }, overview: { component: OverviewSlide },
  favorite: { component: FavoriteSongSlide }, obsession: { component: ObsessionSongSlide },
  favoriteShift: { component: FavoriteShiftSlide }, monthly: { component: MonthlyFavoritesSlide },
  weekday: { component: WeekdayActivitySlide }, calendar: { component: CalendarActivitySlide },
  timeOfDay: { component: TimeOfDaySlide }, lateNight: { component: LateNightSlide },
  ratingRank: { component: RatingRankSlide }, milestones: { component: MilestonesSlide }, keyword: { component: KeywordSlide },
  breakthrough: { component: BreakthroughSlide }, final: { component: FinalTitleSlide }, poster: { component: PosterSlide }
};
const slides = computed(() => props.summary.story.pageKeys.flatMap((key) => slideRegistry[key] ? [{ key, ...slideRegistry[key] }] : []));

const soundEnabled = ref(false);
let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let ambienceTimer: ReturnType<typeof setInterval> | null = null;
const ensureAudio = () => {
  if (audioContext) return;
  const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return;
  audioContext = new AudioCtor();
  masterGain = audioContext.createGain();
  masterGain.gain.value = 0;
  masterGain.connect(audioContext.destination);
};
const playTone = (frequency: number, duration: number, volume: number, type: OscillatorType = "sine") => {
  if (!audioContext || !masterGain || !soundEnabled.value) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type; oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(volume, audioContext.currentTime + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
  oscillator.connect(gain); gain.connect(masterGain); oscillator.start(); oscillator.stop(audioContext.currentTime + duration + 0.02);
};
const startAmbience = () => {
  if (ambienceTimer) clearInterval(ambienceTimer);
  const notes = [220, 261.63, 293.66, 392]; let index = 0;
  playTone(notes[index], 2.8, 0.025);
  ambienceTimer = setInterval(() => { index = (index + 1) % notes.length; playTone(notes[index], 2.8, 0.025); }, 2400);
};
const toggleSound = async () => {
  ensureAudio(); if (!audioContext || !masterGain) return;
  await audioContext.resume(); soundEnabled.value = !soundEnabled.value;
  localStorage.setItem("version-summary-sound", soundEnabled.value ? "1" : "0");
  masterGain.gain.setTargetAtTime(soundEnabled.value ? 0.32 : 0, audioContext.currentTime, 0.08);
  if (soundEnabled.value) startAmbience(); else if (ambienceTimer) { clearInterval(ambienceTimer); ambienceTimer = null; }
};

const progressItems = computed(() => {
  const labels =
    locale.value === "ja"
      ? {
          opening: "導入",
          period: "期間",
          overview: "総覧",
          favorite: "最愛",
          obsession: "余韻",
          favoriteShift: "新旧", monthly: "月別", weekday: "週間", calendar: "暦", timeOfDay: "時間", lateNight: "深夜", ratingRank: "RT", milestones: "記録",
          keyword: "キーワード",
          breakthrough: "突破",
          final: "称号",
          poster: "ポスター"
        }
      : {
          opening: "开场",
          period: "时间",
          overview: "总览",
          favorite: "最爱",
          obsession: "回响",
          favoriteShift: "新旧", monthly: "月度", weekday: "星期", calendar: "日历", timeOfDay: "时段", lateNight: "深夜", ratingRank: "RT", milestones: "时刻",
          keyword: "关键词",
          breakthrough: "突破",
          final: "称号",
          poster: "海报"
        };

  return props.summary.story.pageKeys.map((key) => ({
    key,
    label: labels[key as keyof typeof labels] || key
  }));
});

const progressAriaLabel = computed(() => (locale.value === "ja" ? "ストーリー進行" : "故事进度"));

const syncActiveIndex = () => {
  if (!containerRef.value) return;
  if (scrollFrame) {
    cancelAnimationFrame(scrollFrame);
  }
  scrollFrame = requestAnimationFrame(() => {
    const container = containerRef.value;
    if (!container) return;
    const index = Math.round(container.scrollTop / Math.max(container.clientHeight, 1));
    activeIndex.value = Math.max(0, Math.min(slides.value.length - 1, index));
  });
};

const goToPage = async (index: number, instant = false) => {
  const target = slideRefs.value[index];
  if (!containerRef.value || !target) return;
  activeIndex.value = index;
  await nextTick();
  containerRef.value.scrollTo({
    top: target.offsetTop,
    behavior: instant || reducedMotion.value ? "auto" : "smooth"
  });
};

const setSlideRef = (index: number, element: Element | null) => {
  if (!element) return;
  slideRefs.value[index] = element as HTMLElement;
};

const handleKeydown = (event: KeyboardEvent) => {
  if (!props.started) return;
  const target = event.target as HTMLElement | null;
  if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
    return;
  }

  if (event.key === "ArrowDown" || event.key === "PageDown" || event.key === " ") {
    event.preventDefault();
    goToPage(Math.min(activeIndex.value + 1, slides.value.length - 1));
  }
  if (event.key === "ArrowUp" || event.key === "PageUp") {
    event.preventDefault();
    goToPage(Math.max(activeIndex.value - 1, 0));
  }
  if (event.key === "Home") {
    event.preventDefault();
    goToPage(0);
  }
  if (event.key === "End") {
    event.preventDefault();
    goToPage(slides.value.length - 1);
  }
};

watch(
  () => props.started,
  async (started) => {
    if (!started) return;
    ensureAudio();
    if (soundEnabled.value && audioContext && masterGain) {
      await audioContext.resume();
      masterGain.gain.setValueAtTime(0.32, audioContext.currentTime);
      startAmbience();
    }
    activeIndex.value = 0;
    await nextTick();
    containerRef.value?.focus();
    goToPage(0, true);
  }
);

watch(
  () => props.summary.summaryId,
  async () => {
    activeIndex.value = 0;
    await nextTick();
    containerRef.value?.scrollTo({ top: 0, behavior: "auto" });
  }
);

watch(activeIndex, (value, oldValue) => {
  if (value !== oldValue && soundEnabled.value) playTone(92, 0.18, 0.16, "triangle");
});

onMounted(() => {
  motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
  reducedMotion.value = motionMedia.matches;
  updateMotionHandler = (event: MediaQueryListEvent) => {
    reducedMotion.value = event.matches;
  };
  motionMedia.addEventListener("change", updateMotionHandler);
  window.addEventListener("keydown", handleKeydown);
  soundEnabled.value = localStorage.getItem("version-summary-sound") === "1";
});

onBeforeUnmount(() => {
  if (scrollFrame) {
    cancelAnimationFrame(scrollFrame);
  }
  if (motionMedia && updateMotionHandler) {
    motionMedia.removeEventListener("change", updateMotionHandler);
  }
  window.removeEventListener("keydown", handleKeydown);
  if (ambienceTimer) clearInterval(ambienceTimer);
  audioContext?.close();
});
</script>

<template>
  <div class="story-player" :class="{ 'is-live': started }">
    <button v-if="started" type="button" class="story-player__drawer-trigger" @click="emit('open-drawer')">
      <span></span>
      <span></span>
      <span></span>
    </button>
    <button v-if="started" type="button" class="story-player__sound-trigger" :aria-pressed="soundEnabled" :aria-label="soundEnabled ? '关闭声音' : '开启声音'" @click="toggleSound">
      {{ soundEnabled ? "♪" : "♩̸" }}
    </button>

    <StoryProgress v-if="started" :items="progressItems" :active-index="activeIndex" :aria-label="progressAriaLabel" @select="goToPage" />

    <div ref="containerRef" class="story-player__viewport" tabindex="0" @scroll="syncActiveIndex">
      <div
        v-for="(slide, index) in slides"
        :key="slide.key"
        :ref="(element: Element | null) => setSlideRef(index, element)"
        class="story-player__slide"
        :data-page-key="slide.key"
      >
        <component
          :is="slide.component"
          :summary="summary"
          :page-index="index"
          :page-total="slides.length"
          :active="activeIndex === index"
          :reduced-motion="reducedMotion"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.story-player {
  position: relative;
  --story-slide-top-padding: 7.4rem;
  --story-slide-bottom-padding: 2.2rem;
}

.story-player.is-live {
  height: 100vh;
  height: 100svh;
  height: 100dvh;
  --story-slide-top-padding: 2.75rem;
  --story-slide-bottom-padding: 2rem;
}

.story-player__viewport {
  position: relative;
  height: 100vh;
  height: 100svh;
  height: 100dvh;
  overflow-y: auto;
  scroll-snap-type: y mandatory;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  touch-action: pan-y;
}

.story-player__viewport::-webkit-scrollbar {
  display: none;
}

.story-player__slide {
  height: 100vh;
  height: 100svh;
  height: 100dvh;
  min-height: 100vh;
  min-height: 100svh;
  min-height: 100dvh;
  scroll-snap-align: start;
  scroll-snap-stop: always;
  overflow: hidden;
}

.story-player__drawer-trigger {
  position: fixed;
  top: 24px;
  right: 22px;
  z-index: 16;
  width: 48px;
  height: 48px;
  border: 0;
  border-radius: 50%;
  display: grid;
  place-items: center;
  gap: 4px;
  background: rgba(9, 17, 40, 0.44);
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(16px);
  box-shadow: 0 18px 48px rgba(4, 10, 28, 0.24);
  cursor: pointer;
}

.story-player__sound-trigger{position:fixed;top:24px;right:82px;z-index:16;width:48px;height:48px;border-radius:50%;border:1px solid #ffffff1a;background:#09112870;color:#fff4df;backdrop-filter:blur(16px);font-size:20px;cursor:pointer}.story-player__sound-trigger:focus-visible,.story-player__drawer-trigger:focus-visible{outline:2px solid #f6c86e;outline-offset:3px}

.story-player__drawer-trigger span {
  display: block;
  width: 18px;
  height: 2px;
  border-radius: 999px;
  background: #fff4df;
}

@media (max-width: 960px) {
  .story-player__drawer-trigger {
    top: auto;
    bottom: calc(86px + env(safe-area-inset-bottom, 0px));
    right: 18px;
  }
  .story-player__sound-trigger{top:auto;bottom:calc(86px + env(safe-area-inset-bottom, 0px));right:76px}
}

@media (max-width: 720px) {
  .story-player.is-live {
    --story-slide-top-padding: 0.45rem;
    --story-slide-bottom-padding: calc(4.2rem + env(safe-area-inset-bottom, 0px));
  }
}

@media (max-width: 720px) and (max-height: 780px) {
  .story-player.is-live {
    --story-slide-top-padding: 0.45rem;
    --story-slide-bottom-padding: calc(4rem + env(safe-area-inset-bottom, 0px));
  }
  .story-player__drawer-trigger { width: 42px; height: 42px; bottom: calc(68px + env(safe-area-inset-bottom, 0px)); }
}
</style>
