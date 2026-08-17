<script setup lang="ts">
import { computed } from "vue";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import AnnualArtworkFallback from "../AnnualArtworkFallback.vue";
import StorySlideShell from "../StorySlideShell.vue";
import { isUsableMetric } from "~/utils/annualPresentation";

defineProps<{ summary: VersionSummaryViewModel; pageIndex: number; pageTotal: number; active: boolean; reducedMotion: boolean }>();
const { t, locale } = useI18n();
const formatter = computed(() => new Intl.NumberFormat(locale.value === "ja" ? "ja-JP" : "zh-CN"));
</script>

<template>
  <StorySlideShell :page-index="pageIndex" :page-total="pageTotal" :eyebrow="summary.copy.favoriteShift.eyebrow" :title="summary.copy.favoriteShift.title" :lead="summary.copy.favoriteShift.body" tone="sunrise" :active="active" :reduced-motion="reducedMotion">
    <div v-if="summary.favoriteShift" class="shift">
      <article data-animate><el-image :src="summary.favoriteShift.oldFavorite.coverUrl" fit="cover"><template #error><AnnualArtworkFallback :label="t('annualSummary.common.defaultCover')" /></template></el-image><div><span>{{ t("annualSummary.slides.shift.old") }}</span><strong>{{ summary.favoriteShift.oldFavorite.name }}</strong><small v-if="isUsableMetric(summary.favoriteShift.oldFavorite.playCount)">{{ t("annualSummary.slides.shift.times", { count: formatter.format(summary.favoriteShift.oldFavorite.playCount) }) }}</small></div></article>
      <i data-animate aria-hidden="true">●</i>
      <article data-animate><el-image :src="summary.favoriteShift.newFavorite.coverUrl" fit="cover"><template #error><AnnualArtworkFallback :label="t('annualSummary.common.defaultCover')" /></template></el-image><div><span>{{ t("annualSummary.slides.shift.new") }}</span><strong>{{ summary.favoriteShift.newFavorite.name }}</strong><small v-if="isUsableMetric(summary.favoriteShift.newFavorite.playCount)">{{ t("annualSummary.slides.shift.times", { count: formatter.format(summary.favoriteShift.newFavorite.playCount) }) }}</small></div></article>
    </div>
  </StorySlideShell>
</template>

<style scoped>
.shift{height:100%;min-height:0;display:grid;grid-template-columns:1fr auto 1fr;gap:16px;align-items:stretch}.shift article{min-width:0;display:grid;grid-template-columns:minmax(96px,34%) 1fr;gap:16px;align-items:center;padding:18px;border:1px solid rgba(57,120,200,.18);border-radius:28px;background:rgba(247,251,255,.86);box-shadow:0 14px 34px rgba(23,54,93,.08)}.shift :deep(.el-image){width:100%;aspect-ratio:1;border:7px solid #e5f1ff;border-radius:50%;box-shadow:0 0 0 4px #3978c8}.shift div{display:grid;gap:9px;min-width:0}.shift span,.shift small{color:#5c7697;font-size:12px;letter-spacing:.03em}.shift small{font-size:10px}.shift strong{color:#17365d;font:700 clamp(1.15rem,3vw,2.4rem)/1.1 var(--viewer-display-font);overflow-wrap:anywhere}.shift>i{align-self:center;color:#3978c8;font-style:normal;text-shadow:0 0 18px rgba(57,120,200,.35)}
@media(max-width:720px){.shift{gap:7px}.shift article{grid-template-columns:68px 1fr;padding:9px;gap:8px;border-radius:17px}.shift :deep(.el-image){border-width:4px}.shift strong{font-size:.9rem}.shift span,.shift small{font-size:10px}.shift>i{font-size:10px}}@media(max-width:390px){.shift{grid-template-columns:1fr}.shift>i{display:none}}
</style>
