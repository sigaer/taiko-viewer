<script setup lang="ts">
import { computed, ref, toRef } from "vue";
import { gsap } from "gsap";
import { createAnnualTimeline, setAnnualTargets, requireAnnualTargets } from "~/utils/annualGsap";
import AnnualObsessionCoverBlock from "./AnnualObsessionCoverBlock.vue";
import AnnualScene from "./AnnualScene.vue";
import { useAnnualTimeline } from "~/composables/useAnnualTimeline";
import { segmentAnnualTitle } from "~/utils/annualPresentation";

const props = defineProps<{
  active: boolean;
  reducedMotion: boolean;
  headlineDaysText: string;
  headlineDaysSuffix: string;
  headlinePlaysBefore: string;
  headlinePlaysAfter: string;
  playCountText: string;
  closing1: string;
  closing2: string;
  sceneLabel: string;
  songName: string;
  coverUrl: string;
}>();

const rootRef = ref<InstanceType<typeof AnnualScene> | null>(null);
const saveData = ref(process.client && Boolean(
  (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
));
const motionReduced = computed(() => props.reducedMotion || saveData.value);
const songNameLength = computed(() => segmentAnnualTitle(props.songName).length);
const songNameClass = computed(() => songNameLength.value > 30
  ? "is-very-long"
  : songNameLength.value > 18 ? "is-long" : "");
const { onAnnualMotionActive } = useAnnualTimeline(
  rootRef,
  toRef(props, "active"),
  motionReduced,
  { reenter: "restart" }
);

onAnnualMotionActive(() => {
  const root = rootRef.value?.rootEl;
  if (!root || !requireAnnualTargets(root, ['[data-obsession-stage="headline"]', '[data-obsession-stage="cover"]', '[data-obsession-stage="song"]'])) return;

  let timeline: gsap.core.Timeline | null = null;
  const context = gsap.context(() => {
    const headline = root.querySelectorAll<HTMLElement>('[data-obsession-stage="headline"]');
    const numbers = root.querySelectorAll<HTMLElement>('[data-obsession-stage="number"]');
    const cover = root.querySelector<HTMLElement>('[data-obsession-stage="cover"]');
    const songTitle = root.querySelector<HTMLElement>('[data-obsession-stage="song"]');
    const closing = root.querySelectorAll<HTMLElement>('[data-obsession-stage="closing"]');

    // Background stays painted while foreground stages enter.
    setAnnualTargets(headline, { autoAlpha: 0, y: 16 });
    setAnnualTargets(numbers, { scale: .88, transformOrigin: "50% 70%" });
    setAnnualTargets(cover, { autoAlpha: 0, y: 16, scale: .92 });
    setAnnualTargets(songTitle, { autoAlpha: 0, y: 10 });
    setAnnualTargets(closing, { autoAlpha: 0, y: 14 });

    timeline = createAnnualTimeline();
    timeline
      .to(headline, { autoAlpha: 1, y: 0, duration: .56, stagger: .1, ease: "power2.out" }, .25)
      .to(numbers, { scale: 1.07, duration: .24, ease: "power2.out" }, .48)
      .to(numbers, { scale: 1, duration: .34, ease: "power1.out" }, .72)
      .to(cover, { autoAlpha: 1, y: 0, scale: 1, duration: .62, ease: "power2.out" }, .7)
      .to(songTitle, { autoAlpha: 1, y: 0, duration: .5, ease: "power2.out" }, .92)
      .to(closing, { autoAlpha: 1, y: 0, duration: .58, stagger: .1, ease: "power2.out" }, 1.25);
  }, root);

  return () => {
    timeline?.kill();
    context.revert();
  };
});
</script>

<template>
  <AnnualScene
    ref="rootRef"
    class="annual-obsession-green-echo"
    :active="active"
    :reduced-motion="motionReduced"
    mood="green-echo"
    intensity="low"
    :aria-label="sceneLabel"
  >
    <template #background>
      <div class="annual-obsession-green-echo__background" data-obsession-stage="background">
        <img
          class="annual-obsession-green-echo__backdrop"
          src="/obsession/background_6.png"
          alt=""
          aria-hidden="true"
        >
        <div class="annual-obsession-green-echo__scrim" />
      </div>
    </template>

    <div class="annual-obsession-green-echo__content">
      <header class="annual-obsession-green-echo__headline">
        <p data-obsession-stage="headline">
          <strong data-obsession-stage="number">{{ headlineDaysText }}</strong> {{ headlineDaysSuffix }}
        </p>
        <p data-obsession-stage="headline">
          {{ headlinePlaysBefore }} <strong data-obsession-stage="number">{{ playCountText }}</strong> {{ headlinePlaysAfter }}
        </p>
      </header>

      <section class="annual-obsession-green-echo__cover-area">
        <div data-obsession-stage="cover">
          <AnnualObsessionCoverBlock :cover-url="coverUrl" :song-name="songName" />
        </div>
        <h1 :class="songNameClass" data-obsession-stage="song">《{{ songName }}》</h1>
      </section>

      <div class="annual-obsession-green-echo__closing">
        <p data-obsession-stage="closing">{{ closing1 }}</p>
        <p data-obsession-stage="closing">{{ closing2 }}</p>
      </div>
    </div>
  </AnnualScene>
</template>

<style scoped>
.annual-obsession-green-echo {
  --obsession-lime: #b9e64f;
  --obsession-ivory: #fffdf0;
  --obsession-gold: #efe4a4;
  --obsession-shadow: rgba(5, 35, 16, 0.46);
  --obsession-cover-size: clamp(104px, 29vw, 124px);
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100vh;
  height: 100svh;
  height: 100dvh;
  overflow: hidden;
  color: var(--obsession-ivory);
  background: #164d25;
}

.annual-obsession-green-echo__background,
.annual-obsession-green-echo__backdrop,
.annual-obsession-green-echo__scrim,
.annual-obsession-green-echo__content {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.annual-obsession-green-echo__background {
  overflow: hidden;
  background: #164d25;
}

.annual-obsession-green-echo__backdrop {
  object-fit: cover;
  object-position: center;
  transform: scale(1.012);
  will-change: transform;
}

.annual-obsession-green-echo__scrim {
  background:
    linear-gradient(180deg, rgba(5, 39, 17, 0.14) 0%, transparent 31%, transparent 66%, rgba(7, 38, 15, 0.1) 100%),
    radial-gradient(circle at 50% 47%, transparent 0 33%, rgba(3, 35, 13, 0.06) 100%);
}

.annual-obsession-green-echo__content {
  z-index: 1;
  font-family: var(--viewer-font-family);
}

.annual-obsession-green-echo__headline {
  position: absolute;
  top: max(clamp(82px, 10.8dvh, 101px), calc(env(safe-area-inset-top) + 66px));
  left: 8%;
  width: 84%;
  color: rgba(255, 255, 245, 0.97);
  font: 850 clamp(1.48rem, 6.8vw, 1.92rem) / 1.38 var(--viewer-display-font);
  letter-spacing: -0.025em;
  text-shadow: 0 2px 9px var(--obsession-shadow);
}

.annual-obsession-green-echo__headline p {
  margin: 0;
  white-space: nowrap;
}

.annual-obsession-green-echo__headline p + p {
  margin-top: 1px;
  text-align: right;
}

.annual-obsession-green-echo__headline strong {
  display: inline-block;
  color: var(--obsession-lime);
  font-size: 1.37em;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.045em;
  text-shadow: 0 3px 12px rgba(26, 69, 16, 0.52);
}

.annual-obsession-green-echo__cover-area {
  position: absolute;
  top: clamp(386px, 48.5dvh, 452px);
  left: 7%;
  right: 7%;
  display: grid;
  justify-items: center;
  text-align: center;
}

.annual-obsession-green-echo__cover-area h1 {
  max-width: min(82vw, 22rem);
  margin: clamp(15px, 2.2dvh, 20px) 0 0;
  overflow-wrap: anywhere;
  color: var(--obsession-gold);
  font: 850 clamp(1.15rem, 5.1vw, 1.42rem) / 1.32 var(--viewer-display-font);
  letter-spacing: 0.01em;
  text-shadow: 0 2px 8px rgba(10, 35, 14, 0.48);
  text-wrap: balance;
}

.annual-obsession-green-echo__cover-area h1.is-long {
  max-width: min(88vw, 24rem);
  font-size: clamp(1rem, 4.35vw, 1.22rem);
}

.annual-obsession-green-echo__cover-area h1.is-very-long {
  max-width: min(90vw, 25rem);
  font-size: clamp(.9rem, 3.8vw, 1.08rem);
  line-height: 1.38;
}

.annual-obsession-green-echo__closing {
  position: absolute;
  top: clamp(638px, 74dvh, 690px);
  left: 6%;
  right: 6%;
  color: var(--obsession-gold);
  font: 850 clamp(1rem, 4.65vw, 1.28rem) / 1.66 var(--viewer-display-font);
  letter-spacing: 0.005em;
  text-align: center;
  text-shadow: 0 2px 8px rgba(10, 35, 14, 0.5);
}

.annual-obsession-green-echo__closing p {
  margin: 0;
}

.annual-obsession-green-echo.is-active:not(.is-reduced) .annual-obsession-green-echo__backdrop {
  animation: obsession-river-drift 12s ease-in-out 1.8s infinite alternate;
}

@keyframes obsession-river-drift {
  from { transform: scale(1.012) translate3d(0, 0, 0); }
  to { transform: scale(1.028) translate3d(-0.35%, 0.28%, 0); }
}

@media (max-height: 860px) and (orientation: portrait) {
  .annual-obsession-green-echo {
    --obsession-cover-size: clamp(98px, 27vw, 116px);
  }

  .annual-obsession-green-echo__headline {
    top: max(78px, calc(env(safe-area-inset-top) + 62px));
  }

  .annual-obsession-green-echo__cover-area {
    top: 45.8dvh;
  }

  .annual-obsession-green-echo__closing {
    top: 74.8dvh;
  }
}

@media (max-width: 375px) {
  .annual-obsession-green-echo__headline {
    left: 7%;
    width: 86%;
    font-size: clamp(1.34rem, 6.65vw, 1.56rem);
  }

  .annual-obsession-green-echo__closing {
    left: 4%;
    right: 4%;
    font-size: clamp(.94rem, 4.45vw, 1.08rem);
  }
}

@media (orientation: landscape) and (max-height: 540px) {
  .annual-obsession-green-echo__headline {
    top: max(48px, calc(env(safe-area-inset-top) + 38px));
    left: 6%;
    width: 42%;
    font-size: clamp(1.12rem, 3.1vw, 1.55rem);
  }

  .annual-obsession-green-echo__headline p + p {
    text-align: left;
  }

  .annual-obsession-green-echo__cover-area {
    top: 22%;
    left: 48%;
    right: 5%;
  }

  .annual-obsession-green-echo__closing {
    top: auto;
    bottom: max(34px, calc(env(safe-area-inset-bottom) + 24px));
    left: 5%;
    right: 54%;
    font-size: clamp(.9rem, 2.25vw, 1.08rem);
    text-align: left;
  }
}

@media (prefers-reduced-motion: reduce) {
  .annual-obsession-green-echo__backdrop {
    animation: none !important;
    transform: scale(1.012);
  }
}
</style>
