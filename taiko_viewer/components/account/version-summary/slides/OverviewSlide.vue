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
        playCount: "プレイ回数",
        uniqueSongs: "触れた曲数",
        activeDays: "活動日数",
        estimatedTime: "推定時間",
        heat: "今期の熱量"
      }
    : {
        playCount: "游玩次数",
        uniqueSongs: "涉及歌曲",
        activeDays: "活跃天数",
        estimatedTime: "估算时长",
        heat: "这一版的热量"
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
        <div class="overview-slide__hero-head">
          <span>{{ uiText.playCount }}</span>
          <strong>
            <StoryCounter :value="summary.overview.playCount" :active="active" :reduced-motion="reducedMotion" />
          </strong>
        </div>
        <p>{{ summary.copy.overview.body }}</p>
        <div class="overview-slide__hero-pills">
          <span>{{ summary.overview.estimatedTimeText }}</span>
          <span>{{ summary.poster.shareCopy }}</span>
        </div>
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
          <small>{{ uiText.heat }} · {{ summary.poster.shareCopy }}</small>
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
  align-items: stretch;
  height: 100%;
  min-height: 0;
}

@media (max-height: 900px) {
  .overview-slide { gap: 10px; }
  .overview-slide__hero, .overview-slide__tile { padding: 14px; border-radius: 22px; }
  .overview-slide__hero { gap: 10px; }
  .overview-slide__hero strong { font-size: clamp(3rem, 7vw, 4.6rem); }
  .overview-slide__grid { gap: 8px; }
}

@media (max-width: 720px) and (max-height: 900px) {
  .overview-slide { grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); }
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
  display: grid;
  align-content: start;
  gap: 18px;
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

.overview-slide__hero-head {
  display: grid;
  gap: 10px;
}

.overview-slide__hero strong {
  font-family: var(--viewer-display-font);
  font-size: clamp(4rem, 8vw, 6.3rem);
  line-height: 0.9;
  color: #fff8ed;
}

.overview-slide__hero p {
  margin: 0;
  color: rgba(255, 240, 218, 0.88);
  font-size: 1rem;
  line-height: 1.78;
}

.overview-slide__hero-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.overview-slide__hero-pills span {
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 243, 224, 0.82);
  letter-spacing: 0.04em;
  text-transform: none;
}

.overview-slide__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.overview-slide__tile {
  display: grid;
  align-content: start;
  gap: 8px;
}

.overview-slide__tile strong {
  display: block;
  color: #fff8ed;
  font-size: clamp(2rem, 3.8vw, 3rem);
  line-height: 1.05;
}

.overview-slide__tile small {
  display: block;
  color: rgba(255, 237, 214, 0.76);
  line-height: 1.8;
}

.overview-slide__tile--wide {
  grid-column: span 2;
}

@media (max-width: 960px) {
  .overview-slide {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .overview-slide__hero,
  .overview-slide__tile {
    padding: 18px;
    border-radius: 24px;
  }

  .overview-slide__hero {
    gap: 14px;
  }

  .overview-slide__hero strong {
    font-size: clamp(3.1rem, 15vw, 4.8rem);
  }

  .overview-slide__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .overview-slide__tile--wide {
    grid-column: 1 / -1;
  }
}

@media (max-width: 420px) {
  .overview-slide__grid {
    grid-template-columns: 1fr;
  }

  .overview-slide__tile--wide {
    grid-column: span 1;
  }
}

@media (max-width: 720px) {
  .overview-slide { grid-template-columns: minmax(0, 0.86fr) minmax(0, 1.14fr); gap: 7px; align-items: stretch; }
  .overview-slide__hero, .overview-slide__tile { padding: 10px 11px; border-radius: 16px; }
  .overview-slide__hero { gap: 7px; }
  .overview-slide__hero strong { font-size: clamp(2.2rem, 12vw, 3.2rem); }
  .overview-slide__hero p { font-size: 0.72rem; line-height: 1.32; display: block; overflow: visible; }
  .overview-slide__hero-pills { display: flex; gap: 5px; }
  .overview-slide__hero-pills span { padding: 4px 6px; font-size: 8px; }
  .overview-slide__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
  .overview-slide__tile--wide { grid-column: 1 / -1; }
  .overview-slide__hero span, .overview-slide__tile span { font-size: 9px; letter-spacing: 0.08em; }
  .overview-slide__tile strong { font-size: clamp(1.15rem, 5vw, 1.55rem); overflow-wrap: anywhere; }
  .overview-slide__tile small { display: block; font-size: 0.68rem; line-height: 1.3; }
}
</style>
