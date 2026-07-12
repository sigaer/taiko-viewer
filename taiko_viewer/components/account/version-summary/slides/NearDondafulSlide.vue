<script setup lang="ts">
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import AnnualDrumWindow from "../AnnualDrumWindow.vue";
import StorySlideShell from "../StorySlideShell.vue";
defineProps<{ summary: VersionSummaryViewModel; pageIndex: number; pageTotal: number; active: boolean; reducedMotion: boolean }>();
const { t, n } = useI18n();
</script>
<template>
  <StorySlideShell :page-index="pageIndex" :page-total="pageTotal" :eyebrow="summary.copy.nearDondaful.eyebrow" :title="summary.copy.nearDondaful.title" :lead="summary.copy.nearDondaful.body" tone="gold" :active="active" :reduced-motion="reducedMotion">
    <div v-if="summary.nearDondaful" class="near-slide">
      <AnnualDrumWindow data-animate size="large" gold :image-url="summary.nearDondaful.song.coverUrl" :image-alt="summary.nearDondaful.song.name" :fallback="t('annualSummary.common.defaultCover')" />
      <div class="near-slide__copy">
        <p data-animate>{{ t('annualSummary.slides.near.okCount', { count: summary.nearDondaful.okCount }) }}</p>
        <h3 data-animate>{{ summary.nearDondaful.song.name }}</h3>
        <article data-animate><span>{{ t('annualSummary.slides.near.score') }}</span><strong>{{ n(summary.nearDondaful.score) }}</strong></article>
      </div>
    </div>
  </StorySlideShell>
</template>
<style scoped>
.near-slide{height:100%;display:grid;grid-template-columns:minmax(220px,.85fr) minmax(0,1.15fr);gap:clamp(18px,5vw,64px);align-items:center}.near-slide__copy p{margin:0;color:#3978c8;font-weight:700}.near-slide__copy h3{margin:10px 0 20px;color:#17365d;font:700 clamp(2rem,5vw,4.4rem)/1.06 var(--viewer-display-font);overflow-wrap:anywhere}.near-slide__copy article{padding:16px 18px;border-radius:20px;background:#f7fbffcc;border:1px solid #3978c829}.near-slide__copy span{display:block;color:#5c7697;font-size:12px}.near-slide__copy strong{display:block;margin-top:5px;color:#3978c8;font-size:clamp(1.5rem,4vw,2.6rem)}@media(max-width:720px){.near-slide{grid-template-columns:auto 1fr;gap:12px;align-items:start}.near-slide__copy h3{margin:5px 0 8px;font-size:1.25rem}.near-slide__copy article{padding:9px 10px;border-radius:14px}.near-slide__copy strong{font-size:1.25rem}}
</style>
