<script setup lang="ts">
import type { SongCatalogItem, SongCatalogPagePayload } from "~/types/content";
import {
  CATALOG_SHELVES,
  CATALOG_SORTS,
  catalogLocation,
  catalogRequestFor,
  catalogState,
  formatOpenDay,
  genreKey,
  isLibraryPath,
  keywordSwitch,
  pageCount,
  pageSwitch,
  sameCatalogState,
  shelfOf,
  shelfSwitch,
  songDetailLocation,
  songLevels,
  songNames,
  sortSwitch,
  type CatalogShelf,
  type CatalogSort,
  type CatalogState
} from "~/utils/rework/catalog";
import { rememberLibraryLocation } from "~/composables/useLibraryReturn";

// Unified song library. State lives in the URL (utils/rework/catalog.ts); the first page is rendered on the
// server, later pages are fetched here with abort + sequence guards. Kept alive: only its own route is followed.
defineOptions({ name: "ReworkLibrary" });
const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const localePath = useLocalePath();
const api = useViewerApiFetch();

const state = shallowRef<CatalogState>(catalogState(route.query));
const active = ref(true);
const heading = ref<HTMLElement>();
const keyOf = (value: CatalogState) => JSON.stringify(catalogRequestFor(value));
const currentKey = computed(() => keyOf(state.value));
const fetchPage = (value: CatalogState, signal?: AbortSignal) =>
  api<SongCatalogPagePayload>("/api/content/songs", { query: catalogRequestFor(value), signal, timeout: 10000 });

// ---------- Data: SSR first page, then own requests ----------
type Entry = { key: string; shelf: CatalogShelf; data: SongCatalogPagePayload };
const initialState = state.value;
const initialKey = keyOf(initialState);
const initial = useLazyAsyncData(`rework-library:${locale.value}:${initialKey}`, (_app, options) =>
  fetchPage(initialState, options?.signal)
);
const own = shallowRef<Entry | null>(null);
const ownStarted = ref(false);
const ownLoading = ref(false);
const ownFailedKey = ref("");
let controller: AbortController | undefined;
let sequence = 0;

const shown = computed<Entry | null>(() =>
  own.value ??
    (!ownStarted.value && initial.data.value ? { key: initialKey, shelf: initialState.shelf, data: initial.data.value } : null)
);
const busy = computed(() =>
  ownStarted.value ? ownLoading.value : initial.status.value === "pending" || initial.status.value === "idle"
);
const failed = computed(() =>
  ownStarted.value
    ? ownFailedKey.value === currentKey.value
    : Boolean(initial.error.value) && initialKey === currentKey.value
);

async function load() {
  const value = state.value;
  const key = keyOf(value);
  controller?.abort();
  const current = (controller = new AbortController());
  const ticket = ++sequence;
  if (!ownStarted.value && initial.data.value) own.value = { key: initialKey, shelf: initialState.shelf, data: initial.data.value };
  ownStarted.value = true;
  ownLoading.value = true;
  ownFailedKey.value = "";
  try {
    const data = await fetchPage(value, current.signal);
    if (ticket === sequence) own.value = { key, shelf: value.shelf, data };
  } catch {
    if (ticket === sequence && !current.signal.aborted) ownFailedKey.value = key;
  } finally {
    if (ticket === sequence) ownLoading.value = false;
  }
}
watch(currentKey, (key) => {
  if (shown.value?.key !== key || failed.value) void load();
});

// ---------- Route: follow only this page's own query while active ----------
function syncFromRoute() {
  if (!active.value || !isLibraryPath(route.path)) return;
  const next = catalogState(route.query);
  if (!sameCatalogState(next, state.value)) state.value = next;
}
function remember() {
  if (active.value && isLibraryPath(route.path)) rememberLibraryLocation(route.fullPath);
}
watch(
  () => route.fullPath,
  () => {
    syncFromRoute();
    remember();
  }
);
onActivated(() => {
  active.value = true;
  syncFromRoute();
  remember();
});
onDeactivated(() => {
  active.value = false;
  cancelTyping();
});
onMounted(remember);
onBeforeUnmount(() => {
  controller?.abort();
  cancelTyping();
});

// After a page change (same keyword, shelf and sort): top of the results, focus on the results heading.
watch(state, (next, previous) => {
  if (!import.meta.client || !previous || next.page === previous.page) return;
  if (next.q !== previous.q || next.shelf !== previous.shelf || next.sort !== previous.sort) return;
  void nextTick(() => {
    heading.value?.focus({ preventScroll: true });
    heading.value?.scrollIntoView({ block: "start" });
  });
});

// ---------- Keyword: replace after 300 ms, never during composition ----------
const draft = ref(state.value.q);
let typingTimer: ReturnType<typeof setTimeout> | undefined;
let composing = false;
function cancelTyping() {
  clearTimeout(typingTimer);
  typingTimer = undefined;
}
function commitKeyword() {
  cancelTyping();
  const q = draft.value.trim();
  if (q === state.value.q || !active.value) return;
  void router.replace(catalogLocation(keywordSwitch(state.value, q), localePath));
}
function scheduleKeyword() {
  cancelTyping();
  typingTimer = setTimeout(commitKeyword, 300);
}
function onInput(event: Event) {
  draft.value = (event.target as HTMLInputElement).value;
  if ((event as InputEvent).isComposing || composing) return;
  scheduleKeyword();
}
function onCompositionStart() {
  composing = true;
  cancelTyping();
}
function onCompositionEnd(event: CompositionEvent) {
  composing = false;
  draft.value = (event.target as HTMLInputElement).value;
  scheduleKeyword();
}
function onKeydown(event: KeyboardEvent) {
  if (event.key !== "Enter" || event.isComposing || composing) return;
  event.preventDefault();
  commitKeyword();
}
function clearKeyword() {
  draft.value = "";
  commitKeyword();
}
watch(
  () => state.value.q,
  (q) => {
    if (!typingTimer && !composing && draft.value.trim() !== q) draft.value = q;
  }
);

// ---------- View ----------
// Links between states of this page use NuxtLink `custom`: RouterLink ignores the query when it decides that a
// link is exactly active, so it would mark every /songs?… link aria-current="page".
const href = (value: Partial<CatalogState>) => catalogLocation(value, localePath);
const shelfHref = (shelf: CatalogShelf) => href(shelfSwitch(state.value, shelf));
const sortHref = (sort: CatalogSort) => href(sortSwitch(state.value, sort));
const pageHref = (page: number) => href(pageSwitch(state.value, page));
const data = computed(() => shown.value?.data ?? null);
const fresh = computed(() => shown.value?.key === currentKey.value);
const stale = computed(() => Boolean(shown.value) && (!fresh.value || busy.value));
const total = computed(() => Number(data.value?.total || 0));
const pageSize = computed(() => Number(data.value?.pageSize || 24));
const pages = computed(() => pageCount(total.value, pageSize.value));
const songs = computed<SongCatalogItem[]>(() => data.value?.songs ?? []);
const firstLoad = computed(() => !shown.value && busy.value && !failed.value);
const view = computed(() => {
  if (failed.value) return "failed";
  if (firstLoad.value || !data.value) return "loading";
  if (!fresh.value) return "rows";
  if (total.value === 0) return state.value.q ? "noMatch" : "empty";
  if (!songs.value.length) return "beyond";
  return "rows";
});
const summary = computed(() => {
  if (failed.value) return "";
  if (!data.value || (!fresh.value && !stale.value)) return busy.value ? t("rework.library.loading") : "";
  if (total.value === 0) return t("rework.library.summaryNone");
  return t("rework.library.summary", { total: total.value, page: state.value.page, pages: pages.value });
});
// Rows (and their column set and links) belong to the shelf they were loaded for, also while stale.
const rowsShelf = computed(() => shown.value?.shelf ?? state.value.shelf);
const showShelf = computed(() => rowsShelf.value === "all");
const rows = computed(() =>
  songs.value.map((song) => {
    const genre = genreKey(song.type);
    const levels = songLevels(song);
    return {
      song,
      names: songNames(song, locale.value),
      to: localePath(songDetailLocation(Number(song.id), rowsShelf.value)),
      genre,
      genreLabel: genre ? t(`rework.library.genre.${genre}`) : String(song.type || "") || "—",
      slots: ([1, 2, 3, 4, 5] as const).map((difficulty) => levels.find((level) => level.difficulty === difficulty) ?? { difficulty, star: "" }),
      bpm: song.bpm ? String(song.bpm) : "—",
      openDay: formatOpenDay(song.open_day) ?? "—",
      shelf: t(`rework.library.shelf.${shelfOf(song.shelf_status)}`)
    };
  })
);
const skeletonRows = Array.from({ length: 24 }, (_, index) => index);
</script>

<template>
  <div class="lib" :class="{ 'with-shelf': showShelf }">
    <div class="lib-filters">
      <nav class="facet" :aria-label="t('rework.library.shelfLabel')">
        <span class="facet-h" aria-hidden="true">{{ t("rework.library.shelfLabel") }}</span>
        <div class="opts">
          <NuxtLink v-for="shelf in CATALOG_SHELVES" :key="shelf" v-slot="{ href: to, navigate }" :to="shelfHref(shelf)" custom>
            <a class="opt" :href="to" :aria-current="state.shelf === shelf ? 'page' : undefined" @click="navigate">{{
              t(`rework.library.shelf.${shelf}`)
            }}</a>
          </NuxtLink>
        </div>
      </nav>
      <nav class="facet" :aria-label="t('rework.library.sortLabel')">
        <span class="facet-h" aria-hidden="true">{{ t("rework.library.sortLabel") }}</span>
        <div class="opts">
          <NuxtLink v-for="sort in CATALOG_SORTS" :key="sort" v-slot="{ href: to, navigate }" :to="sortHref(sort)" custom>
            <a class="opt" :href="to" :aria-current="state.sort === sort ? 'page' : undefined" @click="navigate">{{
              t(`rework.library.sort.${sort}`)
            }}</a>
          </NuxtLink>
        </div>
      </nav>
    </div>

    <form class="lib-search" role="search" @submit.prevent="commitKeyword">
      <label class="search-box">
        <span class="vh">{{ t("rework.library.search") }}</span>
        <ReworkIcon name="search" />
        <input
          :value="draft"
          type="search"
          enterkeyhint="search"
          autocomplete="off"
          spellcheck="false"
          :placeholder="t('rework.library.searchPlaceholder')"
          @input="onInput"
          @compositionstart="onCompositionStart"
          @compositionend="onCompositionEnd"
          @keydown="onKeydown"
        />
      </label>
      <button v-if="draft" type="button" class="clear" :aria-label="t('rework.library.clearKeyword')" @click="clearKeyword">
        <ReworkIcon name="close" />
      </button>
    </form>

    <div class="lib-head">
      <h1 ref="heading" tabindex="-1">{{ t(`rework.library.title.${state.shelf}`) }}</h1>
      <p class="summary" role="status" aria-live="polite">{{ summary }}</p>
    </div>

    <section class="lib-results" :aria-busy="busy">
      <div v-if="view === 'failed'" class="lib-state" role="alert">
        <p>{{ t("rework.library.failed") }}</p>
        <button type="button" class="btn" @click="load">{{ t("rework.library.retry") }}</button>
      </div>
      <div v-else-if="view === 'noMatch'" class="lib-state">
        <p>{{ t("rework.library.noMatch", { q: state.q }) }}</p>
        <div class="actions">
          <NuxtLink v-slot="{ href: to, navigate }" :to="href(keywordSwitch(state, ''))" custom>
            <a class="btn" :href="to" @click="navigate">{{ t("rework.library.clearKeyword") }}</a>
          </NuxtLink>
          <NuxtLink v-if="state.shelf !== 'all'" v-slot="{ href: to, navigate }" :to="href(shelfSwitch(state, 'all'))" custom>
            <a class="btn" :href="to" @click="navigate">{{ t("rework.library.searchAll") }}</a>
          </NuxtLink>
        </div>
      </div>
      <div v-else-if="view === 'empty'" class="lib-state">
        <p>{{ t("rework.library.emptyShelf") }}</p>
      </div>
      <div v-else-if="view === 'beyond'" class="lib-state">
        <p>{{ t("rework.library.beyond", { page: state.page, pages }) }}</p>
        <div class="actions">
          <NuxtLink v-slot="{ href: to, navigate }" :to="pageHref(1)" custom>
            <a class="btn" :href="to" @click="navigate">{{ t("rework.library.firstPage") }}</a>
          </NuxtLink>
        </div>
      </div>
      <template v-else>
        <div class="cols" aria-hidden="true">
          <span class="c-song">{{ t("rework.library.columns.song") }}</span>
          <span class="c-genre">{{ t("rework.library.columns.genre") }}</span>
          <span class="c-diffs">{{ t("rework.library.columns.difficulty") }}</span>
          <span class="c-bpm">{{ t("rework.library.columns.bpm") }}</span>
          <span class="c-date">{{ t("rework.library.columns.openDay") }}</span>
          <span v-if="showShelf" class="c-shelf">{{ t("rework.library.columns.shelf") }}</span>
        </div>
        <ul v-if="view === 'loading'" class="rows" role="list">
          <li v-for="n in skeletonRows" :key="n" class="row skeleton" aria-hidden="true">
            <span class="c-song"><span class="sk-cover" /><span class="sk-line" /></span>
            <span class="c-diffs"><span class="sk-line short" /></span>
          </li>
        </ul>
        <ul v-else class="rows" :class="{ 'is-stale': stale }" role="list">
          <li v-for="row in rows" :key="row.song.id" class="row">
            <span class="c-song">
              <NuxtLink class="row-link" :to="row.to">
                <DsSongCell
                  :song-id="Number(row.song.id)"
                  :title="row.names.title"
                  :title-lang="row.names.titleLang"
                  :subtitle="row.names.subtitle || null"
                  :subtitle-lang="row.names.subtitleLang"
                />
              </NuxtLink>
            </span>
            <span class="c-genre">
              <i v-if="row.genre" class="dot" :class="`g-${row.genre}`" aria-hidden="true" /><span
                class="clip"
                :title="row.genreLabel"
                >{{ row.genreLabel }}</span
              >
            </span>
            <span class="c-diffs">
              <span v-for="slot in row.slots" :key="slot.difficulty" class="slot" :class="{ 'is-none': !slot.star }">
                <DsDiff v-if="slot.star" :difficulty="slot.difficulty" :star="slot.star" :show-constant="false" />
              </span>
            </span>
            <span class="c-bpm"><span class="k">BPM </span><span class="n">{{ row.bpm }}</span></span>
            <span class="c-date"><span class="vh">{{ t("rework.library.columns.openDay") }} </span><span class="n">{{ row.openDay }}</span></span>
            <span v-if="showShelf" class="c-shelf"><span class="vh">{{ t("rework.library.columns.shelf") }} </span>{{ row.shelf }}</span>
          </li>
        </ul>
        <ReworkPager v-if="view === 'rows' && pages > 1" :page="state.page" :count="pages" :href="pageHref" />
      </template>
    </section>
  </div>
</template>

<style scoped>
.lib {
  display: grid;
  grid-template-columns: 184px minmax(0, 1fr);
  grid-template-areas:
    "filters search"
    "filters head"
    "filters results";
  grid-template-rows: auto auto 1fr;
  column-gap: var(--sp-8);
  align-items: start;
  font-family: var(--font-ui);
  color: var(--ink);
}
.vh {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
/* ---------- Shelf and sort ---------- */
.lib-filters {
  grid-area: filters;
  position: sticky;
  top: calc(var(--bar-h) + var(--sp-6));
  display: flex;
  flex-direction: column;
  gap: var(--sp-6);
}
.facet-h {
  display: block;
  margin-bottom: var(--sp-2);
  font-size: var(--fs-12);
  font-weight: 500;
  color: var(--ink-3);
}
.opts {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.opt {
  display: flex;
  align-items: center;
  min-height: var(--hit);
  padding: 0 var(--sp-3);
  border-radius: var(--r-ctl);
  color: var(--ink-2);
  font-size: var(--fs-14);
  text-decoration: none;
  white-space: nowrap;
}
.opt:hover {
  background: var(--bg-sunk);
  color: var(--ink);
}
.opt[aria-current="page"] {
  background: var(--selected-bg);
  color: var(--selected-ink);
  font-weight: 700;
}
/* ---------- Search ---------- */
.lib-search {
  grid-area: search;
  position: relative;
  display: flex;
  align-items: center;
  margin-bottom: var(--sp-4);
}
.search-box {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  height: var(--ctl-h-lg);
  padding: 0 var(--hit) 0 14px;
  background: var(--surface);
  border: 1px solid var(--ctl-border);
  border-radius: var(--r-note);
  color: var(--ink-3);
}
.search-box:focus-within {
  border-color: var(--input-focus-line);
  box-shadow: var(--focus);
}
.search-box input {
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
.search-box input::-webkit-search-cancel-button {
  display: none;
}
.clear {
  position: absolute;
  right: 1px;
  display: grid;
  place-items: center;
  width: var(--hit);
  height: var(--hit);
  border: 0;
  border-radius: var(--r-note);
  background: transparent;
  color: var(--ink-3);
  cursor: pointer;
}
/* ---------- Heading and summary ---------- */
.lib-head {
  grid-area: head;
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--sp-1) var(--sp-4);
  margin-bottom: var(--sp-3);
}
.lib-head h1 {
  margin: 0;
  font-size: var(--fs-18);
  line-height: 1.3;
  scroll-margin-top: calc(var(--bar-h) + var(--sp-4));
  border-radius: var(--r-xs);
}
.lib-head h1:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 3px;
}
.summary {
  margin: 0;
  font-size: var(--fs-13);
  color: var(--ink-3);
}
/* ---------- Rows: table columns from 768 px, list below ---------- */
.lib-results {
  grid-area: results;
  min-width: 0;
}
.cols,
.row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 112px repeat(4, 58px) 74px 64px 96px;
  grid-template-areas: "song genre d d d d d bpm date";
  align-items: center;
  column-gap: var(--sp-2);
  padding: 0 var(--sp-4);
}
.with-shelf .cols,
.with-shelf .row {
  grid-template-columns: minmax(0, 1fr) 112px repeat(4, 58px) 74px 64px 96px 76px;
  grid-template-areas: "song genre d d d d d bpm date shelf";
}
.cols {
  min-height: 40px;
  border-bottom: 1px solid var(--line-strong);
  font-size: var(--fs-12);
  font-weight: 500;
  color: var(--ink-3);
}
.c-song { grid-area: song; min-width: 0; }
.c-genre { grid-area: genre; min-width: 0; }
.c-diffs { grid-area: d; }
.c-bpm { grid-area: bpm; text-align: right; }
.c-date { grid-area: date; text-align: right; }
.c-shelf { grid-area: shelf; padding-left: var(--sp-3); white-space: nowrap; }
.c-diffs {
  display: grid;
  grid-template-columns: repeat(4, 58px) 74px;
  column-gap: var(--sp-2);
}
.cols .c-diffs {
  display: block;
}
.rows {
  margin: 0;
  padding: 0;
  list-style: none;
}
.rows.is-stale {
  position: relative;
  pointer-events: none;
}
.rows.is-stale::after {
  content: "";
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--bg) 55%, transparent);
}
.row {
  position: relative;
  min-height: 64px;
  border-bottom: 1px solid var(--line);
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.row:hover {
  background: var(--bg-sunk);
}
.row-link {
  display: block;
  min-width: 0;
  padding: var(--sp-2) 0;
  color: inherit;
  text-decoration: none;
  border-radius: var(--r-ctl);
}
/* The whole row opens the song; the link itself carries the name. */
.row-link::after {
  content: "";
  position: absolute;
  inset: 0;
}
.row-link:focus-visible {
  outline: none;
}
.row:has(.row-link:focus-visible) {
  outline: 2px solid var(--focus-ring);
  outline-offset: -2px;
}
.row-link:hover :deep(.ds-songcell__title) {
  color: var(--link);
}
.c-genre {
  display: flex;
  align-items: center;
  gap: 6px;
}
.clip {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}
.g-namco { color: var(--genre-namco); }
.g-pops { color: var(--genre-pops); }
.g-kids { color: var(--genre-kids); }
.g-classic { color: var(--genre-classic); }
.g-variety { color: var(--genre-variety); }
.g-game { color: var(--genre-game); }
.g-vocaloid { color: var(--genre-vocaloid); }
.g-anime { color: var(--genre-anime); }
.n {
  font-family: var(--font-num);
  font-size: var(--fs-14);
}
.c-bpm .k {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
.c-date .n {
  color: var(--ink-3);
}
/* ---------- States ---------- */
.lib-state {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--sp-3);
  padding: var(--sp-8) var(--sp-4);
  border-top: 1px solid var(--line);
  color: var(--ink-2);
}
.lib-state p {
  margin: 0;
  font-size: var(--fs-16);
  color: var(--ink);
  overflow-wrap: anywhere;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}
.btn {
  display: inline-flex;
  align-items: center;
  min-height: var(--hit);
  padding: 0 var(--btn-pad-x);
  border: 1px solid var(--line-strong);
  border-radius: var(--r-ctl);
  background: var(--surface);
  color: var(--link);
  font: inherit;
  font-size: var(--fs-14);
  text-decoration: none;
  cursor: pointer;
}
.btn:hover {
  background: var(--bg-sunk);
}
.skeleton .c-song {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-2) 0;
}
.sk-cover {
  flex: none;
  width: 44px;
  height: 44px;
  border-radius: var(--r-ctl);
  background: var(--bg-sunk);
}
.sk-line {
  display: block;
  width: min(240px, 60%);
  height: 12px;
  border-radius: var(--r-xs);
  background: var(--bg-sunk);
}
.sk-line.short {
  width: 160px;
}
.opt:focus-visible,
.btn:focus-visible,
.clear:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
/* 1100–1239: no release date column */
@media (max-width: 1239px) {
  .cols,
  .row {
    grid-template-columns: minmax(0, 1fr) 104px repeat(4, 58px) 74px 64px;
    grid-template-areas: "song genre d d d d d bpm";
  }
  .with-shelf .cols,
  .with-shelf .row {
    grid-template-columns: minmax(0, 1fr) 104px repeat(4, 58px) 74px 64px 76px;
    grid-template-areas: "song genre d d d d d bpm shelf";
  }
  .c-date {
    display: none;
  }
}
/* 768–1099: filters above the list, song + difficulty columns */
@media (max-width: 1099px) {
  .lib {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: "search" "filters" "head" "results";
    grid-template-rows: none;
  }
  .lib-filters {
    position: static;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sp-2) var(--sp-4);
    margin-bottom: var(--sp-3);
  }
  .facet-h {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .opts {
    flex-direction: row;
    gap: var(--sp-1);
    padding: 3px;
    border-radius: var(--r-note);
    background: var(--bg-sunk);
  }
  .opt {
    min-height: 38px;
    padding: 0 14px;
    border-radius: var(--r-note);
    position: relative;
  }
  .opt::before {
    content: "";
    position: absolute;
    inset: -3px 0;
  }
  .opt[aria-current="page"] {
    background: var(--surface);
    box-shadow: inset 0 0 0 1px var(--seg-on-ring);
    color: var(--seg-on-ink);
  }
  .cols,
  .row {
    grid-template-columns: minmax(0, 1fr) repeat(4, 58px) 74px;
    grid-template-areas: "song d d d d d";
  }
  .with-shelf .cols,
  .with-shelf .row {
    grid-template-columns: minmax(0, 1fr) repeat(4, 58px) 74px 76px;
    grid-template-areas: "song d d d d d shelf";
  }
  .c-genre,
  .c-bpm {
    display: none;
  }
}
/* Below 768: list rows */
@media (max-width: 767px) {
  .lib-filters {
    flex-direction: column;
    align-items: stretch;
    gap: var(--sp-2);
  }
  .opts {
    overflow-x: auto;
    scrollbar-width: none;
    align-self: flex-start;
    max-width: 100%;
  }
  .opt {
    flex: none;
    padding: 0 12px;
  }
  .cols {
    display: none;
  }
  .row,
  .with-shelf .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px var(--sp-3);
    padding: var(--sp-2) 0 var(--sp-3);
  }
  .c-song {
    flex: 1 0 100%;
  }
  .row-link {
    padding: var(--sp-1) 0 0;
  }
  .c-diffs {
    order: 1;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    flex: 1 0 100%;
    padding-left: calc(44px + var(--sp-3));
  }
  .slot.is-none {
    display: none;
  }
  .c-genre,
  .c-bpm,
  .c-date,
  .c-shelf {
    order: 2;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    text-align: left;
    font-size: var(--fs-12);
    color: var(--ink-3);
  }
  .c-genre {
    margin-left: calc(44px + var(--sp-3));
    max-width: 40%;
  }
  .c-bpm .k {
    position: static;
    width: auto;
    height: auto;
    clip-path: none;
  }
  .n {
    font-size: var(--fs-13);
  }
  .skeleton .c-diffs {
    display: block;
  }
  .lib-head h1 {
    scroll-margin-top: calc(var(--bar-h-m) + var(--subtab-h-m) + var(--sp-3));
  }
}
</style>
