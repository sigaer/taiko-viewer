<script setup lang="ts">
import { computed, ref } from "vue";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import { selectAnnualCoverSongs } from "~/utils/annualCoverFlow";

const MAX_TRACK_COVERS = 12;
const ZONE_SLOT_COUNT = 6;
const SLOT_INTERVAL_SECONDS = 6;

type CoverFlowItem = ReturnType<typeof selectAnnualCoverSongs>[number] & {
  slotKey: string;
  fallback?: boolean;
};

const props = defineProps<{
  summary: VersionSummaryViewModel;
  active: boolean;
  reducedMotion: boolean;
  variant?: "period" | "overview";
}>();

const failedCovers = ref(new Set<string>());
const zones = ["upper", "lower"] as const;
const variant = computed(() => props.variant || "period");
const songs = computed(() => selectAnnualCoverSongs(props.summary, MAX_TRACK_COVERS, variant.value));

const expandZone = (
  source: ReturnType<typeof selectAnnualCoverSongs>,
  zone: "upper" | "lower"
): CoverFlowItem[] => {
  const fallback = {
    songNo: 0,
    name: "",
    coverUrl: null,
    flowKey: `fallback:${variant.value}:${zone}`,
    fallback: true
  } as unknown as CoverFlowItem;
  const pool = source.length ? source : [fallback];
  return Array.from({ length: ZONE_SLOT_COUNT }, (_, index) => ({
    ...pool[index % pool.length],
    slotKey: `${variant.value}:${zone}:${index}:${pool[index % pool.length].flowKey}`
  }));
};

const zoneItems = computed(() => {
  const upper = songs.value.filter((_, index) => index % 2 === 0);
  const lower = songs.value.filter((_, index) => index % 2 === 1);
  return {
    upper: expandZone(upper, "upper"),
    lower: expandZone(lower, "lower")
  };
});

const streamStyle = {
  "--cover-stream-duration": `${ZONE_SLOT_COUNT * SLOT_INTERVAL_SECONDS}s`
};
const itemStyle = (index: number) => ({ "--cover-delay": `${-index * SLOT_INTERVAL_SECONDS}s` });

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
      v-for="zone in zones"
      :key="zone"
      class="vertical-cover-stream__zone"
      :class="`is-${zone}`"
    >
      <div class="vertical-cover-stream__track">
        <div
          v-for="(song, index) in zoneItems[zone]"
          :key="song.slotKey"
          class="vertical-cover-stream__slot"
          :style="itemStyle(index)"
          :data-flow-key="song.fallback ? '' : song.flowKey"
        >
          <img
            v-if="song.coverUrl && !song.fallback && !failedCovers.has(song.slotKey)"
            :src="song.coverUrl"
            alt=""
            width="400"
            height="400"
            loading="eager"
            fetchpriority="low"
            decoding="async"
            @error="failCover(song.slotKey)"
          />
          <span v-else class="vertical-cover-stream__fallback"><i></i></span>
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
  width: min(78vw, 330px);
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
.vertical-cover-stream__fallback {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  overflow: hidden;
  border: 1px solid rgba(57, 120, 200, .22);
  background:
    linear-gradient(135deg, rgba(247, 251, 255, .96), rgba(185, 219, 251, .92)),
    #e5f1ff;
  box-shadow: 0 30px 34px rgba(23, 54, 93, .18);
}
.vertical-cover-stream__fallback i {
  width: 32%;
  aspect-ratio: 1;
  border: clamp(5px, 2vw, 10px) solid #3978c8;
  border-radius: 50%;
  background: #f7fbff;
  box-shadow: inset 0 0 0 clamp(3px, 1vw, 6px) rgba(238, 112, 98, .72);
}
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
  0% {
    opacity: .94;
    transform: translate3d(-50%, calc(var(--cover-zone-height) - 46%), 0) rotateX(72deg) scale(.74);
  }
  40% { opacity: .46; }
  49.95% {
    opacity: .12;
    transform: translate3d(-50%, -54%, -110px) rotateX(78deg) scale(.52);
  }
  50%, 100% {
    opacity: 0;
    transform: translate3d(-50%, -54%, -110px) rotateX(78deg) scale(.52);
  }
}

@keyframes cover-rise-from-horizon {
  0% {
    opacity: .3;
    transform: translate3d(-50%, calc(var(--cover-zone-height) - 46%), -110px) rotateX(-78deg) scale(.52);
  }
  8% { opacity: .48; }
  49.95% {
    opacity: .94;
    transform: translate3d(-50%, -54%, 0) rotateX(-72deg) scale(.74);
  }
  50%, 100% {
    opacity: 0;
    transform: translate3d(-50%, -54%, 0) rotateX(-72deg) scale(.74);
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
