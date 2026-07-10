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
    ? { scoreUp: "スコア上昇", playDelta: "今回の増加", level: "難度", coverFallback: "虹2025" }
    : { scoreUp: "分数提升", playDelta: "本次增量", level: "难度", coverFallback: "虹2025" }
);
</script>

<template>
  <StorySlideShell
    :page-index="pageIndex"
    :page-total="pageTotal"
    :eyebrow="summary.copy.breakthrough.eyebrow"
    :title="summary.breakthrough.title"
    :lead="summary.breakthrough.body"
    :accent="summary.breakthrough.happenedLabel"
    tone="gold"
    :active="active"
    :reduced-motion="reducedMotion"
  >
    <div class="breakthrough-slide">
      <div class="breakthrough-slide__banner" data-animate>
        <span>{{ summary.breakthrough.happenedLabel }}</span>
        <strong>{{ summary.breakthrough.song?.name || summary.breakthrough.title }}</strong>
        <small>{{ summary.breakthrough.song?.subtitle || summary.copy.breakthrough.body }}</small>
      </div>

      <div class="breakthrough-slide__metrics">
        <article class="breakthrough-slide__metric" data-animate>
          <span>{{ uiText.scoreUp }}</span>
          <strong>+<StoryCounter :value="summary.breakthrough.scoreDelta" :active="active" :reduced-motion="reducedMotion" /></strong>
        </article>
        <article class="breakthrough-slide__metric" data-animate>
          <span>{{ uiText.playDelta }}</span>
          <strong>+<StoryCounter :value="summary.breakthrough.playDelta" :active="active" :reduced-motion="reducedMotion" /></strong>
        </article>
      </div>

      <div v-if="summary.breakthrough.song" class="breakthrough-slide__song" data-animate>
        <el-image :src="summary.breakthrough.song.coverUrl" fit="cover" class="breakthrough-slide__cover">
          <template #error>
            <div class="breakthrough-slide__cover breakthrough-slide__cover--fallback">{{ uiText.coverFallback }}</div>
          </template>
        </el-image>
        <div class="breakthrough-slide__song-meta">
          <span>{{ summary.breakthrough.song.level !== null ? `${uiText.level} ${summary.breakthrough.song.level}` : summary.version.name }}</span>
          <strong>{{ summary.breakthrough.song.name }}</strong>
        </div>
      </div>
    </div>
  </StorySlideShell>
</template>

<style scoped>
.breakthrough-slide {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 0.72fr);
  gap: 18px;
  align-items: stretch;
  height: 100%;
  min-height: 0;
}

@media (max-height: 900px) {
  .breakthrough-slide { grid-template-columns: minmax(0, 1fr) minmax(100px, 26vh); gap: 10px; }
  .breakthrough-slide__banner { grid-column: 1 / 2; }
  .breakthrough-slide__banner, .breakthrough-slide__metric, .breakthrough-slide__song { padding: 12px 14px; border-radius: 20px; }
  .breakthrough-slide__song { grid-column: 2; grid-row: 1 / span 2; }
}

@media (max-width: 720px) and (max-height: 900px) {
  .breakthrough-slide { grid-template-columns: minmax(0, 1fr) minmax(86px, 26vw); }
  .breakthrough-slide__cover { border-radius: 16px; }
}

.breakthrough-slide__banner,
.breakthrough-slide__metric,
.breakthrough-slide__song {
  padding: 22px;
  border-radius: 30px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(16px);
}

.breakthrough-slide__banner {
  grid-column: 1 / -1;
  position: relative;
  overflow: hidden;
}

.breakthrough-slide__banner::after {
  content: "";
  position: absolute;
  inset: -30% auto auto 60%;
  width: 16rem;
  height: 16rem;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 205, 122, 0.18), rgba(255, 205, 122, 0));
}

.breakthrough-slide__banner span,
.breakthrough-slide__song-meta span,
.breakthrough-slide__metric span {
  display: block;
  color: rgba(255, 230, 196, 0.68);
  letter-spacing: 0.14em;
  font-size: 12px;
}

.breakthrough-slide__banner strong,
.breakthrough-slide__metric strong,
.breakthrough-slide__song-meta strong {
  display: block;
  margin-top: 10px;
  color: #fff8ed;
  line-height: 1.08;
}

.breakthrough-slide__banner strong {
  font-size: clamp(2rem, 4.4vw, 3.6rem);
  max-width: 24rem;
}

.breakthrough-slide__banner small {
  display: block;
  margin-top: 14px;
  max-width: 36rem;
  color: rgba(255, 237, 214, 0.76);
  line-height: 1.84;
}

.breakthrough-slide__metrics {
  display: grid;
  gap: 14px;
}

.breakthrough-slide__metric strong {
  font-size: clamp(2rem, 4vw, 3.1rem);
}

.breakthrough-slide__song {
  display: grid;
  gap: 14px;
}

.breakthrough-slide__cover {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 28px;
  overflow: hidden;
  background: linear-gradient(135deg, rgba(255, 214, 126, 0.28), rgba(255, 129, 80, 0.3));
}

.breakthrough-slide__cover--fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 248, 237, 0.86);
  font-family: var(--viewer-display-font);
  font-size: clamp(1.8rem, 3vw, 2.6rem);
  letter-spacing: 0.08em;
}

@media (max-width: 960px) {
  .breakthrough-slide {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .breakthrough-slide__banner,
  .breakthrough-slide__metric,
  .breakthrough-slide__song {
    padding: 18px;
    border-radius: 24px;
  }

  .breakthrough-slide__cover {
    aspect-ratio: 1.14;
    border-radius: 22px;
  }

  .breakthrough-slide__banner strong {
    font-size: clamp(1.7rem, 7vw, 2.7rem);
  }

  .breakthrough-slide__metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .breakthrough-slide { grid-template-columns: minmax(0, 1fr) 92px; grid-template-rows: auto auto; gap: 7px; align-content: start; }
  .breakthrough-slide__banner { grid-column: 1; grid-row: 1; padding: 10px 11px; border-radius: 16px; }
  .breakthrough-slide__banner strong { margin-top: 5px; font-size: clamp(1.1rem, 5vw, 1.5rem); max-width: none; overflow-wrap: anywhere; }
  .breakthrough-slide__banner small { display: block; margin-top: 6px; font-size: 0.72rem; line-height: 1.32; overflow: visible; }
  .breakthrough-slide__metrics { grid-column: 1; grid-row: 2; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
  .breakthrough-slide__metric { padding: 9px 10px; border-radius: 15px; }
  .breakthrough-slide__metric strong { margin-top: 4px; font-size: 1.2rem; }
  .breakthrough-slide__song { grid-column: 2; grid-row: 1 / span 2; align-content: start; padding: 7px; border-radius: 16px; gap: 6px; }
  .breakthrough-slide__cover { aspect-ratio: 1; border-radius: 12px; }
  .breakthrough-slide__song-meta span { display: block; font-size: 8px; }
  .breakthrough-slide__song-meta strong { margin-top: 4px; font-size: 0.76rem; overflow-wrap: anywhere; }
  .breakthrough-slide__banner span, .breakthrough-slide__metric span { font-size: 9px; letter-spacing: 0.08em; }
}
</style>
