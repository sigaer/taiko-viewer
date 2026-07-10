<script setup lang="ts">
import { computed } from "vue";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import StoryCounter from "../StoryCounter.vue";
import StorySlideShell from "../StorySlideShell.vue";

const props = defineProps<{
  summary: VersionSummaryViewModel;
  pageIndex: number;
  pageTotal: number;
  active: boolean;
  reducedMotion: boolean;
}>();

const { locale } = useI18n();
const uiText = computed(() =>
  locale.value === "ja"
    ? {
        uniqueSongs: "触れた曲数",
        activeDays: "活動日数",
        estimatedTime: "推定時間"
      }
    : {
        uniqueSongs: "涉及歌曲",
        activeDays: "活跃天数",
        estimatedTime: "估算时长"
      }
);
</script>

<template>
  <StorySlideShell
    :page-index="pageIndex"
    :page-total="pageTotal"
    :eyebrow="summary.copy.overview.eyebrow"
    :title="summary.copy.overview.title"
    :lead="summary.copy.overview.body"
    tone="aurora"
    :active="active"
    :reduced-motion="reducedMotion"
  >
    <div class="overview-slide">
      <article class="overview-slide__hero" data-animate>
        <span>{{ summary.copy.overview.eyebrow }}</span>
        <strong>
          <StoryCounter :value="summary.overview.playCount" :active="active" :reduced-motion="reducedMotion" />
        </strong>
        <p>{{ summary.overview.estimatedTimeText }}</p>
      </article>

      <div class="overview-slide__grid">
        <article class="overview-slide__tile" data-animate>
          <span>{{ uiText.uniqueSongs }}</span>
          <strong><StoryCounter :value="summary.overview.uniqueSongs" :active="active" :reduced-motion="reducedMotion" /></strong>
        </article>
        <article class="overview-slide__tile" data-animate>
          <span>{{ uiText.activeDays }}</span>
          <strong><StoryCounter :value="summary.period.activeDays" :active="active" :reduced-motion="reducedMotion" /></strong>
        </article>
        <article class="overview-slide__tile overview-slide__tile--wide" data-animate>
          <span>{{ uiText.estimatedTime }}</span>
          <strong>{{ summary.overview.estimatedTimeText }}</strong>
          <small>{{ summary.poster.shareCopy }}</small>
        </article>
      </div>
    </div>
  </StorySlideShell>
</template>

<style scoped>
.overview-slide {
  display: grid;
  grid-template-columns: minmax(300px, 0.95fr) minmax(0, 1.05fr);
  gap: 18px;
}

.overview-slide__hero,
.overview-slide__tile {
  padding: 22px;
  border-radius: 30px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(16px);
}

.overview-slide__hero {
  display: flex;
  flex-direction: column;
  justify-content: end;
  min-height: 26rem;
  background:
    radial-gradient(circle at top left, rgba(255, 201, 116, 0.18), transparent 38%),
    rgba(255, 255, 255, 0.08);
}

.overview-slide__hero span,
.overview-slide__tile span {
  color: rgba(255, 230, 196, 0.68);
  letter-spacing: 0.14em;
  font-size: 12px;
}

.overview-slide__hero strong {
  margin-top: 12px;
  font-family: var(--viewer-display-font);
  font-size: clamp(5rem, 9vw, 7rem);
  line-height: 0.9;
  color: #fff8ed;
}

.overview-slide__hero p {
  margin: 16px 0 0;
  color: rgba(255, 240, 218, 0.88);
  font-size: 18px;
}

.overview-slide__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.overview-slide__tile {
  min-height: 12rem;
}

.overview-slide__tile strong {
  display: block;
  margin-top: 10px;
  color: #fff8ed;
  font-size: clamp(2rem, 3.8vw, 3rem);
  line-height: 1.05;
}

.overview-slide__tile small {
  display: block;
  margin-top: 14px;
  color: rgba(255, 237, 214, 0.76);
  line-height: 1.8;
}

.overview-slide__tile--wide {
  grid-column: span 2;
  min-height: 14rem;
}

@media (max-width: 960px) {
  .overview-slide {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .overview-slide__grid {
    grid-template-columns: 1fr;
  }

  .overview-slide__tile--wide {
    grid-column: span 1;
  }
}
</style>
