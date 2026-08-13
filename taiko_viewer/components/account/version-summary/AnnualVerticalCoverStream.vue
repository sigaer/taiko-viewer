<script setup lang="ts">
import { computed, ref } from "vue";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import { selectAnnualCoverSongs } from "~/utils/annualCoverFlow";

const MAX_TRACK_COVERS = 14;

const props = defineProps<{
  summary: VersionSummaryViewModel;
  active: boolean;
  reducedMotion: boolean;
}>();

const failedCovers = ref(new Set<string>());
const songs = computed(() => selectAnnualCoverSongs(props.summary, MAX_TRACK_COVERS, "period"));
const streamDuration = computed(() => Math.max(songs.value.length * 3.4, 30));
const streamStyle = computed(() => ({
  "--cover-stream-duration": `${streamDuration.value}s`
}));
const itemStyle = (index: number) => ({
  "--cover-delay": `${-(streamDuration.value * index / Math.max(songs.value.length, 1))}s`
});

const failCover = (key: string) => {
  failedCovers.value = new Set(failedCovers.value).add(key);
};
</script>

<template>
  <div
    class="vertical-cover-stream"
    :class="{ 'is-running': active && !reducedMotion, 'is-reduced': reducedMotion }"
    :style="streamStyle"
    aria-hidden="true"
  >
    <div
      v-for="zone in ['upper', 'lower']"
      :key="zone"
      class="vertical-cover-stream__zone"
      :class="`is-${zone}`"
    >
      <div v-if="songs.length" class="vertical-cover-stream__track">
        <div
          v-for="(song, index) in songs"
          :key="`${zone}:${song.flowKey}`"
          class="vertical-cover-stream__slot"
          :style="itemStyle(index)"
        >
          <img
            v-if="song.coverUrl && !failedCovers.has(song.flowKey)"
            :src="song.coverUrl"
            alt=""
            width="400"
            height="400"
            loading="eager"
            fetchpriority="low"
            decoding="async"
            @error="failCover(song.flowKey)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vertical-cover-stream {
  --cover-zone-height: 31vh;
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}
.vertical-cover-stream__zone {
  position: absolute;
  left: 0;
  right: 0;
  height: 31%;
  overflow: hidden;
  perspective: 720px;
}
.vertical-cover-stream__zone.is-upper {
  top: 0;
  mask-image: linear-gradient(#000 0%, rgba(0, 0, 0, .82) 42%, transparent 100%);
}
.vertical-cover-stream__zone.is-lower {
  bottom: 0;
  mask-image: linear-gradient(transparent 0%, rgba(0, 0, 0, .82) 58%, #000 100%);
}
.vertical-cover-stream__track { position: absolute; inset: 0; }
.vertical-cover-stream__slot {
  position: absolute;
  top: 0;
  left: 50%;
  width: min(76vw, 360px);
  aspect-ratio: 1;
  opacity: 0;
  will-change: transform, opacity;
  animation-delay: var(--cover-delay);
}
.vertical-cover-stream.is-running .is-lower .vertical-cover-stream__slot { animation: cover-dive-to-horizon var(--cover-stream-duration) linear infinite; animation-delay: var(--cover-delay); }
.vertical-cover-stream.is-running .is-upper .vertical-cover-stream__slot { animation: cover-rise-from-horizon var(--cover-stream-duration) linear infinite; animation-delay: var(--cover-delay); }
.vertical-cover-stream__slot img {
  display: block;
  width: 100%;
  height: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  box-shadow: 0 30px 34px rgba(23, 54, 93, 0.24);
  filter: saturate(0.92) contrast(0.96);
}
.vertical-cover-stream__slot:empty { display: none; }
.vertical-cover-stream.is-reduced .vertical-cover-stream__slot { display: none; }
.vertical-cover-stream.is-reduced .is-lower .vertical-cover-stream__slot:first-child {
  display: block;
  opacity: .72;
  transform: translate3d(-50%, calc(var(--cover-zone-height) - 68%), 0) rotateX(18deg) scale(.9);
}
.vertical-cover-stream.is-reduced .is-upper .vertical-cover-stream__slot:nth-child(2) {
  display: block;
  opacity: .72;
  transform: translate3d(-50%, -32%, 0) rotateX(-18deg) scale(.9);
}

@keyframes cover-dive-to-horizon {
  /* One 7.14% travel window hands off directly to the next entry in a 14-cover track. */
  0% {
    opacity: 1;
    transform: translate3d(-50%, calc(var(--cover-zone-height) - 52%), 0) rotateX(0deg) scale(1.04);
  }
  5% { opacity: .58; }
  7.14% {
    opacity: 0;
    transform: translate3d(-50%, -48%, -190px) rotateX(84deg) scale(.54);
  }
  7.15%, 100% {
    opacity: 0;
    transform: translate3d(-50%, -48%, -190px) rotateX(84deg) scale(.54);
  }
}

@keyframes cover-rise-from-horizon {
  0% {
    opacity: 0;
    transform: translate3d(-50%, calc(var(--cover-zone-height) - 52%), -190px) rotateX(-84deg) scale(.54);
  }
  2% { opacity: .38; }
  7.14% {
    opacity: 1;
    transform: translate3d(-50%, -100%, 0) rotateX(0deg) scale(1.04);
  }
  7.15%, 100% {
    opacity: 0;
    transform: translate3d(-50%, -100%, 0) rotateX(0deg) scale(1.04);
  }
}

@media (orientation: landscape) and (max-height: 460px) {
  .vertical-cover-stream { --cover-zone-height: 100vh; }
  .vertical-cover-stream__zone { top: 0; bottom: 0; width: 31%; height: 100%; perspective: 620px; }
  .vertical-cover-stream__zone.is-upper { left: 0; right: auto; mask-image: linear-gradient(90deg, #000, transparent); }
  .vertical-cover-stream__zone.is-lower { left: auto; right: 0; mask-image: linear-gradient(270deg, #000, transparent); }
  .vertical-cover-stream__slot { width: min(34vw, 240px); }
}

@media (prefers-reduced-motion: reduce) {
  .vertical-cover-stream__slot { animation: none !important; }
}
</style>
