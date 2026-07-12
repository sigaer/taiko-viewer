<script setup lang="ts">
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import AnnualDrumWindow from "../AnnualDrumWindow.vue";
import StorySlideShell from "../StorySlideShell.vue";
defineProps<{ summary: VersionSummaryViewModel; pageIndex: number; pageTotal: number; active: boolean; reducedMotion: boolean }>();
const { t, n } = useI18n();
</script>
<template>
  <StorySlideShell :page-index="pageIndex" :page-total="pageTotal" :eyebrow="summary.copy.highScore.eyebrow" :title="summary.copy.highScore.title" :lead="summary.copy.highScore.body" tone="gold" :active="active" :reduced-motion="reducedMotion">
    <div v-if="summary.highScore" class="score-slide">
      <AnnualDrumWindow data-animate size="large" gold :image-url="summary.highScore.song.coverUrl" :image-alt="summary.highScore.song.name" :fallback="t('annualSummary.common.defaultCover')" />
      <div class="score-slide__copy">
        <span data-animate>{{ summary.highScore.happenedLabel }}</span>
        <strong data-animate>{{ n(summary.highScore.score) }}</strong>
        <h3 data-animate>{{ summary.highScore.song.name }}</h3>
        <p data-animate>{{ t('annualSummary.slides.highScore.celebration') }}</p>
      </div>
    </div>
  </StorySlideShell>
</template>
<style scoped>
.score-slide{height:100%;display:grid;grid-template-columns:minmax(220px,.85fr) minmax(0,1.15fr);gap:clamp(18px,5vw,64px);align-items:center}.score-slide__copy>span{color:#3978c8;font-size:12px}.score-slide__copy>strong{display:block;margin:8px 0;color:#3978c8;font:700 clamp(2.8rem,8vw,6.2rem)/1 var(--viewer-display-font)}.score-slide__copy h3{margin:0 0 12px;color:#17365d;font:700 clamp(1.5rem,4vw,3rem)/1.08 var(--viewer-display-font);overflow-wrap:anywhere}.score-slide__copy p{margin:0;color:#5c7697;font-size:12px;line-height:1.65}@media(max-width:720px){.score-slide{grid-template-columns:auto 1fr;gap:12px;align-items:start}.score-slide__copy>strong{font-size:2rem}.score-slide__copy h3{font-size:1.15rem;margin-bottom:6px}.score-slide__copy p{font-size:12px;line-height:1.4}}
</style>
