<script setup lang="ts">
// Guest home song search (was components/home/GuestSongSearch.vue). Same query contract as the global search panel
// (utils/rework/catalog songSearchRequest: every shelf, server pagination) and the same "view all" link into the
// library (catalogLocation(searchAllState(q))). Keyboard: ↑ / ↓ move, Enter opens the active (or first) option,
// Esc closes. Analytics events unchanged.
import type { SongCatalogItem, SongCatalogPagePayload } from "~/types/content";
import { catalogLocation, searchAllState, songNames, songSearchRequest } from "~/utils/rework/catalog";
import { trackViewerEvent } from "~/utils/analytics";

const { t, locale } = useI18n();
const localePath = useLocalePath();
const apiFetch = useViewerApiFetch();
const query = ref("");
const suggestions = ref<SongCatalogItem[]>([]);
const total = ref(0);
const loading = ref(false);
const failed = ref(false);
const open = ref(false);
const activeIndex = ref(-1);
let searchTimer: ReturnType<typeof setTimeout> | null = null;
let blurTimer: ReturnType<typeof setTimeout> | null = null;
let requestSequence = 0;

const listboxId = "guest-home-song-search-results";
const viewAllHref = computed(() => {
  const q = query.value.trim();
  return q && total.value > suggestions.value.length ? catalogLocation(searchAllState(q), localePath) : "";
});
/** Options in keyboard order: the songs, then "view all" when the API found more than the list shows. */
const optionCount = computed(() => suggestions.value.length + (viewAllHref.value ? 1 : 0));
const optionId = (index: number) => `${listboxId}-${index < suggestions.value.length ? suggestions.value[index]?.id : "all"}`;
const activeDescendant = computed(() => (activeIndex.value >= 0 ? optionId(activeIndex.value) : undefined));
const names = (song: SongCatalogItem) => songNames(song, locale.value);

const runSearch = async () => {
  const keyword = query.value.trim();
  if (!keyword) {
    suggestions.value = [];
    total.value = 0;
    open.value = false;
    activeIndex.value = -1;
    return;
  }
  const sequence = ++requestSequence;
  loading.value = true;
  failed.value = false;
  open.value = true;
  try {
    const payload = await apiFetch<SongCatalogPagePayload>("/api/content/songs", { query: songSearchRequest(keyword) });
    if (sequence !== requestSequence) return;
    suggestions.value = payload.songs.slice(0, 8);
    total.value = Number(payload.total) || 0;
    activeIndex.value = -1;
    open.value = true;
    trackViewerEvent("home_song_search", { home_state: "guest", query_length: keyword.length, result_count: Number(payload.total || 0) });
  } catch {
    if (sequence !== requestSequence) return;
    suggestions.value = [];
    total.value = 0;
    failed.value = true;
    open.value = true;
  } finally {
    if (sequence === requestSequence) loading.value = false;
  }
};

watch(query, () => {
  requestSequence += 1;
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => void runSearch(), 220);
});

const goToSong = async (song: SongCatalogItem) => {
  open.value = false;
  trackViewerEvent("home_latest_song_click", { home_state: "guest", source: "hero_search", song_id: song.id });
  await navigateTo(localePath(`/songs/${song.id}`));
};
const goToAll = async () => {
  if (!viewAllHref.value) return;
  open.value = false;
  await navigateTo(viewAllHref.value);
};
const choose = async (index: number) => {
  if (index < suggestions.value.length) await goToSong(suggestions.value[index]);
  else await goToAll();
};

const submit = async () => {
  if (activeIndex.value >= 0) return choose(activeIndex.value);
  if (suggestions.value[0]) return goToSong(suggestions.value[0]);
  if (query.value.trim()) await runSearch();
};

const handleKeydown = async (event: KeyboardEvent) => {
  if (event.isComposing) return;
  if (event.key === "ArrowDown") {
    event.preventDefault();
    if (!open.value) open.value = true;
    if (optionCount.value) activeIndex.value = (activeIndex.value + 1) % optionCount.value;
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    if (optionCount.value) activeIndex.value = activeIndex.value <= 0 ? optionCount.value - 1 : activeIndex.value - 1;
  } else if (event.key === "Enter") {
    event.preventDefault();
    await submit();
  } else if (event.key === "Escape") {
    open.value = false;
    activeIndex.value = -1;
  }
};
const handleFocus = () => {
  if (query.value.trim()) open.value = true;
};
const handleBlur = () => {
  blurTimer = setTimeout(() => {
    open.value = false;
    activeIndex.value = -1;
  }, 120);
};
const clearSearch = () => {
  query.value = "";
  suggestions.value = [];
  total.value = 0;
  open.value = false;
  activeIndex.value = -1;
};
onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer);
  if (blurTimer) clearTimeout(blurTimer);
});
</script>

<template>
  <div class="ss guest-song-search">
    <form class="ss-form" role="search" @submit.prevent="submit">
      <label for="guest-home-song-search" class="rw-vh">{{ t("page.home.guest.searchLabel") }}</label>
      <ReworkIcon name="search" class="ss-icon" />
      <input
        id="guest-home-song-search"
        v-model="query"
        type="search"
        autocomplete="off"
        enterkeyhint="search"
        spellcheck="false"
        :placeholder="t('page.home.guest.searchPlaceholder')"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="open"
        :aria-controls="listboxId"
        :aria-activedescendant="activeDescendant"
        @keydown="handleKeydown"
        @focus="handleFocus"
        @blur="handleBlur"
      />
      <button v-if="query" type="button" class="ss-clear" :aria-label="t('page.home.guest.clearSearch')" @mousedown.prevent @click="clearSearch">
        <ReworkIcon name="close" />
      </button>
      <button type="submit" class="rw-btn rw-btn--primary ss-submit">{{ t("common.search") }}</button>
    </form>

    <div v-if="open" :id="listboxId" class="ss-results" role="listbox" :aria-label="t('rework.resultsLabel')">
      <div v-if="loading" class="ss-status guest-song-search__status" role="status">{{ t("layout.loading") }}</div>
      <div v-else-if="failed" class="ss-status guest-song-search__status" role="status">{{ t("page.home.guest.searchFailed") }}</div>
      <div v-else-if="!suggestions.length" class="ss-status guest-song-search__status" role="status">{{ t("page.home.guest.searchEmpty") }}</div>
      <template v-else>
        <button
          v-for="(song, index) in suggestions"
          :id="optionId(index)"
          :key="song.id"
          type="button"
          class="ss-option guest-song-search__result"
          :class="{ 'is-active': activeIndex === index }"
          role="option"
          :aria-selected="activeIndex === index"
          @mousedown.prevent
          @mouseenter="activeIndex = index"
          @click="goToSong(song)"
        >
          <DsCover :song-id="song.id" size="md" />
          <span class="ss-copy">
            <strong :lang="names(song).titleLang === 'ja' ? 'ja' : undefined">{{ names(song).title }}</strong>
            <small><span v-if="names(song).subtitle" :lang="names(song).subtitleLang">{{ names(song).subtitle }} · </span><span class="num">#{{ song.id }}</span></small>
          </span>
          <ReworkIcon name="forward" class="ss-go" />
        </button>
        <button
          v-if="viewAllHref"
          :id="optionId(suggestions.length)"
          type="button"
          class="ss-option ss-all"
          :class="{ 'is-active': activeIndex === suggestions.length }"
          role="option"
          :aria-selected="activeIndex === suggestions.length"
          @mousedown.prevent
          @mouseenter="activeIndex = suggestions.length"
          @click="goToAll"
        >
          <ReworkIcon name="songs" />
          <span class="ss-copy"><strong>{{ t("rework.viewAll", { count: total }) }}</strong></span>
          <ReworkIcon name="forward" class="ss-go" />
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.ss {
  position: relative;
  z-index: 4;
  width: 100%;
  max-width: 640px;
  font-family: var(--font-ui);
}
.ss-form {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: var(--sp-1);
  min-height: 56px;
  padding: 5px 5px 5px var(--sp-4);
  border: 2px solid var(--ink);
  border-radius: var(--r-note);
  background: var(--surface);
}
.ss-form:focus-within {
  border-color: var(--focus-ring);
}
.ss-icon {
  width: 20px;
  height: 20px;
  color: var(--ink-3);
}
.ss input {
  min-width: 0;
  width: 100%;
  height: 44px;
  padding: 0 var(--sp-2);
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--ink);
  font: inherit;
  font-size: var(--fs-16);
}
.ss input::placeholder {
  color: var(--ink-3);
}
.ss input::-webkit-search-cancel-button {
  display: none;
}
.ss-clear {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: var(--r-ctl);
  background: transparent;
  color: var(--ink-3);
  cursor: pointer;
}
.ss-clear:focus-visible,
.ss-option:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.ss-submit {
  border-radius: calc(var(--r-note) - 4px);
}
.ss-results {
  position: absolute;
  top: calc(100% + 6px);
  inset-inline: 0;
  overflow: hidden;
  border: 1px solid var(--overlay-line);
  border-radius: var(--r-panel);
  background: var(--overlay-bg);
  box-shadow: var(--shadow-pop);
}
.ss-status {
  padding: var(--sp-4);
  color: var(--ink-2);
  font-size: var(--fs-14);
  text-align: center;
}
.ss-option {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 20px;
  align-items: center;
  gap: var(--sp-3);
  width: 100%;
  min-height: 60px;
  padding: var(--sp-2) var(--sp-4);
  border: 0;
  border-bottom: 1px solid var(--line);
  background: transparent;
  color: var(--ink);
  font: inherit;
  text-align: start;
  cursor: pointer;
}
.ss-option:last-child {
  border-bottom: 0;
}
.ss-option.is-active,
.ss-option:hover {
  background: var(--bg-sunk);
}
.ss-all {
  color: var(--link);
}
.ss-all > :first-child {
  justify-self: center;
  width: 22px;
  height: 22px;
}
.ss-copy {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.ss-copy strong,
.ss-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ss-copy strong {
  font-size: var(--fs-14);
  font-weight: 600;
}
.ss-copy small {
  color: var(--ink-3);
  font-size: var(--fs-12);
}
.ss-go {
  width: 18px;
  height: 18px;
  color: var(--ink-3);
}
@media (max-width: 767px) {
  .ss-form {
    min-height: 52px;
    padding-left: var(--sp-3);
  }
}
</style>
