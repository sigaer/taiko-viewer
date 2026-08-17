<script setup lang="ts">
import { computed, ref } from "vue";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import AnnualArtworkFallback from "../AnnualArtworkFallback.vue";
import AnimatedNumber from "../AnimatedNumber.vue";
import ParticleLayer from "../ParticleLayer.vue";
import TaikoRipple from "../TaikoRipple.vue";
import StorySlideShell from "../StorySlideShell.vue";
import { isUsableMetric, hasUsableText } from "~/utils/annualPresentation";

const props = defineProps<{
  summary: VersionSummaryViewModel;
  pageIndex: number;
  pageTotal: number;
  active: boolean;
  reducedMotion: boolean;
}>();

const song = computed(() => props.summary.favoriteSong);
const hasSong = computed(() => Boolean(song.value && hasUsableText(song.value.name)));
const hasPlayCount = computed(() => isUsableMetric(song.value?.playCount));
const songNameClass = computed(() => {
  const length = Array.from(song.value?.name || "").length;
  return length > 32 ? "is-long" : length > 20 ? "is-compact" : "";
});
const feedbackTrigger = ref(0);
const drumPulse = ref(false);
const { locale } = useI18n();
const uiText = computed(() => ({
  playLabel: locale.value === "ja" ? "太鼓記録" : "鼓点记录",
  coverFallback: "2026"
}));

const onNumberComplete = () => {
  if (!props.active || !hasPlayCount.value || drumPulse.value) return;
  drumPulse.value = true;
  feedbackTrigger.value += 1;
  window.setTimeout(() => { drumPulse.value = false; }, 420);
};
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
    <template #atmosphere>
      <ParticleLayer :active="active" :reduced-motion="reducedMotion" density="low" palette="rainbow" />
    </template>
    <div class="song-slide" :class="{ 'is-pulsing': drumPulse, 'is-solo': !hasSong }">
      <div v-if="hasSong" class="song-slide__cover" data-annual-stage="visual">
        <el-image :src="song.coverUrl" fit="cover" class="song-slide__image">
          <template #error>
            <AnnualArtworkFallback :label="uiText.coverFallback" />
          </template>
        </el-image>
      </div>

      <div class="song-slide__info">
        <article v-if="hasSong" class="song-slide__panel" data-annual-stage="title">
          <span>{{ song?.subtitle || summary.version.name }}</span>
          <strong :class="songNameClass">{{ song?.name || summary.copy.favoriteSong.title }}</strong>
          <div class="song-slide__chips">
            <span>{{ summary.version.name }}</span>
            <span v-if="song?.songNo">#{{ song.songNo }}</span>
          </div>
          <small>{{ summary.copy.favoriteSong.body }}</small>
        </article>

        <article v-if="hasPlayCount" class="song-slide__metric" data-annual-stage="data">
          <span>{{ uiText.playLabel }}</span>
          <strong>
            <AnimatedNumber :value="song?.playCount || 0" :active="active" :reduced-motion="reducedMotion" :delay="1100" @complete="onNumberComplete" />
          </strong>
        </article>
        <p v-else class="song-slide__closing" data-annual-stage="copy">{{ locale === "ja" ? "この曲との余韻を、ここにしまいました。" : "这一次相遇，先把余韵收在这里。" }}</p>
      </div>
    </div>
    <TaikoRipple class="song-slide__ripple" :active="active" :reduced-motion="reducedMotion" :trigger="feedbackTrigger" mode="ambient" origin-x="34%" origin-y="50%" />
  </StorySlideShell>
</template>

<style scoped>
.song-slide {
  display: grid;
  grid-template-columns: minmax(260px, 360px) minmax(0, 1fr);
  gap: 20px;
  align-items: end;
  height: 100%;
  min-height: 0;
}
.song-slide.is-solo { grid-template-columns: minmax(0, 1fr); justify-items: center; }
.song-slide.is-solo .song-slide__info { width: min(100%, 32rem); }
.song-slide.is-pulsing .song-slide__image { animation: song-drum-pulse .42s ease-out; }
.song-slide__closing { margin: 0; color: rgba(255,237,214,.8); line-height: 1.7; }
.song-slide__ripple { z-index: 6; }
@keyframes song-drum-pulse { 0%,100% { transform: scale(1); } 36% { transform: scale(1.025); } 65% { transform: scale(.99); } }

@media (max-height: 900px) {
  .song-slide { grid-template-columns: minmax(110px, 30vh) minmax(0, 1fr); gap: 12px; }
  .song-slide__panel, .song-slide__metric { padding: 12px 14px; border-radius: 20px; }
}

@media (max-width: 520px) and (max-height: 900px) {
  .song-slide { grid-template-columns: minmax(92px, 26vw) minmax(0, 1fr); }
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
  background: radial-gradient(circle, rgba(57, 120, 200, 0.24), rgba(57, 120, 200, 0));
  filter: blur(12px);
}

.song-slide__image {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 34px;
  overflow: hidden;
  background: linear-gradient(135deg, rgba(229, 241, 255, 0.92), rgba(57, 120, 200, 0.24));
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
  overflow-wrap: anywhere;
}
.song-slide__panel strong.is-compact { font-size: clamp(1.55rem, 3.4vw, 2.7rem); }
.song-slide__panel strong.is-long { font-size: clamp(1.2rem, 2.8vw, 2.1rem); line-height: 1.18; }

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

@media (max-width: 720px) {
  .song-slide { grid-template-columns: 92px minmax(0, 1fr); gap: 8px; align-items: start; }
  .song-slide__image { border-radius: 16px; }
  .song-slide__info { gap: 6px; }
  .song-slide__panel, .song-slide__metric { padding: 10px 11px; border-radius: 16px; }
  .song-slide__panel span, .song-slide__metric span { font-size: 10px; letter-spacing: 0.08em; }
  .song-slide__panel strong, .song-slide__metric strong { margin-top: 5px; font-size: clamp(1.05rem, 5vw, 1.45rem); overflow-wrap: anywhere; }
  .song-slide__panel small { display: block; margin-top: 7px; font-size: 0.75rem; line-height: 1.32; overflow: visible; }
  .song-slide__chips { display: flex; margin-top: 7px; gap: 4px; }
  .song-slide__chips span { padding: 3px 5px; font-size: 10px; }
}

@media (orientation: landscape) and (min-width: 721px) and (max-height: 460px) {
  .song-slide { grid-template-columns: minmax(130px, 36vh) minmax(0, 1fr); gap: 14px; align-items: center; }
  .song-slide__image { border-radius: 20px; }
  .song-slide__info { grid-template-columns: minmax(0, 1fr) minmax(125px, 0.34fr); gap: 8px; align-items: stretch; }
  .song-slide__panel,
  .song-slide__metric { padding: 10px 12px; border-radius: 18px; }
  .song-slide__panel strong,
  .song-slide__metric strong { margin-top: 5px; font-size: clamp(1.35rem, 3vw, 1.9rem); }
  .song-slide__panel small { margin-top: 7px; line-height: 1.4; }
  .song-slide__chips { margin-top: 7px; gap: 5px; }
  .song-slide__chips span { padding: 4px 7px; }
  .song-slide__metric { display: grid; align-content: center; }
}
</style>
