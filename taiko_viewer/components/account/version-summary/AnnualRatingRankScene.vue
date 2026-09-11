<script setup lang="ts">
import { computed } from "vue";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import AnnualScene from "./AnnualScene.vue";
import AnnualRatingWaterfallChart, { type RatingWaterfallRank } from "./AnnualRatingWaterfallChart.vue";
import AnimatedNumber from "./AnimatedNumber.vue";
import { getAnnualRatingRankLabels } from "~/utils/annualSummary";

const props = defineProps<{
  summary: VersionSummaryViewModel;
  pageIndex: number;
  pageTotal: number;
  active: boolean;
  reducedMotion: boolean;
}>();

const { t, locale } = useI18n();

const ratingRank = computed(() => props.summary.ratingRank);
const ratingValue = computed(() => ratingRank.value?.rating || 0);
const percentileValue = computed(() => Math.max(0, Math.min(100, ratingRank.value?.percentile || 0)));
const hasRating = computed(() => Boolean(ratingRank.value && ratingRank.value.rating > 0));
const hasDistribution = computed(() => Boolean(ratingRank.value?.distribution?.ranks?.length));
const rankKey = computed(() => ratingRank.value?.rankKey || null);
const rankLabel = computed(() => ratingRank.value?.rankLabel || ratingRank.value?.rankKey || "");

const isJapanese = computed(() => locale.value === "ja");
const rankLabels = computed(() => getAnnualRatingRankLabels(isJapanese.value ? "ja" : "zh"));
const chartRanks = computed<RatingWaterfallRank[]>(() =>
  hasDistribution.value ? (ratingRank.value?.distribution?.ranks as RatingWaterfallRank[]) || [] : []
);

const copyLine = computed(() => {
  const percentile = percentileValue.value;
  const key = percentile >= 90 ? "copyHigh" : percentile >= 50 ? "copyMid" : "copyLow";
  return t(`annualSummary.slides.ratingRank.${key}`);
});
</script>

<template>
  <AnnualScene
    class="annual-rating-rank-scene"
    :active="active"
    :reduced-motion="reducedMotion"
    mood="paper"
    intensity="high"
    data-visual-style="annual-rating-waterfall"
  >
    <template #background>
      <div class="annual-rating-rank-scene__paper" aria-hidden="true"></div>
    </template>

    <div class="annual-rating-rank-scene__content">
      <header class="annual-rating-rank-scene__header">
        <p class="annual-rating-rank-scene__eyebrow">{{ t("annualSummary.slides.ratingRank.eyebrow") }}</p>
        <h2 class="annual-rating-rank-scene__title">{{ t("annualSummary.slides.ratingRank.title") }}</h2>
      </header>

      <div class="annual-rating-rank-scene__visual">
        <AnnualRatingWaterfallChart
          :rating-b20="ratingValue"
          :percentile="percentileValue"
          :current-rank-key="rankKey || undefined"
          :ranks="chartRanks"
          :rank-labels="rankLabels"
        />
      </div>

      <section class="annual-rating-rank-scene__summary">
        <template v-if="hasRating">
          <p class="annual-rating-rank-scene__line annual-rating-rank-scene__line--strong">
            <span>{{ t("annualSummary.slides.ratingRank.b20Value") }}</span>
            <AnimatedNumber :value="ratingValue" :active="active" :reduced-motion="reducedMotion" :decimals="4" :delay="1350" />
            <em v-if="rankLabel" class="annual-rating-rank-scene__rank">{{ rankLabel }}</em>
          </p>
          <p class="annual-rating-rank-scene__line">
            <span>{{ t("annualSummary.slides.ratingRank.percentileBefore") }}</span>
            <AnimatedNumber :value="percentileValue" :active="active" :reduced-motion="reducedMotion" :decimals="2" :delay="1500" />
            <span>{{ t("annualSummary.slides.ratingRank.percentileAfter") }}</span>
          </p>
          <p class="annual-rating-rank-scene__copy">{{ copyLine }}</p>
          <p v-if="!hasDistribution" class="annual-rating-rank-scene__note">
            <strong>{{ t("annualSummary.slides.ratingRank.emptyTitle") }}</strong>
            {{ t("annualSummary.slides.ratingRank.emptyBody") }}
          </p>
        </template>
        <template v-else>
          <h3 class="annual-rating-rank-scene__missing-title">{{ t("annualSummary.slides.ratingRank.missingTitle") }}</h3>
          <p class="annual-rating-rank-scene__missing-body">{{ t("annualSummary.slides.ratingRank.missingBody") }}</p>
        </template>
      </section>
    </div>
  </AnnualScene>
</template>

<style scoped>
.annual-rating-rank-scene {
  width: 100%;
  height: 100vh;
  height: 100svh;
  height: 100dvh;
  color: #5e4833;
  background: #f5eddc;
}
.annual-rating-rank-scene__paper,
.annual-rating-rank-scene__content {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.annual-rating-rank-scene__paper {
  overflow: hidden;
  background:
    linear-gradient(180deg, rgba(249, 243, 229, 0.9), rgba(241, 225, 199, 0.92)),
    url("/annual/ratingRank/background_9.png") center / cover no-repeat,
    linear-gradient(180deg, #f8f1e2 0%, #f1e1c7 100%);
}
.annual-rating-rank-scene__content {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: clamp(5px, 0.8vh, 9px);
  padding: max(44px, calc(env(safe-area-inset-top) + 30px)) clamp(16px, 3.4vw, 30px) max(34px, calc(env(safe-area-inset-bottom) + 26px));
  box-sizing: border-box;
}
.annual-rating-rank-scene__header {
  display: grid;
  gap: 4px;
  min-width: 0;
}
.annual-rating-rank-scene__eyebrow {
  margin: 0;
  color: #8c7255;
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.annual-rating-rank-scene__title {
  margin: 0;
  color: #5c3d22;
  font: 700 clamp(1.7rem, 4.4vw, 3.4rem) / 1.05 var(--viewer-display-font);
  text-wrap: balance;
}
.annual-rating-rank-scene__visual {
  min-height: 0;
  border: 1px solid rgba(136, 109, 72, 0.16);
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(255, 250, 240, 0.5), rgba(247, 233, 206, 0.35));
  box-shadow: 0 18px 36px rgba(120, 89, 48, 0.1);
  overflow: hidden;
  transform: translateY(-10px);
  margin-bottom: -10px;
}
.annual-rating-rank-scene__summary {
  min-width: 0;
  display: grid;
  gap: 6px;
  padding: 12px 16px;
  border: 1px solid rgba(136, 109, 72, 0.14);
  border-radius: 16px;
  background: rgba(255, 251, 244, 0.72);
}
.annual-rating-rank-scene__line {
  margin: 0;
  color: #7a5d40;
  font-size: clamp(13px, 1.7vw, 16px);
  line-height: 1.4;
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px;
}
.annual-rating-rank-scene__line--strong {
  color: #5a351f;
  font: 700 clamp(1.3rem, 4.9vw, 2.3rem) / 1.05 var(--viewer-display-font);
  flex-wrap: nowrap;
  white-space: nowrap;
  min-height: 1.1em;
}
.annual-rating-rank-scene__line--strong > span {
  flex: 0 0 auto;
  white-space: nowrap;
}
.annual-rating-rank-scene__line--strong .animated-number {
  flex: 0 0 auto;
  color: #b03b2a;
  font-variant-numeric: tabular-nums;
}
.annual-rating-rank-scene__rank {
  flex: 0 0 auto;
  white-space: nowrap;
  font-style: normal;
  font-weight: 600;
  font-size: 12px;
  color: #9c6b3f;
  border: 1px solid rgba(156, 107, 63, 0.4);
  border-radius: 99px;
  padding: 2px 10px;
  align-self: center;
  letter-spacing: 0.04em;
}
.annual-rating-rank-scene__copy {
  margin: 2px 0 0;
  color: #8d745b;
  font-size: clamp(12px, 1.6vw, 15px);
  line-height: 1.5;
}
.annual-rating-rank-scene__note {
  margin: 6px 0 0;
  padding-top: 8px;
  border-top: 1px dashed rgba(140, 114, 85, 0.24);
  color: #8b7055;
  font-size: 12px;
  line-height: 1.45;
}
.annual-rating-rank-scene__note strong {
  display: block;
  color: #6b4d2e;
  font-weight: 600;
}
.annual-rating-rank-scene__missing-title {
  margin: 0;
  color: #5c3d22;
  font: 700 clamp(1.4rem, 4vw, 2.2rem) / 1.1 var(--viewer-display-font);
}
.annual-rating-rank-scene__missing-body {
  margin: 0;
  color: #8d745b;
  font-size: clamp(13px, 1.8vw, 16px);
  line-height: 1.5;
}
.annual-rating-rank-scene__eyebrow {
  animation: annual-rr-rise 0.55s ease-out both;
}
.annual-rating-rank-scene__title {
  animation: annual-rr-rise 0.6s ease-out both;
  animation-delay: 0.08s;
}
.annual-rating-rank-scene__summary {
  animation: annual-rr-rise 0.6s ease-out both;
  animation-delay: 1.0s;
}
@keyframes annual-rr-rise {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (max-width: 720px) {
  .annual-rating-rank-scene__content { padding-inline: 10px; gap: 7px; }
  .annual-rating-rank-scene__visual { border-radius: 14px; }
  .annual-rating-rank-scene__summary { padding: 10px 12px; gap: 4px; border-radius: 14px; }
}
</style>
