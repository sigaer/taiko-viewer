<script setup lang="ts">
import { computed } from "vue";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import StorySlideShell from "../StorySlideShell.vue";
import { isUsableMetric } from "~/utils/annualPresentation";

const props = defineProps<{ summary: VersionSummaryViewModel; pageIndex: number; pageTotal: number; active: boolean; reducedMotion: boolean }>();
const { t } = useI18n();
const profile = computed(() => props.summary.speedProfile);
const speedText = computed(() => profile.value ? profile.value.speed.toFixed(1).replace(/\.0$/, "") : "—");
// Guard unavailable metrics with isUsableMetric(summary.speedProfile.chartCount).
const hasCount = computed(() => !!profile.value && isUsableMetric(profile.value.chartCount));
</script>

<template>
  <StorySlideShell variant="poster" :page-index="pageIndex" :page-total="pageTotal" eyebrow="SPEED SIGNATURE" :title="t('annualSummary.slides.speed.title')" tone="aurora" mood="speed-night" :active="active" :reduced-motion="reducedMotion">
    <template #background>
      <div class="profile-poster__bg">
        <img class="profile-poster__sky" src="/annual/speedProfile/background.png" alt="" aria-hidden="true">
        <img class="profile-poster__city" src="/annual/speedProfile/city-silhouette.png" alt="" aria-hidden="true">
        <img class="profile-poster__noise" src="/annual/speedProfile/noise.png" alt="" aria-hidden="true">
      </div>
    </template>

    <div class="profile-poster" :class="{ 'is-empty': !profile }">
      <div class="profile-poster__headline" data-animate>
        <strong>{{ speedText }}<small>×</small></strong>
        <p>{{ t("annualSummary.slides.speed.lead", { speed: speedText }) }}</p>
      </div>

      <div class="profile-poster__stage">
        <div class="profile-poster__record-wrap">
          <img class="profile-poster__record-player" src="/annual/speedProfile/record-player.png" alt="" aria-hidden="true">
          <div class="profile-poster__center">{{ speedText }}×</div>
        </div>
      </div>

      <div class="profile-poster__footer" data-animate>
        <p>{{ t("annualSummary.slides.speed.detail") }}</p>
        <span v-if="hasCount">{{ t("annualSummary.slides.speed.chartCount") }} · {{ profile?.chartCount }}</span>
      </div>
    </div>
  </StorySlideShell>
</template>

<style scoped>
.profile-poster__bg { position: absolute; inset: 0; overflow: hidden; background: #dfe57c; }
.profile-poster__sky { position: absolute; left: 0; top: 0; width: 100%; height: 100%; object-fit: cover; object-position: center top; }
.profile-poster__city { position: absolute; left: 0; right: 0; top: 34%; width: 100%; height: auto; opacity: 0.95; }
.profile-poster__noise { position: absolute; left: 0; right: 0; top: 48%; width: 100%; height: auto; mix-blend-mode: overlay; opacity: 0.4; }

.profile-poster { height: 100%; display: flex; flex-direction: column; align-items: center; text-align: center; color: #162317; }
.profile-poster__headline { position: relative; z-index: 2; padding-top: 0.5rem; }
.profile-poster__headline > strong { display: block; color: #172619; font: 900 clamp(4.6rem, 20vw, 8.5rem) / 0.86 var(--viewer-display-font); letter-spacing: -0.06em; text-shadow: 0 2px 18px rgba(255, 255, 255, 0.4); }
.profile-poster__headline > strong small { font-size: 0.24em; letter-spacing: 0; }
.profile-poster__headline > p { max-width: 22ch; margin: 0.5rem auto 0; color: #2f5230; font-size: clamp(0.95rem, 4vw, 1.25rem); font-weight: 700; line-height: 1.35; }

.profile-poster__stage { position: relative; z-index: 1; flex: 1; display: flex; align-items: flex-end; justify-content: center; min-height: 0; width: 100%; }
.profile-poster__record-wrap { position: relative; width: min(94vw, 430px); }
.profile-poster__record-player { width: 100%; height: auto; display: block; filter: grayscale(1) brightness(1.32) drop-shadow(0 18px 32px rgba(20, 40, 20, 0.35)); }
.profile-poster__center { position: absolute; left: 50%; top: 66%; transform: translate(-50%, -50%); width: clamp(100px, 29vw, 134px); aspect-ratio: 1; border-radius: 50%; display: grid; place-items: center; background: radial-gradient(circle at 34% 28%, #f0f6a8, #c4e05c 55%, #7fbf5a); color: #1b2c19; font: 900 clamp(1.5rem, 6vw, 2.3rem) / 1 var(--viewer-display-font); box-shadow: 0 0 0 7px rgba(12, 14, 12, 0.55), 0 0 0 9px rgba(255, 255, 255, 0.18), 0 12px 26px rgba(0, 0, 0, 0.35); }

.profile-poster__footer { position: relative; z-index: 2; padding-bottom: 0.2rem; color: #fff; }
.profile-poster__footer p { max-width: 30ch; margin: 0 auto; color: #203a21; font-size: 12px; font-weight: 600; line-height: 1.4; }
.profile-poster__footer span { display: block; margin-top: 0.35rem; color: #334238; font-size: 11px; font-weight: 700; }

.is-empty .profile-poster__center { opacity: 0.72; }
@media (max-height: 740px) {
  .profile-poster__record-player { width: min(84vw, 370px); }
  .profile-poster__headline > strong { font-size: clamp(3.4rem, 16vw, 6rem); }
  .profile-poster__center { width: clamp(88px, 25vw, 116px); }
}
</style>

