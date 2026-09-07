<script setup lang="ts">
import { computed } from "vue";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import StorySlideShell from "../StorySlideShell.vue";
import { getPoundSpeedCopy } from "~/utils/annualCopy";

const props = defineProps<{ summary: VersionSummaryViewModel; pageIndex: number; pageTotal: number; active: boolean; reducedMotion: boolean }>();
const { locale, t } = useI18n();
const copy = computed(() => getPoundSpeedCopy(props.summary.pound, locale.value === "ja" ? "ja" : "zh"));
const speed = computed(() => props.summary.pound?.speed);
const song = computed(() => props.summary.pound?.topSong);
</script>

<template>
  <StorySlideShell variant="poster" :page-index="pageIndex" :page-total="pageTotal" eyebrow="SPEED BURST" :title="speed ? '最高秒速歌曲' : '最高秒速记录'" tone="royal" mood="speed-night" :active="active" :reduced-motion="reducedMotion">
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

      <div class="pound-poster__horizon" aria-hidden="true">
        <img class="pound-poster__city" src="/annual/pound/city-silhouette.png" alt="">
        <div class="pound-poster__black-band"></div>
      </div>

      <div class="pound-poster__stage">
        <div class="pound-poster__record-wrap">
          <img class="pound-poster__record-player" src="/annual/pound/record-player.png" alt="" aria-hidden="true">
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
.pound-poster__horizon { position: absolute; z-index: 6; left: 0; right: 0; top: 43%; pointer-events: none; }
.pound-poster__city { display: block; width: 100%; height: auto; opacity: 0.92; }
.pound-poster__black-band { height: clamp(52px, 7vh, 72px); margin-top: -1px; background: #050505; }
.pound-poster__noise { position: absolute; left: 0; right: 0; top: 48%; width: 100%; height: auto; mix-blend-mode: overlay; opacity: 0.35; }

.pound-poster { height: 100%; display: flex; flex-direction: column; align-items: center; color: #fff; }
.pound-poster__hero { text-align: center; z-index: 2; padding-top: 0.5rem; }
.pound-poster__kicker { margin: 0; color: #fff; font: 700 clamp(1.15rem, 5vw, 2.2rem) / 1.05 var(--viewer-display-font); text-wrap: balance; text-shadow: 0 2px 14px rgba(0, 0, 0, 0.4); }
.pound-poster__speed { display: flex; align-items: baseline; justify-content: center; gap: 8px; margin-top: 0.3rem; }
.pound-poster__speed strong { font: 800 clamp(4.4rem, 20vw, 8.5rem) / 0.84 var(--viewer-display-font); letter-spacing: -0.06em; color: #fff; text-shadow: 0 4px 28px rgba(0, 0, 0, 0.45); }
.pound-poster__speed span { font-weight: 700; font-size: clamp(0.8rem, 3vw, 1.25rem); white-space: nowrap; }
.pound-poster__sub { max-width: 92vw; margin: 0.5rem auto 0; color: #ffe8f3cc; font-size: clamp(10px, 3.1vw, 12.5px); line-height: 1.4; white-space: nowrap; }

.pound-poster__stage { position: relative; z-index: 4; flex: 1; display: flex; align-items: flex-end; justify-content: center; min-height: 0; width: 100%; }
.pound-poster__record-wrap { position: relative; width: min(94vw, 430px); }
.pound-poster__record-player { width: 100%; height: auto; display: block; filter: drop-shadow(0 18px 32px rgba(10, 8, 30, 0.45)); }
.pound-poster__center { position: absolute; left: 50%; top: 66%; transform: translate(-50%, -50%); width: clamp(100px, 29vw, 134px); aspect-ratio: 1; border-radius: 50%; overflow: hidden; display: grid; place-items: center; background: #111; box-shadow: 0 0 0 7px rgba(10, 8, 12, 0.55), 0 0 0 9px rgba(255, 255, 255, 0.16), 0 12px 26px rgba(0, 0, 0, 0.4); }
.pound-poster__center img { width: 100%; height: 100%; object-fit: cover; display: block; }
.pound-poster__center span { font: 800 clamp(1.6rem, 6vw, 2.4rem) / 1 var(--viewer-display-font); color: #fff; }

.pound-poster__caption { position: relative; z-index: 2; margin-top: -0.2rem; padding-bottom: 0.2rem; text-align: center; font: 700 clamp(1rem, 4vw, 1.5rem) / 1.1 var(--viewer-display-font); max-width: 90vw; overflow-wrap: anywhere; color: #fff; text-shadow: 0 2px 12px rgba(0, 0, 0, 0.5); }

.is-empty .pound-poster__speed strong { color: #ffffffb8; }
@media (max-height: 720px) {
  .pound-poster__record-player { width: min(82vw, 360px); }
  .pound-poster__center { width: clamp(86px, 24vw, 112px); }
  .pound-poster__speed strong { font-size: clamp(3.4rem, 16vw, 6rem); }
  .pound-poster__horizon { top: 45%; }
}
</style>
