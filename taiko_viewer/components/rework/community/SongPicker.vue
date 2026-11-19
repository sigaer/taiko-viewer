<script setup lang="ts">
// ReworkCommunitySongPicker — the composer's related chart: search the song list (the page runs the request with
// the catalog contract), pick a result, then the difficulty (only those the song has; empty = none) and its star
// level (read only, from the song). Search runs on the button or Enter, as before.
import type { PropType } from "vue";
import type { SongCatalogItem } from "~/types/content";
import { songNames } from "~/utils/rework/catalog";

const props = defineProps({
  query: { type: String, default: "" },
  results: { type: Array as PropType<SongCatalogItem[]>, default: () => [] },
  loading: { type: Boolean, default: false },
  selected: { type: Object as PropType<SongCatalogItem | null>, default: null },
  difficulty: { type: String, default: "" },
  difficultyOptions: { type: Array as PropType<{ value: string; label: string }[]>, default: () => [] },
  level: { type: String, default: "" },
  disabled: { type: Boolean, default: false }
});
const emit = defineEmits<{
  "update:query": [value: string];
  "update:difficulty": [value: string];
  search: [];
  choose: [song: SongCatalogItem];
}>();
const { t, locale } = useI18n();
const id = useId();
const names = (song: SongCatalogItem) => songNames(song, locale.value);
const selectedNames = computed(() => (props.selected ? names(props.selected) : null));
</script>

<template>
  <div class="csp song-picker">
    <label :for="`${id}-q`" class="rw-field__label">{{ t("rework.forum.compose.songId") }}</label>
    <div class="csp__search">
      <input
        :id="`${id}-q`"
        class="rw-input csp__input"
        type="search"
        enterkeyhint="search"
        :value="query"
        :placeholder="t('rework.forum.compose.songIdPlaceholder')"
        :disabled="disabled"
        @input="emit('update:query', ($event.target as HTMLInputElement).value)"
        @keyup.enter="emit('search')"
      />
      <button type="button" class="rw-btn" :disabled="disabled" :aria-busy="loading || undefined" @click="emit('search')">{{ loading ? t("rework.state.loading") : t("common.search") }}</button>
    </div>
    <ul v-if="results.length" class="csp__results song-picker__results" :aria-label="t('rework.forum.compose.songResults')">
      <li v-for="song in results" :key="song.id">
        <button type="button" class="csp__result" :disabled="disabled" @click="emit('choose', song)">
          <DsCover :song-id="song.id" size="sm" />
          <span class="csp__names">
            <span class="csp__name" :lang="names(song).titleLang">{{ names(song).title }}</span>
            <small class="num">#{{ song.id }} · {{ song.type }}</small>
          </span>
        </button>
      </li>
    </ul>
    <div v-if="selected && selectedNames" class="csp__picked song-picker__selected">
      <DsSongCell :song-id="selected.id" :title="selectedNames.title" :title-lang="selectedNames.titleLang" :subtitle="selectedNames.subtitle" :subtitle-lang="selectedNames.subtitleLang" :difficulty="difficulty || null" :star="level || null" :show-constant="false" cover-size="md" />
      <div class="csp__diff">
        <label class="rw-field">
          <span class="rw-field__label">{{ t("rework.forum.compose.difficulty") }}</span>
          <select class="rw-select" :value="difficulty" :disabled="disabled" @change="emit('update:difficulty', ($event.target as HTMLSelectElement).value)">
            <option value="">{{ t("rework.forum.compose.noDifficulty") }}</option>
            <option v-for="option in difficultyOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>
        <label class="rw-field">
          <span class="rw-field__label">{{ t("rework.forum.compose.level") }}</span>
          <input class="rw-input csp__level num" :value="level" readonly :placeholder="t('rework.forum.compose.levelPlaceholder')" />
        </label>
      </div>
    </div>
  </div>
</template>

<style scoped>
.csp {
  display: grid;
  gap: var(--sp-2);
  min-width: 0;
  font-family: var(--font-ui);
}
.csp__search {
  display: flex;
  gap: var(--sp-2);
}
.csp__input {
  flex: 1;
  min-width: 0;
}
.csp__results {
  display: grid;
  gap: 2px;
  max-height: 280px;
  overflow-y: auto;
  margin: 0;
  padding: var(--sp-1);
  list-style: none;
  border: 1px solid var(--line-strong);
  border-radius: var(--r-ctl);
  background: var(--surface);
}
.csp__result {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  width: 100%;
  min-height: var(--hit);
  padding: var(--sp-1) var(--sp-2);
  border: 0;
  border-radius: var(--r-xs);
  background: transparent;
  color: var(--ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.csp__result:hover,
.csp__result:focus-visible {
  background: var(--row-sel-bg);
  outline: none;
}
.csp__result:focus-visible {
  box-shadow: inset 0 0 0 2px var(--focus-ring);
}
.csp__names {
  display: grid;
  min-width: 0;
}
.csp__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--fs-14);
}
.csp__names small {
  font-size: var(--fs-12);
  color: var(--ink-3);
}
.csp__picked {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--sp-3) var(--sp-4);
  padding: var(--sp-3);
  border-radius: var(--r-ctl);
  background: var(--bg-sunk);
}
.csp__diff {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-3);
}
.csp__level {
  width: 96px;
}
</style>
