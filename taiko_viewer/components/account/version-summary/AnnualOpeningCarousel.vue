<script setup lang="ts">
import { computed, ref, toRef, watch } from "vue";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import { useAnnualTimeline } from "~/composables/useAnnualTimeline";
import { isAnnualCoverPreloaded, selectAnnualCoverSongs } from "~/utils/annualCoverFlow";
import AnnualArtworkFallback from "./AnnualArtworkFallback.vue";

const props = defineProps<{
  summary: VersionSummaryViewModel;
  active: boolean;
  reducedMotion: boolean;
}>();

const failedCovers = ref(new Set<string>());
const loadedCovers = ref(new Set<string>());
const rootRef = ref<HTMLElement | null>(null);
const candidates = computed(() => selectAnnualCoverSongs(props.summary, 9, "opening"));
const flowSongs = computed(() => {
  const songs = candidates.value;
  if (!songs.length) return [];
  return [...songs, ...songs].map((song, index) => ({ ...song, slotKey: `${song.flowKey}:${index}` }));
});
const staticSongs = computed(() => {
  const songs = candidates.value;
  if (!songs.length) return [];
  return [-2, -1, 0, 1, 2].map((offset) => songs[(offset + songs.length * 4) % songs.length]);
});

const { onAnnualMotionActive } = useAnnualTimeline(
  rootRef,
  toRef(props, "active"),
  toRef(props, "reducedMotion"),
  { reenter: "resume" }
);

const markFailed = (key: string) => { failedCovers.value = new Set(failedCovers.value).add(key); };
const markLoaded = (key: string) => { loadedCovers.value = new Set(loadedCovers.value).add(key); };
const preloadState = () => {
  loadedCovers.value = new Set(
    candidates.value
      .filter((song) => song.coverUrl && isAnnualCoverPreloaded(song.coverUrl))
      .map((song) => song.flowKey)
  );
};

watch(() => props.summary.summaryId, () => {
  failedCovers.value = new Set();
  preloadState();
}, { immediate: true });
watch(candidates, preloadState);

onAnnualMotionActive((scope) => {
  scope.onCleanup(() => undefined);
});
</script>

<template>
  <div
    ref="rootRef"
    class="opening-cover-carousel annual-cover-flow"
    :class="{ 'is-running': active && !reducedMotion, 'is-static': !active || reducedMotion }"
    :aria-label="$t('annualSummary.openingCover.coverFlow')"
  >
    <template v-if="flowSongs.length">
      <div class="opening-cover-carousel__flow" aria-hidden="true">
        <figure
          v-for="(song, index) in flowSongs"
          :key="song.slotKey"
          class="opening-cover-carousel__card opening-cover-carousel__flow-card"
          :style="{ '--cover-delay': `${-index * (28 / Math.max(candidates.length, 1))}s` }"
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
            alt=""
            width="400"
            height="400"
            loading="lazy"
            fetchpriority="low"
            decoding="async"
            @load="markLoaded(song.flowKey)"
            @error="markFailed(song.flowKey)"
          />
          <figcaption>{{ song.name }}</figcaption>
        </figure>
      </div>
      <div class="opening-cover-carousel__static" aria-hidden="true">
        <figure
          v-for="(song, index) in staticSongs"
          :key="`${song.flowKey}:static:${index}`"
          class="opening-cover-carousel__card opening-cover-carousel__static-card"
          :class="`is-slot-${index}`"
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
            loading="eager"
            fetchpriority="high"
            decoding="async"
            @load="markLoaded(song.flowKey)"
            @error="markFailed(song.flowKey)"
          />
          <figcaption>{{ song.name }}</figcaption>
        </figure>
      </div>
    </template>
    <div v-else class="opening-cover-carousel__empty">
      <AnnualArtworkFallback kind="cover" :label="$t('annualSummary.common.songWaiting')" />
    </div>
  </div>
</template>

<style scoped>
.opening-cover-carousel { position: relative; width: 100%; height: 100%; overflow: hidden; isolation: isolate; mask-image: linear-gradient(90deg, transparent 0, #000 9%, #000 91%, transparent 100%); }
.opening-cover-carousel__flow,
.opening-cover-carousel__static { position: absolute; inset: 0; }
.opening-cover-carousel__flow-card,
.opening-cover-carousel__static-card { position: absolute; top: 50%; left: 50%; width: clamp(108px, 32vw, 164px); aspect-ratio: 1; margin: 0; overflow: hidden; border: 2px solid rgba(255, 226, 184, .62); background: #215184; box-shadow: 0 18px 32px rgba(3, 17, 43, .48); }
.opening-cover-carousel__card img,
.opening-cover-carousel__card :deep(.annual-artwork-fallback) { display: block; width: 100%; height: 100%; object-fit: cover; }
.opening-cover-carousel__card figcaption { position: absolute; inset: auto 0 0; padding: 1.4rem .45rem .3rem; overflow: hidden; color: #fff; background: linear-gradient(transparent, rgba(4, 18, 47, .88)); font: 700 10px/1.2 var(--viewer-font-family); text-overflow: ellipsis; white-space: nowrap; }
.opening-cover-carousel__flow-card { z-index: 2; border-color: rgba(255, 229, 181, .82); opacity: 0; transform: translate3d(132vw, -50%, 0) scale(.78); animation: opening-cover-pass 28s linear infinite paused; animation-delay: var(--cover-delay); will-change: transform, opacity; }
.opening-cover-carousel.is-running .opening-cover-carousel__flow-card { animation-play-state: running; }
.opening-cover-carousel.is-static .opening-cover-carousel__flow { display: none; }
.opening-cover-carousel__static-card { transition: none; }
.opening-cover-carousel__static-card.is-slot-0 { transform: translate(-166%, -48%) rotate(-5deg) scale(.82); opacity: .52; filter: saturate(.74) brightness(.72); }
.opening-cover-carousel__static-card.is-slot-1 { transform: translate(-116%, -50%) rotate(-3deg) scale(.91); opacity: .78; filter: saturate(.86) brightness(.86); }
.opening-cover-carousel__static-card.is-slot-2 { z-index: 3; width: clamp(156px, 51vw, 238px); transform: translate(-50%, -50%) scale(1); opacity: 1; border-color: rgba(255, 229, 181, .9); box-shadow: 0 24px 44px rgba(1, 12, 32, .64), 0 0 0 5px rgba(247, 194, 111, .12); }
.opening-cover-carousel__static-card.is-slot-3 { transform: translate(16%, -50%) rotate(3deg) scale(.91); opacity: .78; filter: saturate(.86) brightness(.86); }
.opening-cover-carousel__static-card.is-slot-4 { transform: translate(66%, -48%) rotate(5deg) scale(.82); opacity: .52; filter: saturate(.74) brightness(.72); }
.opening-cover-carousel.is-running .opening-cover-carousel__static { display: none; }
.opening-cover-carousel__empty { position: absolute; top: 50%; left: 50%; width: clamp(156px, 51vw, 238px); aspect-ratio: 1; transform: translate(-50%, -50%); }
@keyframes opening-cover-pass {
  0% { opacity: 0; transform: translate3d(132vw, -50%, 0) scale(.78) rotate(5deg); }
  8% { opacity: .5; }
  34% { opacity: .82; transform: translate3d(52vw, -50%, 0) scale(.9) rotate(3deg); }
  50% { z-index: 4; opacity: 1; transform: translate3d(-50%, -50%, 0) scale(1.14) rotate(0deg); border-color: rgba(255, 229, 181, .95); box-shadow: 0 24px 44px rgba(1, 12, 32, .64), 0 0 0 5px rgba(247, 194, 111, .12); }
  66% { opacity: .82; transform: translate3d(-152vw, -50%, 0) scale(.9) rotate(-3deg); }
  92% { opacity: .5; }
  100% { opacity: 0; transform: translate3d(-232vw, -50%, 0) scale(.78) rotate(-5deg); }
}
@media (orientation: landscape) and (max-height: 460px) { .opening-cover-carousel__flow-card, .opening-cover-carousel__static-card { width: min(22vh, 150px); } .opening-cover-carousel__static-card.is-slot-2 { width: min(32vh, 205px); } }
@media (prefers-reduced-motion: reduce) { .opening-cover-carousel__flow-card { animation: none; } }
</style>
