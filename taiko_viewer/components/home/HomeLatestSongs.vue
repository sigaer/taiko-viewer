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
      :description="t('page.home.guest.latestDescription')"
      :link-label="t('common.viewAll')"
      :link-to="localePath('/songs/available')"
    />
    <div v-if="pending" class="guest-latest__rail" aria-hidden="true">
      <div v-for="index in 6" :key="index" class="guest-song-card guest-song-card--loading shimmer-card"></div>
    </div>
    <div v-else-if="failed || !songs.length" class="guest-latest__empty panel-card">
      {{ t("home.latestSongsUnavailable") }}
    </div>
    <div v-else class="guest-latest__rail">
      <NuxtLink
        v-for="(song, index) in songs.slice(0, 6)"
        :key="song.id"
        :to="localePath(`/songs/${song.id}`)"
        class="guest-song-card"
        @click="trackViewerEvent('home_latest_song_click', { home_state: 'guest', source: 'latest', song_id: song.id, position: index + 1 })"
      >
        <div class="guest-song-card__cover">
          <SongCoverImage
            :song-id="song.id"
            :alt="getTitle(song)"
            sizes="(max-width: 720px) 148px, (max-width: 1200px) 16vw, 180px"
            fit="contain"
            :priority="index === 0"
          />
        </div>
        <div class="guest-song-card__copy">
          <strong>{{ getTitle(song) }}</strong>
          <span>{{ getSubtitle(song) }}</span>
          <small v-if="song.open_day">{{ song.open_day }}</small>
        </div>
      </NuxtLink>
    </div>
  </section>
</template>

<style scoped>
.guest-latest {
  display: grid;
  gap: 14px;
}

.guest-latest__rail {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 12px;
}

.guest-song-card {
  min-width: 0;
  display: grid;
  grid-template-rows: auto 1fr;
  overflow: hidden;
  border: 1px solid var(--viewer-border);
  border-radius: 18px;
  color: inherit;
  background: rgba(255, 253, 250, 0.9);
  box-shadow: 0 12px 24px rgba(110, 77, 51, 0.08);
  text-decoration: none;
  scroll-snap-align: start;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.guest-song-card:hover {
  transform: translateY(-2px);
  border-color: rgba(168, 95, 62, 0.34);
  box-shadow: 0 16px 30px rgba(110, 77, 51, 0.13);
}

.guest-song-card:focus-visible {
  outline: 3px solid #a85f3e;
  outline-offset: 3px;
}

.guest-song-card__cover {
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  overflow: hidden;
  padding: 8px;
  background: linear-gradient(145deg, #fff, #f6eadf);
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
  color: var(--viewer-text);
  font-size: 14px;
}

.guest-song-card__copy span,
.guest-song-card__copy small {
  color: var(--viewer-text-muted);
  font-size: 11px;
}

.guest-song-card--loading {
  min-height: 230px;
}

.guest-latest__empty {
  min-height: 120px;
  display: grid;
  place-items: center;
  color: var(--viewer-text-muted);
}

:global(body.theme-dark .guest-song-card) {
  background: rgba(35, 30, 27, 0.92);
}

:global(body.theme-dark .guest-song-card__cover) {
  background: linear-gradient(145deg, #2c2521, #211c19);
}

@media (max-width: 980px) {
  .guest-latest__rail {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
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

  .guest-song-card--loading {
    min-height: 210px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .guest-song-card {
    transition: none;
  }
}
</style>
