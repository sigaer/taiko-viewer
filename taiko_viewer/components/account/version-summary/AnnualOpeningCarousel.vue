<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, type ComponentPublicInstance } from "vue";
import type { VersionSummarySongCard, VersionSummaryViewModel } from "~/types/account-version-summary";
import AnnualArtworkFallback from "./AnnualArtworkFallback.vue";

const props = defineProps<{
  summary: VersionSummaryViewModel;
  active: boolean;
  reducedMotion: boolean;
}>();

const activeIndex = ref(0);
const failedCovers = ref(new Set<string>());
const loadedCovers = ref(new Set<string>());
let timer: number | null = null;

const candidates = computed(() => {
  const songs: Array<VersionSummarySongCard | null | undefined> = [
    props.summary.favoriteSong,
    props.summary.obsessionSong,
    props.summary.favoriteShift?.newFavorite,
    props.summary.favoriteShift?.oldFavorite,
    ...props.summary.monthlyFavorites.map((item) => item.song),
    props.summary.timeOfDay?.favoriteSong,
    props.summary.lateNight?.song,
    props.summary.nearDondaful?.song,
    props.summary.challenge?.song,
    props.summary.pound?.topSong,
    props.summary.highScore?.song,
    ...props.summary.milestones.map((item) => item.song)
  ];
  const seen = new Set<string>();
  return songs.flatMap((song) => {
    if (!song?.songNo) return [];
    const key = `${song.songNo}:${song.level ?? song.difficulty ?? ""}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ ...song, carouselKey: key }];
  }).slice(0, 9);
});

const relativePosition = (index: number) => {
  const total = candidates.value.length;
  if (!total) return 0;
  let value = index - activeIndex.value;
  if (value > total / 2) value -= total;
  if (value < -total / 2) value += total;
  return value;
};

const cardStyle = (index: number) => {
  const position = relativePosition(index);
  const distance = Math.abs(position);
  return {
    "--carousel-x": `${position * 99}%`,
    "--carousel-scale": String(distance === 0 ? 1 : distance === 1 ? 0.84 : 0.72),
    "--carousel-opacity": String(distance <= 1 ? 1 : 0),
    "--carousel-z": String(10 - distance)
  };
};

const stopTimer = () => {
  if (timer !== null) window.clearInterval(timer);
  timer = null;
};

const startTimer = () => {
  stopTimer();
  if (!process.client || !props.active || props.reducedMotion || candidates.value.length < 2) return;
  timer = window.setInterval(() => {
    activeIndex.value = (activeIndex.value + 1) % candidates.value.length;
  }, 3600);
};

const showCard = (index: number) => {
  if (index === activeIndex.value) return;
  activeIndex.value = index;
  startTimer();
};

const markFailed = (key: string) => {
  if (failedCovers.value.has(key)) return;
  failedCovers.value = new Set(failedCovers.value).add(key);
};

const markLoaded = (key: string) => {
  if (loadedCovers.value.has(key)) return;
  loadedCovers.value = new Set(loadedCovers.value).add(key);
};

const registerCoverImage = (
  element: Element | ComponentPublicInstance | null,
  key: string
) => {
  if (!(element instanceof HTMLImageElement) || !element.complete) return;
  queueMicrotask(() => {
    if (element.naturalWidth > 0) markLoaded(key);
    else markFailed(key);
  });
};

watch(() => [props.active, props.reducedMotion, candidates.value.length], startTimer);
watch(() => props.summary.summaryId, () => {
  activeIndex.value = 0;
  failedCovers.value = new Set();
  loadedCovers.value = new Set();
  startTimer();
});

onMounted(startTimer);
onBeforeUnmount(stopTimer);
</script>

<template>
  <div class="annual-cover-carousel" aria-live="polite">
    <template v-if="candidates.length">
      <button
        v-for="(song, index) in candidates"
        v-show="Math.abs(relativePosition(index)) <= 1"
        :key="song.carouselKey"
        type="button"
        class="annual-cover-carousel__card"
        :class="{ 'is-active': index === activeIndex }"
        :style="cardStyle(index)"
        :aria-label="song.name"
        :aria-current="index === activeIndex ? 'true' : undefined"
        @click="showCard(index)"
      >
        <AnnualArtworkFallback
          v-if="!song.coverUrl || failedCovers.has(song.carouselKey) || !loadedCovers.has(song.carouselKey)"
          kind="cover"
          :label="song.name"
        />
        <img
          v-if="song.coverUrl && !failedCovers.has(song.carouselKey)"
          v-show="loadedCovers.has(song.carouselKey)"
          :ref="(element) => registerCoverImage(element, song.carouselKey)"
          :src="song.coverUrl"
          :alt="song.name"
          @load="markLoaded(song.carouselKey)"
          @error="markFailed(song.carouselKey)"
        />
        <span class="annual-cover-carousel__chart">
          <b>{{ song.difficulty || `LEVEL ${song.level ?? "—"}` }}</b>
          <em v-if="song.stars">★{{ song.stars }}</em>
        </span>
        <strong>{{ song.name }}</strong>
      </button>
    </template>
    <div v-else class="annual-cover-carousel__empty">
      <AnnualArtworkFallback kind="cover" :label="$t('annualSummary.common.songWaiting')" />
    </div>
  </div>
</template>

<style scoped>
.annual-cover-carousel {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  isolation: isolate;
}

.annual-cover-carousel__card,
.annual-cover-carousel__empty {
  position: absolute;
  left: 50%;
  top: 0;
  width: min(61.5vw, 255px);
  height: min(61.5vw, 255px);
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  overflow: hidden;
  background: #2f81a1;
  box-shadow: 0 14px 28px rgba(3, 25, 53, 0.2);
}

.annual-cover-carousel__card {
  z-index: var(--carousel-z);
  opacity: var(--carousel-opacity);
  transform: translateX(calc(-50% + var(--carousel-x))) scale(var(--carousel-scale));
  transform-origin: 50% 50%;
  cursor: pointer;
  transition:
    transform 720ms cubic-bezier(0.2, 0.82, 0.2, 1),
    opacity 420ms ease,
    filter 420ms ease;
}

.annual-cover-carousel__card:not(.is-active) {
  filter: saturate(0.72) brightness(0.86);
}

.annual-cover-carousel__card:focus-visible {
  outline: 4px solid #ffffff;
  outline-offset: -5px;
}

.annual-cover-carousel__card img,
.annual-cover-carousel__card :deep(.annual-artwork-fallback),
.annual-cover-carousel__empty :deep(.annual-artwork-fallback) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.annual-cover-carousel__card > strong {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2;
  min-height: 2.2rem;
  padding: 0.55rem 0.72rem;
  overflow: hidden;
  color: #ffffff;
  background: linear-gradient(180deg, transparent, rgba(5, 30, 60, 0.86));
  font: 700 12px/1.35 var(--viewer-font-family);
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.annual-cover-carousel__chart {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 3;
  display: flex;
  gap: 5px;
  align-items: center;
  padding: 6px 8px;
  color: #ffffff;
  background: rgba(9, 53, 102, 0.84);
  font: 700 10px/1 var(--viewer-font-family);
}

.annual-cover-carousel__chart b,
.annual-cover-carousel__chart em {
  color: inherit;
  font: inherit;
  font-style: normal;
}

@media (min-width: 521px) {
  .annual-cover-carousel__card,
  .annual-cover-carousel__empty {
    width: 255px;
    height: 255px;
  }
}

@media (max-height: 650px) {
  .annual-cover-carousel__card,
  .annual-cover-carousel__empty {
    width: min(48vh, 230px);
    height: min(48vh, 230px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .annual-cover-carousel__card {
    transition: none;
  }
}
</style>
