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

const { formatDate, formatDateTime } = useViewerDateTime();
const { locale, t } = useI18n();
const hasRecordTimes = computed(() => Boolean(props.summary.period.firstRecordAt || props.summary.period.lastRecordAt));
const uiText = computed(() =>
  locale.value === "ja"
    ? {
        start: "開始",
        now: "現在",
        end: "終了",
        first: "物語が最初に灯った日",
        latest: "物語の今",
        totalDays: "広がった日々",
        activeDays: "灯った日"
      }
    : {
        start: "开始",
        now: "当前",
        end: "结束",
        first: "故事第一次亮起",
        latest: "故事写到这里",
        totalDays: "展开的日子",
        activeDays: "点亮的日期"
      }
);
</script>

<template>
  <StorySlideShell
    :page-index="pageIndex"
    :page-total="pageTotal"
    :eyebrow="summary.copy.period.eyebrow"
    :title="summary.copy.period.title"
    :lead="summary.copy.period.body"
    :accent="summary.poster.periodLabel"
    tone="sunrise"
    :active="active"
    :reduced-motion="reducedMotion"
  >
    <div class="period-slide">
      <div class="period-slide__timeline" data-animate>
        <article>
          <span>{{ uiText.start }}</span>
          <strong>{{ formatDate(summary.version.startDate) }}</strong>
        </article>
        <i></i>
        <article>
          <span>{{ summary.version.isOngoing ? uiText.now : uiText.end }}</span>
          <strong>{{ formatDate(summary.version.effectiveEndDate) }}</strong>
        </article>
      </div>

      <div class="period-slide__grid">
        <article v-if="summary.period.firstRecordAt" class="period-slide__card" data-animate>
          <span>{{ uiText.first }}</span>
          <strong>{{ formatDateTime(summary.period.firstRecordAt) }}</strong>
        </article>
        <article v-if="summary.period.lastRecordAt" class="period-slide__card" data-animate>
          <span>{{ uiText.latest }}</span>
          <strong>{{ formatDateTime(summary.period.lastRecordAt) }}</strong>
        </article>
        <article v-if="!hasRecordTimes" class="period-slide__card period-slide__card--archive" data-animate>
          <span>{{ t('annualSummary.slides.period.archiveTitle') }}</span>
          <p>{{ t('annualSummary.slides.period.archiveBody') }}</p>
        </article>
        <article class="period-slide__card" data-animate>
          <span>{{ uiText.totalDays }}</span>
          <strong><StoryCounter :value="summary.period.totalDays" :active="active" :reduced-motion="reducedMotion" /></strong>
        </article>
        <article v-if="summary.timeCoverage?.status !== 'unavailable'" class="period-slide__card" data-animate>
          <span>{{ uiText.activeDays }}</span>
          <strong><StoryCounter :value="summary.period.activeDays" :active="active" :reduced-motion="reducedMotion" /></strong>
        </article>
      </div>
    </div>
  </StorySlideShell>
</template>

<style scoped>
.period-slide {
  display: grid;
  height: 100%;
  min-height: 0;
  align-content: end;
  gap: 18px;
}

@media (max-height: 900px) {
  .period-slide { gap: 10px; }
  .period-slide__timeline { padding: 14px 16px; }
  .period-slide__grid { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
  .period-slide__card { min-height: 0; padding: 12px; }
  .period-slide__timeline article strong, .period-slide__card strong { font-size: clamp(1.15rem, 2.2vw, 1.8rem); }
}

@media (max-width: 720px) and (max-height: 900px) {
  .period-slide__timeline { grid-template-columns: minmax(0, 1fr) 3rem minmax(0, 1fr); gap: 8px; }
  .period-slide__timeline i { width: 100%; }
  .period-slide__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

.period-slide__timeline,
.period-slide__card {
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(16px);
}

.period-slide__timeline {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  gap: 18px;
  align-items: center;
  padding: 22px 24px;
}

.period-slide__timeline article span,
.period-slide__card span {
  display: block;
  color: rgba(255, 230, 196, 0.66);
  letter-spacing: 0.14em;
  font-size: 12px;
}

.period-slide__timeline article strong,
.period-slide__card strong {
  display: block;
  margin-top: 10px;
  color: #fff8ed;
  font-size: clamp(1.5rem, 2.8vw, 2.5rem);
  line-height: 1.1;
}

.period-slide__timeline i {
  width: 10rem;
  height: 2px;
  background: linear-gradient(90deg, rgba(57, 120, 200, 0.18), rgba(57, 120, 200, 0.9), rgba(23, 54, 93, 0.42));
}

.period-slide__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.period-slide__card--archive { grid-column: span 2; }
.period-slide__card--archive p { margin: 8px 0 0; font-size: 12px; line-height: 1.5; }

.period-slide__card {
  min-height: 10.5rem;
  padding: 18px 20px;
}

@media (max-width: 720px) {
  .period-slide__card {
    min-height: auto;
    padding: 16px 18px;
    border-radius: 22px;
  }

  .period-slide__timeline,
  .period-slide__grid {
    grid-template-columns: 1fr;
  }

  .period-slide__timeline {
    gap: 14px;
    padding: 18px;
    border-radius: 22px;
  }

  .period-slide__timeline i {
    width: 100%;
  }
}

@media (max-width: 720px) {
  .period-slide { align-content: start; gap: 8px; }
  .period-slide__timeline { grid-template-columns: minmax(0, 1fr) 28px minmax(0, 1fr); gap: 6px; padding: 10px 12px; border-radius: 16px; }
  .period-slide__timeline i { width: 100%; }
  .period-slide__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
  .period-slide__card { min-height: 0; padding: 10px 12px; border-radius: 16px; }
  .period-slide__timeline article span, .period-slide__card span { font-size: 10px; letter-spacing: 0.08em; }
  .period-slide__timeline article strong, .period-slide__card strong { margin-top: 5px; font-size: clamp(0.9rem, 4vw, 1.2rem); overflow-wrap: anywhere; }
}

@media (orientation: landscape) and (min-width: 721px) and (max-height: 460px) {
  .period-slide { align-content: center; gap: 7px; }
  .period-slide__timeline { padding: 10px 13px; border-radius: 18px; }
  .period-slide__grid { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 7px; }
  .period-slide__card { min-height: 0; padding: 10px 11px; border-radius: 17px; }
  .period-slide__timeline article strong,
  .period-slide__card strong { margin-top: 5px; font-size: clamp(1rem, 2vw, 1.3rem); }
  .period-slide__timeline i { width: 7rem; }
}
</style>
