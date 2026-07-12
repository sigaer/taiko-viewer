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
  <StorySlideShell :page-index="pageIndex" :page-total="pageTotal" :eyebrow="summary.copy.monthlyFavorites.eyebrow" :title="summary.copy.monthlyFavorites.title" :lead="summary.copy.monthlyFavorites.body" tone="aurora" :active="active" :reduced-motion="reducedMotion">
    <div class="month-timeline" :class="{ dense: summary.monthlyFavorites.length > 6 }">
      <article v-for="item in summary.monthlyFavorites" :key="item.month" data-animate><i></i><el-image :src="item.song.coverUrl" fit="cover"><template #error><AnnualArtworkFallback :label="t('annualSummary.common.defaultCover')" /></template></el-image><div><span>{{ item.monthLabel }}</span><strong>{{ item.song.name }}</strong><small>{{ t("annualSummary.slides.monthly.plays", { count: formatter.format(item.playCount), time: item.estimatedTimeText }) }}</small></div></article>
    </div>
  </StorySlideShell>
</template>

<style scoped>
.month-timeline{position:relative;height:100%;min-height:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;align-content:center}.month-timeline:before{content:"";position:absolute;left:3%;right:3%;top:50%;height:2px;background:linear-gradient(90deg,transparent,rgba(57,120,200,.48),transparent)}.month-timeline article{position:relative;z-index:1;min-width:0;display:grid;grid-template-columns:58px 1fr;gap:9px;align-items:center;padding:10px;border:1px solid rgba(57,120,200,.18);border-radius:20px;background:rgba(247,251,255,.92);box-shadow:0 14px 32px rgba(23,54,93,.1)}.month-timeline article i{position:absolute;top:-12px;left:20px;width:9px;height:9px;border-radius:50%;background:#3978c8;box-shadow:0 0 13px rgba(57,120,200,.35)}.month-timeline :deep(.el-image){width:58px;aspect-ratio:1;border-radius:50%;box-shadow:0 0 0 4px #e5f1ff}.month-timeline div{min-width:0}.month-timeline span,.month-timeline small{display:block;color:#5c7697;font-size:10px}.month-timeline strong{display:-webkit-box;margin:4px 0;color:#17365d;font:700 .82rem/1.2 var(--viewer-display-font);-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.month-timeline.dense{grid-template-columns:repeat(3,minmax(0,1fr))}
@media(max-width:720px){.month-timeline,.month-timeline.dense{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.month-timeline:before{top:8%;bottom:8%;left:50%;right:auto;width:1px;height:auto}.month-timeline article{grid-template-columns:42px 1fr;padding:7px;gap:7px;border-radius:13px}.month-timeline article i{display:none}.month-timeline :deep(.el-image){width:42px}.month-timeline strong{font-size:.72rem}.month-timeline span,.month-timeline small{font-size:10px}}
</style>
