<script setup lang="ts">
// Constants table (pages/songs/constants.vue renders it; the page keeps the request, the filter state and the
// debounce). Server-side sorting on every column, a difficulty filter, paging with page size and jump, and the
// inspector for the selected row: the right column from 1240 px, a dialog below. A table from 768 px (columns drop
// by priority: 75% / 99% below 1240, the five ability values below 1100); rows below 768 px.
// Range filter: value column + min / max inputs (the page debounces, applies and mirrors them in the URL); the
// column of an active non-default range is emphasised like a sorted one and stays visible at every width.
import { computed, onDeactivated, onMounted, ref } from "vue";
import type { V2ConstantsDifficulty, V2ConstantsDimension, V2ConstantsItem, V2ConstantsPayload, V2ConstantsSortKey } from "~/types/content";
import { CONSTANT_DIMENSIONS, DEFAULT_DIMENSION, formatBound, parseRangeBound } from "~/utils/rework/constantQuery";

const props = defineProps<{
  payload: V2ConstantsPayload;
  pending: boolean;
  failed: boolean;
  filtered: boolean;
  /** Dimension of the applied range filter, null when none is active */
  rangeActive?: V2ConstantsDimension | null;
}>();
const emit = defineEmits<{ retry: []; clear: [] }>();
const keywordInput = defineModel<string>("keywordInput", { required: true });
const difficulty = defineModel<"" | V2ConstantsDifficulty>("difficulty", { required: true });
const page = defineModel<number>("page", { required: true });
const pageSize = defineModel<number>("pageSize", { required: true });
const sortBy = defineModel<V2ConstantsSortKey>("sortBy", { required: true });
const sortOrder = defineModel<"asc" | "desc">("sortOrder", { required: true });
const rangeDimension = defineModel<V2ConstantsDimension>("rangeDimension", { required: true });
const rangeMin = defineModel<string>("rangeMin", { required: true });
const rangeMax = defineModel<string>("rangeMax", { required: true });
const { t, locale } = useI18n();

const payload = computed(() => props.payload);
const difficultyOptions: V2ConstantsDifficulty[] = ["hard", "oni", "edit"];
const difficultyI18nKey: Record<V2ConstantsDifficulty, string> = {
  hard: "difficulty.3",
  oni: "difficulty.4",
  edit: "difficulty.5"
};
const difficultyCode: Record<V2ConstantsDifficulty, number> = { hard: 3, oni: 4, edit: 5 };

const formatMetric = (value: number) => Number(value).toFixed(2);
// Generation time: server render and hydration print the same fixed UTC text ("2026-11-18 08:44 UTC"); after mount
// it becomes date and time to the minute in the viewer's time zone and the page language. <time datetime> keeps the
// exact value either way.
const mounted = ref(false);
onMounted(() => (mounted.value = true));
const generated = computed(() => {
  const date = new Date(payload.value.generatedAt);
  if (!payload.value.generatedAt || Number.isNaN(date.getTime())) return null;
  return { iso: date.toISOString(), utc: `${date.toISOString().slice(0, 16).replace("T", " ")} UTC` };
});
const generatedText = computed(() => {
  if (!generated.value) return "—";
  if (!mounted.value) return generated.value.utc;
  return new Intl.DateTimeFormat(locale.value, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(generated.value.iso));
});
const getRowKey = (row: V2ConstantsItem) => `${row.id}-${row.difficulty}`;
const count = (value: number) => new Intl.NumberFormat(locale.value).format(value);

// ---------- Sorting (server side, same keys as before; a new column starts ascending for id / title / difficulty
// and descending for numbers, the same column flips) ----------
const ASCENDING_FIRST: V2ConstantsSortKey[] = ["id", "songName", "difficulty"];
const sortChange = (key: V2ConstantsSortKey) => {
  if (sortBy.value === key) sortOrder.value = sortOrder.value === "asc" ? "desc" : "asc";
  else {
    sortBy.value = key;
    sortOrder.value = ASCENDING_FIRST.includes(key) ? "asc" : "desc";
  }
  page.value = 1;
};
const ariaSort = (key: V2ConstantsSortKey) => (sortBy.value === key ? (sortOrder.value === "asc" ? "ascending" : "descending") : "none");
const constantColumns: { key: V2ConstantsSortKey; cls: string }[] = [
  { key: "mainConstant", cls: "c-main" },
  { key: "subConstant1", cls: "c-alt" },
  { key: "subConstant2", cls: "c-alt" },
  { key: "totalNotes", cls: "c-notes" }
];
const metricColumns: V2ConstantsSortKey[] = ["stamina", "handspeed", "burst", "complex", "rhythm"];
const sortOptions: V2ConstantsSortKey[] = ["id", "songName", "difficulty", "mainConstant", "subConstant1", "subConstant2", "totalNotes", ...metricColumns];
/** Column names (static keys, checked against the locale files) */
const COLUMN_KEYS = {
  id: "page.songs.v2Constants.columns.id",
  songName: "page.songs.v2Constants.columns.songName",
  difficulty: "page.songs.v2Constants.columns.difficulty",
  totalNotes: "page.songs.v2Constants.columns.totalNotes",
  subConstant1: "page.songs.v2Constants.columns.subConstant1",
  mainConstant: "page.songs.v2Constants.columns.mainConstant",
  subConstant2: "page.songs.v2Constants.columns.subConstant2",
  stamina: "page.songs.v2Constants.columns.stamina",
  handspeed: "page.songs.v2Constants.columns.handspeed",
  burst: "page.songs.v2Constants.columns.burst",
  complex: "page.songs.v2Constants.columns.complex",
  rhythm: "page.songs.v2Constants.columns.rhythm"
} as const;
const columnLabel = (key: V2ConstantsSortKey) => t(COLUMN_KEYS[key]);
const mobileSort = computed({
  get: () => sortBy.value,
  set: (key: V2ConstantsSortKey) => {
    sortBy.value = key;
    sortOrder.value = ASCENDING_FIRST.includes(key) ? "asc" : "desc";
    page.value = 1;
  }
});
const toggleOrder = () => {
  sortOrder.value = sortOrder.value === "asc" ? "desc" : "asc";
  page.value = 1;
};
/** Emphasised value column: the sort column unless it is main constant, title, id or difficulty; otherwise the
 *  column of an active range filter on another dimension. */
const emphasis = computed<V2ConstantsSortKey | null>(() => {
  if (!["mainConstant", "songName", "id", "difficulty"].includes(sortBy.value)) return sortBy.value;
  return props.rangeActive && props.rangeActive !== DEFAULT_DIMENSION ? props.rangeActive : null;
});
const isEmphasis = (key: V2ConstantsSortKey) => sortBy.value === key || emphasis.value === key;
/** The emphasised value shown on a phone row. */
const sortedValue = (row: V2ConstantsItem) =>
  emphasis.value === null
    ? null
    : emphasis.value === "totalNotes"
      ? count(row.totalNotes)
      : formatMetric(row[emphasis.value as keyof V2ConstantsItem] as number);
/** On leaving a bound input, show the value the filter uses (clamped, tidy); text that is not a number stays. */
const tidyBound = (which: "min" | "max") => {
  const model = which === "min" ? rangeMin : rangeMax;
  const value = parseRangeBound(model.value);
  if (value !== null) model.value = formatBound(value);
};
/** Ability bar width in whole percent of a 0–15.5 scale (the prototype's scale), capped at 100. */
const barWidth = (value: number) => `${Math.max(0, Math.min(100, Math.round((Number(value) / 15.5) * 100)))}%`;

const filtered = computed(() => props.filtered);
const clearFilters = () => emit("clear");

// ---------- Paging ----------
const pages = computed(() => Math.max(1, Math.ceil(payload.value.total / Math.max(1, payload.value.pageSize || pageSize.value))));
const listTop = ref<HTMLElement | null>(null);
const goToPage = (next: number) => {
  page.value = Math.min(Math.max(1, Math.floor(next)), pages.value);
  const top = listTop.value?.getBoundingClientRect().top;
  if (top !== undefined && top < 0) listTop.value?.scrollIntoView({ block: "start" });
};
const jumpInput = ref("");
const jump = () => {
  const target = Number(jumpInput.value);
  if (Number.isFinite(target) && target >= 1) goToPage(target);
  jumpInput.value = "";
};
const pageSizes = [25, 50, 100];

// ---------- Selection: right column from 1240 px, a dialog below ----------
const selectedKey = ref("");
const dialogOpen = ref(false);
// The dialog exists only while it is open (and while it closes), so a kept-alive page leaves nothing in <body>.
const dialogMounted = ref(false);
onDeactivated(() => {
  dialogOpen.value = false;
  dialogMounted.value = false;
});
const items = computed(() => payload.value.items);
const selected = computed(() => items.value.find((row) => getRowKey(row) === selectedKey.value) || items.value[0] || null);
const isSelected = (row: V2ConstantsItem) => Boolean(selected.value) && getRowKey(row) === getRowKey(selected.value!);
const pick = (row: V2ConstantsItem) => {
  selectedKey.value = getRowKey(row);
  if (!window.matchMedia("(min-width: 1240px)").matches) {
    dialogMounted.value = true;
    dialogOpen.value = true;
  }
};
const rowLabel = (row: V2ConstantsItem) => t("rework.constantsTable.select", { title: row.songName, difficulty: t(difficultyI18nKey[row.difficulty]) });

const summary = computed(() => (props.failed ? "" : t("page.songs.v2Constants.summary", { total: payload.value.total })));
const view = computed(() => {
  if (props.failed) return "failed";
  if (props.pending && !items.value.length) return "loading";
  if (!items.value.length) return "empty";
  return "rows";
});
</script>

<template>
  <div class="ct">
    <ReworkPageHeader :title="t('page.songs.v2Constants.title')">
      <p class="ct-meta">
        <span role="status" aria-live="polite">{{ summary }}</span>
        <span>{{ t("page.songs.v2Constants.generatedAt") }} <time class="num" :datetime="generated?.iso">{{ generatedText }}</time></span>
      </p>
    </ReworkPageHeader>

    <p v-if="payload.stale" class="ct-notice" role="status">
      {{ t(payload.fetchedAt ? "page.songs.v2Constants.stale" : "page.songs.v2Constants.partial") }}
    </p>

    <section class="ct-tools" :aria-label="t('rework.library.filters')">
      <label class="ct-search">
        <span class="rw-vh">{{ t("rework.constantsTable.search") }}</span>
        <ReworkIcon name="search" />
        <input v-model="keywordInput" type="search" enterkeyhint="search" autocomplete="off" spellcheck="false" :placeholder="t('page.songs.v2Constants.searchPlaceholder')" />
      </label>
      <div class="seg" role="group" :aria-label="t('rework.constantsTable.difficulty')">
        <button type="button" :aria-pressed="difficulty === ''" @click="difficulty = ''">{{ t("rework.constantsTable.allDifficulties") }}</button>
        <button v-for="item in difficultyOptions" :key="item" type="button" :aria-pressed="difficulty === item" @click="difficulty = item">
          <span class="seg-icon" aria-hidden="true"><DsDiff :difficulty="difficultyCode[item]" :show-constant="false" class="seg-diff" /></span>{{ t(difficultyI18nKey[item]) }}
        </button>
      </div>
      <div class="ct-range" role="group" :aria-label="t('rework.constantsTable.range')">
        <label class="rw-vh" for="ct-range-dim">{{ t("rework.constantsTable.rangeColumn") }}</label>
        <select id="ct-range-dim" v-model="rangeDimension" class="ct-select">
          <option v-for="key in CONSTANT_DIMENSIONS" :key="key" :value="key">{{ columnLabel(key) }}</option>
        </select>
        <input v-model="rangeMin" class="ct-bound" type="text" inputmode="decimal" autocomplete="off" :aria-label="t('rework.constantsTable.rangeMin')" :placeholder="t('rework.constantsTable.rangeMin')" @change="tidyBound('min')" />
        <span aria-hidden="true">–</span>
        <input v-model="rangeMax" class="ct-bound" type="text" inputmode="decimal" autocomplete="off" :aria-label="t('rework.constantsTable.rangeMax')" :placeholder="t('rework.constantsTable.rangeMax')" @change="tidyBound('max')" />
      </div>
      <button v-if="filtered" type="button" class="rw-btn rw-btn--ghost" @click="clearFilters">{{ t("rework.constantsTable.clear") }}</button>
      <div class="ct-msort">
        <label class="rw-vh" for="ct-sort">{{ t("rework.constantsTable.sortLabel") }}</label>
        <select id="ct-sort" v-model="mobileSort" class="ct-select">
          <option v-for="key in sortOptions" :key="key" :value="key">{{ t("rework.constantsTable.sortBy", { column: columnLabel(key) }) }}</option>
        </select>
        <button type="button" class="rw-btn ct-dir" :aria-label="t(sortOrder === 'asc' ? 'rework.constantsTable.asc' : 'rework.constantsTable.desc')" @click="toggleOrder">
          <ReworkIcon name="back" :class="sortOrder === 'asc' ? 'is-up' : 'is-down'" />
        </button>
      </div>
    </section>

    <div ref="listTop" class="ct-layout">
      <div class="ct-main">
        <ReworkState v-if="view === 'failed'" kind="failed" :title="t('page.songs.v2Constants.loadFailed')" @retry="emit('retry')" />
        <ReworkState v-else-if="view === 'loading'" kind="loading" :lines="8" />
        <ReworkState v-else-if="view === 'empty'" kind="empty" :title="t('page.songs.v2Constants.empty')">
          <button v-if="filtered" type="button" class="rw-btn" @click="clearFilters">{{ t("rework.constantsTable.clear") }}</button>
        </ReworkState>
        <template v-else>
          <div class="ct-table-wrap" :class="{ 'is-stale': pending }" :aria-busy="pending">
            <table class="ct-table">
              <caption class="rw-vh">{{ t("page.songs.v2Constants.title") }} · {{ summary }}</caption>
              <thead>
                <tr>
                  <th scope="col" class="c-song" :aria-sort="ariaSort('songName')">
                    <button type="button" @click="sortChange('songName')">{{ t("rework.constantsTable.song") }}<ReworkIcon v-if="sortBy === 'songName'" name="back" :class="sortOrder === 'asc' ? 'is-up' : 'is-down'" /></button>
                  </th>
                  <th scope="col" class="c-id" :aria-sort="ariaSort('id')">
                    <button type="button" @click="sortChange('id')">{{ columnLabel("id") }}<ReworkIcon v-if="sortBy === 'id'" name="back" :class="sortOrder === 'asc' ? 'is-up' : 'is-down'" /></button>
                  </th>
                  <th scope="col" class="c-diff" :aria-sort="ariaSort('difficulty')">
                    <button type="button" @click="sortChange('difficulty')">{{ columnLabel("difficulty") }}<ReworkIcon v-if="sortBy === 'difficulty'" name="back" :class="sortOrder === 'asc' ? 'is-up' : 'is-down'" /></button>
                  </th>
                  <th v-for="column in constantColumns" :key="column.key" scope="col" class="r" :class="[column.cls, { 'is-emph': emphasis === column.key }]" :aria-sort="ariaSort(column.key)">
                    <button type="button" @click="sortChange(column.key)">{{ columnLabel(column.key) }}<ReworkIcon v-if="sortBy === column.key" name="back" :class="sortOrder === 'asc' ? 'is-up' : 'is-down'" /></button>
                  </th>
                  <th v-for="key in metricColumns" :key="key" scope="col" class="r c-ab" :class="{ 'is-emph': emphasis === key }" :aria-sort="ariaSort(key)">
                    <button type="button" @click="sortChange(key)">{{ columnLabel(key) }}<ReworkIcon v-if="sortBy === key" name="back" :class="sortOrder === 'asc' ? 'is-up' : 'is-down'" /></button>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in items" :key="getRowKey(row)" :class="{ 'is-sel': isSelected(row), 'is-implicit': !selectedKey }">
                  <td class="c-song">
                    <button type="button" class="row-btn" :aria-pressed="Boolean(selectedKey) && isSelected(row)" :aria-label="rowLabel(row)" @click="pick(row)">
                      <DsSongCell :song-id="row.id" :title="row.songName" title-lang="zh-CN" cover-size="sm" />
                    </button>
                    <small v-if="row.matchedAlias" class="ct-alias">{{ t("rework.aliasMatch") }} · <span>{{ row.matchedAlias }}</span></small>
                  </td>
                  <td class="c-id num">{{ row.id }}</td>
                  <td class="c-diff"><DsDiff :difficulty="difficultyCode[row.difficulty]" :show-constant="false" /></td>
                  <td v-for="column in constantColumns" :key="column.key" class="r" :class="[column.cls, { 'is-sorted': isEmphasis(column.key), 'is-emph': emphasis === column.key }]">
                    <span class="rw-vh">{{ columnLabel(column.key) }} </span>
                    <span class="num">{{ column.key === "totalNotes" ? count(row.totalNotes) : formatMetric(row[column.key] as number) }}</span>
                  </td>
                  <td v-for="key in metricColumns" :key="key" class="r c-ab" :class="{ 'is-sorted': isEmphasis(key), 'is-emph': emphasis === key }">
                    <span class="ab">
                      <span class="num">{{ formatMetric(row[key] as number) }}</span>
                      <span class="ab-bar" aria-hidden="true"><span :style="{ width: barWidth(row[key] as number) }" /></span>
                    </span>
                  </td>
                  <td class="c-sorted" aria-hidden="true">
                    <template v-if="emphasis !== null">{{ columnLabel(emphasis) }} <b class="num">{{ sortedValue(row) }}</b></template>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="ct-paging">
            <div class="ct-size">
              <span aria-hidden="true">{{ t("rework.constantsTable.pageSize") }}</span>
              <el-select v-model="pageSize" class="ct-size-select" :aria-label="t('rework.constantsTable.pageSize')" :teleported="true" :persistent="false">
                <el-option v-for="size in pageSizes" :key="size" :value="size" :label="t('rework.constantsTable.pageSizeOption', { n: size })" />
              </el-select>
            </div>
            <ReworkPager v-if="pages > 1" :page="payload.page" :count="pages" @select="goToPage" />
            <form v-if="pages > 1" class="ct-jump" @submit.prevent="jump">
              <label for="ct-jump-input">{{ t("rework.constantsTable.jump") }}</label>
              <input id="ct-jump-input" v-model="jumpInput" type="number" inputmode="numeric" min="1" :max="pages" />
              <span>{{ t("rework.constantsTable.jumpUnit") }}</span>
              <button type="submit" class="rw-btn rw-btn--sm">{{ t("rework.constantsTable.jumpGo") }}</button>
            </form>
          </div>
        </template>
      </div>
      <aside v-if="selected && view === 'rows'" class="ct-aside" :aria-label="t('rework.constantsTable.inspector')">
        <ReworkConstantsInspector :row="selected" />
      </aside>
    </div>

    <el-dialog v-if="dialogMounted" v-model="dialogOpen" class="ct-dialog" :title="t('rework.constantsTable.inspector')" width="min(440px, calc(100vw - 32px))" append-to-body destroy-on-close @closed="dialogMounted = false">
      <ReworkConstantsInspector v-if="selected" :row="selected" :heading-level="3" />
    </el-dialog>
  </div>
</template>

<style scoped>
.ct {
  min-width: 0;
  font-family: var(--font-ui);
  color: var(--ink);
}
.ct-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-1) var(--sp-5);
  margin: var(--sp-2) 0 0;
  font-size: var(--fs-13);
  color: var(--ink-3);
}
.ct-notice {
  margin: var(--sp-4) 0 0;
  padding: var(--sp-3) var(--sp-4);
  border-radius: var(--r-ctl);
  background: var(--warn-wash);
  color: var(--ink);
  font-size: var(--fs-14);
}
/* ---------- Filter card (the song library's control language) ---------- */
.ct-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-3);
  margin: var(--sp-5) 0 var(--sp-4);
  padding: var(--sp-4) 18px;
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
}
.ct-search {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1 1 260px;
  min-width: 0;
  height: var(--hit);
  padding: 0 14px;
  box-sizing: border-box;
  border: 1.5px solid var(--ctl-border);
  border-radius: var(--r-ctl);
  background: var(--surface);
  color: var(--ink-3);
}
.ct-search:focus-within {
  border-color: var(--input-focus-line);
  box-shadow: var(--focus);
}
.ct-search input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: 0;
  background: none;
  color: var(--ink);
  font: inherit;
  font-size: var(--fs-16);
  outline: none;
}
.seg {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 2px;
  padding: 4px;
  border-radius: var(--r-ctl);
  background: var(--bg-sunk);
}
.seg button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 36px;
  padding: 0 var(--sp-3);
  border: 0;
  border-radius: calc(var(--r-ctl) - 3px);
  background: transparent;
  color: var(--ink-2);
  font: inherit;
  font-size: var(--fs-14);
  font-weight: 600;
  cursor: pointer;
}
/* 44 px touch target over the 36 px segment */
.seg button::before {
  content: "";
  position: absolute;
  inset: -4px 0;
}
.seg button[aria-pressed="true"] {
  background: var(--seg-on-bg);
  color: var(--seg-on-ink);
  font-weight: 700;
  box-shadow: 0 0 0 1px var(--seg-on-ring);
}
.seg button:focus-visible,
.row-btn:focus-visible,
th button:focus-visible,
select:focus-visible,
.ct-bound:focus-visible,
.ct-jump input:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 1px;
}
/* Only the icon of the badge: the name is the button text */
.seg-icon {
  display: inline-flex;
}
.seg-diff {
  padding: 0;
  border: 0;
  background: transparent;
}
.ct-msort {
  display: none;
  gap: var(--sp-2);
  flex: 1 1 100%;
}
.ct-range {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  color: var(--ink-3);
}
.ct-range .ct-select {
  flex: 0 1 auto;
}
.ct-bound {
  width: 72px;
  min-width: 0;
  min-height: var(--hit);
  padding: 0 var(--sp-2);
  box-sizing: border-box;
  border: 1.5px solid var(--ctl-border);
  border-radius: var(--r-ctl);
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: var(--fs-16);
  font-variant-numeric: tabular-nums;
}
.ct-msort select {
  flex: 1;
}
.ct-select {
  min-width: 0;
  min-height: var(--hit);
  padding: 0 var(--sp-3);
  box-sizing: border-box;
  border: 1.5px solid var(--ctl-border);
  border-radius: var(--r-ctl);
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: var(--fs-16);
}
.ct-dir {
  width: var(--hit);
  padding: 0;
}
.is-up {
  transform: rotate(90deg);
}
.is-down {
  transform: rotate(-90deg);
}
/* ---------- Layout ---------- */
.ct-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--sp-5);
  align-items: start;
  scroll-margin-top: calc(var(--bar-h) + var(--sp-4));
}
.ct-main {
  min-width: 0;
}
.ct-aside {
  display: none;
}
/* ---------- Table ---------- */
.ct-table-wrap {
  position: relative;
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
  overflow: hidden;
}
.ct-table-wrap.is-stale::after {
  content: "";
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--surface) 55%, transparent);
  pointer-events: none;
}
.ct-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--fs-14);
}
th {
  height: var(--hit);
  padding: 0 6px;
  border-bottom: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink-2);
  font-size: var(--fs-12);
  font-weight: 700;
  text-align: left;
  white-space: nowrap;
}
th button {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-height: var(--hit);
  padding: 0 4px;
  border: 0;
  border-radius: var(--r-xs);
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}
th[aria-sort="ascending"] button,
th[aria-sort="descending"] button {
  color: var(--ink);
  font-weight: 700;
}
th button :deep(svg) {
  width: 12px;
  height: 12px;
}
td {
  height: 52px;
  padding: 0 6px;
  border-bottom: 1px solid var(--line);
  white-space: nowrap;
  color: var(--ink-2);
}
tbody tr:last-child td {
  border-bottom: 0;
}
th:first-child,
td:first-child {
  padding-left: var(--sp-4);
}
th:last-of-type,
td.c-ab:last-of-type {
  padding-right: var(--sp-4);
}
.r {
  text-align: right;
}
th.r button {
  flex-direction: row-reverse;
}
.c-song {
  width: 100%;
  max-width: 0;
}
.ct-alias {
  display: block;
  overflow: hidden;
  padding-left: calc(32px + var(--sp-3));
  font-size: var(--fs-12);
  color: var(--ink-3);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ct-alias span {
  color: var(--ink-2);
}
.row-btn {
  display: block;
  width: 100%;
  min-height: var(--hit);
  padding: 0;
  border: 0;
  border-radius: var(--r-ctl);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.row-btn:hover :deep(.ds-songcell__title) {
  color: var(--link);
}
tr.is-sel td {
  background: var(--row-sel-bg);
}
tr.is-sel td.c-song {
  box-shadow: inset 3px 0 0 var(--row-sel-line);
}
.c-id {
  color: var(--ink-3);
  font-size: var(--fs-13);
}
td .num {
  color: var(--ink-2);
}
td.c-main .num {
  font-size: var(--fs-16);
  font-weight: 700;
  color: var(--emph-num);
}
td.is-sorted:not(.c-main) .num {
  color: var(--ink);
  font-weight: 700;
}
.ab {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  width: 42px;
  line-height: 1.2;
}
.ab-bar {
  display: block;
  width: 100%;
  height: 3px;
  border-radius: 2px;
  background: var(--bg-sunk);
  overflow: hidden;
}
.ab-bar span {
  display: block;
  height: 100%;
  border-radius: 2px;
  background: var(--series-alt);
}
.c-sorted {
  display: none;
}
/* ---------- Paging ---------- */
.ct-paging {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3) var(--sp-5);
  margin-top: var(--sp-4);
}
.ct-paging :deep(.pager) {
  margin-top: 0;
}
.ct-size,
.ct-jump {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.ct-size-select {
  width: 112px;
}
.ct-jump input {
  width: 64px;
  min-height: var(--hit);
  padding: 0 var(--sp-2);
  border: 1px solid var(--ctl-border);
  border-radius: var(--r-ctl);
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: var(--fs-16);
}
/* Column priority: ≥ 1240 all (and the inspector column); 1100–1239 without 75% / 99%; 768–1099 without the five
   ability values (they are in the inspector dialog); < 768 rows. */
@media (min-width: 1240px) {
  .ct-layout {
    grid-template-columns: minmax(0, 1fr) 328px;
  }
  .ct-aside {
    display: block;
    position: sticky;
    top: calc(var(--bar-h) + var(--sp-4));
    max-height: calc(100dvh - var(--bar-h) - 32px);
    overflow-y: auto;
    padding: var(--sp-5);
    border: 1px solid var(--line);
    border-radius: var(--r-panel);
    background: var(--surface);
  }
}
@media (max-width: 1239px) {
  .ct-table .c-alt:not(.is-emph) {
    display: none;
  }
  /* Without the inspector column nothing is selected until a row is chosen */
  tr.is-sel.is-implicit td {
    background: transparent;
  }
  tr.is-sel.is-implicit td.c-song {
    box-shadow: none;
  }
}
@media (max-width: 1099px) {
  .ct-table .c-ab:not(.is-emph) {
    display: none;
  }
}
@media (max-width: 767px) {
  .ct-tools {
    padding: var(--sp-3);
  }
  .ct-search {
    flex-basis: 100%;
  }
  .seg {
    flex: 1 1 auto;
  }
  .ct-range {
    flex: 1 1 100%;
  }
  .ct-range .ct-select {
    flex: 1 1 auto;
  }
  .ct-msort {
    display: flex;
  }
  .ct-table thead,
  .ct-table .c-id,
  .ct-table .c-notes,
  .ct-table .c-alt,
  .ct-table .c-ab {
    display: none;
  }
  .ct-table,
  .ct-table tbody {
    display: block;
  }
  .ct-table tr {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      "song main"
      "diff sorted";
    align-items: center;
    column-gap: var(--sp-3);
    padding: var(--sp-2) var(--sp-4);
    border-bottom: 1px solid var(--line);
  }
  .ct-table tbody tr:last-child {
    border-bottom: 0;
  }
  .ct-table td:not(.c-id, .c-notes, .c-alt, .c-ab) {
    display: block;
    height: auto;
    padding: 0;
    border: 0;
  }
  .ct-table td.c-song {
    grid-area: song;
    max-width: none;
    width: auto;
    min-width: 0;
  }
  .ct-table td.c-diff {
    grid-area: diff;
    padding-left: 44px;
  }
  .ct-table td.c-main {
    grid-area: main;
  }
  .ct-table td.c-main .num {
    font-size: var(--fs-22);
  }
  .ct-table td.c-sorted {
    grid-area: sorted;
    display: block;
    font-size: var(--fs-12);
    color: var(--ink-3);
    text-align: right;
  }
  .ct-table td.c-sorted b {
    font-size: var(--fs-14);
    color: var(--ink);
  }
  tr.is-sel td {
    background: transparent;
  }
  tr.is-sel:not(.is-implicit) {
    background: var(--row-sel-bg);
  }
  tr.is-sel td.c-song {
    box-shadow: none;
  }
  .ct-paging {
    justify-content: center;
  }
}
</style>
