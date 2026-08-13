<script setup lang="ts">
import { computed } from "vue";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import AnnualVerticalCoverStream from "../AnnualVerticalCoverStream.vue";

const props = defineProps<{
  summary: VersionSummaryViewModel;
  pageIndex: number;
  pageTotal: number;
  active: boolean;
  reducedMotion: boolean;
}>();

const { formatDate } = useViewerDateTime();
const { locale, n, t } = useI18n();
const donIconUrl = "/api/content/assets/don";
const anchorDate = computed(() => props.summary.period.firstRecordAt || props.summary.version.startDate);
const latestDate = computed(() => props.summary.period.lastRecordAt || props.summary.version.effectiveEndDate);
const centerText = computed(() => locale.value === "ja"
  ? {
      first: props.summary.period.firstRecordAt ? "最初の一打が記録された日" : "この物語が始まった日",
      latest: "ここまで記録された日",
      elapsed: "物語が続いた日",
      active: "音が灯った日"
    }
  : {
      first: props.summary.period.firstRecordAt ? "第一次留下鼓点" : "这一版故事开始",
      latest: "故事写到这里",
      elapsed: "故事走过的日子",
      active: "点亮的日期"
    }
);
</script>

<template>
  <section class="period-story" :class="{ 'is-active': active, 'is-reduced': reducedMotion }">
    <AnnualVerticalCoverStream
      :summary="summary"
      :active="active"
      :reduced-motion="reducedMotion"
    />

    <span class="period-story__page">{{ String(pageIndex + 1).padStart(2, "0") }} / {{ String(pageTotal).padStart(2, "0") }}</span>

    <div class="period-story__center">
      <p>{{ centerText.first }}</p>
      <time :datetime="anchorDate">{{ formatDate(anchorDate) }}</time>
      <img :src="donIconUrl" alt="" aria-hidden="true" />
      <h2>{{ summary.copy.period.title }}</h2>
      <p class="period-story__lead">{{ summary.copy.period.body }}</p>

      <div class="period-story__facts">
        <span><b>{{ n(summary.period.totalDays) }}</b>{{ centerText.elapsed }}</span>
        <span v-if="summary.timeCoverage?.status !== 'unavailable'"><b>{{ n(summary.period.activeDays) }}</b>{{ centerText.active }}</span>
      </div>
      <small>{{ centerText.latest }} · {{ formatDate(latestDate) }}</small>
    </div>
  </section>
</template>

<style scoped>
.period-story {
  position: relative;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  color: #17365d;
  background:
    radial-gradient(circle at 74% 48%, rgba(255, 255, 255, 0.94), transparent 27%),
    linear-gradient(155deg, #d9ecff 0%, #f7fbff 44%, #b9dbfb 100%);
}

.period-story::after {
  content: "";
  position: absolute;
  z-index: 1;
  inset: 31% 0;
  background: linear-gradient(90deg, rgba(247, 251, 255, 0.68), rgba(247, 251, 255, 0.9) 18% 82%, rgba(247, 251, 255, 0.68));
  box-shadow: 0 -18px 32px rgba(247, 251, 255, 0.58), 0 18px 32px rgba(247, 251, 255, 0.58);
  backdrop-filter: blur(5px);
}

.period-story__page {
  position: absolute;
  z-index: 4;
  top: max(18px, env(safe-area-inset-top));
  left: 18px;
  padding: 6px 9px;
  border: 1px solid rgba(57, 120, 200, 0.2);
  border-radius: 99px;
  color: #3978c8;
  background: rgba(247, 251, 255, 0.82);
  font: 700 10px/1 var(--viewer-font-family);
}

.period-story__center {
  position: absolute;
  z-index: 3;
  top: 50%;
  left: 50%;
  width: min(88%, 610px);
  transform: translate(-50%, -50%);
  text-align: center;
  opacity: 0;
}

.period-story.is-active .period-story__center { animation: period-copy-arrive 760ms 120ms both cubic-bezier(0.2, 0.82, 0.2, 1); }
.period-story__center > p:first-child { margin: 0; color: #3978c8; font-size: 12px; font-weight: 800; letter-spacing: 0.16em; }
.period-story__center time { display: block; margin-top: 6px; color: #486bb3; font: 700 clamp(1.7rem, 5.8vw, 3.3rem)/1 var(--viewer-display-font); }
.period-story__center img { display: block; width: clamp(46px, 9vh, 72px); margin: 11px auto 7px; filter: drop-shadow(0 8px 10px rgba(57, 120, 200, 0.18)); }
.period-story__center h2 { margin: 0; color: #17365d; font: 700 clamp(1.65rem, 5vw, 3.25rem)/1.08 var(--viewer-display-font); text-wrap: balance; }
.period-story__lead { max-width: 520px; margin: 8px auto 0; color: #5c7697; font-size: clamp(11px, 1.5vw, 14px); line-height: 1.55; text-wrap: balance; }
.period-story__facts { display: flex; justify-content: center; gap: clamp(22px, 8vw, 64px); margin-top: 12px; }
.period-story__facts span { display: grid; gap: 2px; color: #5c7697; font-size: 11px; }
.period-story__facts b { color: #3978c8; font: 700 clamp(1.35rem, 4vw, 2.25rem)/1 var(--viewer-display-font); }
.period-story__center small { display: block; margin-top: 8px; color: #7991ad; font-size: 10px; }

@keyframes period-copy-arrive {
  from { opacity: 0; transform: translate(-50%, calc(-50% + 16px)); }
  to { opacity: 1; transform: translate(-50%, -50%); }
}

@media (max-height: 700px) and (orientation: portrait) {
  .period-story__center img { margin-block: 5px 3px; }
  .period-story__lead { margin-top: 4px; line-height: 1.35; }
  .period-story__facts { margin-top: 7px; }
}

@media (orientation: landscape) and (max-height: 460px) {
  .period-story::after { inset: 0 31%; background: linear-gradient(rgba(247,251,255,.68), rgba(247,251,255,.9) 16% 84%, rgba(247,251,255,.68)); box-shadow: -18px 0 32px rgba(247,251,255,.58), 18px 0 32px rgba(247,251,255,.58); }
  .period-story__center { width: min(38%, 520px); }
  .period-story__center time { font-size: clamp(1.35rem, 3.5vw, 2rem); }
  .period-story__center img { width: 38px; margin-block: 4px 2px; }
  .period-story__center h2 { font-size: clamp(1.25rem, 3vw, 1.8rem); }
  .period-story__lead { display: none; }
  .period-story__facts { margin-top: 6px; }
  .period-story__facts b { font-size: 1.3rem; }
}

.period-story.is-reduced .period-story__center { opacity: 1; animation: none; }
@media (prefers-reduced-motion: reduce) { .period-story__center { opacity: 1; animation: none !important; } }
</style>
