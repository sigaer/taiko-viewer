<script setup lang="ts">
import { computed, ref } from "vue";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import StorySlideShell from "../StorySlideShell.vue";
import { getPoundSpeedCopy } from "~/utils/annualCopy";

const props = defineProps<{ summary: VersionSummaryViewModel; pageIndex: number; pageTotal: number; active: boolean; reducedMotion: boolean }>();
const { locale, t } = useI18n();
const copy = computed(() => getPoundSpeedCopy(props.summary.pound, locale.value === "ja" ? "ja" : "zh"));
const speed = computed(() => props.summary.pound?.speed);
const song = computed(() => props.summary.pound?.topSong);
const cityLoaded = ref(false);
const noiseLoaded = ref(false);
const recordLoaded = ref(false);
const assetsReady = computed(() => cityLoaded.value && noiseLoaded.value && recordLoaded.value);
</script>

<template>
  <StorySlideShell variant="poster" :page-index="pageIndex" :page-total="pageTotal" eyebrow="" :show-meta="false" :title="speed ? '最高秒速歌曲' : '最高秒速记录'" tone="royal" mood="speed-night" :active="active" :reduced-motion="reducedMotion">
    <template #background>
      <div class="pound-poster__bg">
        <img class="pound-poster__sky" src="/annual/pound/background.webp" alt="" aria-hidden="true">
        <img class="pound-poster__noise" src="/annual/pound/noise.png" alt="" aria-hidden="true">
      </div>
    </template>

    <div class="pound-poster" :class="{ 'is-empty': !speed }">
      <div class="pound-poster__hero">
        <p class="pound-poster__kicker">{{ speed ? copy.title : "今年还没有记录到最高秒速" }}</p>
        <div class="pound-poster__speed" data-animate>
          <strong>{{ speed ? speed.toFixed(1) : "—" }}</strong>
          <span>打 / 秒</span>
        </div>
        <p class="pound-poster__sub">{{ speed ? copy.body : "等下一段连打，把鼓点推到更快的位置。" }}</p>
      </div>

      <div class="vinyl-stack" :class="{ 'is-ready': assetsReady }" aria-hidden="true">
        <img class="vinyl-stack__city" src="/annual/pound/city-silhouette.png" alt="" @load="cityLoaded = true">
        <img class="vinyl-stack__noise" src="/annual/pound/noise.png" alt="" @load="noiseLoaded = true">
        <div class="vinyl-stack__record">
          <img class="vinyl-stack__record-image" src="/annual/pound/record-player.png" alt="" @load="recordLoaded = true">
          <div class="pound-poster__center">
            <img v-if="song?.coverUrl" :src="song.coverUrl" :alt="song.name || ''" loading="lazy">
            <span v-else>♪</span>
          </div>
        </div>
      </div>

      <div class="pound-poster__caption">{{ song?.name || t("annualSummary.common.songWaiting") }}</div>
    </div>
  </StorySlideShell>
</template>

<style scoped>
.pound-poster__bg { position: absolute; inset: 0; overflow: hidden; background: #1d1b3b; }
.pound-poster__sky { position: absolute; left: 0; top: 0; width: 100%; height: 100%; object-fit: cover; object-position: center top; }

.pound-poster { --split-y: calc(43% + 4px); --building-h: calc(100vw * 162 / 414); --noise-h: clamp(48px, 7svh, 64px); --record-h: calc(100vw * 348 / 414); --record-clear-top: calc(var(--record-h) * 87 / 348); position: relative; height: 100%; display: flex; flex-direction: column; align-items: center; color: #fff; }
.pound-poster__hero { text-align: center; z-index: 2; padding-top: 0.5rem; }
.pound-poster__kicker { margin: 0; color: #fff; font: 700 clamp(1.15rem, 5vw, 2.2rem) / 1.05 var(--viewer-display-font); text-wrap: balance; text-shadow: 0 2px 14px rgba(0, 0, 0, 0.4); }
.pound-poster__speed { display: flex; align-items: baseline; justify-content: center; gap: 8px; margin-top: 0.3rem; }
.pound-poster__speed strong { font: 800 clamp(4.4rem, 20vw, 8.5rem) / 0.84 var(--viewer-display-font); letter-spacing: -0.06em; color: #fff; text-shadow: 0 4px 28px rgba(0, 0, 0, 0.45); }
.pound-poster__speed span { font-weight: 700; font-size: clamp(0.8rem, 3vw, 1.25rem); white-space: nowrap; }
.pound-poster__sub { max-width: 92vw; margin: 0.5rem auto 0; color: #ffe8f3cc; font-size: clamp(10px, 3.1vw, 12.5px); line-height: 1.4; white-space: nowrap; }

.vinyl-stack { --split-y: inherit; --building-h: calc(100vw * 162 / 414); --record-h: calc(100vw * 348 / 414); --noise-h: clamp(48px, 7svh, 64px); position: absolute; z-index: 5; top: calc(var(--split-y) - var(--building-h)); left: 50%; width: 100vw; height: calc(var(--building-h) + var(--noise-h) + var(--record-h) - var(--record-clear-top)); max-width: none; transform: translateX(-50%); opacity: 0; pointer-events: none; }
.vinyl-stack.is-ready { opacity: 1; transition: opacity 240ms ease-out; }
.vinyl-stack__city,.vinyl-stack__noise,.vinyl-stack__record { position: absolute; left: 50%; width: 100vw; max-width: none; transform: translateX(-50%); }
.vinyl-stack__city { top: 0; height: var(--building-h); object-fit: fill; opacity: .92; }
.vinyl-stack__noise { top: var(--building-h); height: var(--noise-h); object-fit: fill; }
.vinyl-stack__record { top: calc(var(--building-h) + var(--noise-h) - var(--record-clear-top) - 1px); height: var(--record-h); }
.vinyl-stack__record-image { display: block; width: 100vw; max-width: none; height: var(--record-h); object-fit: fill; filter: drop-shadow(0 18px 32px rgba(10, 8, 30, .45)); }
.pound-poster__center { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: clamp(100px, 29vw, 134px); aspect-ratio: 1; border-radius: 50%; overflow: hidden; display: grid; place-items: center; background: #111; box-shadow: 0 0 0 7px rgba(10, 8, 12, 0.55), 0 0 0 9px rgba(255, 255, 255, 0.16), 0 12px 26px rgba(0, 0, 0, 0.4); }
.pound-poster__center img { width: 100%; height: 100%; object-fit: cover; display: block; }
.pound-poster__center span { font: 800 clamp(1.6rem, 6vw, 2.4rem) / 1 var(--viewer-display-font); color: #fff; }

.pound-poster__caption { position: absolute; z-index: 8; top: calc(var(--split-y) + var(--noise-h) + var(--record-h) - var(--record-clear-top) + 8px); left: 5%; right: 5%; margin: 0; padding-bottom: 0.2rem; text-align: center; font: 700 clamp(1rem, 4vw, 1.5rem) / 1.1 var(--viewer-display-font); max-width: 90vw; overflow-wrap: anywhere; color: #fff; text-shadow: 0 2px 12px rgba(0, 0, 0, 0.5); }

.is-empty .pound-poster__speed strong { color: #ffffffb8; }
@media (max-height: 720px) {
  .pound-poster__center { width: clamp(86px, 24vw, 112px); }
  .pound-poster__speed strong { font-size: clamp(3.4rem, 16vw, 6rem); }
  .pound-poster { --split-y: calc(47% + 4px); }
}
</style>
