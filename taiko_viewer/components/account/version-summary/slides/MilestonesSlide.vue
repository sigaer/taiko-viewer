<script setup lang="ts">
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import AnnualArtworkFallback from "../AnnualArtworkFallback.vue";
import StorySlideShell from "../StorySlideShell.vue";

defineProps<{ summary: VersionSummaryViewModel; pageIndex: number; pageTotal: number; active: boolean; reducedMotion: boolean }>();
const { n, t } = useI18n();
</script>

<template>
  <StorySlideShell :page-index="pageIndex" :page-total="pageTotal" :eyebrow="summary.copy.milestones.eyebrow" :title="summary.copy.milestones.title" :lead="summary.copy.milestones.body" tone="gold" :active="active" :reduced-motion="reducedMotion">
    <div class="moments">
      <article v-for="item in summary.milestones" :key="`${item.type}-${item.song.songNo}-${item.level}`" data-animate>
        <el-image :src="item.song.coverUrl" fit="cover"><template #error><AnnualArtworkFallback :label="t('annualSummary.common.defaultCover')" /></template></el-image>
        <div>
          <span>{{ item.happenedLabel }}</span>
          <strong>{{ item.title }}</strong>
          <h3>{{ item.song.name }}</h3>
          <small>{{ t('annualSummary.slides.milestones.effort', { plays: n(item.playCount), stars: item.song.stars ?? '—' }) }}</small>
          <em v-if="item.achievementCount === 1">{{ t('annualSummary.slides.milestones.onlyOnce') }}</em>
        </div>
      </article>
    </div>
  </StorySlideShell>
</template>

<style scoped>
.moments{height:100%;min-height:0;display:grid;grid-template-columns:repeat(3,1fr);gap:11px;align-items:stretch}.moments article{min-width:0;padding:14px;border:1px solid rgba(57,120,200,.18);border-radius:25px;background:rgba(247,251,255,.86);box-shadow:0 14px 34px rgba(23,54,93,.08);display:grid;grid-template-rows:minmax(0,1fr) auto;gap:10px}.moments :deep(.el-image){width:100%;max-height:27vh;aspect-ratio:1;justify-self:center;border:7px solid #e5f1ff;border-radius:50%;box-shadow:0 0 0 3px #3978c8}.moments div{min-width:0}.moments span,.moments small{display:block;color:#5c7697;font-size:10px}.moments strong{display:block;margin:5px 0 2px;color:#3978c8;font:700 1.2rem/1.15 var(--viewer-display-font)}.moments h3{margin:0 0 6px;overflow:hidden;color:#17365d;font:700 1rem/1.2 var(--viewer-display-font);text-overflow:ellipsis;white-space:nowrap}.moments em{display:inline-block;margin-top:7px;padding:4px 7px;border-radius:99px;color:#825f18;background:#fff0bd;font:700 10px/1 var(--viewer-font-family);font-style:normal}
@media(max-width:720px){.moments{gap:6px}.moments article{padding:7px;border-radius:15px;gap:6px}.moments :deep(.el-image){border-width:4px}.moments strong{font-size:.82rem}.moments h3{font-size:.72rem}.moments span,.moments small{font-size:10px}.moments em{margin-top:4px;padding:3px 5px;font-size:10px}}
</style>
