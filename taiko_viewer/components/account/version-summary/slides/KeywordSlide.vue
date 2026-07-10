<script setup lang="ts">
import { computed } from "vue";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import StorySlideShell from "../StorySlideShell.vue";

const props = defineProps<{
  summary: VersionSummaryViewModel;
  pageIndex: number;
  pageTotal: number;
  active: boolean;
  reducedMotion: boolean;
}>();

const { locale } = useI18n();
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

const entries = computed(() =>
  Object.entries(props.summary.keyword?.radarValues || {})
    .map(([key, value]) => ({
      key,
      label: dimensionLabels.value[key as keyof typeof dimensionLabels.value] || key,
      value: Number(value || 0)
    }))
    .sort((a, b) => b.value - a.value)
);

const formatWidth = (value: number) => `${Math.max(10, Math.min(100, value <= 1 ? value * 100 : value))}%`;
const formatValue = (value: number) => (value <= 1 ? `${(value * 100).toFixed(1)}%` : value.toFixed(1));
</script>

<template>
  <StorySlideShell
    :page-index="pageIndex"
    :page-total="pageTotal"
    :eyebrow="summary.copy.keyword.eyebrow"
    :title="summary.copy.keyword.title"
    :lead="summary.copy.keyword.body"
    :accent="summary.keyword?.dimensionLabel || summary.finalTitle.title"
    tone="aurora"
    :active="active"
    :reduced-motion="reducedMotion"
  >
    <div class="keyword-slide">
      <div class="keyword-slide__hero" data-animate>
        <img src="/radar-empty.svg" alt="" class="keyword-slide__radar" />
        <div class="keyword-slide__center">
          <span>{{ summary.keyword?.dimensionLabel || summary.finalTitle.eyebrow }}</span>
          <strong>{{ summary.keyword?.title || summary.finalTitle.title }}</strong>
        </div>
      </div>

      <div class="keyword-slide__bars">
        <article v-for="entry in entries" :key="entry.key" class="keyword-slide__bar" data-animate>
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
  position: relative;
  display: grid;
  place-items: center;
  overflow: hidden;
}

.keyword-slide__radar {
  width: min(24rem, 78%);
  opacity: 0.74;
  filter: drop-shadow(0 18px 34px rgba(8, 14, 28, 0.26));
}

.keyword-slide__center {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  text-align: center;
  gap: 8px;
}

.keyword-slide__center span {
  color: rgba(255, 230, 196, 0.72);
  font-size: 13px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.keyword-slide__center strong {
  color: #fff8ed;
  font-family: var(--viewer-display-font);
  font-size: clamp(2.2rem, 4vw, 3.8rem);
  line-height: 1.04;
  max-width: 12rem;
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

.keyword-slide__bar-head span {
  color: rgba(255, 230, 196, 0.72);
  letter-spacing: 0.12em;
  font-size: 12px;
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
</style>
