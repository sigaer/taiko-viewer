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
    ? { finalTitle: "今期の称号", favorite: "よく戻った曲", keyword: "キーワード", coverFallback: "虹2025" }
    : { finalTitle: "这一版的称号", favorite: "反复回去的歌", keyword: "关键词", coverFallback: "虹2025" }
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
        <div class="poster-slide__hero">
          <div class="poster-slide__board-head">
            <span>{{ summary.version.name }}</span>
            <h3>{{ summary.poster.title }}</h3>
            <p>{{ summary.poster.subtitle }}</p>
          </div>

          <div v-if="summary.favoriteSong" class="poster-slide__cover-card">
            <el-image :src="summary.favoriteSong.coverUrl" fit="cover" class="poster-slide__cover">
              <template #error>
                <div class="poster-slide__cover poster-slide__cover--fallback">{{ uiText.coverFallback }}</div>
              </template>
            </el-image>
          </div>
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

        <article class="poster-slide__closing">
          <span>{{ summary.poster.periodLabel }}</span>
          <strong>{{ summary.poster.shareCopy }}</strong>
          <small>{{ summary.poster.closingLine }}</small>
        </article>
      </div>
    </div>
  </StorySlideShell>
</template>

<style scoped>
.poster-slide {
  display: grid;
  height: 100%;
  min-height: 0;
}

.poster-slide__board,
.poster-slide__closing {
  border-radius: 34px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(18px);
}

.poster-slide__board {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 26px;
  background:
    radial-gradient(circle at top right, rgba(255, 190, 96, 0.28), transparent 34%),
    linear-gradient(160deg, rgba(255, 248, 236, 0.96), rgba(255, 234, 208, 0.88));
  color: #552617;
  box-shadow: 0 30px 64px rgba(5, 10, 27, 0.38);
}

.poster-slide__hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 18px;
  align-items: start;
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

.poster-slide__cover-card {
  width: 116px;
  flex-shrink: 0;
}

.poster-slide__cover {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 24px;
  overflow: hidden;
  background: linear-gradient(140deg, rgba(255, 199, 114, 0.38), rgba(255, 134, 87, 0.34));
  box-shadow: 0 18px 38px rgba(85, 38, 23, 0.16);
}

.poster-slide__cover--fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(85, 38, 23, 0.8);
  font-family: var(--viewer-display-font);
  font-size: 1.8rem;
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
  margin-top: auto;
  padding: 14px 16px 0;
  border: 0;
  border-top: 1px solid rgba(85, 38, 23, 0.12);
  border-radius: 0;
  backdrop-filter: none;
}

.poster-slide__closing span {
  color: rgba(85, 38, 23, 0.64);
}

.poster-slide__closing strong {
  display: block;
  margin-top: 10px;
  color: #552617;
  font-size: clamp(1.2rem, 2.5vw, 2rem);
  line-height: 1.12;
}

.poster-slide__closing small {
  display: block;
  margin-top: 14px;
  color: rgba(255, 237, 214, 0.78);
  color: rgba(85, 38, 23, 0.7);
}

@media (max-width: 720px) {
  .poster-slide__hero {
    grid-template-columns: minmax(0, 1fr) 86px;
    gap: 14px;
  }

  .poster-slide__cover-card {
    width: 86px;
  }

  .poster-slide__facts,
  .poster-slide__footer {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .poster-slide__board {
    padding: 16px;
  }

  .poster-slide__board,
  .poster-slide__closing {
    border-radius: 26px;
  }

  .poster-slide__facts article,
  .poster-slide__footer div {
    padding: 14px;
  }

  .poster-slide__footer div:last-child {
    grid-column: 1 / -1;
  }

}

@media (max-width: 420px) and (min-height: 901px) {
  .poster-slide__facts {
    grid-template-columns: 1fr;
  }
}

@media (max-height: 900px) {
  .poster-slide__board { padding: 16px; }
  .poster-slide__board-head h3 { margin: 6px 0; font-size: clamp(1.8rem, 3.6vw, 3rem); }
  .poster-slide__facts, .poster-slide__footer { gap: 8px; margin-top: 8px; }
  .poster-slide__facts article, .poster-slide__footer div { padding: 10px; border-radius: 16px; }
  .poster-slide__closing { margin-top: 8px; padding: 8px 10px 0; }
  .poster-slide__closing small { margin-top: 6px; line-height: 1.4; }
}

@media (max-width: 720px) and (max-height: 780px) {
  .poster-slide__cover-card { width: 62px; }
  .poster-slide__hero { grid-template-columns: minmax(0, 1fr) 62px; }
  .poster-slide__facts, .poster-slide__footer { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .poster-slide__footer div:last-child { grid-column: auto; }
  .poster-slide__facts strong, .poster-slide__footer strong { font-size: 1rem; }
  .poster-slide__closing small { display: block; }
}

@media (max-width: 720px) {
  .poster-slide__board { padding: 10px; border-radius: 18px; }
  .poster-slide__hero { grid-template-columns: minmax(0, 1fr) 64px; gap: 7px; }
  .poster-slide__cover-card { width: 64px; }
  .poster-slide__cover { border-radius: 12px; }
  .poster-slide__board-head h3 { margin: 4px 0; font-size: clamp(1.25rem, 6vw, 1.7rem); }
  .poster-slide__board-head p, .poster-slide__closing small { display: block; font-size: 0.68rem; line-height: 1.25; overflow: visible; }
  .poster-slide__facts, .poster-slide__footer { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; margin-top: 6px; }
  .poster-slide__footer div:last-child { grid-column: auto; }
  .poster-slide__facts article, .poster-slide__footer div { padding: 7px; border-radius: 12px; }
  .poster-slide__board-head span, .poster-slide__facts span, .poster-slide__footer span, .poster-slide__closing span { font-size: 8px; letter-spacing: 0.07em; }
  .poster-slide__facts strong, .poster-slide__footer strong { margin-top: 3px; font-size: 0.82rem; overflow-wrap: anywhere; }
  .poster-slide__closing { margin-top: 6px; padding: 6px 7px 0; }
  .poster-slide__closing strong { margin-top: 3px; font-size: 0.95rem; }
  .poster-slide__closing small { margin-top: 4px; color: rgba(85, 38, 23, 0.7); }
}
</style>
