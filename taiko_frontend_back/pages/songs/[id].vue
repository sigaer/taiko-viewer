<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { type BranchVariant, useSongBranchAudio } from "~/composables/useSongBranchAudio";

type SongItem = {
  id: number;
  song_name: string;
  song_name_jp?: string;
  subtitle?: string;
  open_day?: string;
  type: string;
  bpm?: string;
  version?: string[];
  artists?: string[];
  max_combo?: Array<number | string>;
  shelf_status?: number | string;
  level_1?: number | string;
  level_2?: number | string;
  level_3?: number | string;
  level_4?: number | string;
  level_5?: number | string;
};

type RatingDataItem = {
  id?: number | string;
  level?: number | string;
  曲名?: string;
  复合处理?: number | string;
  平均密度?: number | string;
  瞬间密度?: number | string;
  叩き分け?: number | string;
  BPM变化?: number | string;
  hs变化?: number | string;
};

const route = useRoute();
const runtimeConfig = useRuntimeConfig();
const apiBase = runtimeConfig.public.apiBase || "https://static.sakura-bot.cn";
const coverFallbackId = 1384;
const coverError = ref(false);
const selectedTrack = ref("ONI");
const drumVolume = ref(1);
const drumMuted = ref(false);
const audioErrors = ref<Record<string, boolean>>({});
const drumAudioRefs = ref<Record<string, HTMLAudioElement | null>>({});

const songId = computed(() => Number(route.params.id));

const pageMeta = {
  title: "歌曲详情",
  desc: "查看歌曲信息、试听音源和谱面预览。"
};

definePageMeta({
  pageTitle: pageMeta.title,
  pageDesc: pageMeta.desc,
  navKey: "/songs/available",
  breadcrumbs: [
    { label: "现有歌曲", to: "/songs/available" },
    { label: "歌曲详情" }
  ]
});

const { data: songData, pending, error } = await useAsyncData(
  () => `song-${songId.value}`,
  async () => {
    const list = await $fetch<SongItem[]>("/json/song_data.json", {
      baseURL: apiBase
    });
    return list.find((item) => item.id === songId.value) || null;
  },
  {
    watch: [songId],
    default: () => null
  }
);

const { data: ratingSource } = await useAsyncData(
  "rating-structured-with-ids",
  async () => {
    try {
      return await $fetch<{ songs?: Record<string, RatingDataItem> }>("/json/rating_structured_with_ids.json", {
        baseURL: apiBase
      });
    } catch {
      return null;
    }
  },
  {
    default: () => null
  }
);

const song = computed(() => songData.value);

const coverUrl = computed(() => {
  const id = coverError.value || !song.value ? coverFallbackId : song.value.id;
  return `${apiBase}/cover/${id}.png`;
});

const hasEditDifficulty = computed(() => {
  const value = song.value?.level_5;
  return value !== undefined && value !== null && value !== "-" && value !== "";
});

const trackDefs = computed(() => {
  const base = [
    { key: "EASY", label: "简单" },
    { key: "NORMAL", label: "一般" },
    { key: "HARD", label: "困难" },
    { key: "ONI", label: "魔王" }
  ];
  return hasEditDifficulty.value ? [...base, { key: "EDIT", label: "里谱" }] : base;
});

const levelMap = computed(() => ({
  EASY: song.value?.level_1,
  NORMAL: song.value?.level_2,
  HARD: song.value?.level_3,
  ONI: song.value?.level_4,
  EDIT: song.value?.level_5
}));

const formatStar = (value?: number | string) => {
  if (value === undefined || value === null || value === "-" || value === "") return "—";
  return `${value}★`;
};

const getTrackStarLabel = (key: string) => formatStar(levelMap.value[key as keyof typeof levelMap.value]);

const fumenKeyMap: Record<string, keyof typeof levelMap.value> = {
  easy: "EASY",
  normal: "NORMAL",
  hard: "HARD",
  oni: "ONI",
  inner: "EDIT"
};

const getFumenStarLabel = (key: string) => formatStar(levelMap.value[fumenKeyMap[key]]);

const comboIndexMap: Record<string, number> = {
  easy: 0,
  normal: 1,
  hard: 2,
  oni: 3,
  inner: 4
};

const formatList = (input?: string[]) => {
  if (!input || !input.length) return "-";
  return input.join(" / ");
};

const getFumenComboLabel = (key: string) => {
  const comboList = song.value?.max_combo;
  const index = comboIndexMap[key];
  if (!comboList || comboList[index] === undefined || comboList[index] === null || comboList[index] === "") {
    return "—";
  }
  return String(comboList[index]);
};

const { activeBranchVariants, hasBranchVariants, getBaseAudioUrl, getVariantAudioUrl } = useSongBranchAudio({
  apiBase,
  songId,
  selectedTrack
});

const currentDrumAudio = computed(() => {
  if (!song.value) return "";
  return getBaseAudioUrl("drum");
});

const currentMixAudio = computed(() => {
  if (!song.value) return "";
  return getBaseAudioUrl("mix");
});

const getDrumVariantAudioUrl = (variant: BranchVariant) => getVariantAudioUrl("drum", variant);
const getMixVariantAudioUrl = (variant: BranchVariant) => getVariantAudioUrl("mix", variant);

const fumenDefs = computed(() => {
  const base = [
    { key: "easy", label: "简单", folder: "Kantan" },
    { key: "normal", label: "一般", folder: "Futsuu" },
    { key: "hard", label: "困难", folder: "Muzukashii" },
    { key: "oni", label: "魔王", folder: "Oni" }
  ];
  return hasEditDifficulty.value ? [...base, { key: "inner", label: "里谱", folder: "InnerOni" }] : base;
});

const getFumenUrl = (folder: string) => `${apiBase}/fumen/${folder}/${songId.value}.png`;

const setDrumAudioRef = (key: string, el: Element | null) => {
  drumAudioRefs.value = {
    ...drumAudioRefs.value,
    [key]: el instanceof HTMLAudioElement ? el : null
  };
  syncDrumState();
};

const syncDrumState = () => {
  Object.values(drumAudioRefs.value).forEach((audio) => {
    if (!audio) return;
    audio.volume = drumVolume.value;
    audio.muted = drumMuted.value;
  });
};

const markAudioError = (key: string) => {
  audioErrors.value = { ...audioErrors.value, [key]: true };
};

const hasAudioError = (key: string) => !!audioErrors.value[key];
const getAudioErrorKey = (mode: "drum" | "mix", variant?: BranchVariant) =>
  variant
    ? `${mode}-${songId.value}-${selectedTrack.value}-${variant}`
    : `${mode}-base-${songId.value}-${selectedTrack.value}`;

const radarLabels = ["复合处理", "平均密度", "瞬间密度", "叩き分け", "BPM变化", "hs变化"] as const;

const trackLevelMap: Record<string, number> = {
  EASY: 1,
  NORMAL: 2,
  HARD: 3,
  ONI: 4,
  EDIT: 5
};

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const ratingEntries = computed(() => {
  const songs = ratingSource.value?.songs;
  if (!songs || typeof songs !== "object") return [];
  return Object.values(songs).filter((item): item is RatingDataItem => !!item && typeof item === "object");
});

const selectedRating = computed(() => {
  const entries = ratingEntries.value.filter((item) => Number(item.id) === songId.value);
  if (!entries.length) return null;
  const targetLevel = trackLevelMap[selectedTrack.value];
  const exactMatch = entries.find((item) => Number(item.level) === targetLevel);
  if (exactMatch) return exactMatch;
  return [...entries].sort((a, b) => (toNumber(b.level) ?? 0) - (toNumber(a.level) ?? 0))[0];
});

const hasRadarData = computed(() => {
  if (!selectedRating.value) return false;
  return radarLabels.some((label) => toNumber(selectedRating.value?.[label]) !== null);
});

const radarValues = computed(() => {
  if (!selectedRating.value) return radarLabels.map(() => 0);
  return radarLabels.map((label) => toNumber(selectedRating.value?.[label]) ?? 0);
});

const radarMax = computed(() => {
  const maxValue = Math.max(...radarValues.value, 0);
  if (maxValue <= 0) return 10;
  return Math.ceil(maxValue / 10) * 10;
});

const radarSize = 260;
const radarCenter = radarSize / 2;
const radarRadius = 86;
const radarAngleOffset = -Math.PI / 2;
const radarLevels = [0.25, 0.5, 0.75, 1];

const getRadarPoint = (ratio: number, index: number, extra = 0) => {
  const angle = (Math.PI * 2 * index) / radarLabels.length + radarAngleOffset;
  const radius = radarRadius * ratio + extra;
  return {
    x: radarCenter + radius * Math.cos(angle),
    y: radarCenter + radius * Math.sin(angle)
  };
};

const radarGridPolygons = computed(() =>
  radarLevels.map((level) =>
    radarLabels
      .map((_, index) => {
        const point = getRadarPoint(level, index);
        return `${point.x},${point.y}`;
      })
      .join(" ")
  )
);

const radarAxisLines = computed(() =>
  radarLabels.map((_, index) => {
    const start = getRadarPoint(0, index);
    const end = getRadarPoint(1, index);
    return {
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y
    };
  })
);

const radarDataPoints = computed(() =>
  radarLabels.map((_, index) => {
    const value = radarValues.value[index];
    const ratio = Math.min(1, value / radarMax.value);
    const point = getRadarPoint(ratio, index);
    return {
      x: point.x,
      y: point.y,
      value
    };
  })
);

const radarDataPolygon = computed(() => radarDataPoints.value.map((point) => `${point.x},${point.y}`).join(" "));

const radarLabelPoints = computed(() =>
  radarLabels.map((label, index) => {
    const point = getRadarPoint(1, index, 22);
    const deltaX = point.x - radarCenter;
    const anchor = deltaX > 10 ? "start" : deltaX < -10 ? "end" : "middle";
    return {
      label,
      x: point.x,
      y: point.y + 4,
      anchor
    };
  })
);

const radarSummary = computed(() =>
  radarLabels.map((label, index) => ({
    label,
    value: radarValues.value[index]
  }))
);

const formatRadarValue = (value: number) => {
  if (Number.isInteger(value)) return `${value}`;
  return value.toFixed(2);
};

watch([drumVolume, drumMuted], () => syncDrumState());
watch([songId, selectedTrack], () => {
  drumAudioRefs.value = {};
});
watch(hasEditDifficulty, (value) => {
  if (!value && selectedTrack.value === "EDIT") {
    selectedTrack.value = "ONI";
  }
});

useSeoMeta(() => ({
  title: song.value ? `${song.value.song_name} - 歌曲详情` : pageMeta.title,
  description: song.value?.subtitle || pageMeta.desc,
  ogTitle: song.value ? `${song.value.song_name} - 歌曲详情` : pageMeta.title,
  ogDescription: song.value?.subtitle || pageMeta.desc
}));
</script>

<template>
  <div class="song-detail-page">
    <el-card v-if="pending" class="panel-card">
      <el-skeleton :rows="8" animated />
    </el-card>

    <el-card v-else-if="error || !song" class="panel-card">
      <el-result icon="error" title="歌曲不存在或加载失败" sub-title="请返回歌曲列表后重试。">
        <template #extra>
          <NuxtLink to="/songs/available">
            <el-button type="primary">返回歌曲列表</el-button>
          </NuxtLink>
        </template>
      </el-result>
    </el-card>

    <el-card v-else class="panel-card detail-shell">
      <div class="back-row">
        <NuxtLink class="back-link" to="/songs/available">← 返回列表</NuxtLink>
      </div>

      <main class="detail-main">
        <section class="detail-left">
          <div class="cover-wrap">
            <el-image :src="coverUrl" fit="cover" class="cover-image" @error="coverError = true" />
          </div>
          <h2>{{ song.song_name }}</h2>
          <p class="jp-name">{{ song.song_name_jp || "-" }}</p>

          <div class="meta-list">
            <div class="meta-row">
              <span>发布日期</span>
              <strong>{{ song.open_day || "-" }}</strong>
            </div>
            <div class="meta-row">
              <span>ID</span>
              <strong>#{{ song.id }}</strong>
            </div>
            <div class="meta-row">
              <span>副标题</span>
              <strong>{{ song.subtitle || "-" }}</strong>
            </div>
            <div class="meta-row">
              <span>日文名</span>
              <strong>{{ song.song_name_jp || "-" }}</strong>
            </div>
            <div class="meta-row">
              <span>BPM</span>
              <strong>{{ song.bpm || "-" }}</strong>
            </div>
            <div class="meta-row">
              <span>实装版本</span>
              <strong>{{ formatList(song.version) }}</strong>
            </div>
            <div class="meta-row">
              <span>作曲/演唱</span>
              <strong>{{ formatList(song.artists) }}</strong>
            </div>
          </div>
        </section>

        <section class="detail-middle">
          <div class="radar-card">
            <div class="section-title">
              <span class="title-icon radar-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 4l7 4v8l-7 4-7-4V8l7-4z M12 4v16 M5 8l14 8 M19 8L5 16"
                    stroke="currentColor"
                    stroke-width="1.4"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
              <span>六维雷达</span>
            </div>
            <template v-if="hasRadarData">
              <svg class="radar-chart" viewBox="0 0 260 260" role="img" aria-label="六维雷达图">
                <polygon
                  v-for="(polygon, index) in radarGridPolygons"
                  :key="`grid-${index}`"
                  class="radar-grid"
                  :points="polygon"
                />
                <line
                  v-for="(line, index) in radarAxisLines"
                  :key="`axis-${index}`"
                  class="radar-axis"
                  :x1="line.x1"
                  :y1="line.y1"
                  :x2="line.x2"
                  :y2="line.y2"
                />
                <polygon class="radar-area" :points="radarDataPolygon" />
                <circle
                  v-for="(point, index) in radarDataPoints"
                  :key="`point-${index}`"
                  class="radar-point"
                  :cx="point.x"
                  :cy="point.y"
                  r="3.2"
                />
                <text
                  v-for="label in radarLabelPoints"
                  :key="label.label"
                  class="radar-label"
                  :x="label.x"
                  :y="label.y"
                  :text-anchor="label.anchor"
                >
                  {{ label.label }}
                </text>
              </svg>
              <div class="radar-meta">
                <span>坐标范围：0 - {{ radarMax }}</span>
                <span v-if="selectedRating?.level">层级：{{ selectedRating.level }}</span>
              </div>
              <ul class="radar-values">
                <li v-for="item in radarSummary" :key="item.label">
                  <span>{{ item.label }}</span>
                  <strong>{{ formatRadarValue(item.value) }}</strong>
                </li>
              </ul>
            </template>
            <div v-else class="radar-empty">
              <img src="/radar-empty.svg" alt="暂无六维数据" class="radar-empty-image" />
              <p>暂无该歌曲 ID 对应的六维数据</p>
            </div>
          </div>
        </section>

        <section class="detail-right">
          <div class="player-card">
            <div class="section-title">
              <span class="title-icon" aria-hidden="true">
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
              <span>试听</span>
            </div>
            <div class="track-tabs">
              <button
                v-for="track in trackDefs"
                :key="track.key"
                type="button"
                class="track-btn"
                :class="{ active: selectedTrack === track.key }"
                @click="selectedTrack = track.key"
              >
                <span class="track-label">
                  <span>{{ track.label }}</span>
                  <span class="track-star">{{ getTrackStarLabel(track.key) }}</span>
                </span>
              </button>
            </div>

            <div class="audio-grid">
              <div class="audio-block">
                <div class="audio-head">
                  <strong>DRUM · 纯鼓点音效试听</strong>
                </div>
                <template v-if="hasBranchVariants">
                  <div class="variant-audios">
                    <div v-for="variant in activeBranchVariants" :key="`drum-${selectedTrack}-${variant}`" class="variant-item">
                      <span class="variant-label">{{ variant }}</span>
                      <audio
                        :ref="(el) => setDrumAudioRef(`drum-${selectedTrack}-${variant}`, el)"
                        :key="`drum-${songId}-${selectedTrack}-${variant}`"
                        :src="getDrumVariantAudioUrl(variant)"
                        class="audio-player"
                        controls
                        preload="none"
                        @loadedmetadata="syncDrumState"
                        @error="markAudioError(getAudioErrorKey('drum', variant))"
                      />
                      <p v-if="hasAudioError(getAudioErrorKey('drum', variant))" class="audio-error">音源不存在</p>
                    </div>
                  </div>
                </template>
                <template v-else>
                  <audio
                    :ref="(el) => setDrumAudioRef(getAudioErrorKey('drum'), el)"
                    :key="currentDrumAudio"
                    :src="currentDrumAudio"
                    class="audio-player"
                    controls
                    preload="none"
                    @loadedmetadata="syncDrumState"
                    @error="markAudioError(getAudioErrorKey('drum'))"
                  />
                  <p v-if="hasAudioError(getAudioErrorKey('drum'))" class="audio-error">基础音源不存在</p>
                </template>
                <div class="volume-row">
                  <button class="volume-btn" type="button" @click="drumMuted = !drumMuted">
                    {{ drumMuted ? "取消静音" : "静音" }}
                  </button>
                  <input v-model.number="drumVolume" class="volume-slider" type="range" min="0" max="1" step="0.01" />
                  <span>{{ Math.round(drumVolume * 100) }}%</span>
                </div>
              </div>

              <div class="audio-block">
                <div class="audio-head">
                  <strong>MIX · 完整混音试听</strong>
                </div>
                <template v-if="hasBranchVariants">
                  <div class="variant-audios">
                    <div v-for="variant in activeBranchVariants" :key="`mix-${selectedTrack}-${variant}`" class="variant-item">
                      <span class="variant-label">{{ variant }}</span>
                      <audio
                        :key="`mix-${songId}-${selectedTrack}-${variant}`"
                        :src="getMixVariantAudioUrl(variant)"
                        class="audio-player"
                        controls
                        preload="none"
                        @error="markAudioError(getAudioErrorKey('mix', variant))"
                      />
                      <p v-if="hasAudioError(getAudioErrorKey('mix', variant))" class="audio-error">音源不存在</p>
                    </div>
                  </div>
                </template>
                <template v-else>
                  <audio
                    :key="`mix-base-${songId}-${selectedTrack}`"
                    :src="currentMixAudio"
                    class="audio-player"
                    controls
                    preload="none"
                    @error="markAudioError(getAudioErrorKey('mix'))"
                  />
                  <p v-if="hasAudioError(getAudioErrorKey('mix'))" class="audio-error">基础音源不存在</p>
                </template>
              </div>
            </div>
          </div>

          <div class="fumen-block">
            <div class="section-title">
              <span class="title-icon chart-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 6h6v6H4z M14 6h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
              <span>谱面预览</span>
            </div>
            <div class="fumen-grid">
              <div
                v-for="item in fumenDefs"
                :key="item.folder"
                :class="['fumen-card', `fumen-${item.key}`]"
              >
                <span class="fumen-label">{{ item.label }}</span>
                <span class="fumen-star">{{ getFumenStarLabel(item.key) }}</span>
                <span class="fumen-combo">最大物量 {{ getFumenComboLabel(item.key) }}</span>
                <a
                  class="fumen-link-btn"
                  :href="getFumenUrl(item.folder)"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  打开新页面预览
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
    </el-card>
  </div>
</template>

<style scoped>
.song-detail-page {
  display: grid;
}

.back-row {
  margin-bottom: 14px;
}

.back-link {
  color: #8b5a2b;
  text-decoration: none;
  font-size: 13px;
  font-weight: 600;
}

.detail-main {
  display: flex;
  gap: 28px;
  align-items: flex-start;
}

.detail-left {
  width: min(360px, 100%);
  flex-shrink: 0;
}

.detail-middle {
  width: min(320px, 100%);
  flex-shrink: 0;
}

.cover-wrap {
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 16px 28px rgba(130, 95, 60, 0.2);
}

.cover-image {
  width: 100%;
  aspect-ratio: 1 / 1;
}

.detail-left h2 {
  margin: 16px 0 6px;
  font-size: 24px;
  line-height: 1.3;
}

.jp-name {
  margin: 0 0 14px;
  color: #7c6a58;
}

.meta-list {
  display: grid;
  gap: 10px;
}

.meta-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(155, 122, 90, 0.2);
}

.meta-row span {
  color: #786657;
  font-size: 13px;
}

.meta-row strong {
  text-align: right;
  font-size: 13px;
  word-break: break-all;
}

.detail-right {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 18px;
  max-width: 760px;
}

.radar-card {
  border-radius: 16px;
  padding: 14px;
  background: linear-gradient(145deg, rgba(236, 248, 255, 0.9), rgba(255, 255, 255, 0.96));
  border: 1px solid rgba(95, 143, 191, 0.22);
}

.radar-icon {
  background: rgba(76, 126, 179, 0.2);
  color: #3b6898;
}

.radar-chart {
  width: 100%;
  max-width: 270px;
  display: block;
  margin: 4px auto 0;
}

.radar-grid {
  fill: none;
  stroke: rgba(120, 146, 176, 0.3);
  stroke-width: 1;
}

.radar-axis {
  stroke: rgba(102, 131, 163, 0.35);
  stroke-width: 1;
}

.radar-area {
  fill: rgba(75, 136, 216, 0.26);
  stroke: #4a77aa;
  stroke-width: 1.8;
}

.radar-point {
  fill: #2f5f95;
}

.radar-label {
  fill: #4d5f75;
  font-size: 11px;
  font-weight: 600;
}

.radar-meta {
  margin-top: 2px;
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
  color: #5f7185;
}

.radar-values {
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 6px;
}

.radar-values li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
  color: #4a5f79;
  border-bottom: 1px solid rgba(116, 145, 177, 0.18);
  padding-bottom: 4px;
}

.radar-values strong {
  color: #2f5f95;
}

.radar-empty {
  min-height: 320px;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 8px;
  text-align: center;
}

.radar-empty-image {
  width: min(220px, 100%);
}

.radar-empty p {
  margin: 0;
  font-size: 13px;
  color: #5c6f84;
}

.player-card {
  border-radius: 16px;
  padding: 16px;
  background: linear-gradient(130deg, rgba(255, 243, 229, 0.85), rgba(255, 255, 255, 0.96));
  border: 1px solid rgba(161, 127, 95, 0.2);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 16px;
  font-weight: 700;
  color: #6f4b2f;
}

.title-icon {
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: rgba(196, 127, 79, 0.2);
  color: #9a6d47;
  font-size: 14px;
}

.title-icon svg {
  width: 14px;
  height: 14px;
}

.chart-icon {
  background: rgba(88, 136, 197, 0.2);
  color: #3c6aa6;
}

.track-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.track-btn {
  border: 1px solid rgba(139, 107, 77, 0.35);
  background: #fff;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  color: #7d5a3d;
  padding: 4px 12px;
  cursor: pointer;
}

.track-btn.active {
  background: #9a6d47;
  color: #fff;
  border-color: #9a6d47;
}

.track-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.track-star {
  font-size: 11px;
  font-weight: 700;
  color: inherit;
}

.audio-player {
  width: 100%;
  display: block;
  height: 40px;
  min-height: 40px;
  max-height: 40px;
  box-sizing: border-box;
}

.audio-grid {
  display: grid;
  gap: 12px;
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
}

.audio-block {
  border-radius: 12px;
  border: 1px solid rgba(161, 127, 95, 0.25);
  background: rgba(255, 255, 255, 0.7);
  padding: 10px;
}

.audio-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
  font-size: 13px;
}

.audio-tag {
  font-size: 11px;
  line-height: 1;
  border-radius: 999px;
  padding: 4px 8px;
  background: #fbe7d4;
  color: #8a5a35;
  font-weight: 700;
}

.mix-tag {
  background: #e8f1fb;
  color: #2d567e;
}

.volume-row {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #6f5d4c;
}
.volume-btn {
  border: 1px solid rgba(139, 107, 77, 0.35);
  background: #fff;
  color: #7d5a3d;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  cursor: pointer;
}

.volume-slider {
  flex: 1;
}

.variant-audios {
  display: grid;
  gap: 4px;
  margin-top: 2px;
}

.variant-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-auto-rows: max-content;
  align-content: start;
  gap: 4px;
}

.variant-item .audio-player {
  margin: 0;
}

.variant-label {
  font-size: 12px;
  font-weight: 600;
  color: #6f5d4c;
}

.audio-error {
  margin: 0;
  font-size: 11px;
  color: #c16a5a;
}

.fumen-block h3 {
  margin: 0 0 12px;
  font-size: 18px;
}

.fumen-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}

.fumen-card {
  color: #6f5d4c;
  border-radius: 12px;
  border: 1px solid rgba(161, 127, 95, 0.22);
  padding: 12px;
  background: rgba(255, 255, 255, 0.82);
  display: grid;
  gap: 8px;
  text-align: center;
}

.fumen-easy {
  border-top: 4px solid #7ddfa0;
  background: rgba(240, 252, 245, 0.85);
}

.fumen-normal {
  border-top: 4px solid #7db2ff;
  background: rgba(240, 246, 255, 0.85);
}

.fumen-hard {
  border-top: 4px solid #ffb15e;
  background: rgba(255, 246, 236, 0.85);
}

.fumen-oni {
  border-top: 4px solid #ff7b7b;
  background: rgba(255, 241, 241, 0.85);
}

.fumen-inner {
  border-top: 4px solid #c08dff;
  background: rgba(248, 241, 255, 0.85);
}

.fumen-card span {
  display: block;
  font-size: 13px;
  font-weight: 700;
}

.fumen-label {
  color: #6f5d4c;
}

.fumen-star {
  font-size: 12px;
  color: #8a6b52;
}

.fumen-combo {
  font-size: 12px;
  color: #6f5d4c;
}

.fumen-link-btn {
  text-decoration: none;
  border-radius: 8px;
  border: 1px solid rgba(139, 107, 77, 0.35);
  background: #fff;
  color: #7d5a3d;
  font-size: 12px;
  font-weight: 600;
  padding: 6px 8px;
}

@media (max-width: 1240px) {
  .detail-main {
    flex-direction: column;
  }

  .detail-left {
    width: 100%;
    max-width: 460px;
  }

  .detail-middle,
  .detail-right {
    width: 100%;
    max-width: 760px;
  }

  .audio-grid {
    max-width: none;
  }
}
</style>
