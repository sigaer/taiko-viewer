<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import { isAnnualCoverPreloaded, selectAnnualCoverSongs } from "~/utils/annualCoverFlow";
import AnnualArtworkFallback from "./AnnualArtworkFallback.vue";

const props = defineProps<{
  summary: VersionSummaryViewModel;
  active: boolean;
  reducedMotion: boolean;
}>();

const failedCovers = ref(new Set<string>());
const loadedCovers = ref(new Set<string>());
const candidates = computed(() => selectAnnualCoverSongs(props.summary, 9, "opening"));
const visibleSongs = computed(() => {
  const songs = candidates.value;
  if (!songs.length) return [];
  return [-2, -1, 0, 1, 2].map((offset) => songs[(offset + songs.length * 4) % songs.length]);
});

const markFailed = (key: string) => {
  failedCovers.value = new Set(failedCovers.value).add(key);
};

const markLoaded = (key: string) => {
  loadedCovers.value = new Set(loadedCovers.value).add(key);
};

watch(() => props.summary.summaryId, () => {
  failedCovers.value = new Set();
  loadedCovers.value = new Set(
    candidates.value
      .filter((song) => song.coverUrl && isAnnualCoverPreloaded(song.coverUrl))
      .map((song) => song.flowKey)
  );
}, { immediate: true });
</script>

<template>
  <div
    class="opening-cover-carousel annual-cover-flow"
    :class="{ 'is-running': active && !reducedMotion, 'is-reduced': reducedMotion }"
    :aria-label="$t('annualSummary.openingCover.coverFlow')"
  >
    <div v-if="visibleSongs.length" class="opening-cover-carousel__stage">
      <figure
        v-for="(song, index) in visibleSongs"
        :key="`${song.flowKey}:${index}`"
        class="opening-cover-carousel__card annual-cover-flow__card"
        :class="`is-slot-${index}`"
        :aria-hidden="index === 0 || index === 1 || index === 3 || index === 4 ? 'true' : undefined"
      >
        <AnnualArtworkFallback
          v-if="!song.coverUrl || failedCovers.has(song.flowKey) || !loadedCovers.has(song.flowKey)"
          kind="cover"
          :label="song.name"
        />
        <img
          v-if="song.coverUrl && !failedCovers.has(song.flowKey)"
          v-show="loadedCovers.has(song.flowKey)"
          :src="song.coverUrl"
          :alt="index === 2 ? song.name : ''"
          width="400"
          height="400"
          :loading="index === 2 ? 'eager' : 'lazy'"
          :fetchpriority="index === 2 ? 'high' : 'low'"
          decoding="async"
          @load="markLoaded(song.flowKey)"
          @error="markFailed(song.flowKey)"
        />
        <figcaption>{{ song.name }}</figcaption>
      </figure>
    </div>
    <div v-else class="opening-cover-carousel__empty">
      <AnnualArtworkFallback kind="cover" :label="$t('annualSummary.common.songWaiting')" />
    </div>
  </div>
</template>

<style scoped>
.opening-cover-carousel {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  isolation: isolate;
  mask-image: linear-gradient(90deg, transparent 0, #000 9%, #000 91%, transparent 100%);
}

.opening-cover-carousel__stage { position: absolute; inset: 0; perspective: 760px; transform-style: preserve-3d; }
.opening-cover-carousel__card {
  position: absolute;
  top: 50%;
  left: 50%;
  width: clamp(96px, 36vw, 174px);
  aspect-ratio: 1;
  margin: 0;
  overflow: hidden;
  border: 2px solid rgba(255, 226, 184, .62);
  background: #215184;
  box-shadow: 0 18px 32px rgba(3, 17, 43, .48);
  transform-origin: center;
  transition: transform 700ms cubic-bezier(.2, .8, .2, 1), opacity 700ms ease, filter 700ms ease;
}
.opening-cover-carousel__card img,
.opening-cover-carousel__card :deep(.annual-artwork-fallback) { display: block; width: 100%; height: 100%; object-fit: cover; }
.opening-cover-carousel__card figcaption { position: absolute; inset: auto 0 0; padding: 1.4rem .45rem .3rem; overflow: hidden; color: #fff; background: linear-gradient(transparent, rgba(4, 18, 47, .88)); font: 700 10px/1.2 var(--viewer-font-family); text-overflow: ellipsis; white-space: nowrap; }
.opening-cover-carousel__card.is-slot-0 { transform: translate(-166%, -48%) rotate(-5deg) scale(.82); opacity: .52; filter: saturate(.74) brightness(.72); }
.opening-cover-carousel__card.is-slot-1 { transform: translate(-116%, -50%) rotate(-3deg) scale(.91); opacity: .78; filter: saturate(.86) brightness(.86); }
.opening-cover-carousel__card.is-slot-2 { z-index: 3; width: clamp(156px, 51vw, 238px); transform: translate(-50%, -50%) scale(1); opacity: 1; border-color: rgba(255, 229, 181, .9); box-shadow: 0 24px 44px rgba(1, 12, 32, .64), 0 0 0 5px rgba(247, 194, 111, .12); }
.opening-cover-carousel__card.is-slot-3 { transform: translate(16%, -50%) rotate(3deg) scale(.91); opacity: .78; filter: saturate(.86) brightness(.86); }
.opening-cover-carousel__card.is-slot-4 { transform: translate(66%, -48%) rotate(5deg) scale(.82); opacity: .52; filter: saturate(.74) brightness(.72); }
.opening-cover-carousel.is-running .opening-cover-carousel__card.is-slot-2 { animation: opening-cover-breathe 3.4s ease-in-out infinite; }
.opening-cover-carousel.is-running .opening-cover-carousel__stage { animation: opening-cover-drift 18s linear infinite; }
.opening-cover-carousel.is-reduced .opening-cover-carousel__card { transition: none; }
.opening-cover-carousel__empty { position: absolute; top: 50%; left: 50%; width: clamp(156px, 51vw, 238px); aspect-ratio: 1; transform: translate(-50%, -50%); }
@keyframes opening-cover-breathe { 0%, 100% { transform: translate(-50%, -50%) scale(1); } 50% { transform: translate(-50%, -52%) scale(1.025); } }
@keyframes opening-cover-drift { 0%, 100% { transform: translate3d(0, 0, 0); } 50% { transform: translate3d(-1.8%, 0, 0); } }
@media (orientation: landscape) and (max-height: 460px) { .opening-cover-carousel__card { width: min(22vh, 150px); } .opening-cover-carousel__card.is-slot-2 { width: min(32vh, 205px); } }
@media (prefers-reduced-motion: reduce) { .opening-cover-carousel__card { transition: none; } .opening-cover-carousel.is-running .opening-cover-carousel__card.is-slot-2, .opening-cover-carousel.is-running .opening-cover-carousel__stage { animation: none; } }
</style>
