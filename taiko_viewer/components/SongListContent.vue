<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { SongCatalogItem, SongCatalogPagePayload } from "~/types/content";

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
const apiFetch = useViewerApiFetch();
const query = ref("");
const pageSize = 12;
const loadingMore = ref(false);
const refreshing = ref(false);
const loadError = ref<unknown>(null);
const failedAction = ref<"reload" | "more">("reload");
const loadSentinel = ref<HTMLElement | null>(null);
let searchTimer: ReturnType<typeof setTimeout> | undefined;
let requestSequence = 0;
let loadObserver: IntersectionObserver | undefined;

const createDefaultPayload = (): SongCatalogPagePayload => ({
  songs: [],
  total: 0,
  page: 1,
  pageSize
});

const fetchSongPage = (page: number, keyword = query.value.trim()) =>
  apiFetch<SongCatalogPagePayload>("/api/content/songs", {
    query: {
      view: "list",
      shelfStatus: props.shelfStatus,
      page,
      pageSize,
      keyword: keyword || undefined,
      sort: props.defaultSort
    }
  });

const {
  data: songsPayload,
  pending,
  error: initialError
} = await useAsyncData<SongCatalogPagePayload>(
  `song-list-${props.shelfStatus}-${props.defaultSort}`,
  () => fetchSongPage(1, ""),
  { default: createDefaultPayload }
);

const songs = computed(() => songsPayload.value.songs ?? []);
const total = computed(() => Number(songsPayload.value.total || 0));
const hasMore = computed(() => songs.value.length < total.value);
const error = computed(() => loadError.value || initialError.value);
const loadingInitial = computed(() => (pending.value || refreshing.value) && !songs.value.length);
const copy = computed(() =>
  locale.value === "ja"
    ? {
        progress: `${songs.value.length} / ${total.value} 件を表示中`,
        loadMore: "続きを読み込む",
        loadingMore: "読み込み中"
      }
    : {
        progress: `已显示 ${songs.value.length} / ${total.value} 首`,
        loadMore: "继续加载",
        loadingMore: "正在加载"
      }
);

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

const getLevels = (song: SongCatalogItem) =>
  difficultyDefs
    .map((def) => ({
      ...def,
      value: song[def.key as keyof SongCatalogItem]
    }))
    .filter((item) => item.value !== undefined && item.value !== null && item.value !== "-");

const getLevelCount = (song: SongCatalogItem) => Math.max(getLevels(song).length, 1);
const getSongTitle = (song: SongCatalogItem) =>
  locale.value === "ja" && song.song_name_jp ? song.song_name_jp : song.song_name;
const getSongSubtitle = (song: SongCatalogItem) =>
  locale.value === "ja" ? song.song_name || "—" : song.song_name_jp || "—";
const getCategoryLabel = (category: string) => categoryLabelMap[category]?.[locale.value === "ja" ? "ja" : "zh"] || category;

const buildSongDetailLink = (songId: number) => {
  const path = `/songs/${songId}`;
  if (props.shelfStatus === 1) {
    return localePath({ path, query: { list: "removed" } });
  }
  return localePath(path);
};

const reload = async () => {
  const sequence = ++requestSequence;
  refreshing.value = true;
  loadError.value = null;
  try {
    const payload = await fetchSongPage(1);
    if (sequence === requestSequence) {
      initialError.value = null;
      songsPayload.value = payload;
    }
  } catch (value) {
    if (sequence === requestSequence) {
      failedAction.value = "reload";
      loadError.value = value;
    }
  } finally {
    if (sequence === requestSequence) refreshing.value = false;
  }
};

const loadMore = async () => {
  if (!hasMore.value || loadingMore.value || refreshing.value) return;
  const sequence = requestSequence;
  const keyword = query.value.trim();
  loadingMore.value = true;
  loadError.value = null;
  try {
    const payload = await fetchSongPage(songsPayload.value.page + 1, keyword);
    if (sequence !== requestSequence || keyword !== query.value.trim()) return;
    songsPayload.value = {
      ...payload,
      songs: [...songs.value, ...payload.songs]
    };
  } catch (value) {
    if (sequence === requestSequence) {
      failedAction.value = "more";
      loadError.value = value;
    }
  } finally {
    loadingMore.value = false;
  }
};

watch(query, () => {
  requestSequence += 1;
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => void reload(), 300);
});

onMounted(() => {
  loadObserver = new IntersectionObserver(
    ([entry]) => {
      if (entry?.isIntersecting) void loadMore();
    },
    { root: null, rootMargin: "700px 0px" }
  );
  if (loadSentinel.value) loadObserver.observe(loadSentinel.value);
});

watch(loadSentinel, (current, previous) => {
  if (previous) loadObserver?.unobserve(previous);
  if (current) loadObserver?.observe(current);
});

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer);
  loadObserver?.disconnect();
});

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

      <div class="song-grid" :aria-busy="loadingInitial || refreshing || loadingMore">
        <template v-if="loadingInitial">
          <div v-for="n in 8" :key="n" class="song-card shimmer-card"></div>
        </template>
        <template v-else-if="error && !songs.length">
          <div class="song-alert">
            <el-alert :title="t('common.loadingFailed')" type="error" show-icon :closable="false" />
            <el-button type="primary" plain size="small" @click="reload">{{ t("common.retry") }}</el-button>
          </div>
        </template>
        <template v-else>
          <NuxtLink
            v-for="song in songs"
            :key="song.id"
            class="song-card-link"
            :to="buildSongDetailLink(song.id)"
          >
            <div class="song-card">
              <div class="song-cover">
                <SongCoverImage
                  :song-id="song.id"
                  :alt="getSongTitle(song)"
                  sizes="(max-width: 640px) 45vw, (max-width: 1100px) 30vw, 220px"
                  fit="contain"
                  class="cover-img"
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
        <div v-if="error && songs.length" class="song-alert">
          <el-alert :title="t('common.loadingFailed')" type="error" show-icon :closable="false" />
          <el-button
            type="primary"
            plain
            size="small"
            @click="failedAction === 'more' ? loadMore() : reload()"
          >
            {{ t("common.retry") }}
          </el-button>
        </div>
        <div v-if="hasMore && !loadingInitial" ref="loadSentinel" class="load-more-row">
          <span>{{ copy.progress }}</span>
          <el-button :loading="loadingMore" plain @click="loadMore">
            {{ loadingMore ? copy.loadingMore : copy.loadMore }}
          </el-button>
        </div>
        <p v-else-if="songs.length" class="load-progress">{{ copy.progress }}</p>
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

.load-more-row,
.load-progress {
  grid-column: 1 / -1;
  min-height: 52px;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #7a6552;
  font-size: 12px;
}
</style>
