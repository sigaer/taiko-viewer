<script setup lang="ts">
// All scores (pages/account/songs.vue renders it; the page keeps the reads, the binding switch, lock / delete and
// the editor and import dialogs). Real fields of /api/account/songs only; the server pages, filters (keyword,
// difficulty) and orders the rows (newest update first), so there is no sort control here.
// A table from 768 px (columns drop by priority: the update date below 1240, the judge bar and the row actions
// below 1100 — they are in the row details), rows below 768 px; the judge triple is hidden below 375 px.
// At most SCORE_ROW_WINDOW rows of a server page are mounted: a 100-row page is shown in two windows.
import { computed, nextTick, onMounted, ref, watch, type PropType } from "vue";
import { crownFromCounts } from "~/utils/ds/crown";
import {
  pageCount,
  rowWindow,
  rowWindowCount,
  rowWindowRange,
  scoreDate,
  scoreDateTime,
  scoreTitles,
  starOf
} from "~/utils/rework/scores";

export type ScoreBinding = { id: number; taikoId: string; displayName: string; isManual: boolean; source: string };
export type ScoreRow = {
  songNo: number;
  level: number;
  title: string;
  titleJp: string;
  maxCombo: string | number;
  starLevel: string | number;
  shelfStatus: number | null;
  isCustom: boolean;
  isLocked: boolean;
  highScore: number;
  bestScoreRank: number;
  goodCnt: number;
  okCnt: number;
  ngCnt: number;
  poundCnt: number;
  stageCnt: number;
  clearCnt: number;
  fullComboCnt: number;
  dondafulComboCnt: number;
  comboCnt: number;
  updateDatetime: string;
};
type Location = string | { path: string; query?: Record<string, unknown> };

const props = defineProps({
  bindings: { type: Array as PropType<ScoreBinding[]>, required: true },
  currentBinding: { type: Object as PropType<ScoreBinding | null>, default: null },
  profileReady: { type: Boolean, required: true },
  rows: { type: Array as PropType<ScoreRow[]>, required: true },
  total: { type: Number, required: true },
  busy: { type: Boolean, required: true },
  resultReady: { type: Boolean, required: true },
  readError: { type: String, default: "" },
  catalogError: { type: String, default: "" },
  catalogPending: { type: Boolean, default: false },
  filtered: { type: Boolean, default: false },
  lockingKey: { type: String, default: "" },
  switching: { type: Boolean, default: false },
  /** line under the binding (the page's sourceHint) */
  hint: { type: String, default: "" },
  songPath: { type: Function as PropType<(row: ScoreRow) => Location | null>, required: true }
});
const emit = defineEmits<{
  search: [];
  clear: [];
  binding: [id: number];
  create: [];
  import: [];
  edit: [row: ScoreRow];
  remove: [row: ScoreRow];
  lock: [row: ScoreRow, value: boolean];
  retry: [];
  retryCatalog: [];
}>();
const keywordInput = defineModel<string>("keywordInput", { required: true });
const level = defineModel<number | undefined>("level", { required: true });
const page = defineModel<number>("page", { required: true });
const pageSize = defineModel<number>("pageSize", { required: true });
const { t, locale } = useI18n();

const PAGE_SIZES = [25, 50, 100];
const isManual = computed(() => Boolean(props.currentBinding?.isManual));
const sourceLabel = computed(() =>
  !props.currentBinding ? "" : isManual.value ? t("rework.scoreList.manualSource") : props.currentBinding.source === "hiroba" ? t("rework.scoreList.hiroba") : t("rework.scoreList.wahlap")
);
const bindingLabel = (b: ScoreBinding) => (b.isManual ? `${b.displayName} · ${t("rework.scoreList.manualSource")}` : b.taikoId);
const view = computed(() => {
  if (props.profileReady && !props.bindings.length) return "binding";
  if (props.busy) return "loading";
  if (props.readError) return "failed";
  if (!props.resultReady) return "loading";
  if (!props.rows.length) return props.filtered ? "noMatch" : "empty";
  return "rows";
});

// ---------- Rows: windows of at most SCORE_ROW_WINDOW, details per row ----------
const windowIndex = ref(0);
const windows = computed(() => rowWindowCount(props.rows.length));
const shown = computed(() => rowWindow(props.rows, windowIndex.value));
const rowKey = (row: ScoreRow) => `${row.songNo}:${row.level}`;
const open = ref(new Set<string>());
watch(
  () => props.rows,
  () => {
    windowIndex.value = 0;
    open.value = new Set();
  }
);
const toggle = (row: ScoreRow) => {
  const next = new Set(open.value);
  const key = rowKey(row);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  open.value = next;
};
const windowLabel = (index: number) => {
  const range = rowWindowRange(index, props.rows.length, (page.value - 1) * pageSize.value);
  return t("rework.scoreList.rowsRange", range);
};
const pages = computed(() => pageCount(props.total, pageSize.value));
const goPage = (n: number) => {
  page.value = Math.min(pages.value, Math.max(1, n));
};

// A new page size keeps the current page, clamped to the new page count (as the previous pagination did).
const setPageSize = (size: number) => {
  page.value = Math.min(page.value, pageCount(props.total, size));
  pageSize.value = size;
};

const titles = (row: ScoreRow) => scoreTitles(row, locale.value);
const number = computed(() => new Intl.NumberFormat(locale.value));
const count = (value: unknown) => number.value.format(Number(value) || 0);
const lockBusy = computed(() => props.busy || Boolean(props.lockingKey));
const detailsId = (row: ScoreRow) => `score-details-${row.songNo}-${row.level}`;
// Phones: the difficulty filter is one scrollable row; the selected option is kept in view.
const levelSeg = ref<HTMLElement | null>(null);
const revealLevel = () => {
  const box = levelSeg.value;
  const item = box?.querySelector<HTMLElement>('[aria-pressed="true"]');
  if (!box || !item || box.scrollWidth <= box.clientWidth) return;
  if (item.offsetLeft < box.scrollLeft) box.scrollLeft = item.offsetLeft;
  else if (item.offsetLeft + item.offsetWidth > box.scrollLeft + box.clientWidth) box.scrollLeft = item.offsetLeft + item.offsetWidth - box.clientWidth;
};
onMounted(revealLevel);
watch(level, () => nextTick(revealLevel));
const setLevel = (value: number | undefined) => {
  if (level.value === value) return;
  level.value = value;
  emit("search");
};
</script>

<template>
  <div class="sl">
    <ReworkPageHeader :title="t('rework.scoreList.title')">
      <div v-if="profileReady && bindings.length" class="sl-binding">
        <label for="sl-binding-select">{{ t("rework.scoreList.binding") }}</label>
        <select id="sl-binding-select" :value="currentBinding?.id" :disabled="busy || Boolean(lockingKey)" :aria-busy="switching" @change="emit('binding', Number(($event.target as HTMLSelectElement).value))">
          <option v-for="b in bindings" :key="b.id" :value="b.id">{{ bindingLabel(b) }}</option>
        </select>
        <span v-if="currentBinding" class="sl-source">{{ sourceLabel }}</span>
      </div>
      <p v-if="hint" class="sl-hint">{{ hint }}</p>
      <template v-if="currentBinding" #actions>
        <button type="button" class="rw-btn sl-act" :disabled="!resultReady" @click="emit('import')"><ReworkIcon name="upload" />{{ t("rework.scoreList.import") }}</button>
        <button type="button" class="rw-btn sl-act" :disabled="!resultReady" @click="emit('create')"><ReworkIcon name="plus" />{{ t("rework.scoreList.create") }}</button>
      </template>
    </ReworkPageHeader>

    <div v-if="catalogError" class="sl-notice" role="alert">
      <span>{{ t("rework.scoreList.catalogFailed") }} · {{ catalogError }}</span>
      <button type="button" class="rw-btn rw-btn--sm" :disabled="catalogPending" @click="emit('retryCatalog')">{{ t("rework.state.retry") }}</button>
    </div>

    <ReworkGate v-if="view === 'binding'" class="sl-gate" need="binding" />
    <template v-else>
      <form v-if="currentBinding" class="sl-tools" role="search" @submit.prevent="emit('search')">
        <label class="sl-search">
          <span class="rw-vh">{{ t("rework.scoreList.search") }}</span>
          <ReworkIcon name="search" />
          <input v-model="keywordInput" type="search" enterkeyhint="search" autocomplete="off" spellcheck="false" :placeholder="t('rework.scoreList.search')" :disabled="busy" />
        </label>
        <button type="submit" class="rw-btn" :disabled="busy">{{ t("rework.scoreList.searchButton") }}</button>
        <div ref="levelSeg" class="seg sl-levels" role="group" :aria-label="t('rework.scoreList.difficulty')">
          <button type="button" :aria-pressed="!level" :disabled="busy" @click="setLevel(undefined)">{{ t("rework.scoreList.allDifficulties") }}</button>
          <button v-for="n in [1, 2, 3, 4, 5]" :key="n" type="button" :aria-pressed="level === n" :disabled="busy" @click="setLevel(n)">
            <span class="seg-icon" aria-hidden="true"><DsDiff :difficulty="n" :show-constant="false" class="seg-diff" /></span>{{ t(`difficulty.${n}`) }}
          </button>
        </div>
        <button v-if="filtered" type="button" class="rw-btn rw-btn--ghost" :disabled="busy" @click="emit('clear')">{{ t("rework.scoreList.clear") }}</button>
      </form>

      <ReworkState v-if="view === 'failed'" kind="failed" :title="readError" @retry="emit('retry')" />
      <ReworkState v-else-if="view === 'loading'" kind="loading" :lines="8" class="sl-loading" />
      <ReworkState v-else-if="view === 'noMatch'" kind="empty" :title="t('rework.scoreList.noMatch')">
        <button type="button" class="rw-btn" @click="emit('clear')">{{ t("rework.scoreList.clear") }}</button>
      </ReworkState>
      <ReworkState v-else-if="view === 'empty'" kind="empty" :title="t('rework.scoreList.empty')">
        <button type="button" class="rw-btn rw-btn--primary" @click="emit('import')">{{ t("rework.scoreList.import") }}</button>
        <button type="button" class="rw-btn" @click="emit('create')">{{ t("rework.scoreList.create") }}</button>
      </ReworkState>
      <template v-else-if="view === 'rows'">
        <p class="sl-summary" role="status" aria-live="polite">{{ t("rework.scoreList.summary", { total: count(total) }) }}</p>
        <div class="sl-wrap">
          <table class="sl-table" :class="{ 'is-manual': isManual }">
            <caption class="rw-vh">{{ t("rework.scoreList.title") }} · {{ t("rework.scoreList.summary", { total: count(total) }) }}</caption>
            <thead>
              <tr>
                <th scope="col" class="c-song">{{ t("rework.scoreList.columns.song") }}</th>
                <th scope="col" class="c-diff">{{ t("rework.scoreList.columns.difficulty") }}</th>
                <th scope="col" class="c-score r">{{ t("rework.scoreList.columns.score") }}</th>
                <th scope="col" class="c-crown">{{ t("rework.scoreList.columns.crown") }}</th>
                <th scope="col" class="c-rank">{{ t("rework.scoreList.columns.rank") }}</th>
                <th scope="col" class="c-judge">{{ t("rework.scoreList.columns.judge") }}</th>
                <th scope="col" class="c-date">{{ t("rework.scoreList.columns.updated") }}</th>
                <th scope="col" class="c-ops"><span class="rw-vh">{{ t("rework.scoreList.columns.actions") }}</span></th>
              </tr>
            </thead>
            <tbody>
              <template v-for="row in shown" :key="rowKey(row)">
                <tr class="sr" :class="{ 'is-open': open.has(rowKey(row)), 'is-locked': row.isLocked }" :data-key="rowKey(row)">
                  <td class="c-song">
                    <NuxtLink v-if="songPath(row)" :to="songPath(row)!" class="sr-link">
                      <DsSongCell :song-id="row.songNo" v-bind="titles(row)" cover-size="sm" />
                    </NuxtLink>
                    <DsSongCell v-else class="sr-nolink" :song-id="row.isCustom ? null : row.songNo" v-bind="titles(row)" cover-size="sm" />
                    <span v-if="row.shelfStatus === 1 || row.isCustom || row.isLocked" class="sr-tags">
                      <span v-if="row.shelfStatus === 1" class="tag">{{ t("rework.scoreList.removed") }}</span>
                      <span v-if="row.isCustom" class="tag">{{ t("rework.scoreList.custom") }}</span>
                      <span v-if="row.isLocked" class="tag is-lock"><ReworkIcon name="lock" />{{ t("rework.scoreList.locked") }}</span>
                    </span>
                  </td>
                  <td class="c-diff"><DsDiff :difficulty="row.level" :star="starOf(row.starLevel)" :show-constant="false" /></td>
                  <td class="c-score r"><span class="rw-vh">{{ t("rework.scoreList.columns.score") }} </span><b class="num">{{ count(row.highScore) }}</b></td>
                  <td class="c-crown">
                    <DsCrown class="is-wide" :state="crownFromCounts(row)" size="table" text="full" />
                    <DsCrown class="is-narrow" :state="crownFromCounts(row)" size="sm" text="short" />
                  </td>
                  <td class="c-rank">
                    <DsRank class="is-wide" :value="row.bestScoreRank" variant="table" />
                    <DsRank class="is-narrow" :value="row.bestScoreRank" variant="compact" />
                  </td>
                  <td class="c-judge">
                    <DsJudgeBar class="is-wide" :good="row.goodCnt" :ok="row.okCnt" :ng="row.ngCnt" />
                    <span class="is-narrow sr-triple num" :aria-label="t('rework.scoreList.judgeText', { good: row.goodCnt, ok: row.okCnt, ng: row.ngCnt })">{{ row.goodCnt }} / {{ row.okCnt }} / {{ row.ngCnt }}</span>
                  </td>
                  <td class="c-date num">{{ scoreDate(row.updateDatetime) }}</td>
                  <td class="c-ops">
                    <span class="sr-inline">
                      <button
                        v-if="!isManual"
                        type="button"
                        class="ib"
                        :class="{ 'is-on': row.isLocked }"
                        :aria-pressed="row.isLocked"
                        :aria-busy="lockingKey === rowKey(row)"
                        :aria-label="t('rework.scoreList.lockLabel', { title: titles(row).title })"
                        :title="t('rework.scoreList.lock')"
                        :disabled="lockBusy"
                        @click="emit('lock', row, !row.isLocked)"
                      ><ReworkIcon name="lock" /></button>
                      <button type="button" class="ib" :aria-label="t('rework.scoreList.editLabel', { title: titles(row).title })" :title="t('rework.scoreList.edit')" @click="emit('edit', row)"><ReworkIcon name="edit" /></button>
                      <button v-if="isManual" type="button" class="ib is-danger" :aria-label="t('rework.scoreList.deleteLabel', { title: titles(row).title })" :title="t('rework.scoreList.delete')" @click="emit('remove', row)"><ReworkIcon name="trash" /></button>
                    </span>
                    <button type="button" class="ib sr-toggle" :aria-expanded="open.has(rowKey(row))" :aria-controls="detailsId(row)" :aria-label="t('rework.scoreList.detailsLabel', { title: titles(row).title })" :title="t('rework.scoreList.details')" @click="toggle(row)">
                      <ReworkIcon name="chevron" />
                    </button>
                  </td>
                </tr>
                <tr v-if="open.has(rowKey(row))" :id="detailsId(row)" class="sd">
                  <td colspan="8">
                    <div class="sd-body">
                      <DsJudgeBar class="sd-judge" :good="row.goodCnt" :ok="row.okCnt" :ng="row.ngCnt" />
                      <dl class="sd-facts">
                        <div><dt>{{ t("rework.scoreList.combo") }}</dt><dd class="num">{{ count(row.comboCnt) }}</dd></div>
                        <div><dt>{{ t("rework.scoreList.drumroll") }}</dt><dd class="num">{{ count(row.poundCnt) }}</dd></div>
                        <div><dt>{{ t("rework.scoreList.maxNotes") }}</dt><dd class="num">{{ row.maxCombo === "" || row.maxCombo == null ? "—" : row.maxCombo }}</dd></div>
                        <div><dt>{{ t("rework.scoreList.plays") }}</dt><dd class="num">{{ count(row.stageCnt) }}</dd></div>
                        <div><dt>{{ t("rework.scoreList.clears") }}</dt><dd class="num">{{ count(row.clearCnt) }}</dd></div>
                        <div><dt>{{ t("rework.scoreList.fullCombos") }}</dt><dd class="num">{{ count(row.fullComboCnt) }}</dd></div>
                        <div><dt>{{ t("rework.scoreList.dondafuls") }}</dt><dd class="num">{{ count(row.dondafulComboCnt) }}</dd></div>
                        <div><dt>{{ t("rework.scoreList.updatedAt") }}</dt><dd class="num">{{ scoreDateTime(row.updateDatetime) }}</dd></div>
                        <div><dt>ID</dt><dd class="num">{{ row.songNo }}</dd></div>
                      </dl>
                      <div class="sd-acts">
                        <label v-if="!isManual" class="sd-lock">
                          <input type="checkbox" role="switch" :checked="row.isLocked" :disabled="lockBusy" :aria-busy="lockingKey === rowKey(row)" @change="emit('lock', row, ($event.target as HTMLInputElement).checked)" />
                          <span>{{ t("rework.scoreList.lock") }}</span>
                        </label>
                        <button type="button" class="rw-btn rw-btn--sm" @click="emit('edit', row)"><ReworkIcon name="edit" />{{ t("rework.scoreList.edit") }}</button>
                        <button v-if="isManual" type="button" class="rw-btn rw-btn--sm is-danger" @click="emit('remove', row)"><ReworkIcon name="trash" />{{ t("rework.scoreList.delete") }}</button>
                        <NuxtLink v-if="songPath(row)" class="rw-link sd-open" :to="songPath(row)!">{{ t("rework.scoreList.openSong") }}</NuxtLink>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
        <div v-if="windows > 1" class="seg sl-windows" role="group" :aria-label="t('rework.scoreList.rowsGroup')">
          <button v-for="(_, i) in windows" :key="i" type="button" :aria-pressed="windowIndex === i" @click="windowIndex = i">{{ windowLabel(i) }}</button>
        </div>
        <div class="sl-paging">
          <label class="sl-size">
            <span>{{ t("rework.scoreList.pageSize") }}</span>
            <select :value="pageSize" @change="setPageSize(Number(($event.target as HTMLSelectElement).value))">
              <option v-for="size in PAGE_SIZES" :key="size" :value="size">{{ t("rework.scoreList.pageSizeOption", { n: size }) }}</option>
            </select>
          </label>
          <ReworkPager v-if="pages > 1" :page="page" :count="pages" @select="goPage" />
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.sl {
  min-width: 0;
  font-family: var(--font-ui);
  color: var(--ink);
}
.sl-binding {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-2) var(--sp-3);
  margin-top: var(--sp-3);
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.sl-binding select,
.sl-size select {
  min-height: var(--hit);
  max-width: 100%;
  padding: 0 var(--sp-3);
  border: 1px solid var(--ctl-border);
  border-radius: var(--r-ctl);
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: var(--fs-16);
}
.sl-binding select {
  flex: 0 1 260px;
  min-width: 0;
}
.sl-source {
  padding: 2px var(--sp-2);
  border-radius: var(--tag-radius);
  background: var(--tag-info-bg);
  color: var(--tag-info-ink);
  font-size: var(--fs-12);
}
.sl-hint {
  margin: var(--sp-2) 0 0;
  font-size: var(--fs-13);
  line-height: var(--lh-body);
  color: var(--ink-3);
}
.sl-notice {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-2) var(--sp-3);
  margin-top: var(--sp-4);
  padding: var(--sp-2) var(--sp-4);
  border-radius: var(--r-ctl);
  background: var(--warn-wash);
  font-size: var(--fs-14);
  overflow-wrap: anywhere;
}
.sl-gate {
  margin-top: var(--sp-5);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
}
/* ---------- Tools ---------- */
.sl-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-3);
  margin: var(--sp-5) 0 var(--sp-3);
}
.sl-search {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  flex: 1 1 220px;
  max-width: 340px;
  height: var(--ctl-h-lg);
  padding: 0 14px;
  border: 1px solid var(--ctl-border);
  border-radius: var(--r-note);
  background: var(--surface);
  color: var(--ink-3);
}
.sl-search:focus-within {
  border-color: var(--input-focus-line);
  box-shadow: var(--focus);
}
.sl-search input {
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
  padding: 2px;
  border-radius: var(--r-ctl);
  background: var(--bg-sunk);
}
.seg button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: var(--hit);
  padding: 0 var(--sp-3);
  border: 0;
  border-radius: calc(var(--r-ctl) - 2px);
  background: transparent;
  color: var(--ink-2);
  font: inherit;
  font-size: var(--fs-13);
  cursor: pointer;
}
.seg button[aria-pressed="true"] {
  background: var(--seg-on-bg);
  color: var(--seg-on-ink);
  font-weight: 700;
  box-shadow: 0 0 0 1px var(--seg-on-ring);
}
.seg button:disabled {
  cursor: default;
}
.seg-icon {
  display: inline-flex;
}
.seg-diff {
  padding: 0;
  border: 0;
  background: transparent;
}
.seg-diff :deep(.ds-diff__ura),
.seg-diff :deep(.ds-diff__star) {
  display: none;
}
:is(.seg button, .ib, select, .sd-lock input):focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 1px;
}
.sl-summary {
  margin: 0 0 var(--sp-2);
  font-size: var(--fs-13);
  color: var(--ink-3);
}
/* ---------- Table ---------- */
.sl-wrap {
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
  overflow: hidden;
}
.sl-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--fs-14);
}
th {
  height: 40px;
  padding: 0 8px;
  border-bottom: 1px solid var(--line-strong);
  background: var(--surface-2);
  color: var(--ink-3);
  font-size: var(--fs-12);
  font-weight: 500;
  text-align: left;
  white-space: nowrap;
}
td {
  height: 60px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--line);
  color: var(--ink-2);
  vertical-align: middle;
}
tbody tr:last-child td {
  border-bottom: 0;
}
th:first-child,
td:first-child {
  padding-left: var(--sp-4);
}
th:last-child,
td.c-ops {
  padding-right: var(--sp-3);
}
.r {
  text-align: right;
}
.c-song {
  width: 100%;
  max-width: 0;
}
.sr-link {
  display: block;
  min-width: 0;
  color: inherit;
  text-decoration: none;
  border-radius: var(--r-ctl);
}
.sr-link:hover :deep(.ds-songcell__title) {
  color: var(--link);
}
.sr-link:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.sr-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 4px 0 0 44px;
}
.tag {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 0 6px;
  border-radius: var(--tag-radius);
  background: var(--bg-sunk);
  color: var(--ink-2);
  font-size: var(--fs-11);
  line-height: 18px;
  white-space: nowrap;
}
.tag.is-lock {
  color: var(--lock-ink);
}
.tag :deep(svg) {
  width: 12px;
  height: 12px;
}
.c-diff,
.c-crown,
.c-rank,
.c-date,
.c-score {
  white-space: nowrap;
}
.c-score b {
  font-size: var(--fs-16);
  font-weight: 700;
  color: var(--emph-num);
}
.c-judge {
  width: 196px;
  min-width: 176px;
}
.c-judge :deep(.ds-judge__legend) {
  flex-wrap: nowrap;
  gap: var(--sp-1) var(--sp-3);
}
.c-judge :deep(.ds-judge__item dd) {
  font-size: var(--fs-14);
}
.c-date {
  font-size: var(--fs-13);
  color: var(--ink-3);
}
.c-ops {
  white-space: nowrap;
  text-align: right;
}
.sr-inline {
  display: inline-flex;
}
.ib {
  display: inline-grid;
  place-items: center;
  width: var(--hit);
  height: var(--hit);
  padding: 0;
  border: 0;
  border-radius: var(--r-ctl);
  background: transparent;
  color: var(--ink-3);
  cursor: pointer;
  vertical-align: middle;
}
.ib:hover {
  background: var(--bg-sunk);
  color: var(--ink);
}
.ib:disabled {
  cursor: default;
  opacity: 0.6;
}
.ib.is-on {
  color: var(--lock-ink);
}
.ib.is-danger:hover {
  color: var(--danger);
}
.ib :deep(svg) {
  width: 18px;
  height: 18px;
}
.sr-toggle :deep(svg) {
  transition: none;
}
.sr.is-open .sr-toggle :deep(svg) {
  transform: rotate(180deg);
}
.is-narrow {
  display: none;
}
/* Details row */
.sd td {
  height: auto;
  padding: var(--sp-3) var(--sp-4) var(--sp-4);
  background: var(--bg-sunk);
}
.sd-body {
  display: grid;
  gap: var(--sp-3);
  max-width: 760px;
}
.sd-judge {
  max-width: 320px;
}
.sd-facts {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
  gap: var(--sp-2) var(--sp-4);
  margin: 0;
}
.sd-facts > div {
  display: flex;
  flex-direction: column-reverse;
  min-width: 0;
}
.sd-facts dt {
  font-size: var(--fs-12);
  color: var(--ink-3);
}
.sd-facts dd {
  margin: 0;
  color: var(--ink);
  overflow-wrap: anywhere;
}
.sd-acts {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-2) var(--sp-3);
}
.sd-lock {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  min-height: var(--hit);
  font-size: var(--fs-14);
  color: var(--ink);
  cursor: pointer;
}
.sd-lock input {
  width: 18px;
  height: 18px;
  accent-color: var(--action-bg);
}
.rw-btn.is-danger {
  border-color: var(--danger);
  color: var(--danger);
}
.sd-open {
  display: inline-flex;
  align-items: center;
  min-height: var(--hit);
  font-size: var(--fs-14);
}
/* ---------- Windows and paging ---------- */
.sl-windows {
  margin-top: var(--sp-3);
}
.sl-paging {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3) var(--sp-5);
  margin-top: var(--sp-4);
}
.sl-paging :deep(.pager) {
  margin-top: 0;
}
.sl-size {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  font-size: var(--fs-13);
  color: var(--ink-2);
}
/* Column priority */
@media (max-width: 1239px) {
  .c-date {
    display: none;
  }
}
@media (max-width: 1099px) {
  .c-judge,
  .sr-inline {
    display: none;
  }
  .c-crown .is-wide {
    display: none;
  }
  .c-crown .is-narrow {
    display: inline-flex;
  }
}
@media (max-width: 767px) {
  .sl :deep(.rw-head) {
    gap: var(--sp-2);
  }
  .sl-binding {
    flex-wrap: nowrap;
    margin-top: var(--sp-2);
  }
  .sl-binding label {
    flex: none;
  }
  .sl-binding select {
    flex: 1 1 auto;
    min-height: 40px;
  }
  .sl-source {
    flex: none;
  }
  .sl-hint {
    margin-top: 4px;
    font-size: var(--fs-12);
  }
  .sl :deep(.rw-head__actions) {
    flex-wrap: nowrap;
  }
  .sl-act {
    flex: 1 1 0;
    min-width: 0;
    padding: 0 var(--sp-2);
    font-size: var(--fs-13);
  }
  .sl-tools {
    margin: var(--sp-3) 0 var(--sp-2);
    gap: var(--sp-2);
  }
  .sl-search {
    height: var(--hit);
  }
  .sl-levels {
    flex-wrap: nowrap;
    max-width: 100%;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .sl-levels button {
    flex: none;
    white-space: nowrap;
  }
  .sl-search {
    flex-basis: 0;
    max-width: none;
  }
  .seg {
    flex: 1 1 100%;
  }
  .sl-table thead {
    display: none;
  }
  .sl-table,
  .sl-table tbody {
    display: block;
  }
  .sr {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto auto var(--hit);
    grid-template-areas:
      "song song song score ops"
      "diff judge crown rank ops";
    align-items: center;
    column-gap: var(--sp-2);
    row-gap: 4px;
    padding: var(--sp-2) var(--sp-1) var(--sp-2) var(--sp-3);
    border-bottom: 1px solid var(--line);
  }
  .sl-table tbody > tr:last-child {
    border-bottom: 0;
  }
  .sr td {
    display: block;
    height: auto;
    padding: 0;
    border: 0;
  }
  .sr td.c-date {
    display: none;
  }
  .sr td.c-song {
    grid-area: song;
    width: auto;
    max-width: none;
    min-width: 0;
  }
  .sr-tags {
    margin-left: 44px;
  }
  .sr td.c-score {
    grid-area: score;
  }
  .sr td.c-score b {
    font-size: var(--fs-18);
  }
  .sr td.c-diff {
    grid-area: diff;
  }
  .sr td.c-judge {
    grid-area: judge;
    display: block;
    width: auto;
    min-width: 0;
  }
  .c-judge .is-wide {
    display: none;
  }
  .c-judge .is-narrow {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--fs-12);
    color: var(--ink-3);
  }
  .sr td.c-crown {
    grid-area: crown;
    justify-self: end;
  }
  .sr td.c-rank {
    grid-area: rank;
    justify-self: end;
  }
  .c-rank .is-wide {
    display: none;
  }
  .c-rank .is-narrow {
    display: inline-flex;
  }
  .sr td.c-score {
    justify-self: end;
  }
  .sr td.c-ops {
    grid-area: ops;
  }
  .sd {
    display: block;
    border-bottom: 1px solid var(--line);
  }
  .sd td {
    display: block;
    padding: var(--sp-3);
  }
  .sl-paging {
    justify-content: center;
  }
}
@media (max-width: 374px) {
  .c-judge .is-narrow {
    display: none;
  }
}
</style>
