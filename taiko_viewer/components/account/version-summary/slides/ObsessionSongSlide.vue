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

const song = computed(() => props.summary.obsessionSong);
const { locale } = useI18n();
const uiText = computed(() =>
  locale.value === "ja"
    ? { activeDays: "活動日数", playCount: "プレイ回数", memory: "余韻", coverFallback: "虹2025" }
    : { activeDays: "活跃天数", playCount: "游玩次数", memory: "回响", coverFallback: "虹2025" }
);
</script>

<template>
  <StorySlideShell
    :page-index="pageIndex"
    :page-total="pageTotal"
    :eyebrow="summary.copy.obsessionSong.eyebrow"
    :title="summary.copy.obsessionSong.title"
    :lead="summary.copy.obsessionSong.body"
    tone="royal"
    :active="active"
    :reduced-motion="reducedMotion"
  >
    <div class="obsession-slide">
      <div class="obsession-slide__memory" data-animate>
        <el-image v-if="song" :src="song.coverUrl" fit="cover" class="obsession-slide__cover">
          <template #error>
            <div class="obsession-slide__cover obsession-slide__cover--fallback">{{ uiText.coverFallback }}</div>
          </template>
        </el-image>
        <div class="obsession-slide__echoes">
          <span v-for="index in Math.min(song?.activeDays || 0, 7)" :key="index"></span>
        </div>
      </div>

      <div class="obsession-slide__metrics">
        <article class="obsession-slide__metric" data-animate>
          <span>{{ uiText.activeDays }}</span>
          <strong><StoryCounter :value="song?.activeDays || 0" :active="active" :reduced-motion="reducedMotion" /></strong>
        </article>
        <article class="obsession-slide__metric" data-animate>
          <span>{{ uiText.playCount }}</span>
          <strong><StoryCounter :value="song?.playCount || 0" :active="active" :reduced-motion="reducedMotion" /></strong>
        </article>
        <article class="obsession-slide__metric obsession-slide__metric--wide" data-animate>
          <span>{{ uiText.memory }}</span>
          <strong>{{ song?.name || summary.copy.obsessionSong.title }}</strong>
          <small>{{ summary.copy.obsessionSong.body }}</small>
        </article>
      </div>
    </div>
  </StorySlideShell>
</template>

<style scoped>
.obsession-slide {
  display: grid;
  grid-template-columns: minmax(300px, 0.92fr) minmax(0, 1.08fr);
  gap: 18px;
  align-items: stretch;
  height: 100%;
  min-height: 0;
}

@media (max-height: 900px) {
  .obsession-slide { grid-template-columns: minmax(110px, 30vh) minmax(0, 1fr); gap: 10px; }
  .obsession-slide__metric { padding: 12px 14px; border-radius: 20px; }
  .obsession-slide__metric small { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
}

@media (max-width: 720px) and (max-height: 900px) {
  .obsession-slide { grid-template-columns: minmax(94px, 28vw) minmax(0, 1fr); }
  .obsession-slide__memory { grid-template-columns: 1fr; }
  .obsession-slide__echoes { display: none; }
}

.obsession-slide__memory,
.obsession-slide__metric {
  padding: 22px;
  border-radius: 30px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(16px);
}

.obsession-slide__memory {
  display: grid;
  gap: 16px;
}

.obsession-slide__cover {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 30px;
  overflow: hidden;
  background: linear-gradient(135deg, rgba(111, 175, 255, 0.22), rgba(255, 147, 101, 0.24));
}

.obsession-slide__cover--fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 248, 237, 0.86);
  font-family: var(--viewer-display-font);
  font-size: clamp(1.8rem, 3vw, 2.6rem);
  letter-spacing: 0.08em;
}

.obsession-slide__echoes {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.obsession-slide__echoes span {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(255, 196, 110, 0.9), rgba(255, 118, 78, 0.9));
  box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.04);
}

.obsession-slide__metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.obsession-slide__metric span {
  display: block;
  color: rgba(255, 230, 196, 0.68);
  letter-spacing: 0.14em;
  font-size: 12px;
}

.obsession-slide__metric strong {
  display: block;
  margin-top: 10px;
  color: #fff8ed;
  font-size: clamp(2rem, 3.8vw, 3rem);
  line-height: 1.08;
}

.obsession-slide__metric small {
  display: block;
  margin-top: 14px;
  color: rgba(255, 237, 214, 0.76);
  line-height: 1.84;
}

.obsession-slide__metric--wide {
  grid-column: span 2;
}

@media (max-width: 960px) {
  .obsession-slide {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .obsession-slide {
    grid-template-columns: 118px minmax(0, 1fr);
    align-items: start;
  }

  .obsession-slide__memory,
  .obsession-slide__metric {
    padding: 16px;
    border-radius: 22px;
  }

  .obsession-slide__cover {
    border-radius: 22px;
  }

  .obsession-slide__echoes {
    gap: 8px;
  }

  .obsession-slide__echoes span {
    width: 14px;
    height: 14px;
    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.04);
  }

  .obsession-slide__metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .obsession-slide__metric--wide {
    grid-column: 1 / -1;
  }

  .obsession-slide__metric strong {
    font-size: clamp(1.4rem, 5vw, 2.1rem);
  }

  .obsession-slide__metric small {
    margin-top: 12px;
    line-height: 1.72;
  }
}

@media (max-width: 420px) {
  .obsession-slide {
    grid-template-columns: 1fr;
  }

  .obsession-slide__metrics {
    grid-template-columns: 1fr;
  }

  .obsession-slide__metric--wide {
    grid-column: span 1;
  }
}
</style>
