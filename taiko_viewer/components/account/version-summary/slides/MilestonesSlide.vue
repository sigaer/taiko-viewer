<script setup lang="ts">
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import AnnualArtworkFallback from "../AnnualArtworkFallback.vue";
import StorySlideShell from "../StorySlideShell.vue";

defineProps<{ summary: VersionSummaryViewModel; pageIndex: number; pageTotal: number; active: boolean; reducedMotion: boolean }>();
const { t } = useI18n();
</script>

<template>
  <StorySlideShell :page-index="pageIndex" :page-total="pageTotal" :eyebrow="summary.copy.milestones.eyebrow" :title="summary.copy.milestones.title" :lead="summary.copy.milestones.body" tone="gold" :active="active" :reduced-motion="reducedMotion">
    <div class="moments"><article v-for="item in summary.milestones" :key="`${item.type}-${item.occurredAt}`" data-animate><el-image :src="item.song.coverUrl" fit="cover"><template #error><AnnualArtworkFallback :label="t('annualSummary.common.defaultCover')" /></template></el-image><div><span>{{ item.happenedLabel }}</span><strong>{{ item.title }}</strong><small>{{ t("annualSummary.slides.milestones.song", { name: item.song.name }) }}</small></div></article></div>
  </StorySlideShell>
</template>

<style scoped>
.moments{height:100%;min-height:0;display:grid;grid-template-columns:repeat(3,1fr);gap:11px;align-items:stretch}.moments article{min-width:0;padding:14px;border:1px solid rgba(57,120,200,.18);border-radius:25px;background:rgba(247,251,255,.86);box-shadow:0 14px 34px rgba(23,54,93,.08);display:grid;grid-template-rows:minmax(0,1fr) auto;gap:10px}.moments :deep(.el-image){width:100%;max-height:28vh;aspect-ratio:1;justify-self:center;border:7px solid #e5f1ff;border-radius:50%;box-shadow:0 0 0 3px #3978c8}.moments div{min-width:0}.moments span,.moments small{display:block;color:#5c7697;font-size:10px}.moments strong{display:block;margin:5px 0;color:#17365d;font:700 1.25rem/1.15 var(--viewer-display-font)}.moments small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@media(max-width:720px){.moments{gap:6px}.moments article{padding:7px;border-radius:15px;gap:6px}.moments :deep(.el-image){border-width:4px}.moments strong{font-size:.82rem}.moments span,.moments small{font-size:10px}}
</style>
