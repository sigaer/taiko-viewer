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

const { t } = useI18n();
const profileKeyword = computed(() => props.summary.keywordProfile || props.summary.keyword);
const dimensionOrder = ["big_song", "stamina", "speed", "accuracy", "rhythm", "complex"] as const;
const radarEntries = computed(() => dimensionOrder.map((key) => ({
  key,
  label: t(`annualSummary.keywords.dimensions.${key}`),
  value: Number(profileKeyword.value?.radarValues?.[key] || 0)
})));
const rankedEntries = computed(() => [...radarEntries.value].sort((a, b) => b.value - a.value));
const radarLabels = computed(() => radarEntries.value.map((entry) => entry.label));
const radarValues = computed(() => radarEntries.value.map((entry) => entry.value));
const radarMax = computed(() => {
  const maxValue = Math.max(...radarValues.value, 0);
  return maxValue <= 0 ? 10 : Math.max(10, Math.ceil(maxValue * 2) / 2);
});
</script>

<template>
  <StorySlideShell
    :page-index="pageIndex"
    :page-total="pageTotal"
    :eyebrow="summary.copy.keyword.eyebrow"
    :title="summary.copy.keyword.title"
    :lead="summary.copy.keyword.body"
    :accent="profileKeyword?.dimensionLabel || summary.finalTitle.title"
    tone="aurora"
    :active="active"
    :reduced-motion="reducedMotion"
  >
    <div class="keyword-slide">
      <article class="keyword-slide__hero" data-animate>
        <div class="keyword-slide__radar">
          <StoryRadarChart
            :labels="radarLabels"
            :values="radarValues"
            :max-value="radarMax"
            :aria-label="t('annualSummary.slides.keyword.shape')"
          />
        </div>
        <div class="keyword-slide__copy">
          <span>{{ t('annualSummary.slides.keyword.signature') }}</span>
          <strong>{{ profileKeyword?.title || summary.finalTitle.title }}</strong>
          <p>{{ t('annualSummary.slides.keyword.story') }}</p>
          <div class="keyword-slide__seal">
            <small>{{ t('annualSummary.slides.keyword.brightest') }}</small>
            <b>{{ profileKeyword?.dimensionLabel || summary.finalTitle.eyebrow }}</b>
          </div>
          <div class="keyword-slide__chips">
            <span v-for="entry in rankedEntries.slice(0, 3)" :key="entry.key">{{ entry.label }}</span>
          </div>
        </div>
      </article>
    </div>
  </StorySlideShell>
</template>

<style scoped>
.keyword-slide { height: 100%; min-height: 0; }
.keyword-slide__hero {
  height: 100%;
  display: grid;
  grid-template-columns: minmax(250px, .9fr) minmax(0, 1.1fr);
  gap: clamp(20px, 5vw, 64px);
  align-items: center;
  padding: clamp(18px, 4vw, 38px);
  border: 1px solid rgba(57, 120, 200, .18);
  border-radius: 34px;
  background: radial-gradient(circle at 22% 45%, rgba(155, 201, 255, .32), transparent 35%), rgba(247, 251, 255, .86);
  box-shadow: 0 18px 44px rgba(23, 54, 93, .1);
}
.keyword-slide__radar {
  display: grid;
  place-items: center;
  width: min(100%, 390px);
  aspect-ratio: 1;
  justify-self: center;
  padding: clamp(16px, 3vw, 28px);
  border: 8px solid #3978c8;
  border-radius: 50%;
  background: #fff;
  box-shadow: inset 0 0 0 7px #e5f1ff, 0 20px 46px rgba(23, 54, 93, .14);
}
.keyword-slide__copy { display: grid; align-content: center; gap: 12px; min-width: 0; }
.keyword-slide__copy > span { color: #3978c8; font-size: 12px; letter-spacing: .16em; }
.keyword-slide__copy > strong {
  color: #17365d;
  font: 700 clamp(2.2rem, 5vw, 4.5rem)/1.04 var(--viewer-display-font);
  overflow-wrap: anywhere;
}
.keyword-slide__copy p { margin: 0; color: #5c7697; line-height: 1.75; }
.keyword-slide__seal {
  display: grid;
  gap: 5px;
  width: fit-content;
  padding: 11px 16px;
  border: 1px solid rgba(57, 120, 200, .26);
  border-radius: 17px;
  background: #e5f1ff;
  transform: rotate(-2deg);
}
.keyword-slide__seal small { color: #5c7697; font-size: 10px; }
.keyword-slide__seal b { color: #17365d; font-size: clamp(1.15rem, 2.5vw, 1.8rem); }
.keyword-slide__chips { display: flex; flex-wrap: wrap; gap: 7px; }
.keyword-slide__chips span { padding: 7px 11px; border-radius: 999px; color: #3978c8; background: rgba(229, 241, 255, .8); font-size: 12px; }

@media (max-width: 720px) {
  .keyword-slide__hero { grid-template-columns: minmax(118px, .8fr) minmax(0, 1.2fr); gap: 10px; padding: 10px; border-radius: 20px; }
  .keyword-slide__radar { width: 100%; padding: 9px; border-width: 5px; box-shadow: inset 0 0 0 4px #e5f1ff, 0 10px 24px rgba(23, 54, 93, .12); }
  .keyword-slide__copy { gap: 7px; }
  .keyword-slide__copy > span { font-size: 10px; }
  .keyword-slide__copy > strong { font-size: clamp(1.35rem, 6vw, 2rem); }
  .keyword-slide__copy p { font-size: 12px; line-height: 1.4; }
  .keyword-slide__seal { padding: 7px 10px; border-radius: 12px; }
  .keyword-slide__seal b { font-size: 1rem; }
  .keyword-slide__chips span { padding: 5px 8px; font-size: 10px; }
}

@media (orientation: landscape) and (min-width: 721px) and (max-height: 460px) {
  .keyword-slide__hero { grid-template-columns: minmax(170px, 205px) minmax(0, 1fr); gap: 18px; padding: 9px 16px; border-radius: 22px; }
  .keyword-slide__radar { width: min(100%, 195px); padding: 9px; border-width: 5px; box-shadow: inset 0 0 0 4px #e5f1ff, 0 12px 28px rgba(23, 54, 93, .12); }
  .keyword-slide__copy { grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: "label seal" "title seal" "story story" "chips chips"; gap: 5px 12px; }
  .keyword-slide__copy > span { grid-area: label; }
  .keyword-slide__copy > strong { grid-area: title; font-size: clamp(1.7rem, 3.8vw, 2.4rem); }
  .keyword-slide__copy p { grid-area: story; line-height: 1.4; }
  .keyword-slide__seal { grid-area: seal; align-self: center; padding: 7px 10px; border-radius: 13px; }
  .keyword-slide__seal b { font-size: 1.05rem; }
  .keyword-slide__chips { grid-area: chips; }
  .keyword-slide__chips span { padding: 5px 8px; }
}
</style>
