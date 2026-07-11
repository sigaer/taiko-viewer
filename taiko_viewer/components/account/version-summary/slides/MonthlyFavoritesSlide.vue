<script setup lang="ts">
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import StorySlideShell from "../StorySlideShell.vue";
defineProps<{ summary: VersionSummaryViewModel; pageIndex: number; pageTotal: number; active: boolean; reducedMotion: boolean }>();
</script>
<template>
  <StorySlideShell :page-index="pageIndex" :page-total="pageTotal" :eyebrow="summary.copy.monthlyFavorites.eyebrow" :title="summary.copy.monthlyFavorites.title" :lead="summary.copy.monthlyFavorites.body" tone="aurora" :active="active" :reduced-motion="reducedMotion">
    <div class="month-timeline" :class="{ dense: summary.monthlyFavorites.length > 6 }">
      <article v-for="item in summary.monthlyFavorites" :key="item.month" data-animate>
        <i></i><el-image :src="item.song.coverUrl" fit="cover" />
        <div><span>{{ item.monthLabel }}，你最常打的是</span><strong>《{{ item.song.name }}》</strong><small>{{ item.playCount }} 次 · {{ item.estimatedTimeText }}</small></div>
      </article>
    </div>
  </StorySlideShell>
</template>
<style scoped>
.month-timeline{position:relative;height:100%;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;align-content:center}.month-timeline:before{content:"";position:absolute;left:3%;right:3%;top:50%;height:2px;background:linear-gradient(90deg,transparent,#ffba6f99,transparent)}.month-timeline article{position:relative;z-index:1;display:grid;grid-template-columns:58px 1fr;gap:9px;align-items:center;padding:10px;border-radius:20px;background:#172b48e8;border:1px solid #ffffff1f;min-width:0;box-shadow:0 14px 32px #050b1e55}.month-timeline article i{position:absolute;top:-12px;left:20px;width:9px;height:9px;border-radius:50%;background:#ffc876;box-shadow:0 0 13px #ffae60}.month-timeline :deep(.el-image){width:58px;aspect-ratio:1;border-radius:13px}.month-timeline div{min-width:0}.month-timeline span,.month-timeline small{display:block;color:#ffe6c4aa;font-size:8px}.month-timeline strong{display:-webkit-box;margin:4px 0;color:#fff8ed;font-size:.75rem;line-height:1.2;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.month-timeline.dense{grid-template-columns:repeat(3,minmax(0,1fr))}@media(max-width:720px){.month-timeline,.month-timeline.dense{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.month-timeline:before{top:8%;bottom:8%;left:50%;right:auto;width:1px;height:auto}.month-timeline article{grid-template-columns:40px 1fr;padding:6px;gap:6px;border-radius:13px}.month-timeline article i{display:none}.month-timeline :deep(.el-image){width:40px;border-radius:9px}.month-timeline strong{font-size:.65rem}.month-timeline span,.month-timeline small{font-size:7px}}</style>
