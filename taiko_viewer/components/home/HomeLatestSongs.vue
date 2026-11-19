<script setup lang="ts">
import type { SongCatalogItem } from "~/types/content";
import { trackViewerEvent } from "~/utils/analytics";

defineProps<{
  songs: SongCatalogItem[];
  pending?: boolean;
  failed?: boolean;
}>();

const { t, locale } = useI18n();
const localePath = useLocalePath();
const getTitle = (song: SongCatalogItem) =>
  locale.value === "ja" && song.song_name_jp ? song.song_name_jp : song.song_name;
const getSubtitle = (song: SongCatalogItem) =>
  locale.value === "ja" ? song.song_name || "—" : song.song_name_jp || "—";
</script>

<template>
  <section class="guest-latest" aria-labelledby="guest-latest-title">
    <HomeSectionHeader
      heading-id="guest-latest-title"
      :title="t('home.latestSongs')"
      :link-label="t('common.viewAll')"
      :link-to="localePath('/songs/available')"
    />
    <div v-if="pending" class="guest-latest__rail" aria-hidden="true">
      <div v-for="index in 5" :key="index" class="guest-song-card guest-song-card--loading shimmer-card">
        <div class="guest-song-card__cover"></div>
        <div class="guest-song-card__copy">
          <span class="guest-song-card__placeholder guest-song-card__placeholder--title"></span>
          <span class="guest-song-card__placeholder"></span>
          <span class="guest-song-card__placeholder"></span>
        </div>
      </div>
    </div>
    <div v-else-if="failed || !songs.length" class="guest-latest__empty panel-card">
      {{ t("home.latestSongsUnavailable") }}
    </div>
    <div v-else class="guest-latest__rail">
      <NuxtLink
        v-for="(song, index) in songs.slice(0, 5)"
        :key="song.id"
        :to="localePath(`/songs/${song.id}`)"
        class="guest-song-card"
        @click="trackViewerEvent('home_latest_song_click', { home_state: 'guest', source: 'latest', song_id: song.id, position: index + 1 })"
      >
        <div class="guest-song-card__cover">
          <SongCoverImage
            :song-id="song.id"
            :alt="getTitle(song)"
            sizes="(max-width: 720px) 42vw, 190px"
            fit="contain"
            :priority="index === 0"
          />
        </div>
        <div class="guest-song-card__copy">
          <strong :title="getTitle(song)">{{ getTitle(song) }}</strong>
          <span :title="getSubtitle(song)">{{ getSubtitle(song) }}</span>
          <small v-if="song.open_day">{{ song.open_day }}</small>
        </div>
      </NuxtLink>
    </div>
  </section>
</template>

<style scoped>
.guest-latest {
  display: grid;
  min-width: 0;
  gap: 14px;
}

.guest-latest__rail {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.guest-song-card {
  min-width: 0;
  display: grid;
  grid-template-rows: auto 1fr;
  overflow: hidden;
  border: 1px solid var(--viewer-border);
  border-radius: 18px;
  color:inherit;
  background:var(--viewer-surface);
  box-shadow:none;
  text-decoration: none;
  scroll-snap-align: start;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.guest-song-card:hover {
  transform: translateY(-2px);
  border-color:var(--viewer-control-border);
  box-shadow:none;
}

.guest-song-card:focus-visible {
  outline: 3px solid var(--viewer-link);
  outline-offset: 3px;
}

.guest-song-card__cover {
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  overflow: hidden;
  padding: 8px;
  background:var(--viewer-surface);
}

.guest-song-card__cover :deep(img) {
  width: 100%;
  height: 100%;
}

.guest-song-card__copy {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: 3px;
  padding: 11px 12px 13px;
}

.guest-song-card__copy strong,
.guest-song-card__copy span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.guest-song-card__copy strong {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  white-space: normal;
  overflow-wrap: anywhere;
  color:var(--viewer-text);
  font-size: 14px;
  line-height: 1.45;
}

.guest-song-card__copy span,
.guest-song-card__copy small {
  color:var(--viewer-text-muted);
  font-size: 14px;
}

.guest-song-card__placeholder { display: block; height: 1.6em; background: var(--viewer-border); border-radius: 4px; }
.guest-song-card__placeholder--title { height: 2.9em; }

.guest-latest__empty {
  min-height: 120px;
  display: grid;
  place-items: center;
  color:var(--viewer-text-muted);
}

:global(body.theme-dark .guest-song-card) {
  background:var(--viewer-surface);
}

:global(body.theme-dark .guest-song-card__cover) {
  background:var(--viewer-surface);
}

@media (max-width: 720px) {
  .guest-latest {
    gap: 12px;
  }

  .guest-latest__rail {
    grid-template-columns: none;
    grid-auto-flow: column;
    grid-auto-columns: minmax(140px, 42vw);
    overflow-x: auto;
    margin-inline: -14px;
    padding: 2px 14px 12px;
    scroll-padding-inline: 14px;
    scroll-snap-type: x proximity;
    overscroll-behavior-inline: contain;
    scrollbar-width: none;
  }

  .guest-latest__rail::-webkit-scrollbar {
    display: none;
  }

}

@media (prefers-reduced-motion: reduce) {
  .guest-song-card {
    transition: none;
  }
}
</style>
