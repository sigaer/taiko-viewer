<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import { selectAnnualCoverSongs } from "~/utils/annualCoverFlow";
import AnnualArtworkFallback from "./AnnualArtworkFallback.vue";

const props = defineProps<{
  summary: VersionSummaryViewModel;
  active: boolean;
  reducedMotion: boolean;
}>();

const failedCovers = ref(new Set<string>());
const loadedCovers = ref(new Set<string>());
const candidates = computed(() => selectAnnualCoverSongs(props.summary, 12, "opening"));
const trackSongs = computed(() => candidates.value.length > 1
  ? [...candidates.value, ...candidates.value]
  : candidates.value
);
const flowStyle = computed(() => ({
  "--cover-flow-duration": `${Math.max(candidates.value.length * 3.4, 22)}s`
}));

const markFailed = (key: string) => {
  failedCovers.value = new Set(failedCovers.value).add(key);
};

const markLoaded = (key: string) => {
  loadedCovers.value = new Set(loadedCovers.value).add(key);
};

watch(() => props.summary.summaryId, () => {
  failedCovers.value = new Set();
  loadedCovers.value = new Set();
});
</script>

<template>
  <div
    class="annual-cover-flow"
    :class="{ 'is-running': active && !reducedMotion, 'is-reduced': reducedMotion }"
    :style="flowStyle"
    :aria-label="$t('annualSummary.openingCover.coverFlow')"
  >
    <div v-if="trackSongs.length" class="annual-cover-flow__track">
      <figure
        v-for="(song, index) in trackSongs"
        :key="`${song.flowKey}:${index >= candidates.length ? 'copy' : 'original'}`"
        class="annual-cover-flow__card"
        :aria-hidden="index >= candidates.length ? 'true' : undefined"
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
          :alt="index < candidates.length ? song.name : ''"
          width="400"
          height="400"
          :loading="index < 2 ? 'eager' : 'lazy'"
          :fetchpriority="index === 0 ? 'high' : 'low'"
          decoding="async"
          @load="markLoaded(song.flowKey)"
          @error="markFailed(song.flowKey)"
        />
        <figcaption>{{ song.name }}</figcaption>
      </figure>
    </div>
    <div v-else class="annual-cover-flow__empty">
      <AnnualArtworkFallback kind="cover" :label="$t('annualSummary.common.songWaiting')" />
    </div>
  </div>
</template>

<style scoped>
.annual-cover-flow {
  --cover-size: min(59vw, 246px);
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  isolation: isolate;
}

.annual-cover-flow::before,
.annual-cover-flow::after {
  content: "";
  position: absolute;
  z-index: 3;
  top: 0;
  bottom: 0;
  width: 12%;
  pointer-events: none;
}

.annual-cover-flow::before { left: 0; background: linear-gradient(90deg, #0d396e, transparent); }
.annual-cover-flow::after { right: 0; background: linear-gradient(270deg, #0d396e, transparent); }

.annual-cover-flow__track {
  display: flex;
  width: max-content;
  height: 100%;
  gap: 12px;
  align-items: center;
  padding-right: 12px;
  will-change: transform;
}

.annual-cover-flow.is-running .annual-cover-flow__track {
  animation: annual-cover-flow var(--cover-flow-duration) linear infinite;
}

.annual-cover-flow__card,
.annual-cover-flow__empty {
  position: relative;
  flex: 0 0 var(--cover-size);
  width: var(--cover-size);
  height: var(--cover-size);
  margin: 0;
  overflow: hidden;
  background: #2f81a1;
  box-shadow: 0 16px 30px rgba(3, 25, 53, 0.24);
}

.annual-cover-flow__card img,
.annual-cover-flow__card :deep(.annual-artwork-fallback),
.annual-cover-flow__empty :deep(.annual-artwork-fallback) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.annual-cover-flow__card figcaption {
  position: absolute;
  inset: auto 0 0;
  z-index: 2;
  padding: 1.6rem 0.72rem 0.55rem;
  overflow: hidden;
  color: #fff;
  background: linear-gradient(transparent, rgba(5, 30, 60, 0.88));
  font: 700 12px/1.35 var(--viewer-font-family);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.annual-cover-flow.is-reduced .annual-cover-flow__track {
  transform: translateX(calc((100vw - var(--cover-size)) / 2));
}

@keyframes annual-cover-flow {
  to { transform: translate3d(-50%, 0, 0); }
}

@media (orientation: landscape) and (max-height: 460px) {
  .annual-cover-flow { --cover-size: min(52vh, 218px); }
}

@media (prefers-reduced-motion: reduce) {
  .annual-cover-flow__track { animation: none !important; }
}
</style>
