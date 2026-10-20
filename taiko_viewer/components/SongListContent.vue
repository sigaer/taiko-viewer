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
  { key: "level_1", icon: "/kantan.png", color: "#e74c3c" },
  { key: "level_2", icon: "/futsuu.png", color: "#2ecc71" },
  { key: "level_3", icon: "/muzukashii.png", color: "#27ae60" },
  { key: "level_4", icon: "/oni.png", color: "#ff69b4" },
  { key: "level_5", icon: "/inner_oni.png", color: "#8e44ad" }
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
  if (props.shelfStatus === 2) {
    return localePath({ path, query: { list: "other" } });
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
    <section class="song-catalog">
      <div class="panel-header">
        <label class="catalog-search-label" for="song-search">{{ t('songs.searchPlaceholder') }}</label>
        <el-input id="song-search" v-model="query" :placeholder="t('songs.searchPlaceholder')" clearable class="search-input">
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
            v-for="(song, songIndex) in songs"
            :key="song.id"
            class="song-card-link"
            :to="buildSongDetailLink(song.id)"
          >
            <div class="song-card">
              <div class="song-cover">
                <SongCoverImage
                  :song-id="song.id"
                  :alt="getSongTitle(song)"
                  sizes="80px"
                  :priority="songIndex === 0"
                  fit="contain"
                  class="cover-img"
                />
              </div>
              <div class="song-body">
                <h4 :lang="locale === 'ja' && song.song_name_jp ? 'ja' : 'zh-CN'">{{ getSongTitle(song) }}</h4>
                <p class="song-sub viewer-secondary-title" :lang="locale === 'ja' ? 'zh-CN' : 'ja'">{{ getSongSubtitle(song) }}</p>
                <div class="song-meta">
                  <span class="category-tag" :style="{ '--category-accent': categoryColors[song.type] || 'var(--viewer-text-muted)' }">
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
                    :aria-label="`${t(`difficulty.${level.key.slice(-1)}`)} ${level.value}★`" :title="`${t(`difficulty.${level.key.slice(-1)}`)} ${level.value}★`"
                  >
                    <img :src="level.icon" alt="" width="20" height="20">{{ level.value }}★
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
    </section>
  </div>
</template>

<style scoped>
.page-stack{display:grid;gap:32px;}.panel-header{display:flex;align-items:center;gap:16px;margin-bottom:24px;}.catalog-search-label{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);}.search-input{width:100%;max-width:520px;}.input-icon{display:inline-flex;width:20px;color:var(--viewer-text-muted);}.input-icon svg{width:18px;height:18px;}
.song-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 32px;}.song-card-link{display:block;min-width:0;text-decoration:none;color:var(--viewer-text);border-radius:8px;}.song-card{display:grid;grid-template-columns:80px minmax(0,1fr);align-items:start;gap:16px;padding:18px 0;border-bottom:1px solid var(--viewer-border);background:transparent;min-width:0;}.song-cover{width:80px;height:80px;border-radius:8px;overflow:hidden;background:var(--viewer-surface);}.cover-img{width:100%;height:100%;}.song-body{min-width:0;}.song-body h4{font-size:16px;font-weight:600;line-height:1.5;margin:0 0 4px;overflow-wrap:anywhere;}.song-sub{font-size:14px;line-height:1.6;color:var(--viewer-text-muted);margin:0 0 8px;overflow-wrap:anywhere;}.song-meta{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:14px;color:var(--viewer-text-muted);}.category-tag{color:var(--viewer-text-muted);}.song-id{margin-left:auto;}.song-levels{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:8px;}.level-pill{font-size:14px;display:inline-flex;gap:4px;align-items:baseline;white-space:nowrap;}.level-pill img{object-fit:contain;flex-shrink:0;}.song-alert,.load-more-row,.load-progress{grid-column:1/-1;}.load-more-row,.load-progress{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:16px;min-height:64px;margin:16px 0 0;color:var(--viewer-text-muted);font-size:14px;}.song-card-link:hover{background:var(--viewer-surface-subtle);}.song-card-link:focus-visible{outline:3px solid var(--viewer-link);outline-offset:4px;}
@media(max-width:700px){.song-grid{grid-template-columns:minmax(0,1fr);}.panel-header{margin-bottom:8px;}.song-card{padding:18px 0;}.song-meta{gap:4px 12px;}.song-id{margin-left:0;}.song-levels{gap:4px 10px;}}
</style>
