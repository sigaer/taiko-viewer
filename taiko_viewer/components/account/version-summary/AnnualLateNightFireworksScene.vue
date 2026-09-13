<script setup lang="ts">
import { computed, ref, toRef } from "vue";
import AnnualScene from "./AnnualScene.vue";
import { useAnnualTimeline } from "~/composables/useAnnualTimeline";

const props = defineProps<{
  active: boolean;
  reducedMotion: boolean;
  latestLabel: string;
  songName: string;
  activeDaysText: string;
  line: string;
  nightsBefore: string;
  nightsAfter: string;
  playsBefore: string;
  playsAfter: string;
  playCountText: string;
} >();

defineSlots<{ cover(): unknown }>();

const rootRef = ref<InstanceType<typeof AnnualScene> | null>(null);
const saveData = ref(process.client && Boolean(
  (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
));
const motionReduced = computed(() => props.reducedMotion || saveData.value);
const songLengthClass = computed(() => ({
  "has-long-song": props.songName.length > 14,
  "has-very-long-song": props.songName.length > 24
}));

useAnnualTimeline(rootRef, toRef(props, "active"), motionReduced, { reenter: "restart" });
</script>

<template>
  <AnnualScene
    ref="rootRef"
    class="annual-late-night-fireworks"
    :class="songLengthClass"
    :active="active"
    :reduced-motion="motionReduced"
    mood="midnight"
    intensity="high"
    data-visual-style="summer-fireworks-memory"
  >
    <template #background>
      <img
        class="annual-late-night-fireworks__backdrop"
        src="/lateNight/background_14.png"
        alt=""
        aria-hidden="true"
      >
      <div class="annual-late-night-fireworks__readability"></div>
    </template>

    <div class="annual-late-night-fireworks__content">
      <div class="annual-late-night-fireworks__cover-wrap" data-annual-stage="title">
        <div class="annual-late-night-fireworks__cover">
          <slot name="cover" />
        </div>
        <img
          class="annual-late-night-fireworks__cover-frame"
          src="/lateNight/cover_bg_14.png"
          alt=""
          aria-hidden="true"
        >
      </div>

      <div class="annual-late-night-fireworks__copy">
        <p class="annual-late-night-fireworks__time" data-annual-stage="visual">{{ latestLabel }}</p>
        <p class="annual-late-night-fireworks__song" data-annual-stage="visual">《{{ songName }}》</p>
        <p class="annual-late-night-fireworks__with" data-annual-stage="visual">{{ line }}</p>
      </div>

      <div v-if="activeDaysText || playCountText" class="annual-late-night-fireworks__stats">
        <p v-if="activeDaysText" data-annual-stage="data">
          {{ nightsBefore }} <strong>{{ activeDaysText }}</strong> {{ nightsAfter }}
        </p>
        <p v-if="playCountText" data-annual-stage="data">
          {{ playsBefore }} <strong>{{ playCountText }}</strong> {{ playsAfter }}
        </p>
      </div>
    </div>
  </AnnualScene>
</template>

<style scoped>
.annual-late-night-fireworks {
  --late-night-gold: #f3ce6a;
  --late-night-bright: #fffbea;
  width: 100%;
  height: 100vh;
  height: 100svh;
  height: 100dvh;
  overflow: hidden;
  color: var(--late-night-gold);
  background: #102c55;
}

.annual-late-night-fireworks__backdrop,
.annual-late-night-fireworks__readability,
.annual-late-night-fireworks__content {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.annual-late-night-fireworks__backdrop {
  object-fit: cover;
  object-position: center;
  transform: scale(1.012);
  animation: annual-late-night-drift 16s ease-in-out infinite alternate;
  will-change: transform;
}

.annual-late-night-fireworks__readability {
  background:
    linear-gradient(90deg, rgba(6, 25, 58, .16), transparent 84%),
    linear-gradient(180deg, transparent 45%, rgba(8, 32, 63, .08) 73%, rgba(4, 17, 40, .13));
}

.annual-late-night-fireworks__content {
  z-index: 1;
  overflow: hidden;
  padding-bottom: max(16px, env(safe-area-inset-bottom));
  font-family: var(--viewer-display-font), var(--viewer-font-family), sans-serif;
}

.annual-late-night-fireworks__cover-wrap {
  position: absolute;
  top: clamp(210px, 42.45dvh, 396px);
  left: clamp(30px, 9.65vw, 48px);
  width: clamp(112px, 30.5vw, 134px);
  aspect-ratio: 167 / 164;
  filter: drop-shadow(0 8px 15px rgba(4, 24, 55, .28));
}

.annual-late-night-fireworks__cover {
  position: absolute;
  z-index: 1;
  /* cover_bg_14's purple backing occupies x=42..159, y=10..127 in its 167x164 canvas. */
  inset: 6.1% 4.8% 22% 25.1%;
  overflow: hidden;
  border-radius: clamp(7px, 2vw, 9px);
  background: #315b82;
  box-shadow: 0 0 18px rgba(255, 234, 161, .22);
}

.annual-late-night-fireworks__cover :deep(.el-image),
.annual-late-night-fireworks__cover :deep(.annual-artwork-fallback) {
  width: 100%;
  height: 100%;
}

.annual-late-night-fireworks__cover-frame {
  position: absolute;
  z-index: 0;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: fill;
  pointer-events: none;
}

.annual-late-night-fireworks__copy,
.annual-late-night-fireworks__stats {
  position: absolute;
  left: clamp(30px, 9.2vw, 46px);
  right: clamp(24px, 8vw, 42px);
  min-width: 0;
  text-shadow:
    0 2px 8px rgba(9, 22, 51, .72),
    0 0 12px rgba(238, 190, 74, .16);
}

.annual-late-night-fireworks__copy {
  top: 58.55dvh;
  display: grid;
  justify-items: start;
  gap: clamp(1px, .38dvh, 4px);
}

.annual-late-night-fireworks__copy p,
.annual-late-night-fireworks__stats p {
  margin: 0;
  color: var(--late-night-gold);
}

.annual-late-night-fireworks__time {
  font-size: clamp(1.38rem, 6.75vw, 2.18rem);
  font-weight: 850;
  line-height: 1.08;
  letter-spacing: .015em;
}

.annual-late-night-fireworks__song {
  max-width: 100%;
  overflow-wrap: anywhere;
  font-size: clamp(1.28rem, 5.85vw, 1.9rem);
  font-weight: 850;
  line-height: 1.16;
  letter-spacing: .01em;
}

.annual-late-night-fireworks.has-long-song .annual-late-night-fireworks__song {
  font-size: clamp(1.14rem, 5.05vw, 1.64rem);
}

.annual-late-night-fireworks.has-very-long-song .annual-late-night-fireworks__song {
  font-size: clamp(1rem, 4.45vw, 1.42rem);
  line-height: 1.12;
}

.annual-late-night-fireworks__with {
  font-size: clamp(1.5rem, 6.9vw, 2.26rem);
  font-weight: 900;
  line-height: 1.08;
  letter-spacing: .025em;
}

.annual-late-night-fireworks__stats {
  top: 77.55dvh;
  display: grid;
  gap: clamp(2px, .45dvh, 5px);
  font-size: clamp(.98rem, 4.65vw, 1.48rem);
  font-weight: 760;
  line-height: 1.35;
  letter-spacing: .015em;
}

.annual-late-night-fireworks__stats strong {
  color: var(--late-night-bright);
  font-size: 1.22em;
  font-weight: 900;
  text-shadow:
    0 2px 8px rgba(9, 22, 51, .76),
    0 0 12px rgba(255, 255, 255, .48);
}

.annual-late-night-fireworks:not(.is-active) .annual-late-night-fireworks__backdrop {
  animation-play-state: paused;
}

.annual-late-night-fireworks.is-reduced .annual-late-night-fireworks__backdrop {
  animation: none;
  transform: scale(1);
  will-change: auto;
}

@keyframes annual-late-night-drift {
  from { transform: translate3d(-.35%, -.2%, 0) scale(1.026); }
  to { transform: translate3d(.35%, .16%, 0) scale(1.012); }
}

@media (max-height: 650px) {
  .annual-late-night-fireworks__cover-wrap { top: 35dvh; }
  .annual-late-night-fireworks__copy { top: 54dvh; gap: 0; }
  .annual-late-night-fireworks__stats { top: 75dvh; gap: 0; }
  .annual-late-night-fireworks__time { font-size: clamp(1.2rem, 6.2vw, 1.7rem); }
  .annual-late-night-fireworks__song { font-size: clamp(1.08rem, 5.35vw, 1.48rem); }
  .annual-late-night-fireworks__with { font-size: clamp(1.28rem, 6.2vw, 1.72rem); }
  .annual-late-night-fireworks__stats { font-size: clamp(.88rem, 4.25vw, 1.12rem); }
}

@media (orientation: landscape) and (max-height: 460px) {
  .annual-late-night-fireworks__backdrop { object-position: center 58%; }
  .annual-late-night-fireworks__cover-wrap { top: 18%; left: 9%; width: min(24vh, 112px); }
  .annual-late-night-fireworks__copy { top: 21%; left: 36%; right: 12%; }
  .annual-late-night-fireworks__stats { top: 61%; left: 36%; right: 12%; }
}

@media (prefers-reduced-motion: reduce) {
  .annual-late-night-fireworks__backdrop {
    animation: none;
    transform: scale(1);
    will-change: auto;
  }
}
</style>
