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
    ? { play: "プレイ回数", days: "活動日数", songs: "触れた曲数", ongoing: "進行中" }
    : { play: "游玩次数", days: "活跃天数", songs: "涉及歌曲", ongoing: "进行中" }
);
</script>

<template>
  <StorySlideShell
    :page-index="pageIndex"
    :page-total="pageTotal"
    :eyebrow="summary.copy.opening.eyebrow"
    :title="summary.copy.opening.title"
    :lead="summary.copy.opening.subtitle"
    :accent="summary.version.isOngoing ? `${summary.version.name} · ${uiText.ongoing}` : summary.version.name"
    tone="ember"
    :active="active"
    :reduced-motion="reducedMotion"
  >
    <div class="opening-slide">
      <div class="opening-slide__drum" data-animate>
        <div class="opening-slide__drum-core">
          <span>{{ summary.finalTitle.title }}</span>
          <strong>{{ summary.version.name }}</strong>
        </div>
      </div>

      <div class="opening-slide__stats">
        <article class="opening-slide__stat" data-animate>
          <small>{{ uiText.play }}</small>
          <strong><StoryCounter :value="summary.overview.playCount" :active="active" :reduced-motion="reducedMotion" /></strong>
        </article>
        <article class="opening-slide__stat" data-animate>
          <small>{{ uiText.days }}</small>
          <strong><StoryCounter :value="summary.period.activeDays" :active="active" :reduced-motion="reducedMotion" /></strong>
        </article>
        <article class="opening-slide__stat" data-animate>
          <small>{{ uiText.songs }}</small>
          <strong><StoryCounter :value="summary.overview.uniqueSongs" :active="active" :reduced-motion="reducedMotion" /></strong>
        </article>
      </div>

      <div class="opening-slide__note" data-animate>
        <span>{{ summary.poster.favoriteSong }}</span>
        <strong>{{ summary.poster.finalTitle }}</strong>
      </div>
    </div>
  </StorySlideShell>
</template>

<style scoped>
.opening-slide {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr);
  gap: 22px;
  align-items: end;
  height: 100%;
}

.opening-slide__drum {
  min-height: 23rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.opening-slide__drum-core {
  width: min(26rem, 48vh, 72vw);
  aspect-ratio: 1;
  border-radius: 50%;
  padding: 1.6rem;
  display: grid;
  place-items: center;
  text-align: center;
  background:
    radial-gradient(circle at 50% 45%, rgba(255, 246, 224, 0.94) 0%, rgba(255, 222, 162, 0.95) 46%, rgba(253, 120, 76, 0.96) 78%, rgba(182, 43, 27, 0.98) 100%);
  box-shadow:
    inset 0 0 0 16px rgba(132, 26, 22, 0.42),
    0 36px 70px rgba(5, 10, 27, 0.42);
}

@media (max-height: 900px) {
  .opening-slide { gap: 12px; }
  .opening-slide__drum { min-height: 0; }
  .opening-slide__drum-core { width: min(18rem, 38vh, 55vw); }
  .opening-slide__stats { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .opening-slide__stat, .opening-slide__note { padding: 10px 12px; border-radius: 18px; }
  .opening-slide__note { grid-column: 1 / -1; }
}

@media (max-width: 720px) and (max-height: 780px) {
  .opening-slide__drum-core { width: min(10rem, 25vh, 42vw); }
  .opening-slide__note { display: flex; justify-content: space-between; gap: 12px; align-items: center; }
  .opening-slide__note strong { margin-top: 0; }
}

.opening-slide__drum-core span {
  color: rgba(104, 36, 20, 0.8);
  font-size: 14px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.opening-slide__drum-core strong {
  color: #6a1f15;
  font-family: var(--viewer-display-font);
  font-size: clamp(2.3rem, 4vw, 4rem);
  line-height: 1.02;
}

.opening-slide__stats {
  display: grid;
  gap: 14px;
}

.opening-slide__stat,
.opening-slide__note {
  padding: 18px 20px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(14px);
}

.opening-slide__stat small,
.opening-slide__note span {
  display: block;
  color: rgba(255, 230, 196, 0.68);
  letter-spacing: 0.14em;
  font-size: 12px;
}

.opening-slide__stat strong,
.opening-slide__note strong {
  display: block;
  margin-top: 10px;
  font-size: clamp(1.8rem, 3.2vw, 2.8rem);
  line-height: 1.08;
  color: #fff8ed;
}

.opening-slide__note strong {
  font-family: var(--viewer-display-font);
}

@media (max-width: 960px) {
  .opening-slide {
    grid-template-columns: 1fr;
    gap: 14px;
  }

  .opening-slide__drum {
    min-height: 20rem;
  }
}

@media (max-width: 720px) {
  .opening-slide {
    align-content: space-between;
  }

  .opening-slide__drum {
    min-height: auto;
  }

  .opening-slide__drum-core {
    width: min(13.5rem, 48vw);
    padding: 1rem;
    box-shadow:
      inset 0 0 0 11px rgba(132, 26, 22, 0.42),
      0 20px 44px rgba(5, 10, 27, 0.34);
  }

  .opening-slide__drum-core span {
    font-size: 11px;
  }

  .opening-slide__drum-core strong {
    font-size: clamp(1.9rem, 8vw, 2.8rem);
  }

  .opening-slide__stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }

  .opening-slide__stat,
  .opening-slide__note {
    padding: 12px 14px;
    border-radius: 20px;
  }

  .opening-slide__stat strong,
  .opening-slide__note strong {
    margin-top: 6px;
    font-size: clamp(1.05rem, 5.4vw, 1.7rem);
  }

  .opening-slide__note {
    grid-column: 1 / -1;
  }
}
</style>
