<script setup lang="ts">
import { computed } from "vue";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import StorySlideShell from "../StorySlideShell.vue";

const props = defineProps<{ summary: VersionSummaryViewModel; pageIndex: number; pageTotal: number; active: boolean; reducedMotion: boolean }>();
const { t, locale } = useI18n();
const numberFormatter = computed(() => new Intl.NumberFormat(locale.value === "ja" ? "ja-JP" : "zh-CN"));
const percentFormatter = computed(() => new Intl.NumberFormat(locale.value === "ja" ? "ja-JP" : "zh-CN", { maximumFractionDigits: 2 }));
const rankLabel = computed(() => {
  const rank = props.summary.ratingRank;
  if (!rank) return "—";
  if (rank.rankMin && rank.rankMax && rank.rankMin !== rank.rankMax) return `#${numberFormatter.value.format(rank.rankMin)}–${numberFormatter.value.format(rank.rankMax)}`;
  return `#${numberFormatter.value.format(rank.rankMin || rank.rank)}`;
});
</script>

<template>
  <StorySlideShell :page-index="pageIndex" :page-total="pageTotal" :eyebrow="summary.copy.ratingRank.eyebrow" :title="summary.copy.ratingRank.title" :lead="summary.copy.ratingRank.body" tone="gold" :active="active" :reduced-motion="reducedMotion">
    <div v-if="summary.ratingRank" class="rank">
      <article class="hero" data-animate><span>TAIKOB20</span><strong>{{ summary.ratingRank.rating.toFixed(4) }}</strong><div class="progress"><i :style="{ width: `${summary.ratingRank.percentile}%` }"></i></div><b>{{ t(`annualSummary.slides.rating.tiers.${summary.ratingRank.tier}`) }}</b><small>{{ t("annualSummary.slides.rating.percentile", { value: percentFormatter.format(summary.ratingRank.percentile) }) }}</small></article>
      <div class="position"><article data-animate><span>{{ t("annualSummary.slides.rating.rank") }}</span><strong>{{ rankLabel }}</strong><small>{{ t("annualSummary.slides.rating.sample", { count: numberFormatter.format(summary.ratingRank.sampleSize) }) }}</small></article><article class="silhouette" data-animate aria-hidden="true"><i></i><i></i><i></i></article></div>
    </div>
  </StorySlideShell>
</template>

<style scoped>
.rank{height:100%;min-height:0;display:grid;grid-template-columns:1fr 1fr;gap:12px}.rank article{min-width:0;padding:20px;border:1px solid rgba(57,120,200,.18);border-radius:28px;background:rgba(247,251,255,.84);box-shadow:0 14px 34px rgba(23,54,93,.08);display:grid;align-content:center}.hero{background:radial-gradient(circle at top left,rgba(57,120,200,.23),transparent 55%),rgba(247,251,255,.9)!important}.rank span,.rank small,.rank b{color:#5c7697;font-size:12px}.rank b{margin-top:8px;color:#3978c8}.rank strong{color:#17365d;font:700 clamp(2.3rem,7vw,6.2rem)/1 var(--viewer-display-font);overflow-wrap:anywhere}.progress{height:8px;margin-top:16px;border-radius:99px;background:#dceafa;overflow:hidden}.progress i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#3978c8,#3978c8)}.position{display:grid;gap:10px}.position strong{font-size:clamp(1.8rem,4.5vw,3.6rem)}.silhouette{display:flex!important;align-items:end!important;justify-content:center;gap:12px;overflow:hidden}.silhouette i{display:block;width:18%;aspect-ratio:.65;border-radius:50% 50% 12px 12px;background:linear-gradient(#9bc9ff,#e5f1ff)}.silhouette i:nth-child(2){width:24%;background:linear-gradient(#9bc9ff,#3978c8)}
@media(max-width:720px){.rank{gap:6px}.rank article{padding:10px;border-radius:17px}.rank strong{font-size:1.75rem}.position strong{font-size:1.25rem}.rank span,.rank small,.rank b{font-size:10px}.progress{height:5px;margin-top:8px}}
@media (orientation:landscape) and (min-width:721px) and (max-height:460px){.rank{grid-template-columns:minmax(0,1.18fr) minmax(0,.82fr);gap:8px}.rank article{padding:11px 14px;border-radius:19px}.rank strong{font-size:clamp(2.5rem,6vw,3.6rem)}.progress{height:6px;margin-top:8px}.rank b{margin-top:5px}.position{grid-template-columns:minmax(0,1fr) minmax(120px,.65fr);gap:8px}.position strong{font-size:clamp(1.6rem,3.8vw,2.3rem)}.silhouette{gap:8px}}
</style>
