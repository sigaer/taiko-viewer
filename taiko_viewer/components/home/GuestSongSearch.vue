<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import type { SongCatalogItem, SongCatalogPagePayload } from "~/types/content";
import { trackViewerEvent } from "~/utils/analytics";

const { t, locale } = useI18n();
const localePath = useLocalePath();
const apiFetch = useViewerApiFetch();
const query = ref("");
const suggestions = ref<SongCatalogItem[]>([]);
const loading = ref(false);
const failed = ref(false);
const open = ref(false);
const activeIndex = ref(-1);
let searchTimer: ReturnType<typeof setTimeout> | null = null;
let blurTimer: ReturnType<typeof setTimeout> | null = null;
let requestSequence = 0;

const listboxId = "guest-home-song-search-results";
const activeDescendant = computed(() =>
  activeIndex.value >= 0 ? `${listboxId}-${suggestions.value[activeIndex.value]?.id}` : undefined
);

const getTitle = (song: SongCatalogItem) =>
  locale.value === "ja" && song.song_name_jp ? song.song_name_jp : song.song_name;
const getSubtitle = (song: SongCatalogItem) =>
  locale.value === "ja" ? song.song_name || "—" : song.song_name_jp || "—";

const runSearch = async () => {
  const keyword = query.value.trim();
  if (!keyword) {
    suggestions.value = [];
    open.value = false;
    activeIndex.value = -1;
    return;
  }

  const sequence = ++requestSequence;
  loading.value = true;
  failed.value = false;
  open.value = true;
  try {
    const payload = await apiFetch<SongCatalogPagePayload>("/api/content/songs", {
      query: {
        view: "list",
        shelfStatus: 0,
        page: 1,
        pageSize: 12,
        keyword
      }
    });
    if (sequence !== requestSequence) return;
    suggestions.value = payload.songs.slice(0, 6);
    activeIndex.value = -1;
    open.value = true;
    trackViewerEvent("home_song_search", {
      home_state: "guest",
      query_length: keyword.length,
      result_count: Number(payload.total || 0)
    });
  } catch {
    if (sequence !== requestSequence) return;
    suggestions.value = [];
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
  trackViewerEvent("home_latest_song_click", {
    home_state: "guest",
    source: "hero_search",
    song_id: song.id
  });
  await navigateTo(localePath(`/songs/${song.id}`));
};

const submit = async () => {
  const selected = suggestions.value[activeIndex.value] || suggestions.value[0];
  if (selected) {
    await goToSong(selected);
    return;
  }
  if (query.value.trim()) await runSearch();
};

const handleKeydown = async (event: KeyboardEvent) => {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    if (!open.value) open.value = true;
    if (suggestions.value.length) {
      activeIndex.value = (activeIndex.value + 1) % suggestions.value.length;
    }
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    if (suggestions.value.length) {
      activeIndex.value =
        activeIndex.value <= 0 ? suggestions.value.length - 1 : activeIndex.value - 1;
    }
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

const clearSearch = async () => {
  query.value = "";
  suggestions.value = [];
  open.value = false;
  activeIndex.value = -1;
  await nextTick();
};

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer);
  if (blurTimer) clearTimeout(blurTimer);
});
</script>

<template>
  <div class="guest-song-search">
    <form class="guest-song-search__form" role="search" @submit.prevent="submit">
      <label for="guest-home-song-search" class="sr-only">{{ t("page.home.guest.searchLabel") }}</label>
      <span class="guest-song-search__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" stroke-width="1.8" />
          <path d="m15.3 15.3 4.2 4.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
      </span>
      <input
        id="guest-home-song-search"
        v-model="query"
        type="search"
        autocomplete="off"
        enterkeyhint="search"
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
      <button
        v-if="query"
        type="button"
        class="guest-song-search__clear"
        :aria-label="t('page.home.guest.clearSearch')"
        @mousedown.prevent
        @click="clearSearch"
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m7 7 10 10M17 7 7 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
      </button>
      <button type="submit" class="guest-song-search__submit">{{ t("common.search") }}</button>
    </form>

    <div v-if="open" :id="listboxId" class="guest-song-search__results" role="listbox">
      <div v-if="loading" class="guest-song-search__status" role="status">
        {{ t("layout.loading") }}
      </div>
      <div v-else-if="failed" class="guest-song-search__status" role="status">
        {{ t("page.home.guest.searchFailed") }}
      </div>
      <div v-else-if="!suggestions.length" class="guest-song-search__status" role="status">
        {{ t("page.home.guest.searchEmpty") }}
      </div>
      <template v-else>
        <button
          v-for="(song, index) in suggestions"
          :id="`${listboxId}-${song.id}`"
          :key="song.id"
          type="button"
          class="guest-song-search__result"
          :class="{ 'is-active': activeIndex === index }"
          role="option"
          :aria-selected="activeIndex === index"
          @mousedown.prevent
          @mouseenter="activeIndex = index"
          @click="goToSong(song)"
        >
          <SongCoverImage
            :song-id="song.id"
            :alt="getTitle(song)"
            sizes="48px"
            fit="contain"
            class="guest-song-search__cover"
          />
          <span class="guest-song-search__copy">
            <strong>{{ getTitle(song) }}</strong>
            <small>{{ getSubtitle(song) }} · #{{ song.id }}</small>
          </span>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m9 6 6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          </svg>
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.guest-song-search {
  position: relative;
  z-index: 4;
  width: min(760px, 100%);
}

.guest-song-search__form {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  min-height: 64px;
  padding: 6px;
  border: 1px solid rgba(157, 101, 63, 0.26);
  border-radius: 18px;
  background:var(--viewer-surface-subtle);
  box-shadow:0 18px 38px rgba(107, 72, 45, 0.14);
}

.guest-song-search__form:focus-within {
  border-color:var(--viewer-link);
  box-shadow:0 0 0 3px var(--viewer-border), 0 20px 42px rgba(107, 72, 45, 0.16);
}

.guest-song-search__icon {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  color:var(--viewer-link);
}

.guest-song-search__icon svg,
.guest-song-search__clear svg {
  width: 22px;
  height: 22px;
}

.guest-song-search input {
  min-width: 0;
  width: 100%;
  height: 48px;
  border: 0;
  outline: 0;
  color:var(--viewer-text);
  background:transparent;
  font-size: 16px;
}

.guest-song-search input::placeholder {
  color:#9b8c80;
}

.guest-song-search__clear,
.guest-song-search__submit {
  min-width: 44px;
  min-height: 44px;
  border: 0;
  border-radius: 12px;
  cursor: pointer;
}

.guest-song-search__clear {
  display: grid;
  place-items: center;
  color:var(--viewer-text-muted);
  background:transparent;
}

.guest-song-search__submit {
  padding: 0 18px;
  color:#fff;
  background:var(--viewer-link);
  font-weight: 700;
}

.guest-song-search__clear:focus-visible,
.guest-song-search__submit:focus-visible,
.guest-song-search__result:focus-visible {
  outline: 3px solid var(--viewer-link);
  outline-offset: 2px;
}

.guest-song-search__results {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  overflow: hidden;
  border: 1px solid var(--viewer-border);
  border-radius: 16px;
  background:var(--viewer-surface-subtle);
  box-shadow:0 22px 48px rgba(80, 55, 35, 0.2);
  backdrop-filter: blur(16px);
}

.guest-song-search__status {
  padding: 18px;
  color:var(--viewer-text-muted);
  text-align: center;
}

.guest-song-search__result {
  width: 100%;
  min-height: 64px;
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) 20px;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  border: 0;
  border-bottom: 1px solid var(--viewer-border);
  color:var(--viewer-text);
  background:transparent;
  text-align: left;
  cursor: pointer;
}

.guest-song-search__result:last-child {
  border-bottom: 0;
}

.guest-song-search__result:hover,
.guest-song-search__result.is-active {
  background:rgba(196, 164, 132, 0.13);
}

.guest-song-search__cover {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  overflow: hidden;
  background:#f5e9dc;
}

.guest-song-search__copy {
  min-width: 0;
  display: grid;
  gap: 3px;
}

.guest-song-search__copy strong,
.guest-song-search__copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.guest-song-search__copy strong {
  font-size: 14px;
}

.guest-song-search__copy small {
  color:var(--viewer-text-muted);
  font-size: 12px;
}

.guest-song-search__result > svg {
  width: 20px;
  height: 20px;
  color:var(--viewer-accent-strong);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

:global(body.theme-dark .guest-song-search__form),
:global(body.theme-dark .guest-song-search__results) {
  border-color:rgba(255, 255, 255, 0.14);
  background:var(--viewer-surface-subtle);
}

:global(body.theme-dark .guest-song-search input::placeholder) {
  color:#a9998c;
}

:global(body.theme-dark .guest-song-search__result:hover),
:global(body.theme-dark .guest-song-search__result.is-active) {
  background:rgba(223, 148, 111, 0.12);
}

:global(body.theme-dark .guest-song-search__cover) {
  background:#2b2420;
}

@media (max-width: 560px) {
  .guest-song-search__form {
    min-height: 56px;
    border-radius: 16px;
  }

  .guest-song-search__icon {
    width: 38px;
  }

  .guest-song-search input {
    height: 44px;
    font-size: 15px;
  }

  .guest-song-search__submit {
    padding: 0 13px;
  }
}
</style>
