<script setup lang="ts">
import { computed, ref, toRef } from "vue";
import { gsap } from "gsap";
import AnnualFavoriteShiftCoverBlock from "./AnnualFavoriteShiftCoverBlock.vue";
import AnnualScene from "./AnnualScene.vue";
import { useAnnualTimeline } from "~/composables/useAnnualTimeline";
import { segmentAnnualTitle } from "~/utils/annualPresentation";

const props = defineProps<{
  active: boolean;
  reducedMotion: boolean;
  oldSongName: string;
  oldPlayCountText: string;
  newSongName: string;
  newPlayCountText: string;
}>();

defineSlots<{ oldCover(): unknown; newCover(): unknown }>();

const rootRef = ref<InstanceType<typeof AnnualScene> | null>(null);
const saveData = ref(process.client && Boolean(
  (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
));
const motionReduced = computed(() => props.reducedMotion || saveData.value);
const oldSongLength = computed(() => segmentAnnualTitle(props.oldSongName).length);
const newSongLength = computed(() => segmentAnnualTitle(props.newSongName).length);
const songLengthClass = (length: number) => length > 26 ? "is-very-long" : length > 16 ? "is-long" : "";

const { onAnnualMotionActive } = useAnnualTimeline(
  rootRef,
  toRef(props, "active"),
  motionReduced,
  { reenter: "restart" }
);

onAnnualMotionActive(() => {
  const root = rootRef.value?.rootEl;
  if (!root) return;

  let timeline: gsap.core.Timeline | null = null;
  const context = gsap.context(() => {
    const background = root.querySelector<HTMLElement>('[data-favorite-shift-stage="background"]');
    const oldCover = root.querySelector<HTMLElement>('[data-favorite-shift-stage="old-cover"]');
    const oldCopy = root.querySelector<HTMLElement>('[data-favorite-shift-stage="old-copy"]');
    const newCover = root.querySelector<HTMLElement>('[data-favorite-shift-stage="new-cover"]');
    const newCopy = root.querySelector<HTMLElement>('[data-favorite-shift-stage="new-copy"]');
    const summary = root.querySelector<HTMLElement>('[data-favorite-shift-stage="summary"]');

    gsap.set(background, { autoAlpha: 0 });
    gsap.set(oldCover, { autoAlpha: 0, x: -10, y: 14, scale: .94, rotate: -1.2 });
    gsap.set(oldCopy, { autoAlpha: 0, x: -8, y: 12 });
    gsap.set(newCover, { autoAlpha: 0, x: 12, y: 16, scale: .94, rotate: 1.2 });
    gsap.set(newCopy, { autoAlpha: 0, x: 8, y: 12 });
    gsap.set(summary, { autoAlpha: 0, y: 18 });

    timeline = gsap.timeline();
    timeline
      .to(background, { autoAlpha: 1, duration: .62, ease: "power1.out" }, 0)
      .to(oldCover, { autoAlpha: 1, x: 0, y: 0, scale: 1, rotate: 0, duration: .62, ease: "power2.out" }, .25)
      .to(oldCopy, { autoAlpha: 1, x: 0, y: 0, duration: .52, ease: "power2.out" }, .45)
      .to(newCover, { autoAlpha: 1, x: 0, y: 0, scale: 1, rotate: 0, duration: .62, ease: "power2.out" }, .75)
      .to(newCopy, { autoAlpha: 1, x: 0, y: 0, duration: .52, ease: "power2.out" }, .95)
      .to(summary, { autoAlpha: 1, y: 0, duration: .62, ease: "power2.out" }, 1.25);
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
    class="annual-favorite-shift-ginkgo"
    :active="active"
    :reduced-motion="motionReduced"
    mood="ginkgo-memory"
    intensity="low"
    aria-label="新旧偏爱"
  >
    <template #background>
      <div class="annual-favorite-shift-ginkgo__background" data-favorite-shift-stage="background">
        <img
          class="annual-favorite-shift-ginkgo__backdrop"
          src="/favoriteShift/background_7.png"
          alt=""
          aria-hidden="true"
        >
      </div>
    </template>

    <div class="annual-favorite-shift-ginkgo__content">
      <section class="annual-favorite-shift-ginkgo__block annual-favorite-shift-ginkgo__block--old">
        <div class="annual-favorite-shift-ginkgo__cover" data-favorite-shift-stage="old-cover">
          <AnnualFavoriteShiftCoverBlock>
            <slot name="oldCover" />
          </AnnualFavoriteShiftCoverBlock>
        </div>
        <div class="annual-favorite-shift-ginkgo__copy" data-favorite-shift-stage="old-copy">
          <p class="annual-favorite-shift-ginkgo__song" :class="songLengthClass(oldSongLength)">《{{ oldSongName }}》</p>
          <p class="annual-favorite-shift-ginkgo__line">
            放不下的旧爱<span v-if="oldPlayCountText">：<strong>{{ oldPlayCountText }}</strong> 次</span>
          </p>
        </div>
      </section>

      <section class="annual-favorite-shift-ginkgo__block annual-favorite-shift-ginkgo__block--new">
        <div class="annual-favorite-shift-ginkgo__cover" data-favorite-shift-stage="new-cover">
          <AnnualFavoriteShiftCoverBlock>
            <slot name="newCover" />
          </AnnualFavoriteShiftCoverBlock>
        </div>
        <div class="annual-favorite-shift-ginkgo__copy" data-favorite-shift-stage="new-copy">
          <p class="annual-favorite-shift-ginkgo__song" :class="songLengthClass(newSongLength)">《{{ newSongName }}》</p>
          <p class="annual-favorite-shift-ginkgo__line">
            <template v-if="newPlayCountText">相遇 <strong>{{ newPlayCountText }}</strong> 次：刚邂逅的新欢</template>
            <template v-else>刚邂逅的新欢</template>
          </p>
        </div>
      </section>

      <div class="annual-favorite-shift-ginkgo__summary" data-favorite-shift-stage="summary">
        <p>旧爱没有退场</p>
        <p>新欢已经熟稔</p>
      </div>
    </div>
  </AnnualScene>
</template>

<style scoped>
.annual-favorite-shift-ginkgo {
  --favorite-shift-cover-size: clamp(196px, 50.97vw, 219px);
  --favorite-shift-gold: #8f6b25;
  --favorite-shift-deep: #30281d;
  width: 100%;
  height: 100vh;
  height: 100svh;
  height: 100dvh;
  overflow: hidden;
  color: var(--favorite-shift-gold);
  background: #fff4bd;
}

.annual-favorite-shift-ginkgo__background,
.annual-favorite-shift-ginkgo__backdrop,
.annual-favorite-shift-ginkgo__content {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.annual-favorite-shift-ginkgo__background {
  overflow: hidden;
  background: #fff4bd;
}

.annual-favorite-shift-ginkgo__backdrop {
  object-fit: cover;
  object-position: center;
  transform: scale(1.012);
  animation: favorite-shift-ginkgo-drift 14s ease-in-out infinite alternate;
  will-change: transform;
}

.annual-favorite-shift-ginkgo__content {
  z-index: 1;
  overflow: hidden;
  padding-bottom: max(18px, env(safe-area-inset-bottom));
  font-family: var(--viewer-display-font), var(--viewer-font-family), sans-serif;
}

.annual-favorite-shift-ginkgo__block {
  position: absolute;
  min-width: 0;
}

.annual-favorite-shift-ginkgo__block--old {
  top: 8.15dvh;
  left: -1.45vw;
  width: min(100vw, 430px);
}

.annual-favorite-shift-ginkgo__block--new {
  top: 43.3dvh;
  left: 39.6vw;
  width: min(61vw, 262px);
}

.annual-favorite-shift-ginkgo__cover {
  width: var(--favorite-shift-cover-size);
  height: var(--favorite-shift-cover-size);
  filter: drop-shadow(0 7px 12px rgba(130, 87, 22, .08));
}

.annual-favorite-shift-ginkgo__copy {
  position: relative;
  z-index: 2;
  display: grid;
  min-width: 0;
  gap: clamp(4px, .65dvh, 7px);
  text-shadow: 0 1px 4px rgba(255, 249, 217, .86);
}

.annual-favorite-shift-ginkgo__block--old .annual-favorite-shift-ginkgo__copy {
  width: min(86vw, 356px);
  margin-top: clamp(-23px, -2.45dvh, -19px);
  margin-left: clamp(45px, 12.3vw, 54px);
}

.annual-favorite-shift-ginkgo__block--new .annual-favorite-shift-ginkgo__copy {
  width: min(61vw, 252px);
  margin-top: clamp(-47px, -5.05dvh, -42px);
  margin-left: -1.2vw;
  text-align: center;
}

.annual-favorite-shift-ginkgo__copy p,
.annual-favorite-shift-ginkgo__summary p {
  margin: 0;
  color: var(--favorite-shift-gold);
}

.annual-favorite-shift-ginkgo__song {
  max-width: 100%;
  overflow-wrap: anywhere;
  font-size: clamp(1.08rem, 5.35vw, 1.45rem);
  font-weight: 850;
  line-height: 1.16;
  letter-spacing: -.025em;
  text-wrap: balance;
}

.annual-favorite-shift-ginkgo__song.is-long {
  font-size: clamp(.98rem, 4.75vw, 1.28rem);
}

.annual-favorite-shift-ginkgo__song.is-very-long {
  font-size: clamp(.88rem, 4.15vw, 1.12rem);
  line-height: 1.12;
}

.annual-favorite-shift-ginkgo__line {
  max-width: 100%;
  overflow-wrap: anywhere;
  font-size: clamp(1rem, 4.8vw, 1.3rem);
  font-weight: 780;
  line-height: 1.2;
  letter-spacing: -.02em;
  text-wrap: balance;
}

.annual-favorite-shift-ginkgo__line strong {
  color: var(--favorite-shift-deep);
  font-size: 1.3em;
  font-weight: 900;
  letter-spacing: -.04em;
}

.annual-favorite-shift-ginkgo__summary {
  position: absolute;
  top: 77.35dvh;
  left: clamp(51px, 13.3vw, 58px);
  z-index: 2;
  display: grid;
  gap: clamp(5px, 1dvh, 10px);
  max-width: min(80vw, 330px);
  padding-bottom: max(20px, env(safe-area-inset-bottom));
  font-size: clamp(1.85rem, 8.8vw, 2.5rem);
  font-weight: 900;
  line-height: 1.32;
  letter-spacing: .015em;
  text-shadow: 0 2px 7px rgba(255, 249, 216, .88);
}

.annual-favorite-shift-ginkgo:not(.is-active) .annual-favorite-shift-ginkgo__backdrop {
  animation-play-state: paused;
}

.annual-favorite-shift-ginkgo.is-reduced .annual-favorite-shift-ginkgo__backdrop {
  animation: none;
  transform: none;
  will-change: auto;
}

@keyframes favorite-shift-ginkgo-drift {
  from { transform: translate3d(-.3%, -.14%, 0) scale(1.018); }
  to { transform: translate3d(.3%, .12%, 0) scale(1.008); }
}

@media (max-height: 720px) {
  .annual-favorite-shift-ginkgo {
    --favorite-shift-cover-size: clamp(174px, 46vw, 198px);
  }

  .annual-favorite-shift-ginkgo__block--old { top: 5.5dvh; }
  .annual-favorite-shift-ginkgo__block--new { top: 40dvh; }
  .annual-favorite-shift-ginkgo__summary { top: 75dvh; }
}

@media (orientation: landscape) and (max-height: 460px) {
  .annual-favorite-shift-ginkgo {
    --favorite-shift-cover-size: min(47vh, 190px);
  }

  .annual-favorite-shift-ginkgo__backdrop { object-position: center 54%; }
  .annual-favorite-shift-ginkgo__block--old { top: 8%; left: 2%; width: 44%; }
  .annual-favorite-shift-ginkgo__block--new { top: 8%; left: 48%; width: 44%; }
  .annual-favorite-shift-ginkgo__block--old .annual-favorite-shift-ginkgo__copy,
  .annual-favorite-shift-ginkgo__block--new .annual-favorite-shift-ginkgo__copy {
    width: 35vw;
    margin-top: -5vh;
    margin-left: 8vh;
    text-align: left;
  }
  .annual-favorite-shift-ginkgo__song { font-size: clamp(.88rem, 2.6vw, 1.12rem); }
  .annual-favorite-shift-ginkgo__line { font-size: clamp(.78rem, 2.2vw, 1rem); }
  .annual-favorite-shift-ginkgo__summary {
    top: 69%;
    left: 37%;
    display: flex;
    gap: 1em;
    max-width: none;
    font-size: clamp(1.1rem, 3vw, 1.5rem);
  }
}

@media (prefers-reduced-motion: reduce) {
  .annual-favorite-shift-ginkgo__backdrop {
    animation: none;
    transform: none;
    will-change: auto;
  }
}
</style>
