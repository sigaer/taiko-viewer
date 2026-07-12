<script setup lang="ts">
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import AnnualDrumWindow from "../AnnualDrumWindow.vue";
import StorySlideShell from "../StorySlideShell.vue";

defineProps<{ summary: VersionSummaryViewModel; pageIndex: number; pageTotal: number; active: boolean; reducedMotion: boolean }>();
const { t } = useI18n();
</script>

<template>
  <StorySlideShell
    :page-index="pageIndex" :page-total="pageTotal"
    :eyebrow="summary.copy.speedProfile.eyebrow"
    :title="summary.copy.speedProfile.title"
    :lead="summary.copy.speedProfile.body"
    tone="royal" :active="active" :reduced-motion="reducedMotion"
  >
    <div v-if="summary.speedProfile" class="speed-slide">
      <AnnualDrumWindow data-animate size="large">
        <div class="speed-slide__number">
          <strong>{{ summary.speedProfile.speed }}</strong><span>×</span>
        </div>
      </AnnualDrumWindow>
      <div class="speed-slide__story">
        <p data-animate>{{ t('annualSummary.slides.speed.story', { speed: summary.speedProfile.speed }) }}</p>
        <article data-animate>
          <span>{{ t('annualSummary.slides.speed.chartCount') }}</span>
          <strong>{{ summary.speedProfile.chartCount }}</strong>
          <small>{{ t('annualSummary.slides.speed.detail') }}</small>
        </article>
      </div>
    </div>
  </StorySlideShell>
</template>

<style scoped>
.speed-slide { height: 100%; display: grid; grid-template-columns: minmax(220px, .85fr) minmax(0, 1.15fr); align-items: center; gap: clamp(18px, 5vw, 64px); }
.speed-slide__number { display: flex; align-items: baseline; color: #17365d; }
.speed-slide__number strong { font: 700 clamp(4rem, 14vw, 9rem)/.8 var(--viewer-display-font); }
.speed-slide__number span { color: #3978c8; font-size: clamp(1.8rem, 5vw, 3.6rem); }
.speed-slide__story > p { margin: 0 0 18px; color: #17365d; font: 700 clamp(1.4rem, 3.5vw, 2.6rem)/1.35 var(--viewer-display-font); }
.speed-slide__story article { padding: 20px; border-radius: 22px; background: rgba(247,251,255,.8); border: 1px solid rgba(57,120,200,.16); }
.speed-slide__story span,.speed-slide__story small { display:block; color:#5c7697; font-size:12px; }
.speed-slide__story strong { display:block; margin:7px 0; color:#3978c8; font-size:2.4rem; }
@media(max-width:720px){.speed-slide{grid-template-columns:auto 1fr;gap:12px;align-items:start}.speed-slide__story>p{font-size:1.05rem;margin-bottom:8px}.speed-slide__story article{padding:10px;border-radius:15px}.speed-slide__story strong{font-size:1.5rem}}
</style>
