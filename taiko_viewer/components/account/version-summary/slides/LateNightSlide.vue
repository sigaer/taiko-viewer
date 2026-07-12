<script setup lang="ts">
import { computed } from "vue";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import AnnualArtworkFallback from "../AnnualArtworkFallback.vue";
import StorySlideShell from "../StorySlideShell.vue";

defineProps<{ summary: VersionSummaryViewModel; pageIndex: number; pageTotal: number; active: boolean; reducedMotion: boolean }>();
const { t, locale } = useI18n();
const formatter = computed(() => new Intl.NumberFormat(locale.value === "ja" ? "ja-JP" : "zh-CN"));
</script>

<template>
  <StorySlideShell :page-index="pageIndex" :page-total="pageTotal" :eyebrow="summary.copy.lateNight.eyebrow" :title="summary.copy.lateNight.title" :lead="summary.copy.lateNight.body" tone="royal" :active="active" :reduced-motion="reducedMotion">
    <div v-if="summary.lateNight" class="late">
      <div class="stars" aria-hidden="true"></div>
      <div class="moon" data-animate><el-image :src="summary.lateNight.song.coverUrl" fit="cover"><template #error><AnnualArtworkFallback :label="t('annualSummary.common.defaultCover')" /></template></el-image></div>
      <div class="facts"><article data-animate><span>{{ t("annualSummary.slides.late.latest") }}</span><strong>{{ summary.lateNight.latestLabel }}</strong><small>{{ t("annualSummary.slides.milestones.song", { name: summary.lateNight.song.name }) }}</small></article><article data-animate><span>{{ t("annualSummary.slides.late.company") }}</span><strong>{{ t("annualSummary.slides.late.nights", { count: formatter.format(summary.lateNight.activeDays) }) }}</strong><small>{{ t("annualSummary.slides.late.plays", { count: formatter.format(summary.lateNight.playCount) }) }}</small></article></div>
    </div>
  </StorySlideShell>
</template>

<style scoped>
.late{position:relative;height:100%;min-height:0;display:grid;grid-template-columns:minmax(180px,34%) 1fr;gap:14px}.stars{position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(circle,#3978c8 0 1px,transparent 1.5px),radial-gradient(circle,#9bc9ff 0 1px,transparent 1.5px);background-size:43px 43px,67px 67px;background-position:0 0,17px 23px;opacity:.2}.moon,.facts article{position:relative;z-index:1;padding:16px;border:1px solid rgba(57,120,200,.18);border-radius:28px;background:rgba(247,251,255,.86);box-shadow:0 14px 34px rgba(23,54,93,.08)}.moon{display:grid;place-items:center;background:radial-gradient(circle at 50% 45%,rgba(155,201,255,.38),transparent 64%),rgba(247,251,255,.9)}.moon:after{content:"";position:absolute;width:min(85%,34vh);aspect-ratio:1;border-radius:50%;box-shadow:0 0 60px rgba(57,120,200,.24);pointer-events:none}.moon :deep(.el-image){width:min(78%,30vh);aspect-ratio:1;border:8px solid #e5f1ff;border-radius:50%;box-shadow:0 0 0 4px #3978c8}.facts{display:grid;gap:10px}.facts article{display:grid;align-content:center}.late span{color:#5c7697;font-size:12px}.late small{color:#5c7697;font-size:10px}.late strong{margin:8px 0;color:#17365d;font:700 clamp(1.4rem,4vw,2.8rem)/1.05 var(--viewer-display-font);overflow-wrap:anywhere}
@media(max-width:720px){.late{grid-template-columns:100px 1fr;gap:7px}.moon,.facts article{padding:9px;border-radius:16px}.moon :deep(.el-image){border-width:4px}.facts{gap:6px}.late strong{margin:4px 0;font-size:.95rem}.late span,.late small{font-size:10px}}
</style>
