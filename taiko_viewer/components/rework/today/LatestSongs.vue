<script setup lang="ts">
// Latest songs of the home page (was components/home/HomeLatestSongs.vue). Data: /api/content/home latestSongs
// (the song data file, newest on-shelf first). Rows: cover, title in the page language, the other-language name,
// release day and the oni difficulty when the song has one. Analytics event unchanged.
// Default: a card with hairline rows. `tiles` (signed-in home with data, redesign 2026-11-27): cover tiles across the
// width, a swipeable strip on phones.
import type { SongCatalogItem } from "~/types/content";
import { formatOpenDay, songLevels, songNames } from "~/utils/rework/catalog";
import { trackViewerEvent } from "~/utils/analytics";

const props = withDefaults(defineProps<{ songs: SongCatalogItem[]; pending?: boolean; failed?: boolean; limit?: number; tiles?: boolean }>(), { limit: 5 });
const { t, locale } = useI18n();
const localePath = useLocalePath();
const rows = computed(() =>
  props.songs.slice(0, props.limit).map((song) => ({
    song,
    names: songNames(song, locale.value),
    day: formatOpenDay(song.open_day),
    oni: songLevels(song).find((level) => level.difficulty === 4) || null
  }))
);
</script>

<template>
  <ReworkPanel class="tl guest-latest" :class="{ 'tl--tiles': tiles }" :plain="tiles" :title="t('home.latestSongs')">
    <template #actions>
      <NuxtLink class="rw-link tl-more" :to="localePath('/songs')">{{ t("common.viewAll") }}</NuxtLink>
    </template>
    <ReworkState v-if="pending" kind="loading" :lines="limit" compact />
    <ReworkState v-else-if="failed || !songs.length" kind="empty" compact :title="t('home.latestSongsUnavailable')" />
    <ul v-else-if="tiles" class="tl-tiles">
      <li v-for="(row, index) in rows" :key="row.song.id">
        <NuxtLink
          :to="localePath(`/songs/${row.song.id}`)"
          class="tl-tile"
          @click="trackViewerEvent('home_latest_song_click', { home_state: 'guest', source: 'latest', song_id: row.song.id, position: index + 1 })"
        >
          <DsCover :song-id="row.song.id" size="fill" :priority="index === 0" />
          <strong :lang="row.names.titleLang === 'ja' ? 'ja' : undefined" :title="row.names.title">{{ row.names.title }}</strong>
          <span class="tl-tile-meta">
            <DsDiff v-if="row.oni" :difficulty="4" :star="row.oni.star" :show-constant="false" />
            <time v-if="row.day" class="num" :datetime="row.day">{{ row.day }}</time>
          </span>
        </NuxtLink>
      </li>
    </ul>
    <ul v-else class="tl-list">
      <li v-for="(row, index) in rows" :key="row.song.id">
        <NuxtLink
          :to="localePath(`/songs/${row.song.id}`)"
          class="tl-row"
          @click="trackViewerEvent('home_latest_song_click', { home_state: 'guest', source: 'latest', song_id: row.song.id, position: index + 1 })"
        >
          <DsCover :song-id="row.song.id" size="md" :priority="index === 0" />
          <span class="tl-name">
            <strong :lang="row.names.titleLang === 'ja' ? 'ja' : undefined" :title="row.names.title">{{ row.names.title }}</strong>
            <small>
              <span v-if="row.names.subtitle" :lang="row.names.subtitleLang">{{ row.names.subtitle }}</span>
              <span v-if="row.names.subtitle && row.day" aria-hidden="true"> · </span>
              <time v-if="row.day" class="num" :datetime="row.day">{{ row.day }}</time>
            </small>
          </span>
          <DsDiff v-if="row.oni" class="tl-diff" :difficulty="4" :star="row.oni.star" :show-constant="false" />
        </NuxtLink>
      </li>
    </ul>
  </ReworkPanel>
</template>

<style scoped>
.tl-more {
  display: inline-flex;
  align-items: center;
  min-height: var(--hit);
  font-size: var(--fs-13);
}
.tl-list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.tl-row {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  min-height: var(--hit);
  padding: 10px 0;
  border-top: 1px solid var(--line);
  color: var(--ink);
  text-decoration: none;
}
.tl-row:hover strong {
  color: var(--link);
}
.tl-row:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
  border-radius: var(--r-xs);
}
.tl-name {
  flex: 1;
  display: grid;
  gap: 2px;
  min-width: 0;
}
.tl-name strong {
  overflow: hidden;
  font-size: var(--fs-14);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tl-name small {
  overflow: hidden;
  color: var(--ink-3);
  font-size: var(--fs-12);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tl-diff {
  flex: none;
}
.tl-tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: var(--sp-4);
  margin: 0;
  padding: 0;
  list-style: none;
}
.tl-tiles li {
  min-width: 0;
}
.tl-tile {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  height: 100%;
  box-sizing: border-box;
  padding: 10px 10px var(--sp-3);
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--surface);
  color: var(--ink);
  text-decoration: none;
}
.tl-tile strong {
  display: -webkit-box;
  overflow: hidden;
  min-height: calc(2em * var(--lh-snug));
  font-size: var(--fs-14);
  font-weight: 700;
  line-height: var(--lh-snug);
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.tl-tile:hover strong {
  color: var(--link);
}
.tl-tile:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.tl-tile-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--sp-1) var(--sp-2);
  margin-top: auto;
  color: var(--ink-3);
  font-size: var(--fs-12);
}
@media (max-width: 767px) {
  .tl-tiles {
    display: flex;
    gap: var(--sp-3);
    padding-bottom: var(--sp-1);
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scroll-snap-type: x proximity;
  }
  .tl-tiles li {
    flex: none;
    width: 136px;
    scroll-snap-align: start;
  }
}
</style>
