<script setup lang="ts">
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import AnnualDrumWindow from "../AnnualDrumWindow.vue";
import StorySlideShell from "../StorySlideShell.vue";
defineProps<{ summary: VersionSummaryViewModel; pageIndex: number; pageTotal: number; active: boolean; reducedMotion: boolean }>();
const { t, n } = useI18n();
</script>
<template>
  <StorySlideShell :page-index="pageIndex" :page-total="pageTotal" :eyebrow="summary.copy.challenge.eyebrow" :title="summary.copy.challenge.title" :lead="summary.copy.challenge.body" tone="royal" :active="active" :reduced-motion="reducedMotion">
    <div v-if="summary.challenge" class="challenge-slide">
      <AnnualDrumWindow data-animate size="large" :image-url="summary.challenge.song.coverUrl" :image-alt="summary.challenge.song.name" :fallback="t('annualSummary.common.defaultCover')" />
      <div class="challenge-slide__copy">
        <span data-animate>{{ t('annualSummary.slides.challenge.total') }}</span>
        <strong data-animate>{{ n(summary.challenge.playCount) }}</strong>
        <small v-if="summary.challenge.observedPlayCount !== summary.challenge.playCount" data-animate>{{ t('annualSummary.slides.challenge.observedInPeriod', { count: n(summary.challenge.observedPlayCount) }) }}</small>
        <h3 data-animate>{{ summary.challenge.song.name }}</h3>
        <p data-animate>{{ t('annualSummary.slides.challenge.story') }}</p>
      </div>
    </div>
  </StorySlideShell>
</template>
<style scoped>
.challenge-slide{height:100%;display:grid;grid-template-columns:minmax(220px,.85fr) minmax(0,1.15fr);gap:clamp(18px,5vw,64px);align-items:center}.challenge-slide__copy>span{color:#3978c8;font-size:12px;letter-spacing:.12em}.challenge-slide__copy>strong{display:block;color:#3978c8;font:700 clamp(4rem,11vw,8rem)/.9 var(--viewer-display-font)}.challenge-slide__copy>small{display:block;margin-top:7px;color:#5c7697;font-size:11px}.challenge-slide__copy h3{margin:12px 0 8px;color:#17365d;font:700 clamp(1.5rem,4vw,3rem)/1.08 var(--viewer-display-font);overflow-wrap:anywhere}.challenge-slide__copy p{margin:0;color:#5c7697;line-height:1.7}@media(max-width:720px){.challenge-slide{grid-template-columns:auto 1fr;gap:12px;align-items:start}.challenge-slide__copy>strong{font-size:3rem}.challenge-slide__copy h3{margin:5px 0;font-size:1.2rem}.challenge-slide__copy p{font-size:12px;line-height:1.45}}
</style>
