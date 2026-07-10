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

const song = computed(() => props.summary.favoriteSong);
const { locale } = useI18n();
const uiText = computed(() => ({
  playLabel: locale.value === "ja" ? "プレイ回数" : "游玩次数",
  coverFallback: "虹2025"
}));
</script>

<template>
  <StorySlideShell
    :page-index="pageIndex"
    :page-total="pageTotal"
    :eyebrow="summary.copy.favoriteSong.eyebrow"
    :title="summary.copy.favoriteSong.title"
    :lead="summary.copy.favoriteSong.body"
    tone="sunrise"
    :active="active"
    :reduced-motion="reducedMotion"
  >
    <div class="song-slide">
      <div v-if="song" class="song-slide__cover" data-animate>
        <el-image :src="song.coverUrl" fit="cover" class="song-slide__image">
          <template #error>
            <div class="song-slide__image song-slide__image--fallback">{{ uiText.coverFallback }}</div>
          </template>
        </el-image>
      </div>

      <div class="song-slide__info">
        <article class="song-slide__panel" data-animate>
          <span>{{ song?.subtitle || summary.version.name }}</span>
          <strong>{{ song?.name || summary.copy.favoriteSong.title }}</strong>
          <div class="song-slide__chips">
            <span>{{ summary.version.name }}</span>
            <span v-if="song?.songNo">#{{ song.songNo }}</span>
          </div>
          <small>{{ summary.copy.favoriteSong.body }}</small>
        </article>

        <article class="song-slide__metric" data-animate>
          <span>{{ uiText.playLabel }}</span>
          <strong>
            <StoryCounter :value="song?.playCount || 0" :active="active" :reduced-motion="reducedMotion" />
          </strong>
        </article>
      </div>
    </div>
  </StorySlideShell>
</template>

<style scoped>
.song-slide {
  display: grid;
  grid-template-columns: minmax(260px, 360px) minmax(0, 1fr);
  gap: 20px;
  align-items: end;
}

.song-slide__cover {
  position: relative;
}

.song-slide__cover::after {
  content: "";
  position: absolute;
  inset: auto 10% -20px;
  height: 44px;
  border-radius: 999px;
  background: radial-gradient(circle, rgba(255, 166, 81, 0.28), rgba(255, 166, 81, 0));
  filter: blur(12px);
}

.song-slide__image {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 34px;
  overflow: hidden;
  background: linear-gradient(135deg, rgba(255, 205, 127, 0.28), rgba(255, 121, 84, 0.3));
  box-shadow: 0 26px 56px rgba(5, 10, 27, 0.34);
}

.song-slide__image--fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 248, 237, 0.86);
  font-family: var(--viewer-display-font);
  font-size: clamp(1.8rem, 3vw, 2.6rem);
  letter-spacing: 0.08em;
}

.song-slide__info {
  display: grid;
  gap: 14px;
}

.song-slide__panel,
.song-slide__metric {
  padding: 20px 22px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(16px);
}

.song-slide__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 14px;
}

.song-slide__chips span {
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 243, 224, 0.78);
  font-size: 11px;
  letter-spacing: 0.08em;
}

.song-slide__panel span,
.song-slide__metric span {
  display: block;
  color: rgba(255, 230, 196, 0.68);
  letter-spacing: 0.14em;
  font-size: 12px;
}

.song-slide__panel strong,
.song-slide__metric strong {
  display: block;
  margin-top: 10px;
  color: #fff8ed;
  font-size: clamp(2rem, 4vw, 3.4rem);
  line-height: 1.06;
}

.song-slide__panel small {
  display: block;
  margin-top: 14px;
  color: rgba(255, 237, 214, 0.76);
  line-height: 1.85;
}

@media (max-width: 900px) {
  .song-slide {
    grid-template-columns: 124px minmax(0, 1fr);
    align-items: start;
  }

  .song-slide__cover::after {
    inset: auto 10% -14px;
    height: 28px;
  }

  .song-slide__image {
    border-radius: 24px;
  }

  .song-slide__panel,
  .song-slide__metric {
    padding: 16px 18px;
    border-radius: 22px;
  }

  .song-slide__panel strong,
  .song-slide__metric strong {
    font-size: clamp(1.5rem, 4.6vw, 2.4rem);
  }

  .song-slide__panel small {
    margin-top: 12px;
    line-height: 1.72;
  }

  .song-slide__chips {
    margin-top: 12px;
    gap: 8px;
  }
}

@media (max-width: 520px) {
  .song-slide {
    grid-template-columns: 1fr;
  }
}
</style>
