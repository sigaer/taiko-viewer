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

const themeClass = computed(() => `theme-${props.summary.finalTitle.themeKey || "encouragement"}`);
const { locale } = useI18n();
const keywordLabel = computed(() => (locale.value === "ja" ? "キーワード" : "关键词"));
</script>

<template>
  <StorySlideShell
    :page-index="pageIndex"
    :page-total="pageTotal"
    :eyebrow="summary.finalTitle.eyebrow"
    :title="summary.finalTitle.title"
    :lead="summary.finalTitle.body"
    :accent="summary.copy.finalTitle.eyebrow"
    tone="gold"
    :active="active"
    :reduced-motion="reducedMotion"
  >
    <div class="final-title-slide" :class="themeClass">
      <div class="final-title-slide__seal" data-animate>
        <span>{{ summary.version.name }}</span>
        <strong>{{ summary.finalTitle.title }}</strong>
      </div>

      <div class="final-title-slide__body">
        <article class="final-title-slide__panel" data-animate>
          <span>{{ summary.finalTitle.eyebrow }}</span>
          <strong>{{ summary.finalTitle.title }}</strong>
          <small>{{ summary.finalTitle.body }}</small>
        </article>

        <article class="final-title-slide__panel final-title-slide__panel--mini" data-animate>
          <span>{{ keywordLabel }}</span>
          <strong>{{ summary.poster.keyword }}</strong>
        </article>
      </div>
    </div>
  </StorySlideShell>
</template>

<style scoped>
.final-title-slide {
  display: grid;
  grid-template-columns: minmax(260px, 0.88fr) minmax(0, 1.12fr);
  gap: 18px;
  align-items: center;
}

.final-title-slide__seal,
.final-title-slide__panel {
  padding: 22px;
  border-radius: 30px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(16px);
}

.final-title-slide__seal {
  position: relative;
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  text-align: center;
  border-radius: 50%;
  overflow: hidden;
  box-shadow: 0 28px 60px rgba(5, 10, 27, 0.36);
}

.final-title-slide__seal::before,
.final-title-slide__seal::after {
  content: "";
  position: absolute;
  inset: 10%;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.22);
}

.final-title-slide__seal::after {
  inset: 18%;
  border-style: dashed;
  opacity: 0.6;
}

.final-title-slide__seal span,
.final-title-slide__panel span {
  display: block;
  color: rgba(255, 247, 234, 0.74);
  letter-spacing: 0.18em;
  font-size: 12px;
  text-transform: uppercase;
}

.final-title-slide__seal strong,
.final-title-slide__panel strong {
  display: block;
  margin-top: 10px;
  color: #fff8ed;
}

.final-title-slide__seal strong {
  font-family: var(--viewer-display-font);
  font-size: clamp(2.4rem, 4vw, 4rem);
  line-height: 1.04;
  max-width: 12rem;
}

.final-title-slide__body {
  display: grid;
  gap: 14px;
}

.final-title-slide__panel strong {
  font-size: clamp(2.1rem, 4vw, 3.2rem);
  line-height: 1.08;
}

.final-title-slide__panel small {
  display: block;
  margin-top: 14px;
  color: rgba(255, 237, 214, 0.8);
  line-height: 1.84;
}

.final-title-slide__panel--mini strong {
  font-size: clamp(1.8rem, 3vw, 2.4rem);
}

.theme-speed .final-title-slide__seal,
.theme-rhythm .final-title-slide__seal {
  background: linear-gradient(145deg, rgba(73, 164, 255, 0.6), rgba(255, 132, 92, 0.42));
}

.theme-accuracy .final-title-slide__seal,
.theme-big_song .final-title-slide__seal,
.theme-score_gain .final-title-slide__seal {
  background: linear-gradient(145deg, rgba(255, 188, 88, 0.72), rgba(255, 108, 76, 0.38));
}

.theme-complex .final-title-slide__seal,
.theme-stamina .final-title-slide__seal,
.theme-full_combo .final-title-slide__seal,
.theme-dondaful .final-title-slide__seal,
.theme-clear .final-title-slide__seal,
.theme-encouragement .final-title-slide__seal {
  background: linear-gradient(145deg, rgba(255, 108, 76, 0.68), rgba(255, 208, 118, 0.38));
}

@media (max-width: 960px) {
  .final-title-slide {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .final-title-slide__seal,
  .final-title-slide__panel {
    padding: 18px;
    border-radius: 24px;
  }

  .final-title-slide__seal {
    width: min(100%, 15.5rem);
    margin: 0 auto;
  }

  .final-title-slide__seal strong {
    font-size: clamp(2rem, 9vw, 3rem);
    max-width: 10rem;
  }
}
</style>
