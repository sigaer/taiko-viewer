<script setup lang="ts">
import { computed, ref } from "vue";
import type { SongCatalogItem } from "~/types/content";
import { buildSongCoverPath } from "~/utils/songCover";

const props = withDefaults(
  defineProps<{
    shelfStatus?: number;
    title?: string;
    desc?: string;
    defaultSort?: "catalog" | "open-day-desc";
  }>(),
  {
    shelfStatus: 0,
    title: "歌曲列表",
    desc: "展示歌曲曲绘、标题与分类信息。",
    defaultSort: "catalog"
  }
);

const { t, locale } = useI18n();
const localePath = useLocalePath();
const query = ref("");
const scrollContainer = ".app-content";
const coverFallbackId = 1384;
const coverErrors = ref<Record<number, boolean>>({});
const { data: songsPayload, pending, error, reload } = useSongCatalog(() => props.shelfStatus);

const songs = computed(() => songsPayload.value.songs ?? []);

const normalizedShelfStatus = (value: SongCatalogItem["shelf_status"]) => {
  if (value === undefined || value === null || value === "") return 0;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const categoryColors: Record<string, string> = {
  南梦宫原创音乐: "rgb(255, 153, 0)",
  流行音乐: "rgb(0, 122, 204)",
  儿童音乐: "rgb(255, 204, 0)",
  古典音乐: "rgb(184, 134, 11)",
  综合音乐: "rgb(46, 204, 113)",
  游戏音乐: "rgb(155, 89, 182)",
  博歌乐音乐: "rgb(128, 128, 128)",
  动漫音乐: "rgb(255, 105, 180)"
};

const categoryLabelMap: Record<string, { zh: string; ja: string }> = {
  南梦宫原创音乐: { zh: "南梦宫原创音乐", ja: "ナムコオリジナル" },
  流行音乐: { zh: "流行音乐", ja: "ポップス" },
  儿童音乐: { zh: "儿童音乐", ja: "キッズ" },
  古典音乐: { zh: "古典音乐", ja: "クラシック" },
  综合音乐: { zh: "综合音乐", ja: "バラエティ" },
  游戏音乐: { zh: "游戏音乐", ja: "ゲームミュージック" },
  博歌乐音乐: { zh: "博歌乐音乐", ja: "ボーカロイド" },
  动漫音乐: { zh: "动漫音乐", ja: "アニメ" }
};

const difficultyDefs = [
  { key: "level_1", color: "#e74c3c" },
  { key: "level_2", color: "#2ecc71" },
  { key: "level_3", color: "#27ae60" },
  { key: "level_4", color: "#ff69b4" },
  { key: "level_5", color: "#8e44ad" }
];

const getCoverUrl = buildSongCoverPath;
const resolveCoverUrl = (id: number) =>
  coverErrors.value[id] ? getCoverUrl(coverFallbackId) : getCoverUrl(id);

const handleCoverError = (id: number) => {
  if (coverErrors.value[id]) return;
  coverErrors.value = { ...coverErrors.value, [id]: true };
};

const getLevels = (song: SongCatalogItem) =>
  difficultyDefs
    .map((def) => ({
      ...def,
      value: song[def.key as keyof SongItem]
    }))
    .filter((item) => item.value !== undefined && item.value !== null && item.value !== "-");

const getLevelCount = (song: SongCatalogItem) => Math.max(getLevels(song).length, 1);
const getSongTitle = (song: SongCatalogItem) =>
  locale.value === "ja" && song.song_name_jp ? song.song_name_jp : song.song_name;
const getSongSubtitle = (song: SongCatalogItem) =>
  locale.value === "ja" ? song.song_name || "—" : song.song_name_jp || "—";
const getCategoryLabel = (category: string) => categoryLabelMap[category]?.[locale.value === "ja" ? "ja" : "zh"] || category;

const parseOpenDay = (input?: string) => {
  if (!input) return 0;
  const match = input.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return 0;
  return new Date(Number(match[3]), Number(match[1]) - 1, Number(match[2])).getTime();
};

const sortSongs = (items: SongCatalogItem[]) => {
  if (props.defaultSort !== "open-day-desc") return items;
  return [...items].sort((a, b) => {
    const dateDiff = parseOpenDay(b.open_day) - parseOpenDay(a.open_day);
    if (dateDiff !== 0) return dateDiff;
    return Number(b.id || 0) - Number(a.id || 0);
  });
};

const filteredSongs = computed(() => {
  const scopedSongs = songs.value.filter((song) => normalizedShelfStatus(song.shelf_status) === props.shelfStatus);
  if (!query.value) return sortSongs(scopedSongs);
  const keyword = query.value.trim().toLowerCase();
  return sortSongs(
    scopedSongs.filter(
      (song) =>
        song.song_name.toLowerCase().includes(keyword) ||
        song.song_name_jp?.toLowerCase().includes(keyword) ||
        song.type.toLowerCase().includes(keyword) ||
        getCategoryLabel(song.type).toLowerCase().includes(keyword)
    )
  );
});

const buildSongDetailLink = (songId: number) => {
  const path = `/songs/${songId}`;
  if (props.shelfStatus === 1) {
    return localePath({ path, query: { list: "removed" } });
  }
  return localePath(path);
};

</script>

<template>
  <div class="page-stack">
    <el-card class="panel-card">
      <div class="panel-header">
        <div>
          <h3 class="panel-title">
            <span class="section-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M9 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z M17 15V6l-9 2.5v9.5"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </span>
            {{ props.title }}
          </h3>
          <p>{{ props.desc }}</p>
        </div>
        <el-input v-model="query" :placeholder="t('songs.searchPlaceholder')" clearable class="search-input">
          <template #prefix>
            <span class="input-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M10.5 4a6.5 6.5 0 1 0 3.9 11.7l4.1 4.1"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </span>
          </template>
        </el-input>
      </div>

      <div class="song-grid">
        <template v-if="pending">
          <div v-for="n in 8" :key="n" class="song-card shimmer-card"></div>
        </template>
        <template v-else-if="error">
          <div class="song-alert">
            <el-alert :title="t('common.loadingFailed')" type="error" show-icon :closable="false" />
            <el-button type="primary" plain size="small" @click="reload">{{ t("common.retry") }}</el-button>
          </div>
        </template>
        <template v-else>
          <NuxtLink
            v-for="song in filteredSongs"
            :key="song.id"
            class="song-card-link"
            :to="buildSongDetailLink(song.id)"
          >
            <div class="song-card">
              <div class="song-cover">
                <el-image
                  :src="resolveCoverUrl(song.id)"
                  fit="contain"
                  class="cover-img"
                  lazy
                  loading="lazy"
                  :scroll-container="scrollContainer"
                  @error="handleCoverError(song.id)"
                />
              </div>
              <div class="song-body">
                <h4>{{ getSongTitle(song) }}</h4>
                <p class="song-sub">{{ getSongSubtitle(song) }}</p>
                <div class="song-meta">
                  <span class="category-tag" :style="{ backgroundColor: categoryColors[song.type] || '#9a8b7b' }">
                    {{ getCategoryLabel(song.type) }}
                  </span>
                  <span class="bpm-text">BPM {{ song.bpm || "-" }}</span>
                  <span class="song-id">#{{ song.id }}</span>
                </div>
                <div class="song-levels" :style="{ '--level-count': getLevelCount(song) }">
                  <span
                    v-for="level in getLevels(song)"
                    :key="level.key"
                    class="level-pill"
                    :style="{ backgroundColor: level.color }"
                  >
                    {{ level.value }}
                  </span>
                </div>
              </div>
            </div>
          </NuxtLink>
        </template>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.page-stack {
  display: grid;
  gap: 20px;
}

.panel-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.panel-header h3 {
  margin: 0 0 6px;
  font-size: 18px;
}

.panel-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.section-icon {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #9a6d47;
  background: rgba(196, 127, 79, 0.2);
  border-radius: 6px;
}

.section-icon svg {
  width: 14px;
  height: 14px;
}

.input-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #9a6d47;
}

.input-icon svg {
  width: 14px;
  height: 14px;
}

.panel-header p {
  margin: 0;
  color: #6c5a4b;
}

.search-input {
  max-width: 260px;
}

.song-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}

.song-card {
  display: grid;
  grid-template-rows: 170px auto;
  border-radius: 18px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 12px 24px rgba(165, 138, 110, 0.14);
}

.song-card-link {
  text-decoration: none;
  color: inherit;
  border-radius: 18px;
  transition: transform 0.2s ease;
}

.song-card-link:hover {
  transform: translateY(-2px);
}

.song-cover {
  width: 100%;
  height: 170px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.85), rgba(255, 243, 230, 0.9));
  padding: 8px;
}

.song-body {
  padding: 12px 14px 16px;
}

.song-body h4 {
  margin: 0 0 6px;
  font-size: 16px;
  line-height: 1.35;
  min-height: calc(1.35em * 2);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.song-sub {
  margin: 0 0 10px;
  font-size: 12px;
  color: #7a6552;
}

.song-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 12px;
}

.category-tag {
  padding: 4px 8px;
  border-radius: 999px;
  color: #fff;
  font-weight: 600;
  font-size: 12px;
}

.bpm-text {
  color: #7a6552;
}

.song-id {
  margin-left: auto;
  color: #7a6552;
  font-weight: 600;
}

.song-levels {
  display: grid;
  grid-template-columns: repeat(var(--level-count, 4), minmax(0, 1fr));
  gap: 6px;
  width: 100%;
}

.level-pill {
  width: 100%;
  padding: 4px 8px;
  border-radius: 10px;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  text-align: center;
}

.cover-img {
  width: 100%;
  height: 100%;
}

.song-alert {
  grid-column: 1 / -1;
}
</style>
