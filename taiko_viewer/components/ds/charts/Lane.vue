<script setup lang="ts">
// Lane (譜面レーン) (P0-25; 04 §9; V1.2 §1.2, §9.19). One column per day, oldest first; the day's note is its
// highest-weight growth fact. Input types are the contract's growth facts (CanonicalFact["type"], 12 RK-06) via
// utils/ds/charts.ts LaneDay. Note colours are the lane note tokens, unchanged; the band is --lane.
//
// Clickable form: role="group", one button per day (aria-pressed), roving tabindex — one Tab stop, ← → move,
// Home / End jump, Enter / Space select. Overview form (`to`): the whole lane is one link, days are not clickable.
// Column width ≥ 44px (clickable) / 36px (overview); when the days do not fit, the lane scrolls and starts at
// the latest day. `today` is passed in (no clock is read), so SSR and the client render the same columns.
import { laneColumnWidth, laneColumns, laneNoteScale, type LaneColumn, type LaneDay } from "~/utils/ds/charts";

const props = withDefaults(
  defineProps<{
    days: ReadonlyArray<LaneDay>;
    /** Selected day (YYYY-MM-DD). */
    modelValue?: string | null;
    /** The player's current day (YYYY-MM-DD): draws the judgement circle and reads 今天 / 今日. */
    today?: string | null;
    compact?: boolean;
    /** Overview: the lane becomes a single link to this location. */
    to?: string | null;
    /** Accessible name; defaults to ds.chart.lane.name. */
    name?: string;
  }>(),
  { modelValue: null, today: null, compact: false, to: null, name: "" }
);
const emit = defineEmits<{ "update:modelValue": [date: string] }>();

const { t } = useI18n();
const WEEKDAY = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

const cols = computed(() => laneColumns(props.days, props.today));
const laneName = computed(() => props.name || t("ds.chart.lane.name"));
const overviewName = computed(() => t("ds.chart.lane.overview", { name: laneName.value, days: cols.value.length, played: cols.value.filter((c) => c.played).length }));

/* ---- layout: column width from the container (after mount) ---- */
const el = ref<HTMLElement | { $el: HTMLElement } | null>(null);
const available = ref(0);
const scrolledLeft = ref(false);
const colW = computed(() => laneColumnWidth(available.value, cols.value.length, !!props.to));
const narrow = computed(() => colW.value < 40);
const laneStyle = computed(() => ({ "--col-w": `${colW.value}px`, "--ns": String(laneNoteScale(colW.value)) }));

const root = (): HTMLElement | null => {
  const v = el.value as unknown;
  if (!v) return null;
  return v instanceof HTMLElement ? v : ((v as { $el?: HTMLElement }).$el ?? null);
};
function onScroll() {
  const e = root();
  if (e) scrolledLeft.value = e.scrollLeft > 1;
}
function measure() {
  const e = root();
  if (!e) return;
  const cs = getComputedStyle(e);
  available.value = e.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
}
function toLatest() {
  nextTick(() => {
    const e = root();
    if (e) e.scrollLeft = e.scrollWidth; // instant, never smooth (reduced motion and V1.2 D13)
    onScroll();
  });
}
let ro: ResizeObserver | null = null;
onMounted(() => {
  measure();
  toLatest();
  const e = root();
  if (typeof ResizeObserver !== "undefined" && e) {
    ro = new ResizeObserver(() => {
      measure();
      toLatest();
    });
    ro.observe(e);
  }
});
onBeforeUnmount(() => ro?.disconnect());
watch(
  () => props.days,
  () => {
    measure();
    toLatest();
  }
);

/* ---- roving focus ---- */
const focusIdx = ref(-1);
const tabIdx = computed(() => {
  if (focusIdx.value >= 0 && focusIdx.value < cols.value.length) return focusIdx.value;
  const sel = cols.value.findIndex((c) => c.date === props.modelValue);
  return sel >= 0 ? sel : cols.value.length - 1;
});
function onKey(e: KeyboardEvent) {
  const n = cols.value.length;
  if (!n) return;
  let i = tabIdx.value;
  if (e.key === "ArrowLeft") i = Math.max(0, i - 1);
  else if (e.key === "ArrowRight") i = Math.min(n - 1, i + 1);
  else if (e.key === "Home") i = 0;
  else if (e.key === "End") i = n - 1;
  else return;
  e.preventDefault();
  focusIdx.value = i;
  const btn = root()?.querySelectorAll<HTMLElement>(".ds-lane__col")[i];
  if (btn) {
    btn.focus({ preventScroll: true });
    btn.scrollIntoView({ behavior: "auto", block: "nearest", inline: "nearest" });
  }
}

/* ---- text ---- */
const shortDate = (c: LaneColumn) => `${c.month}/${c.day}`;
function dateText(c: LaneColumn) {
  if (c.today) return t("ds.chart.lane.today");
  return narrow.value && !c.monthStart ? String(c.day) : shortDate(c);
}
const weekdayText = (c: LaneColumn) => (c.weekday >= 0 ? t(`ds.chart.lane.weekday.${WEEKDAY[c.weekday]}`) : "");
function dayName(c: LaneColumn) {
  const date = c.today ? `${t("ds.chart.lane.today")} ${shortDate(c)}` : shortDate(c);
  if (!c.played) return t("ds.chart.lane.rest", { date });
  if (!c.top || c.count === 0) return t("ds.chart.lane.played", { date });
  return t("ds.chart.lane.facts", { date, fact: t(`ds.chart.lane.fact.${c.top}`), count: c.count });
}
</script>

<template>
  <div v-if="!cols.length" class="ds-lane ds-lane--empty" :class="{ 'is-compact': compact }" role="img" :aria-label="t('ds.chart.summary.empty', { name: laneName })">
    <span aria-hidden="true">{{ t("ds.chart.empty") }}</span>
  </div>
  <NuxtLink
    v-else-if="to"
    ref="el"
    :to="to"
    class="ds-lane ds-lane--overview"
    :class="{ 'is-compact': compact, 'is-narrow': narrow, 'is-faded': scrolledLeft }"
    :style="laneStyle"
    :aria-label="overviewName"
    @scroll.passive="onScroll"
  >
    <span class="ds-lane__track" aria-hidden="true">
      <span v-for="c in cols" :key="c.date" class="ds-lane__col" :class="{ 'is-monday': c.monday, 'is-today': c.today, 'is-rest': !c.played }">
        <span class="ds-lane__count num">{{ c.count > 1 ? c.count : "" }}</span>
        <span class="ds-lane__beat">
          <i v-if="c.rollL" class="ds-lane__roll is-l" />
          <i v-if="c.rollR" class="ds-lane__roll is-r" />
          <i v-if="c.today" class="ds-lane__judge" />
          <i v-if="c.kind !== 'rest'" class="ds-lane__note" :class="`is-${c.kind}`" />
          <i v-else class="ds-lane__tick" />
        </span>
        <span class="ds-lane__date"><b class="num">{{ dateText(c) }}</b></span>
      </span>
    </span>
  </NuxtLink>
  <div
    v-else
    ref="el"
    class="ds-lane"
    :class="{ 'is-compact': compact, 'is-narrow': narrow, 'is-faded': scrolledLeft }"
    :style="laneStyle"
    role="group"
    :aria-label="laneName"
    @keydown="onKey"
    @scroll.passive="onScroll"
  >
    <div class="ds-lane__track">
      <button
        v-for="(c, i) in cols"
        :key="c.date"
        type="button"
        class="ds-lane__col"
        :class="{ 'is-on': modelValue === c.date, 'is-monday': c.monday, 'is-today': c.today, 'is-rest': !c.played }"
        :aria-pressed="modelValue === c.date ? 'true' : 'false'"
        :aria-label="dayName(c)"
        :tabindex="i === tabIdx ? 0 : -1"
        :data-kind="c.kind"
        @focus="focusIdx = i"
        @click="emit('update:modelValue', c.date)"
      >
        <span class="ds-lane__count num" aria-hidden="true">{{ c.count > 1 ? c.count : "" }}</span>
        <span class="ds-lane__beat" aria-hidden="true">
          <i v-if="c.rollL" class="ds-lane__roll is-l" />
          <i v-if="c.rollR" class="ds-lane__roll is-r" />
          <i v-if="c.today" class="ds-lane__judge" />
          <i v-if="c.kind !== 'rest'" class="ds-lane__note" :class="`is-${c.kind}`" />
          <i v-else class="ds-lane__tick" />
        </span>
        <span class="ds-lane__date" aria-hidden="true">
          <b class="num">{{ dateText(c) }}</b>
          <em v-if="!compact && !narrow">{{ weekdayText(c) }}</em>
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.ds-lane {
  --band: 60px;
  --col-w: 44px;
  --ns: 1;
  display: block;
  max-inline-size: 100%;
  padding: 0 6px;
  overflow-x: auto;
  scrollbar-width: none;
  background: var(--lane);
  border-radius: var(--r-panel);
  color: var(--lane-ink);
  text-decoration: none;
}
.ds-lane::-webkit-scrollbar {
  display: none;
}
/* More days to the left: fade the edge instead of cutting a label in half (C2) */
.ds-lane.is-faded {
  -webkit-mask-image: linear-gradient(to right, transparent 0, var(--lane) 28px);
  mask-image: linear-gradient(to right, transparent 0, var(--lane) 28px);
}
.ds-lane--empty {
  display: grid;
  place-items: center;
  block-size: calc(22px + var(--band) + 40px);
  color: var(--lane-ink-2);
  font-size: var(--fs-13);
}
.ds-lane--empty.is-compact {
  block-size: calc(16px + var(--band) + 26px);
}
.ds-lane.ds-lane--overview:focus-visible {
  box-shadow: var(--focus-lane);
}
.ds-lane__track {
  display: flex;
  min-inline-size: max-content;
}
.ds-lane__col {
  position: relative;
  flex: 0 0 var(--col-w);
  min-inline-size: 0;
  display: grid;
  grid-template-rows: 22px var(--band) 40px;
  justify-items: center;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.ds-lane--overview .ds-lane__col {
  cursor: inherit;
}
.is-compact .ds-lane__col {
  grid-template-rows: 16px var(--band) 26px;
}
/* Bar line on each Monday */
.ds-lane__col.is-monday::before {
  content: "";
  position: absolute;
  left: 0;
  top: 22px;
  block-size: var(--band);
  inline-size: 1px;
  background: var(--lane-line);
}
.is-compact .ds-lane__col.is-monday::before {
  top: 16px;
}
/* Beats the shared ds focus ring (html.ds-preview .ds-root :focus-visible): the lane uses its own inset ring */
.ds-lane .ds-lane__col:focus-visible {
  outline: none;
  box-shadow: var(--focus-lane);
  border-radius: var(--r-ctl);
}
.ds-lane__count {
  align-self: end;
  font-size: var(--fs-12);
  color: var(--lane-ink-2);
}
.ds-lane__beat {
  position: relative;
  inline-size: 100%;
  block-size: var(--band);
  display: grid;
  place-items: center;
}
/* The band: two rails */
.ds-lane__beat::before {
  content: "";
  position: absolute;
  inset: 8px 0;
  border-block: 1px solid var(--lane-line);
  background: color-mix(in srgb, var(--lane-ink) 2.5%, transparent);
}
.ds-lane__col.is-on .ds-lane__beat::before {
  background: color-mix(in srgb, var(--lane-ink) 9%, transparent);
}
button.ds-lane__col:hover .ds-lane__beat::before {
  background: color-mix(in srgb, var(--lane-ink) 6%, transparent);
}
.ds-lane__roll {
  position: absolute;
  top: 50%;
  block-size: 10px;
  margin-top: -5px;
  inline-size: 50%;
  background: color-mix(in srgb, var(--lane-roll) 62%, transparent);
}
.ds-lane__roll.is-l {
  left: 0;
}
.ds-lane__roll.is-r {
  right: 0;
}
.ds-lane__note {
  position: relative;
  inline-size: calc(20px * var(--ns));
  block-size: calc(20px * var(--ns));
  border-radius: 50%;
  background: var(--lane-don);
  box-shadow: inset 0 0 0 2.5px var(--note-ring), 0 0 0 1.5px var(--note-outline);
  transition: transform var(--dur-2) var(--ease-hit);
}
.ds-lane__col.is-on .ds-lane__note,
button.ds-lane__col:hover .ds-lane__note {
  transform: scale(1.14);
}
.ds-lane__note.is-ka {
  background: var(--lane-ka);
}
.ds-lane__note.is-ghost {
  inline-size: calc(14px * var(--ns));
  block-size: calc(14px * var(--ns));
  background: var(--lane-ghost);
  box-shadow: inset 0 0 0 2px var(--lane-ghost-ring), 0 0 0 1.5px var(--note-outline);
}
.ds-lane__note.is-fc,
.ds-lane__note.is-dfc,
.ds-lane__note.is-goal {
  inline-size: calc(30px * var(--ns));
  block-size: calc(30px * var(--ns));
  box-shadow: inset 0 0 0 3.5px var(--note-ring), 0 0 0 1.5px var(--note-outline);
}
.ds-lane__note.is-fc {
  box-shadow: inset 0 0 0 3.5px var(--lane-fc), 0 0 0 1.5px var(--note-outline);
}
/* All-perfect: don face, white ring, rainbow rim */
.ds-lane__note.is-dfc {
  inline-size: calc(36px * var(--ns));
  block-size: calc(36px * var(--ns));
  background:
    radial-gradient(circle closest-side, var(--lane-don) 0 50%, var(--note-ring) 52% 72%, transparent 74%),
    var(--crown-dfc);
  box-shadow: 0 0 0 1.5px var(--note-outline);
}
.ds-lane__note.is-goal {
  background: var(--lane-roll);
}
.ds-lane__tick {
  position: relative;
  inline-size: 4px;
  block-size: 4px;
  border-radius: 50%;
  background: var(--lane-line);
}
/* Judgement circle on today */
.ds-lane__judge {
  position: absolute;
  inline-size: min(46px, var(--col-w));
  block-size: min(46px, var(--col-w));
  border-radius: 50%;
  border: 2px solid var(--lane-ink-2);
  box-shadow: inset 0 0 0 5px color-mix(in srgb, var(--lane-ink) 8%, transparent);
}
.ds-lane__date {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 6px;
  line-height: 1.2;
}
.ds-lane__date b {
  font-size: var(--fs-12);
  font-weight: 500;
  color: var(--lane-ink-2);
  white-space: nowrap;
}
.ds-lane__date em {
  font-style: normal;
  font-size: var(--fs-11);
  color: var(--lane-ink-3);
}
.ds-lane__col.is-on .ds-lane__date b,
.ds-lane__col.is-today .ds-lane__date b {
  color: var(--lane-ink);
  font-weight: 700;
}
/* Rest day: lighter weight (a tick instead of a note), not transparency */
.ds-lane__col.is-rest .ds-lane__date b {
  color: var(--lane-ink-3);
  font-weight: 400;
}
/* Reduced motion: no bounce */
@media (prefers-reduced-motion: reduce) {
  .ds-lane__note {
    transition: none;
  }
  .ds-lane__col.is-on .ds-lane__note,
  button.ds-lane__col:hover .ds-lane__note {
    transform: none;
  }
}
</style>
