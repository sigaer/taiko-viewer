<script setup lang="ts">
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import AnnualDrumWindow from "../AnnualDrumWindow.vue";
import StorySlideShell from "../StorySlideShell.vue";
defineProps<{ summary: VersionSummaryViewModel; pageIndex: number; pageTotal: number; active: boolean; reducedMotion: boolean }>();
const { t, n } = useI18n();
</script>
<template>
  <StorySlideShell :page-index="pageIndex" :page-total="pageTotal" :eyebrow="summary.copy.pound.eyebrow" :title="summary.copy.pound.title" :lead="summary.copy.pound.body" tone="gold" :active="active" :reduced-motion="reducedMotion">
    <div v-if="summary.pound" class="pound-slide">
      <AnnualDrumWindow data-animate size="large"><div class="pound-slide__total"><strong>{{ n(summary.pound.totalPoundCount) }}</strong><span>{{ t('annualSummary.slides.pound.unit') }}</span></div></AnnualDrumWindow>
      <div class="pound-slide__copy">
        <h3 data-animate>{{ t('annualSummary.slides.pound.story') }}</h3>
        <article v-if="summary.pound.topSong" data-animate><span>{{ t('annualSummary.slides.pound.topSong') }}</span><strong>{{ summary.pound.topSong.name }}</strong><small>{{ n(summary.pound.topPoundCount) }} {{ t('annualSummary.slides.pound.unit') }}</small></article>
        <p data-animate>{{ t('annualSummary.slides.pound.ending') }}</p>
      </div>
    </div>
  </StorySlideShell>
</template>
<style scoped>
.pound-slide{height:100%;display:grid;grid-template-columns:minmax(250px,.9fr) minmax(0,1.1fr);gap:clamp(18px,5vw,64px);align-items:center}.pound-slide__total{text-align:center;color:#17365d}.pound-slide__total strong{display:block;font:700 clamp(2.2rem,8vw,5rem)/1 var(--viewer-display-font)}.pound-slide__total span{display:block;margin-top:7px;color:#3978c8;font-size:12px}.pound-slide__copy h3{margin:0 0 18px;color:#17365d;font:700 clamp(1.5rem,4vw,3rem)/1.2 var(--viewer-display-font)}.pound-slide__copy article{padding:16px 18px;border-radius:20px;background:#f7fbffcc;border:1px solid #3978c829}.pound-slide__copy article span,.pound-slide__copy article small{display:block;color:#5c7697;font-size:12px}.pound-slide__copy article strong{display:block;margin:7px 0;color:#17365d;font-size:1.25rem;overflow-wrap:anywhere}.pound-slide__copy p{color:#5c7697;font-size:12px;line-height:1.6}@media(max-width:720px){.pound-slide{grid-template-columns:auto 1fr;gap:12px;align-items:start}.pound-slide__copy h3{font-size:1.12rem;margin-bottom:7px}.pound-slide__copy article{padding:9px;border-radius:14px}.pound-slide__copy p{font-size:12px;line-height:1.35}}@media (orientation:landscape) and (min-width:721px) and (max-height:460px){.pound-slide{grid-template-columns:205px minmax(0,1fr);gap:28px}.pound-slide :deep(.drum-window){--drum-size:min(47vh,180px)}.pound-slide__total strong{font-size:clamp(2rem,5vw,3rem)}.pound-slide__copy h3{margin-bottom:8px;font-size:clamp(1.35rem,3vw,1.85rem)}.pound-slide__copy article{padding:10px 12px;border-radius:16px}.pound-slide__copy p{margin:8px 0 0;line-height:1.4}}
</style>
