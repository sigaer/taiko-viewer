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
const { locale } = useI18n();
const uiText = computed(() =>
  locale.value === "ja"
    ? {
        start: "開始",
        now: "現在",
        end: "終了",
        first: "最初の記録",
        latest: "最後の記録",
        totalDays: "総日数",
        activeDays: "活動日数"
      }
    : {
        start: "开始",
        now: "当前",
        end: "结束",
        first: "第一条记录",
        latest: "最后一条记录",
        totalDays: "总天数",
        activeDays: "活跃天数"
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
        <article class="period-slide__card" data-animate>
          <span>{{ uiText.first }}</span>
          <strong>{{ formatDateTime(summary.period.firstRecordAt) }}</strong>
        </article>
        <article class="period-slide__card" data-animate>
          <span>{{ uiText.latest }}</span>
          <strong>{{ formatDateTime(summary.period.lastRecordAt) }}</strong>
        </article>
        <article class="period-slide__card" data-animate>
          <span>{{ uiText.totalDays }}</span>
          <strong><StoryCounter :value="summary.period.totalDays" :active="active" :reduced-motion="reducedMotion" /></strong>
        </article>
        <article class="period-slide__card" data-animate>
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
  gap: 18px;
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
  background: linear-gradient(90deg, rgba(255, 141, 78, 0.2), rgba(255, 215, 125, 0.9), rgba(97, 191, 255, 0.4));
}

.period-slide__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

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
</style>
