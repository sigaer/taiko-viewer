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

const slides = [
  { key: "opening", component: OpeningSlide },
  { key: "period", component: PeriodSlide },
  { key: "overview", component: OverviewSlide },
  { key: "favorite", component: FavoriteSongSlide },
  { key: "obsession", component: ObsessionSongSlide },
  { key: "keyword", component: KeywordSlide },
  { key: "breakthrough", component: BreakthroughSlide },
  { key: "final", component: FinalTitleSlide },
  { key: "poster", component: PosterSlide }
] as const;

const progressItems = computed(() => {
  const labels =
    locale.value === "ja"
      ? {
          opening: "導入",
          period: "期間",
          overview: "総覧",
          favorite: "最愛",
          obsession: "余韻",
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
    activeIndex.value = Math.max(0, Math.min(slides.length - 1, index));
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
    goToPage(Math.min(activeIndex.value + 1, slides.length - 1));
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
    goToPage(slides.length - 1);
  }
};

watch(
  () => props.started,
  async (started) => {
    if (!started) return;
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

onMounted(() => {
  motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
  reducedMotion.value = motionMedia.matches;
  updateMotionHandler = (event: MediaQueryListEvent) => {
    reducedMotion.value = event.matches;
  };
  motionMedia.addEventListener("change", updateMotionHandler);
  window.addEventListener("keydown", handleKeydown);
});

onBeforeUnmount(() => {
  if (scrollFrame) {
    cancelAnimationFrame(scrollFrame);
  }
  if (motionMedia && updateMotionHandler) {
    motionMedia.removeEventListener("change", updateMotionHandler);
  }
  window.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <div class="story-player" :class="{ 'is-live': started }">
    <button v-if="started" type="button" class="story-player__drawer-trigger" @click="emit('open-drawer')">
      <span></span>
      <span></span>
      <span></span>
    </button>

    <StoryProgress v-if="started" :items="progressItems" :active-index="activeIndex" :aria-label="progressAriaLabel" @select="goToPage" />

    <div ref="containerRef" class="story-player__viewport" tabindex="0" @scroll="syncActiveIndex">
      <component
        :is="slide.component"
        v-for="(slide, index) in slides"
        :key="slide.key"
        :ref="(element: Element | null) => setSlideRef(index, element)"
        :summary="summary"
        :page-index="index"
        :page-total="slides.length"
        :active="activeIndex === index"
        :reduced-motion="reducedMotion"
      />
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
