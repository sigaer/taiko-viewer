<script setup lang="ts">
import { computed } from "vue";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import StoryRadarChart from "../StoryRadarChart.vue";
import StorySlideShell from "../StorySlideShell.vue";

const props = defineProps<{
  summary: VersionSummaryViewModel;
  pageIndex: number;
  pageTotal: number;
  active: boolean;
  reducedMotion: boolean;
}>();

const { locale } = useI18n();
const profileKeyword = computed(() => props.summary.keywordProfile || props.summary.keyword);
const dimensionLabels = computed(() =>
  locale.value === "ja"
    ? {
        big_song: "大歌力",
        stamina: "体力",
        speed: "高速処理",
        accuracy: "精度力",
        rhythm: "リズム処理",
        complex: "複合処理"
      }
    : {
        big_song: "大歌力",
        stamina: "体力",
        speed: "高速处理",
        accuracy: "精度力",
        rhythm: "节奏处理",
        complex: "复合处理"
    }
);

const dimensionOrder = ["big_song", "stamina", "speed", "accuracy", "rhythm", "complex"] as const;
const radarEntries = computed(() =>
  dimensionOrder.map((key) => ({
    key,
    label: dimensionLabels.value[key as keyof typeof dimensionLabels.value] || key,
    value: Number(profileKeyword.value?.radarValues?.[key] || 0)
  }))
);
const rankedEntries = computed(() => [...radarEntries.value].sort((a, b) => b.value - a.value));
const radarLabels = computed(() => radarEntries.value.map((entry) => entry.label));
const radarValues = computed(() => radarEntries.value.map((entry) => entry.value));
const radarMax = computed(() => {
  const maxValue = Math.max(...radarValues.value, 0);
  if (maxValue <= 0) return 10;
  return Math.max(10, Math.ceil(maxValue * 2) / 2);
});
const uiText = computed(() =>
  locale.value === "ja"
    ? {
        source: "現在の taikob20 六次元",
        lead: "主軸",
        score: "Top20",
        axis: "輪郭"
      }
    : {
        source: "当前 taikob20 六维",
        lead: "主轴",
        score: "Top20",
        axis: "轮廓"
      }
);

const formatWidth = (value: number) => {
  if (value <= 0) return "0%";
  return `${Math.max(12, Math.min(100, (value / radarMax.value) * 100))}%`;
};
const formatValue = (value: number) => value.toFixed(1);
</script>

<template>
  <StorySlideShell
    :page-index="pageIndex"
    :page-total="pageTotal"
    :eyebrow="summary.copy.keyword.eyebrow"
    :title="summary.copy.keyword.title"
    :lead="summary.copy.keyword.body"
    :accent="profileKeyword?.dimensionLabel || summary.keyword?.dimensionLabel || summary.finalTitle.title"
    tone="aurora"
    :active="active"
    :reduced-motion="reducedMotion"
  >
    <div class="keyword-slide">
      <article class="keyword-slide__hero" data-animate>
        <div class="keyword-slide__hero-copy">
          <span>{{ uiText.source }}</span>
          <strong>{{ profileKeyword?.title || summary.keyword?.title || summary.finalTitle.title }}</strong>
          <small>{{ profileKeyword?.dimensionLabel || summary.keyword?.dimensionLabel || summary.finalTitle.eyebrow }}</small>
        </div>

        <div class="keyword-slide__hero-radar">
          <StoryRadarChart :labels="radarLabels" :values="radarValues" :max-value="radarMax" :aria-label="uiText.axis" />
        </div>

        <div class="keyword-slide__hero-meta">
          <div class="keyword-slide__metric">
            <span>{{ uiText.lead }}</span>
            <strong>{{ profileKeyword?.dimensionLabel || summary.keyword?.dimensionLabel || summary.finalTitle.eyebrow }}</strong>
          </div>
          <div class="keyword-slide__metric">
            <span>{{ uiText.score }}</span>
            <strong>{{ formatValue(profileKeyword?.score || summary.keyword?.score || 0) }}</strong>
          </div>
          <div class="keyword-slide__chips">
            <span v-for="entry in rankedEntries.slice(0, 3)" :key="entry.key">
              {{ entry.label }} · {{ formatValue(entry.value) }}
            </span>
          </div>
        </div>
      </article>

      <div class="keyword-slide__bars">
        <article v-for="entry in rankedEntries" :key="entry.key" class="keyword-slide__bar" data-animate>
          <div class="keyword-slide__bar-head">
            <span>{{ entry.label }}</span>
            <strong>{{ formatValue(entry.value) }}</strong>
          </div>
          <div class="keyword-slide__track">
            <i :style="{ width: formatWidth(entry.value) }"></i>
          </div>
        </article>
      </div>
    </div>
  </StorySlideShell>
</template>

<style scoped>
.keyword-slide {
  display: grid;
  grid-template-columns: minmax(280px, 0.92fr) minmax(0, 1.08fr);
  gap: 18px;
  align-items: stretch;
  height: 100%;
  min-height: 0;
}

@media (max-height: 900px) {
  .keyword-slide { gap: 10px; }
  .keyword-slide__hero, .keyword-slide__bar { padding: 12px 14px; border-radius: 20px; }
  .keyword-slide__hero-radar { max-height: min(30vh, 230px); }
  .keyword-slide__bars { gap: 7px; }
  .keyword-slide__bar:nth-child(n + 5) { display: none; }
}

@media (max-width: 720px) and (max-height: 900px) {
  .keyword-slide { grid-template-columns: minmax(0, 1.05fr) minmax(0, .95fr); }
  .keyword-slide__hero-meta { grid-template-columns: 1fr; }
  .keyword-slide__chips { display: none; }
  .keyword-slide__bar:nth-child(n + 4) { display: none; }
}

.keyword-slide__hero,
.keyword-slide__bar {
  padding: 22px;
  border-radius: 30px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(16px);
}

.keyword-slide__hero {
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 14px;
  overflow: hidden;
}

.keyword-slide__hero-copy {
  display: grid;
  gap: 8px;
}

.keyword-slide__hero-radar {
  display: grid;
  place-items: center;
  min-height: 0;
}

.keyword-slide__hero-copy span,
.keyword-slide__bar-head span,
.keyword-slide__metric span {
  color: rgba(255, 230, 196, 0.72);
  font-size: 13px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.keyword-slide__hero-copy strong {
  color: #fff8ed;
  font-family: var(--viewer-display-font);
  font-size: clamp(2rem, 3.6vw, 3.4rem);
  line-height: 1.04;
}

.keyword-slide__hero-copy small {
  color: rgba(255, 238, 214, 0.84);
  line-height: 1.7;
}

.keyword-slide__hero-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.keyword-slide__metric {
  padding: 16px 18px;
  border-radius: 22px;
  background: rgba(5, 14, 32, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.keyword-slide__metric strong {
  display: block;
  margin-top: 8px;
  color: #fff8ed;
  font-size: clamp(1.6rem, 2.6vw, 2.2rem);
  line-height: 1.1;
}

.keyword-slide__chips {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.keyword-slide__chips span {
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 243, 224, 0.84);
  font-size: 12px;
  letter-spacing: 0.06em;
}

.keyword-slide__bars {
  display: grid;
  gap: 14px;
}

.keyword-slide__bar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.keyword-slide__bar-head strong {
  color: #fff8ed;
}

.keyword-slide__track {
  height: 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.keyword-slide__track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #ff6d46, #ffd27b, #66c1ff);
}

@media (max-width: 960px) {
  .keyword-slide {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .keyword-slide__hero,
  .keyword-slide__bar {
    padding: 18px;
    border-radius: 24px;
  }

  .keyword-slide__hero-copy strong {
    font-size: clamp(1.7rem, 8vw, 2.6rem);
  }

  .keyword-slide__hero-copy small {
    font-size: 0.92rem;
    line-height: 1.6;
  }

  .keyword-slide__hero-meta {
    grid-template-columns: 1fr;
  }

  .keyword-slide__metric {
    padding: 14px 16px;
  }
}
</style>
