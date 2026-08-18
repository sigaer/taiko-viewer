<script setup lang="ts">
import { computed } from "vue";

type CalendarDay = {
  date: string;
  playCount: number;
  intensity: number;
};

const props = withDefaults(defineProps<{
  month: number;
  year: number;
  days: CalendarDay[];
  startDate?: string;
  endDate?: string;
  reducedMotion?: boolean;
}>(), {
  startDate: "",
  endDate: "",
  reducedMotion: false
});

const { t } = useI18n();

const clamp = (value: number, minimum = 0, maximum = 1) =>
  Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));

const daysInMonth = computed(() => new Date(props.year, props.month, 0).getDate());
const firstDayOffset = computed(() => (new Date(props.year, props.month - 1, 1).getDay() + 6) % 7);
const maximumPlayCount = computed(() => Math.max(1, ...props.days.map((day) => clamp(day.playCount, 0, Number.MAX_SAFE_INTEGER))));
const dayMap = computed(() => new Map(props.days.map((day) => [day.date, day])));

const dateKey = (day: number) =>
  `${props.year}-${String(props.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

const cells = computed(() => {
  const output: Array<{
    key: string;
    date: string;
    placeholder: boolean;
    outsideRange: boolean;
    active: boolean;
    highIntensity: boolean;
    playCount: number;
    style: Record<string, string>;
  }> = [];

  for (let index = 0; index < firstDayOffset.value; index += 1) {
    output.push({
      key: `before-${index}`,
      date: "",
      placeholder: true,
      outsideRange: true,
      active: false,
      highIntensity: false,
      playCount: 0,
      style: {}
    });
  }

  for (let dayNumber = 1; dayNumber <= daysInMonth.value; dayNumber += 1) {
    const date = dateKey(dayNumber);
    const activity = dayMap.value.get(date);
    const playCount = clamp(Number(activity?.playCount), 0, Number.MAX_SAFE_INTEGER);
    const fallbackIntensity = playCount / maximumPlayCount.value;
    const intensity = clamp(Number(activity?.intensity), 0, 1) || clamp(fallbackIntensity);
    const active = playCount > 0;
    const outsideRange = Boolean(
      (props.startDate && date < props.startDate)
      || (props.endDate && date > props.endDate)
    );
    output.push({
      key: date,
      date,
      placeholder: false,
      outsideRange,
      active,
      highIntensity: active && intensity >= .72,
      playCount,
      style: {
        "--dot-scale": String(active ? 1.08 + intensity * .28 : 1),
        "--dot-opacity": String(active ? .82 + intensity * .18 : outsideRange ? .17 : .27),
        "--dot-glow": `${Math.round(3 + intensity * 7)}px`,
        "--dot-delay": `${((dayNumber * 37 + props.month * 71) % 900) / 1000}s`
      }
    });
  }

  while (output.length < 42) {
    output.push({
      key: `after-${output.length}`,
      date: "",
      placeholder: true,
      outsideRange: true,
      active: false,
      highIntensity: false,
      playCount: 0,
      style: {}
    });
  }
  return output;
});

const activeCount = computed(() => cells.value.filter((cell) => cell.active).length);
const monthLabel = computed(() => t("annualSummary.slides.calendar.month", { month: props.month }));
const monthSummary = computed(() => t("annualSummary.slides.calendar.monthSummary", {
  month: props.month,
  count: activeCount.value
}));
</script>

<template>
  <section class="calendar-month" :class="{ 'is-reduced': reducedMotion }" :aria-label="monthSummary">
    <h3>{{ monthLabel }}</h3>
    <div class="calendar-month__dots" aria-hidden="true">
      <i
        v-for="cell in cells"
        :key="cell.key"
        class="calendar-dot"
        :class="{
          'calendar-dot--day': !cell.placeholder,
          'calendar-dot--placeholder': cell.placeholder,
          'calendar-dot--outside': cell.outsideRange,
          'calendar-dot--active': cell.active,
          'calendar-dot--high': cell.highIntensity
        }"
        :style="cell.style"
        :title="cell.active ? t('annualSummary.slides.calendar.datePlayCount', { date: cell.date, count: cell.playCount }) : undefined"
      />
    </div>
  </section>
</template>

<style scoped>
.calendar-month {
  min-width: 0;
  height: 100%;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  align-content: start;
  gap: clamp(5px, .8vh, 8px);
  contain: layout paint style;
}

.calendar-month h3 {
  margin: 0;
  color: var(--calendar-ink);
  font: 750 clamp(15px, 4.2vw, 19px)/1.05 var(--viewer-display-font);
  letter-spacing: -.035em;
}

.calendar-month__dots {
  width: min(100%, 70px);
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  align-content: start;
  gap: clamp(2.4px, .82vw, 4px);
}

.calendar-dot {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 50%;
  background: rgba(102, 164, 222, .38);
  opacity: var(--dot-opacity, .27);
  transform: scale(var(--dot-scale, 1));
  transform-origin: center;
  will-change: transform, opacity;
}

.calendar-dot--placeholder { visibility: hidden; }
.calendar-dot--outside { background: rgba(99, 159, 216, .26); }
.calendar-dot--active {
  background: rgba(255, 255, 255, .98);
  box-shadow: 0 0 var(--dot-glow, 5px) rgba(255, 255, 255, .88), 0 1px 3px rgba(36, 104, 173, .2);
}

.calendar-dot--high {
  animation: calendar-dot-breathe 3.8s ease-in-out var(--dot-delay, 0s) infinite alternate;
}

.calendar-month.is-reduced .calendar-dot { will-change: auto; }

@keyframes calendar-dot-breathe {
  from { opacity: var(--dot-opacity, 1); transform: scale(var(--dot-scale, 1)); }
  to { opacity: 1; transform: scale(calc(var(--dot-scale, 1) * 1.04)); }
}

@media (max-width: 350px) {
  .calendar-month h3 { font-size: 14px; }
  .calendar-month__dots { width: min(100%, 64px); gap: 2.2px; }
}

@media (orientation: landscape) and (max-height: 460px) {
  .calendar-month { gap: 3px; }
  .calendar-month h3 { font-size: 13px; }
  .calendar-month__dots { width: min(100%, 56px); gap: 2px; }
}

@media (prefers-reduced-motion: reduce) {
  .calendar-dot { animation: none !important; will-change: auto; }
}
</style>
