<script setup lang="ts">
import { computed, ref } from "vue";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import { selectAnnualCoverSongs } from "~/utils/annualCoverFlow";

const props = defineProps<{
  summary: VersionSummaryViewModel;
  active: boolean;
  reducedMotion: boolean;
}>();

const failedCovers = ref(new Set<string>());
const songs = computed(() => selectAnnualCoverSongs(props.summary, 14, "period"));
const streamStyle = computed(() => ({
  "--cover-stream-duration": `${Math.max(songs.value.length * 2.6, 28)}s`
}));

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
    <div v-if="songs.length" class="vertical-cover-stream__track">
      <div v-for="copy in 2" :key="copy" class="vertical-cover-stream__group">
        <div v-for="song in songs" :key="`${copy}:${song.flowKey}`" class="vertical-cover-stream__slot">
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
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  mask-image: linear-gradient(transparent, #000 8%, #000 92%, transparent);
}
.vertical-cover-stream__track { width: 100%; will-change: transform; }
.vertical-cover-stream.is-running .vertical-cover-stream__track { animation: vertical-cover-drift var(--cover-stream-duration) linear infinite; }
.vertical-cover-stream__group { display: grid; }
.vertical-cover-stream__slot { position: relative; height: clamp(96px, 14vh, 144px); }
.vertical-cover-stream__slot img {
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(76vw, 360px);
  aspect-ratio: 1;
  object-fit: cover;
  transform: translate(-50%, -50%) perspective(620px) rotateX(62deg);
  box-shadow: 0 30px 34px rgba(23, 54, 93, 0.24);
  filter: saturate(0.92) contrast(0.96);
}
.vertical-cover-stream__slot:empty { display: none; }
.vertical-cover-stream.is-reduced .vertical-cover-stream__group:nth-child(2),
.vertical-cover-stream.is-reduced .vertical-cover-stream__slot:not(:nth-child(5)) { display: none; }

@keyframes vertical-cover-drift { to { transform: translate3d(0, -50%, 0); } }

@media (orientation: landscape) and (max-height: 460px) {
  .vertical-cover-stream__slot { height: clamp(72px, 24vh, 108px); }
  .vertical-cover-stream__slot img { width: min(34vw, 240px); }
}

@media (prefers-reduced-motion: reduce) {
  .vertical-cover-stream__track { animation: none !important; }
}
</style>
