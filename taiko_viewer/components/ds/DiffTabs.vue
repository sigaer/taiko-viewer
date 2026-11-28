<script lang="ts">
// DsDiffTabs — difficulty tabs for song detail (04 §7.4 tabs, P0-23).
// Each tab: icon 26px + difficulty name + ★star + constant ("—" when missing). Unselected: 1.5px --line.
// Selected: 2px --selected-line, --selected-bg, bold, a 2px bottom indicator and aria-selected — never icon colour.
// Phone (≤ 767): unselected tabs show the one-character short name; the bar scrolls sideways with edge fades and the
// selected tab is scrolled into view. Arrow keys / Home / End move the selection (tablist). Tabs are ≥ 44 × 44.
// It only emits the chosen difficulty (v-model); it never reads or writes the URL.
// `controls`: id of the tab panel the tabs switch; each tab then gets aria-controls and the id
// `<controls>-tab-<difficulty>`, which the panel uses for aria-labelledby.
import { normalizeDifficultyType, type DifficultyType } from "~/utils/difficulty";
import { diffIconSrc } from "~/utils/ds/gameAssets";
import { diffConstant, diffStar } from "./Diff.vue";

export interface DsDiffTabChart {
  difficulty: number | string;
  star?: number | string | null;
  constant?: number | string | null;
}

export interface DsDiffTabItem {
  difficulty: DifficultyType;
  icon: string;
  star: number | null;
  constant: string | null;
}

/** Valid charts in the given order; duplicates and invalid difficulties are dropped. */
export function diffTabItems(charts: readonly DsDiffTabChart[] | null | undefined): DsDiffTabItem[] {
  const seen = new Set<number>();
  const items: DsDiffTabItem[] = [];
  for (const chart of charts ?? []) {
    const difficulty = normalizeDifficultyType(chart?.difficulty);
    if (!difficulty || seen.has(difficulty)) continue;
    seen.add(difficulty);
    items.push({ difficulty, icon: diffIconSrc(difficulty)!, star: diffStar(difficulty, chart.star), constant: diffConstant(chart.constant) });
  }
  return items;
}

/** Index after a key press (wraps; Home / End), or -1 when the key does nothing. */
export function nextTabIndex(key: string, index: number, count: number): number {
  if (count <= 0) return -1;
  if (key === "ArrowRight") return (index + 1) % count;
  if (key === "ArrowLeft") return (index - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return -1;
}
</script>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type PropType } from "vue";
import { useI18n } from "vue-i18n";

const props = defineProps({
  charts: { type: Array as PropType<DsDiffTabChart[]>, required: true },
  /** Selected difficulty 1–5 */
  modelValue: { type: [Number, String] as PropType<number | string | null>, default: null },
  /** id of the controlled tab panel */
  controls: { type: String, default: "" },
  /** "lg": tiles that share the row (song detail, redesign v2): 38 px icon, name over ★star, constant on the right;
   *  on phones icon over ★star only (the name and constant stay in the accessible name). No sideways scrolling. */
  size: { type: String as PropType<"md" | "lg">, default: "md" }
});
const emit = defineEmits<{ "update:modelValue": [difficulty: DifficultyType] }>();

const { t } = useI18n();
const items = computed(() => diffTabItems(props.charts));
const selected = computed(() => normalizeDifficultyType(props.modelValue));
const tabIndex = computed(() => Math.max(0, items.value.findIndex((item) => item.difficulty === selected.value)));

const label = (item: DsDiffTabItem) =>
  [
    t(`difficulty.${item.difficulty}`),
    item.star !== null ? t("ds.diff.star", { n: item.star }) : "",
    item.constant !== null ? t("ds.diff.constant", { value: item.constant }) : t("ds.diff.noConstant")
  ]
    .filter(Boolean)
    .join(" ");
/** Caption over the constant on a large tile: the existing "定数 {value}" message without its value. */
const constantCaption = computed(() => t("ds.diff.constant", { value: "" }).trim());

const scroller = ref<HTMLElement | null>(null);
const tabs = ref<HTMLElement[]>([]);
const fadeStart = ref(false);
const fadeEnd = ref(false);

function updateFades() {
  const el = scroller.value;
  if (!el) return;
  fadeStart.value = el.scrollLeft > 1;
  fadeEnd.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
}

function reveal(smooth: boolean) {
  const el = scroller.value;
  const tab = tabs.value[tabIndex.value];
  if (!el || !tab) return;
  const pad = 24;
  const left = tab.offsetLeft; // the bar is the tabs' offsetParent
  const right = left + tab.offsetWidth;
  let target = el.scrollLeft;
  if (left - pad < el.scrollLeft) target = Math.max(0, left - pad);
  else if (right + pad > el.scrollLeft + el.clientWidth) target = right + pad - el.clientWidth;
  if (target !== el.scrollLeft) {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: target, behavior: smooth && !reduce ? "smooth" : "auto" });
  }
  updateFades();
}

function choose(difficulty: DifficultyType) {
  if (difficulty !== selected.value) emit("update:modelValue", difficulty);
}

function onKeydown(event: KeyboardEvent, index: number) {
  const next = nextTabIndex(event.key, index, items.value.length);
  if (next < 0) return;
  event.preventDefault();
  choose(items.value[next].difficulty);
  nextTick(() => tabs.value[next]?.focus());
}

let resizeObserver: ResizeObserver | null = null;
onMounted(() => {
  reveal(false);
  if (typeof ResizeObserver !== "undefined" && scroller.value) {
    resizeObserver = new ResizeObserver(() => updateFades());
    resizeObserver.observe(scroller.value);
  }
});
onBeforeUnmount(() => resizeObserver?.disconnect());
watch(selected, () => nextTick(() => reveal(true)));
</script>

<template>
  <div class="ds-difftabs" :class="[`ds-difftabs--${size}`, { 'has-fade-start': fadeStart, 'has-fade-end': fadeEnd }]">
    <div ref="scroller" class="ds-difftabs__bar" role="tablist" :aria-label="t('ds.diff.tabs')" @scroll.passive="updateFades">
      <button
        v-for="(item, index) in items"
        :key="item.difficulty"
        ref="tabs"
        type="button"
        role="tab"
        class="ds-difftab"
        :aria-selected="item.difficulty === selected ? 'true' : 'false'"
        :tabindex="index === tabIndex ? 0 : -1"
        :id="controls ? `${controls}-tab-${item.difficulty}` : undefined"
        :aria-controls="controls || undefined"
        :data-difficulty="item.difficulty"
        @click="choose(item.difficulty)"
        @keydown="onKeydown($event, index)"
      >
        <span class="ds-difftab__icon" aria-hidden="true">
          <img class="ds-difftab__img" :src="item.icon" alt="" width="26" height="26" decoding="async" />
        </span>
        <template v-if="size === 'lg'">
          <span class="ds-difftab__main" aria-hidden="true">
            <span class="ds-difftab__name">{{ t(`difficulty.${item.difficulty}`) }}</span>
            <span v-if="item.star !== null" class="ds-difftab__star num">★{{ item.star }}</span>
          </span>
          <span class="ds-difftab__const" aria-hidden="true">
            <span class="ds-difftab__cap">{{ constantCaption }}</span>
            <span v-if="item.constant !== null" class="ds-difftab__constant num">{{ item.constant }}</span>
            <span v-else class="ds-difftab__constant is-missing">—</span>
          </span>
        </template>
        <template v-else>
          <span class="ds-difftab__name" aria-hidden="true">{{ t(`difficulty.${item.difficulty}`) }}</span>
          <span class="ds-difftab__short" aria-hidden="true">{{ t(`ds.diff.short.${item.difficulty}`) }}</span>
          <span v-if="item.star !== null" class="ds-difftab__star num" aria-hidden="true">★{{ item.star }}</span>
          <span v-if="item.constant !== null" class="ds-difftab__constant num" aria-hidden="true">{{ item.constant }}</span>
          <span v-else class="ds-difftab__constant is-missing" aria-hidden="true">—</span>
        </template>
        <span class="ds-difftab__sr">{{ label(item) }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.ds-difftabs {
  --ds-difftabs-fade: var(--bg);
  position: relative;
  min-width: 0;
}
.ds-difftabs__bar {
  position: relative;
  display: flex;
  gap: 8px;
  padding: 2px;
  overflow-x: auto;
  scrollbar-width: none;
}
.ds-difftabs__bar::-webkit-scrollbar {
  display: none;
}
/* Edge fades: a background-colour gradient over the scroll edges, shown only when there is more to scroll. */
.ds-difftabs::before,
.ds-difftabs::after {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 1;
  width: 28px;
  pointer-events: none;
  visibility: hidden;
}
.ds-difftabs::before {
  left: 0;
  background: linear-gradient(to right, var(--ds-difftabs-fade), transparent);
}
.ds-difftabs::after {
  right: 0;
  background: linear-gradient(to left, var(--ds-difftabs-fade), transparent);
}
.ds-difftabs.has-fade-start::before,
.ds-difftabs.has-fade-end::after {
  visibility: visible;
}
.ds-difftab {
  position: relative;
  display: inline-flex;
  align-items: center;
  flex: none;
  gap: 6px;
  min-width: var(--hit);
  height: var(--hit);
  padding: 0 14px 0 10px;
  border: 1.5px solid var(--line);
  border-radius: var(--ctl-radius);
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color var(--dur-1);
}
.ds-difftab:hover {
  background: var(--bg-sunk);
}
.ds-difftab:focus-visible {
  outline: none;
  box-shadow: var(--focus);
}
.ds-difftab[aria-selected="true"] {
  border-color: var(--selected-line);
  box-shadow: inset 0 0 0 0.5px var(--selected-line);
  background: var(--selected-bg);
}
.ds-difftab[aria-selected="true"]:focus-visible {
  box-shadow: inset 0 0 0 0.5px var(--selected-line), var(--focus);
}
.ds-difftab[aria-selected="true"]::after {
  content: "";
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: 3px;
  height: 2px;
  border-radius: 2px;
  background: var(--selected-line);
}
.ds-difftab__icon {
  display: inline-grid;
  place-items: center;
  flex: none;
  width: 26px;
  height: 26px;
}
.ds-difftab__img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.ds-difftab__name {
  font-size: var(--fs-13);
  font-weight: 500;
}
.ds-difftab[aria-selected="true"] .ds-difftab__name {
  font-weight: 700;
}
.ds-difftab__short {
  display: none;
  font-size: var(--fs-13);
  font-weight: 700;
}
.ds-difftabs .ds-difftab__star {
  font-size: var(--fs-18);
  font-weight: 700;
}
.ds-difftab__constant {
  font-size: var(--fs-16);
  color: var(--ink-2);
}
.ds-difftab[aria-selected="true"] .ds-difftab__constant {
  color: var(--ink);
}
.ds-difftab__constant.is-missing {
  color: var(--ink-3);
}
.ds-difftab__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
@media (max-width: 767px) {
  .ds-difftab {
    height: var(--ctl-h-lg);
    padding: 0 12px 0 8px;
  }
  .ds-difftab:not([aria-selected="true"]) .ds-difftab__name {
    display: none;
  }
  .ds-difftab:not([aria-selected="true"]) .ds-difftab__short {
    display: inline;
  }
}
/* ---------- lg: tiles sharing the row ---------- */
.ds-difftabs--lg .ds-difftabs__bar {
  flex-wrap: wrap;
  gap: 12px;
  overflow: visible;
}
.ds-difftabs--lg .ds-difftab {
  flex: 1 1 170px;
  gap: 12px;
  min-width: 0;
  height: 72px;
  padding: 0 16px;
  border-radius: var(--r-panel);
  text-align: left;
}
.ds-difftabs--lg .ds-difftab[aria-selected="true"] {
  border-width: 2px;
  box-shadow: none;
}
.ds-difftabs--lg .ds-difftab[aria-selected="true"]:focus-visible {
  box-shadow: var(--focus);
}
.ds-difftabs--lg .ds-difftab[aria-selected="true"]::after {
  display: none;
}
.ds-difftabs--lg .ds-difftab__icon {
  width: 38px;
  height: 38px;
}
.ds-difftab__main,
.ds-difftab__const {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.25;
}
.ds-difftab__const {
  align-items: flex-end;
  margin-left: auto;
}
.ds-difftabs--lg .ds-difftab__name {
  color: var(--ink-2);
}
.ds-difftabs--lg .ds-difftab[aria-selected="true"] .ds-difftab__name {
  color: var(--selected-ink);
}
.ds-difftabs--lg .ds-difftab__star {
  font-family: var(--font-display, var(--font-ui));
  font-size: var(--fs-22);
  font-weight: 800;
}
.ds-difftab__cap {
  font-size: var(--fs-12);
  color: var(--ink-3);
}
.ds-difftabs--lg .ds-difftab__constant {
  font-family: var(--font-display, var(--font-ui));
  font-size: var(--fs-16);
  font-weight: 800;
  color: var(--ink);
}
.ds-difftabs--lg .ds-difftab__constant.is-missing {
  color: var(--ink-3);
}
@media (max-width: 767px) {
  .ds-difftabs--lg .ds-difftabs__bar {
    flex-wrap: nowrap;
    gap: 8px;
  }
  .ds-difftabs--lg .ds-difftab {
    flex: 1 1 0;
    flex-direction: column;
    justify-content: center;
    gap: 1px;
    height: 68px;
    padding: 0 4px;
    text-align: center;
  }
  .ds-difftabs--lg .ds-difftab__icon {
    width: 26px;
    height: 26px;
  }
  .ds-difftabs--lg .ds-difftab__main {
    align-items: center;
  }
  .ds-difftabs--lg .ds-difftab__name,
  .ds-difftabs--lg .ds-difftab__const {
    display: none;
  }
  .ds-difftabs--lg .ds-difftab__star {
    font-size: var(--fs-16);
  }
}
</style>
