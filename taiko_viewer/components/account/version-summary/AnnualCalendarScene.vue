<script setup lang="ts">
import { computed, ref, toRef } from "vue";
import AnnualMonthDotGrid from "./AnnualMonthDotGrid.vue";
import AnnualScene from "./AnnualScene.vue";
import { useAnnualTimeline } from "~/composables/useAnnualTimeline";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";

type CalendarDay = NonNullable<VersionSummaryViewModel["calendarActivity"]>["days"][number];

const props = defineProps<{
  summary: VersionSummaryViewModel;
  pageIndex: number;
  pageTotal: number;
  active: boolean;
  reducedMotion: boolean;
}>();

const { t, locale } = useI18n();
const rootRef = ref<InstanceType<typeof AnnualScene> | null>(null);
useAnnualTimeline(rootRef, toRef(props, "active"), toRef(props, "reducedMotion"), { reenter: "restart" });

const finiteNonNegative = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

const annualYear = computed(() => {
  for (const candidate of [props.summary.version.name, props.summary.version.key, props.summary.version.startDate]) {
    const match = String(candidate || "").match(/(?:^|\D)(20\d{2})(?:\D|$)/);
    if (match) return Number(match[1]);
  }
  return new Date().getFullYear();
});

const activity = computed(() => props.summary.calendarActivity);
const activeDays = computed(() => Math.round(finiteNonNegative(activity.value?.activeDays)));
const longestStreak = computed(() => Math.round(finiteNonNegative(activity.value?.longestStreak)));
const formatter = computed(() => new Intl.NumberFormat(locale.value === "ja" ? "ja-JP" : "zh-CN"));

const startMonth = computed(() => {
  const match = String(props.summary.version.startDate || "").match(/^(\d{4})-(\d{2})/);
  if (match) return { year: Number(match[1]), month: Number(match[2]) };
  return { year: annualYear.value, month: 1 };
});

const normalizedDays = computed(() => {
  const byDate = new Map<string, CalendarDay>();
  for (const rawDay of activity.value?.days || []) {
    const match = String(rawDay?.date || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) continue;
    const date = `${match[1]}-${match[2]}-${match[3]}`;
    const current = byDate.get(date);
    const playCount = finiteNonNegative(rawDay.playCount);
    const intensity = Math.min(1, finiteNonNegative(rawDay.intensity));
    byDate.set(date, {
      date,
      playCount: finiteNonNegative(current?.playCount) + playCount,
      intensity: Math.max(finiteNonNegative(current?.intensity), intensity)
    } as CalendarDay);
  }
  return [...byDate.values()];
});

const monthGroups = computed(() => Array.from({ length: 12 }, (_, index) => {
  const total = startMonth.value.year * 12 + (startMonth.value.month - 1) + index;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const prefix = `${year}-${String(month).padStart(2, "0")}-`;
  return { year, month, days: normalizedDays.value.filter((day) => day.date.startsWith(prefix)) };
}));

</script>

<template>
  <AnnualScene
    ref="rootRef"
    class="annual-calendar-scene"
    :active="active"
    :reduced-motion="reducedMotion"
    mood="time-blue"
    intensity="medium"
    data-visual-style="annual-dot-calendar"
    :data-year="annualYear"
    :data-active-days="activeDays"
  >
    <template #background>
      <img class="annual-calendar-scene__backdrop" src="/蓝色白色背景图.png" alt="" aria-hidden="true">
      <div class="annual-calendar-scene__wash"></div>
    </template>
    <template #atmosphere>
      <div class="annual-calendar-scene__glows"><i></i><i></i><i></i></div>
    </template>

    <div v-if="activity" class="annual-calendar-scene__content">
      <header class="annual-calendar-scene__header">
        <div class="annual-calendar-scene__title" data-annual-stage="title">
          <h2>{{ t("annualSummary.slides.calendar.title", { year: annualYear }) }}</h2>
        </div>
        <div class="annual-calendar-scene__narrative">
          <p class="annual-calendar-scene__summary" data-annual-stage="title">
            <span>{{ t("annualSummary.slides.calendar.primary", { activeDays: formatter.format(activeDays) }) }}</span>
            <span>{{ t("annualSummary.slides.calendar.longest", { longestStreak: formatter.format(longestStreak) }) }}</span>
          </p>
          <p class="annual-calendar-scene__reflection" data-annual-stage="copy">
            <span>{{ t("annualSummary.slides.calendar.emotionLine1") }}</span>
            <span>{{ t("annualSummary.slides.calendar.emotionLine2") }}</span>
          </p>
        </div>
      </header>

      <div class="annual-calendar-scene__months">
        <AnnualMonthDotGrid
          v-for="group in monthGroups"
          :key="`${group.year}-${group.month}`"
          data-annual-stage="visual"
          :month="group.month"
          :year="group.year"
          :days="group.days"
          :start-date="summary.version.startDate"
          :end-date="summary.version.effectiveEndDate"
          :reduced-motion="reducedMotion"
        />
      </div>

    </div>
  </AnnualScene>
</template>

<style scoped>
.annual-calendar-scene {
  --calendar-ink: #0d4f88;
  --calendar-body: #1b659d;
  width: 100%;
  height: 100vh;
  height: 100svh;
  height: 100dvh;
  color: var(--calendar-ink);
  background: #a9d8ff;
}

.annual-calendar-scene__backdrop,
.annual-calendar-scene__wash {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.annual-calendar-scene__backdrop { object-fit: cover; }
.annual-calendar-scene__wash {
  background:
    linear-gradient(180deg, rgba(72, 159, 235, .2), rgba(95, 177, 241, .14) 45%, rgba(70, 154, 228, .19)),
    radial-gradient(circle at 50% 42%, rgba(255, 255, 255, .06), rgba(63, 144, 222, .12));
}

.annual-calendar-scene__glows { position: absolute; inset: 0; overflow: hidden; }
.annual-calendar-scene__glows i {
  position: absolute;
  width: clamp(72px, 24vw, 130px);
  aspect-ratio: 1;
  border-radius: 50%;
  background: rgba(255, 255, 255, .14);
  filter: blur(8px);
  animation: calendar-glow-float 8s ease-in-out infinite alternate;
}
.annual-calendar-scene__glows i:nth-child(1) { top: 11%; left: -9%; }
.annual-calendar-scene__glows i:nth-child(2) { top: 38%; right: -14%; animation-delay: -2.6s; }
.annual-calendar-scene__glows i:nth-child(3) { bottom: 9%; left: 30%; width: clamp(48px, 16vw, 82px); animation-delay: -5s; }

.annual-calendar-scene__content {
  position: relative;
  width: min(680px, 100%);
  height: 100%;
  margin: 0 auto;
  padding: max(50px, calc(env(safe-area-inset-top) + 42px)) clamp(18px, 5.6vw, 30px) max(52px, calc(env(safe-area-inset-bottom) + 44px));
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: clamp(8px, 1.45vh, 14px);
}

.annual-calendar-scene__header { min-width: 0; }
.annual-calendar-scene__title {
  display: flex;
  align-items: baseline;
  gap: 9px;
}
.annual-calendar-scene__title > span {
  flex: 0 0 auto;
  color: rgba(13, 79, 136, .65);
  font: 700 10px/1 var(--viewer-font-family);
  letter-spacing: .08em;
}
.annual-calendar-scene__title h2 {
  margin: 0;
  color: var(--calendar-ink);
  font: 760 clamp(19px, 5.2vw, 25px)/1.08 var(--viewer-display-font);
  letter-spacing: -.04em;
}

.annual-calendar-scene__narrative {
  margin-top: clamp(14px, 2.3vh, 22px);
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(108px, .9fr);
  gap: 14px;
  align-items: end;
}
.annual-calendar-scene__summary,
.annual-calendar-scene__reflection {
  margin: 0;
  color: var(--calendar-body);
  font-size: clamp(13px, 3.5vw, 16px);
  line-height: 1.62;
  letter-spacing: -.02em;
}
.annual-calendar-scene__summary { font-weight: 650; }
.annual-calendar-scene__summary span,
.annual-calendar-scene__reflection span { display: block; }
.annual-calendar-scene__reflection {
  justify-self: end;
  text-align: right;
  font-size: clamp(11px, 2.9vw, 13px);
  line-height: 1.5;
  font-weight: 520;
}

.annual-calendar-scene__months {
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-template-rows: repeat(4, minmax(0, 1fr));
  column-gap: clamp(10px, 4.2vw, 28px);
  row-gap: clamp(7px, 1.35vh, 14px);
  align-items: start;
}

.annual-calendar-scene footer {
  color: rgba(13, 79, 136, .72);
  font-size: 10px;
  line-height: 1.25;
  letter-spacing: .01em;
}

@keyframes calendar-glow-float {
  from { opacity: .5; transform: translate3d(-5px, 2px, 0) scale(.96); }
  to { opacity: .82; transform: translate3d(7px, -8px, 0) scale(1.05); }
}

@media (max-width: 350px) {
  .annual-calendar-scene__content { padding-inline: 12px; }
  .annual-calendar-scene__narrative { grid-template-columns: minmax(0, 1.7fr) minmax(94px, .8fr); gap: 8px; }
  .annual-calendar-scene__summary { font-size: 12px; }
  .annual-calendar-scene__reflection { font-size: 10px; }
  .annual-calendar-scene__months { column-gap: 8px; row-gap: 5px; }
}

@media (max-height: 700px) and (orientation: portrait) {
  .annual-calendar-scene__content {
    padding-top: max(44px, calc(env(safe-area-inset-top) + 38px));
    padding-bottom: max(44px, calc(env(safe-area-inset-bottom) + 38px));
    gap: 6px;
  }
  .annual-calendar-scene__title h2 { font-size: 18px; }
  .annual-calendar-scene__narrative { margin-top: 8px; }
  .annual-calendar-scene__summary { font-size: 11px; line-height: 1.42; }
  .annual-calendar-scene__reflection { font-size: 10px; line-height: 1.35; }
  .annual-calendar-scene__months { row-gap: 4px; }
  .annual-calendar-scene footer { font-size: 10px; }
}

@media (orientation: landscape) and (max-height: 460px) {
  .annual-calendar-scene__content {
    width: min(760px, 100%);
    padding: 38px 54px 34px;
    grid-template-rows: auto minmax(0, 1fr) auto;
    gap: 5px;
  }
  .annual-calendar-scene__header { display: grid; grid-template-columns: minmax(170px, .75fr) minmax(0, 1.25fr); gap: 18px; align-items: end; }
  .annual-calendar-scene__title h2 { font-size: 16px; }
  .annual-calendar-scene__narrative { margin-top: 0; gap: 10px; }
  .annual-calendar-scene__summary { font-size: 10px; line-height: 1.35; }
  .annual-calendar-scene__reflection { font-size: 10px; line-height: 1.3; }
  .annual-calendar-scene__months {
    grid-template-columns: repeat(6, minmax(0, 1fr));
    grid-template-rows: repeat(2, minmax(0, 1fr));
    column-gap: 16px;
    row-gap: 4px;
  }
}

.annual-calendar-scene.is-reduced :deep(.calendar-dot) { will-change: auto; }

@media (prefers-reduced-motion: reduce) {
  .annual-calendar-scene__glows i { animation: none !important; }
}
</style>
