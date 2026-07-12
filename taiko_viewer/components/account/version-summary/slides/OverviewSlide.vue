<script setup lang="ts">
import { computed } from "vue";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import StoryCounter from "../StoryCounter.vue";
import StorySlideShell from "../StorySlideShell.vue";

const props = defineProps<{ summary: VersionSummaryViewModel; pageIndex: number; pageTotal: number; active: boolean; reducedMotion: boolean }>();
const { t, locale } = useI18n();
const formatter = computed(() => new Intl.NumberFormat(locale.value === "ja" ? "ja-JP" : "zh-CN"));
const showActiveDays = computed(() => props.summary.timeCoverage?.status !== "unavailable");
const metrics = computed(() => [
  { key: "songs", label: t("annualSummary.slides.overview.songs"), value: props.summary.overview.uniqueSongs },
  { key: "charts", label: t("annualSummary.slides.overview.charts"), value: props.summary.overview.uniqueCharts || 0 },
  { key: "clear", label: t("annualSummary.slides.overview.clear"), value: props.summary.overview.currentClearCharts || 0 },
  { key: "fullCombo", label: t("annualSummary.slides.overview.fullCombo"), value: props.summary.overview.currentFullComboCharts || 0 },
  { key: "dondaful", label: t("annualSummary.slides.overview.dondaful"), value: props.summary.overview.currentDondafulCharts || 0 },
  { key: "kiwami", label: t("annualSummary.slides.overview.kiwami"), value: props.summary.overview.currentKiwamiCharts || 0 }
]);
</script>

<template>
  <StorySlideShell :page-index="pageIndex" :page-total="pageTotal" :eyebrow="summary.copy.overview.eyebrow" :title="summary.copy.overview.title" :lead="summary.copy.overview.body" tone="aurora" :active="active" :reduced-motion="reducedMotion">
    <div class="overview-slide">
      <article class="overview-slide__hero" data-animate>
        <span>{{ t("annualSummary.slides.overview.plays") }}</span>
        <strong><StoryCounter :value="summary.overview.playCount" :active="active" :reduced-motion="reducedMotion" /></strong>
        <p>{{ summary.mode === "version_observed" ? t("annualSummary.common.observedQualifier") : t("annualSummary.common.archiveQualifier") }}</p>
        <div class="overview-slide__hero-pills">
          <span v-if="showActiveDays">{{ t("annualSummary.slides.overview.activeDays") }} · <b>{{ formatter.format(summary.period.activeDays) }}</b></span>
          <span>{{ t("annualSummary.slides.overview.estimated") }} · <b>{{ summary.overview.estimatedTimeText }}</b></span>
        </div>
      </article>
      <div class="overview-slide__grid">
        <article v-for="item in metrics" :key="item.key" class="overview-slide__tile" data-animate><span>{{ item.label }}</span><strong><StoryCounter :value="item.value" :active="active" :reduced-motion="reducedMotion" /></strong></article>
      </div>
    </div>
  </StorySlideShell>
</template>

<style scoped>
.overview-slide{height:100%;min-height:0;display:grid;grid-template-columns:minmax(260px,.82fr) minmax(0,1.18fr);gap:14px}.overview-slide__hero,.overview-slide__tile{min-width:0;border:1px solid rgba(57,120,200,.18);border-radius:26px;background:rgba(247,251,255,.86);box-shadow:0 14px 34px rgba(23,54,93,.08)}.overview-slide__hero{display:grid;align-content:center;padding:clamp(16px,3vw,30px);background:radial-gradient(circle at 20% 12%,rgba(155,201,255,.35),transparent 45%),rgba(247,251,255,.9)}.overview-slide__hero>span,.overview-slide__tile span{color:#5c7697;font-size:12px;letter-spacing:.04em}.overview-slide__hero>strong{color:#3978c8;font:700 clamp(3.4rem,9vw,7rem)/.9 var(--viewer-display-font)}.overview-slide__hero p{margin:16px 0;color:#5c7697;font-size:12px;line-height:1.55}.overview-slide__hero-pills{display:flex;flex-wrap:wrap;gap:6px}.overview-slide__hero-pills span{padding:6px 8px;border-radius:99px;color:#3978c8;background:#e5f1ff;font-size:10px}.overview-slide__hero-pills b{color:#17365d}.overview-slide__grid{min-height:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.overview-slide__tile{display:grid;align-content:center;padding:14px}.overview-slide__tile strong{margin-top:7px;color:#17365d;font:700 clamp(1.45rem,4vw,2.7rem)/1 var(--viewer-display-font)}
@media(max-width:720px){.overview-slide{grid-template-columns:minmax(120px,.72fr) minmax(0,1.28fr);gap:6px}.overview-slide__hero,.overview-slide__tile{border-radius:16px}.overview-slide__hero{padding:10px}.overview-slide__hero>span,.overview-slide__tile span{font-size:10px}.overview-slide__hero>strong{font-size:2.4rem}.overview-slide__hero p{margin:8px 0;font-size:12px;line-height:1.35}.overview-slide__hero-pills{display:grid}.overview-slide__hero-pills span{font-size:10px}.overview-slide__grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}.overview-slide__tile{padding:8px}.overview-slide__tile strong{font-size:1.15rem}}
</style>
