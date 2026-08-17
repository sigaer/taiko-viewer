<script setup lang="ts">
import { computed } from "vue";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import StorySlideShell from "../StorySlideShell.vue";
import { isUsableMetric } from "~/utils/annualPresentation";

const props = defineProps<{ summary: VersionSummaryViewModel; pageIndex: number; pageTotal: number; active: boolean; reducedMotion: boolean }>();
const { t, locale } = useI18n();
const formatter = computed(() => new Intl.NumberFormat(locale.value === "ja" ? "ja-JP" : "zh-CN"));
const inStreak = (date: string) => Boolean(
  props.summary.calendarActivity?.streakStart
  && props.summary.calendarActivity?.streakEnd
  && date >= props.summary.calendarActivity.streakStart
  && date <= props.summary.calendarActivity.streakEnd
);
</script>

<template>
  <StorySlideShell :page-index="pageIndex" :page-total="pageTotal" :eyebrow="summary.copy.calendarActivity.eyebrow" :title="summary.copy.calendarActivity.title" :lead="summary.copy.calendarActivity.body" tone="royal" :active="active" :reduced-motion="reducedMotion">
    <div v-if="summary.calendarActivity" class="calendar">
      <div class="heat" data-animate>
        <i v-for="day in summary.calendarActivity.days" :key="day.date" :class="{ streak: inStreak(day.date) }" :style="{ '--heat': day.intensity }" :title="`${day.date} · ${formatter.format(day.playCount)}`"></i>
      </div>
      <div class="calendar__facts">
        <article v-if="isUsableMetric(summary.calendarActivity.activeDays)" data-animate><span>{{ t("annualSummary.slides.calendar.active") }}</span><strong>{{ formatter.format(summary.calendarActivity.activeDays) }}</strong></article>
        <article v-if="isUsableMetric(summary.calendarActivity.longestStreak)" data-animate><span>{{ t("annualSummary.slides.calendar.streak") }}</span><strong>{{ t("annualSummary.slides.calendar.days", { count: formatter.format(summary.calendarActivity.longestStreak) }) }}</strong><small>{{ summary.calendarActivity.streakLabel }}</small></article>
      </div>
    </div>
  </StorySlideShell>
</template>

<style scoped>
.calendar{height:100%;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(210px,28%);gap:12px}.heat,.calendar__facts article{padding:16px;border:1px solid rgba(57,120,200,.18);border-radius:25px;background:rgba(247,251,255,.84);box-shadow:0 14px 34px rgba(23,54,93,.08)}.heat{min-height:0;display:grid;grid-template-columns:repeat(23,minmax(3px,1fr));grid-auto-rows:minmax(4px,1fr);gap:4px;align-content:center}.heat i{border-radius:5px;background:rgba(57,120,200,calc(.09 + var(--heat)*.75));box-shadow:0 0 calc(var(--heat)*8px) rgba(57,120,200,.24)}.heat i.streak{outline:2px solid #3978c8;outline-offset:1px}.calendar__facts{display:grid;gap:10px}.calendar__facts article{min-width:0;display:grid;align-content:center}.calendar span,.calendar small{color:#5c7697;font-size:12px}.calendar small{margin-top:6px;font-size:10px;overflow-wrap:anywhere}.calendar strong{color:#17365d;font:700 clamp(1.65rem,4vw,3.2rem)/1.05 var(--viewer-display-font)}
@media(max-width:720px){.calendar{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) auto;gap:6px}.heat{padding:10px;gap:2px;border-radius:17px}.calendar__facts{grid-template-columns:1fr 1fr;gap:6px}.calendar__facts article{padding:9px;border-radius:15px}.calendar strong{font-size:1.15rem}.calendar span{font-size:10px}.calendar small{font-size:10px}}
</style>
