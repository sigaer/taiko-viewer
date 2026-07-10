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
const uiText = computed(() =>
  locale.value === "ja"
    ? { finalTitle: "今期の称号", favorite: "よく戻った曲", keyword: "キーワード" }
    : { finalTitle: "这一版的称号", favorite: "反复回去的歌", keyword: "关键词" }
);
</script>

<template>
  <StorySlideShell
    :page-index="pageIndex"
    :page-total="pageTotal"
    :eyebrow="summary.copy.poster.eyebrow"
    :title="summary.copy.poster.title"
    :lead="summary.copy.poster.subtitle"
    :accent="summary.poster.periodLabel"
    tone="gold"
    :active="active"
    :reduced-motion="reducedMotion"
  >
    <div class="poster-slide">
      <div class="poster-slide__board" data-animate>
        <div class="poster-slide__board-head">
          <span>{{ summary.version.name }}</span>
          <h3>{{ summary.poster.title }}</h3>
          <p>{{ summary.poster.subtitle }}</p>
        </div>

        <div class="poster-slide__facts">
          <article v-for="item in summary.poster.stats" :key="item.label">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </article>
        </div>

        <div class="poster-slide__footer">
              <div>
            <span>{{ uiText.finalTitle }}</span>
            <strong>{{ summary.poster.finalTitle }}</strong>
          </div>
          <div>
            <span>{{ uiText.favorite }}</span>
            <strong>{{ summary.poster.favoriteSong }}</strong>
          </div>
          <div>
            <span>{{ uiText.keyword }}</span>
            <strong>{{ summary.poster.keyword }}</strong>
          </div>
        </div>
      </div>

      <article class="poster-slide__closing" data-animate>
        <span>{{ summary.poster.periodLabel }}</span>
        <strong>{{ summary.poster.shareCopy }}</strong>
        <small>{{ summary.poster.closingLine }}</small>
      </article>
    </div>
  </StorySlideShell>
</template>

<style scoped>
.poster-slide {
  display: grid;
  gap: 18px;
}

.poster-slide__board,
.poster-slide__closing {
  border-radius: 34px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(18px);
}

.poster-slide__board {
  padding: 26px;
  background:
    radial-gradient(circle at top right, rgba(255, 190, 96, 0.28), transparent 34%),
    linear-gradient(160deg, rgba(255, 248, 236, 0.96), rgba(255, 234, 208, 0.88));
  color: #552617;
  box-shadow: 0 30px 64px rgba(5, 10, 27, 0.38);
}

.poster-slide__board-head span,
.poster-slide__facts span,
.poster-slide__footer span,
.poster-slide__closing span {
  display: block;
  letter-spacing: 0.14em;
  font-size: 12px;
  text-transform: uppercase;
}

.poster-slide__board-head span,
.poster-slide__facts span,
.poster-slide__footer span {
  color: rgba(85, 38, 23, 0.64);
}

.poster-slide__board-head h3 {
  margin: 10px 0 12px;
  font-family: var(--viewer-display-font);
  font-size: clamp(2.2rem, 4.4vw, 4rem);
  line-height: 1.04;
}

.poster-slide__board-head p,
.poster-slide__closing small {
  margin: 0;
  color: rgba(85, 38, 23, 0.74);
  line-height: 1.82;
}

.poster-slide__facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-top: 18px;
}

.poster-slide__facts article,
.poster-slide__footer div {
  padding: 16px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.56);
  border: 1px solid rgba(85, 38, 23, 0.1);
}

.poster-slide__facts strong,
.poster-slide__footer strong {
  display: block;
  margin-top: 8px;
  font-size: clamp(1.3rem, 2.8vw, 2rem);
  line-height: 1.15;
}

.poster-slide__footer {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-top: 14px;
}

.poster-slide__closing {
  padding: 22px 24px;
  background: rgba(255, 255, 255, 0.08);
}

.poster-slide__closing span {
  color: rgba(255, 230, 196, 0.68);
}

.poster-slide__closing strong {
  display: block;
  margin-top: 10px;
  color: #fff8ed;
  font-size: clamp(1.8rem, 3.8vw, 3rem);
  line-height: 1.12;
}

.poster-slide__closing small {
  display: block;
  margin-top: 14px;
  color: rgba(255, 237, 214, 0.78);
}

@media (max-width: 720px) {
  .poster-slide__facts,
  .poster-slide__footer {
    grid-template-columns: 1fr;
  }

  .poster-slide__board {
    padding: 20px;
  }
}
</style>
