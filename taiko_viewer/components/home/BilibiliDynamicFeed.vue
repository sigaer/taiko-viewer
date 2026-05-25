<script setup lang="ts">
import { computed } from "vue";
import type { BilibiliDynamicItem } from "~/types/bilibili";
import { useBilibiliDynamics } from "~/composables/useBilibiliDynamics";
import { BILIBILI_DYNAMIC_UID, BILIBILI_SPACE_URL } from "~/utils/bilibili";

const { locale } = useI18n();
const { items, pending, error, reload } = useBilibiliDynamics(BILIBILI_DYNAMIC_UID);

const previewVisible = ref(false);
const previewImage = ref<string | null>(null);
const expandedMap = ref<Record<string, boolean>>({});

const copy = computed(() =>
  locale.value === "ja"
    ? {
        title: "投稿",
        profile: "Bilibili ホームを見る",
        previewAlt: "プレビュー",
        loadFailed: "投稿の取得に失敗しました：",
        retry: "再試行",
        empty: "投稿はまだありません",
        collapse: "折りたたむ",
        expand: "全文を見る",
        forward: "転送",
        comment: "コメント",
        like: "いいね",
        disclaimer: "内容は Bilibili 提供の公開情報を表示しています"
      }
    : {
        title: "动态",
        profile: "查看 B 站主页",
        previewAlt: "预览",
        loadFailed: "获取动态失败：",
        retry: "重试",
        empty: "暂无动态",
        collapse: "收起全文",
        expand: "查看全文",
        forward: "转发",
        comment: "评论",
        like: "点赞",
        disclaimer: "内容来源于 Bilibili，仅供展示"
      }
);

const formatNumber = (num: number) => {
  if (num >= 10000) {
    return `${(num / 10000).toFixed(1)}万`;
  }
  return String(num);
};

const getProxyUrl = (url: string, type: "avatar" | "cover" | "grid" | "preview" = "preview") => {
  if (!url) {
    return "";
  }

  const cleanUrl = url.split("@")[0];
  let suffix = "";
  switch (type) {
    case "avatar":
      suffix = "@100w_100h_1c.webp";
      break;
    case "cover":
      suffix = "@480w_270h_1c.webp";
      break;
    case "grid":
      suffix = "@300w_300h_1c.webp";
      break;
    case "preview":
      suffix = "@.webp";
      break;
  }

  const optimizedUrl = cleanUrl + suffix;
  return `/api/bilibili/image?url=${encodeURIComponent(optimizedUrl)}`;
};

const getItemText = (item: BilibiliDynamicItem) =>
  item.modules.module_dynamic.desc?.text ||
  item.modules.module_dynamic.major?.opus?.summary?.text ||
  item.modules.module_dynamic.major?.archive?.desc ||
  "";

const getJumpUrl = (item: BilibiliDynamicItem) => {
  let jumpUrl = item.basic.jump_url;
  if (!jumpUrl) {
    return `https://t.bilibili.com/${item.id_str}`;
  }
  if (!jumpUrl.startsWith("http")) {
    return `https:${jumpUrl}`;
  }
  return jumpUrl;
};

const isLongText = (text: string) => text.length > 100 || text.split("\n").length > 4;

const toggleExpanded = (id: string, event: Event) => {
  event.preventDefault();
  event.stopPropagation();
  expandedMap.value[id] = !expandedMap.value[id];
};

const openPreview = (url: string, event: Event) => {
  event.preventDefault();
  event.stopPropagation();
  previewImage.value = getProxyUrl(url, "preview");
  previewVisible.value = true;
};
</script>

<template>
  <div class="bili-dynamic-feed">
    <div class="section-head">
      <h3>{{ copy.title }}</h3>
      <a :href="BILIBILI_SPACE_URL" target="_blank" rel="noopener noreferrer" class="space-link">
        {{ copy.profile }}
      </a>
    </div>

    <el-dialog v-model="previewVisible" width="90%" class="bili-preview-dialog" @close="previewImage = null">
      <img v-if="previewImage" :src="previewImage" :alt="copy.previewAlt" class="bili-preview-image" />
    </el-dialog>

    <div v-if="pending" class="dynamic-list">
      <article v-for="index in 3" :key="index" class="dynamic-card dynamic-card--skeleton shimmer-card" />
    </div>

    <el-empty v-else-if="error" :description="`${copy.loadFailed}${error}`">
      <el-button type="primary" @click="reload">{{ copy.retry }}</el-button>
    </el-empty>

    <el-empty v-else-if="!items.length" :description="copy.empty" />

    <div v-else class="dynamic-list">
      <a
        v-for="item in items"
        :key="item.id_str"
        :href="getJumpUrl(item)"
        target="_blank"
        rel="noopener noreferrer"
        class="dynamic-card"
      >
        <header class="dynamic-header">
          <img
            :src="getProxyUrl(item.modules.module_author.face, 'avatar')"
            :alt="item.modules.module_author.name"
            class="dynamic-avatar"
            loading="lazy"
          />
          <div class="dynamic-meta">
            <div class="dynamic-meta-top">
              <span class="dynamic-name">{{ item.modules.module_author.name }}</span>
              <span class="dynamic-action">{{ item.modules.module_author.pub_action }}</span>
            </div>
            <span class="dynamic-time">{{ item.modules.module_author.pub_time }}</span>
          </div>
        </header>

        <div class="dynamic-body">
          <p
            v-if="getItemText(item)"
            class="dynamic-text"
            :class="{ 'dynamic-text--expanded': expandedMap[item.id_str] }"
          >
            {{ getItemText(item) }}
          </p>
          <button
            v-if="getItemText(item) && isLongText(getItemText(item))"
            type="button"
            class="dynamic-expand"
            @click="toggleExpanded(item.id_str, $event)"
          >
            {{ expandedMap[item.id_str] ? copy.collapse : copy.expand }}
          </button>

          <div
            v-if="item.modules.module_dynamic.major?.type === 'MAJOR_TYPE_DRAW' && item.modules.module_dynamic.major.draw"
            class="dynamic-media-grid"
          >
            <button
              v-for="(img, idx) in item.modules.module_dynamic.major.draw.items.slice(0, 9)"
              :key="`${item.id_str}-draw-${idx}`"
              type="button"
              class="dynamic-media-item"
              @click="openPreview(img.src, $event)"
            >
              <img :src="getProxyUrl(img.src, 'grid')" alt="" loading="lazy" />
            </button>
          </div>

          <div
            v-if="item.modules.module_dynamic.major?.type === 'MAJOR_TYPE_OPUS' && item.modules.module_dynamic.major.opus"
            class="dynamic-media-grid"
          >
            <button
              v-for="(img, idx) in item.modules.module_dynamic.major.opus.pics.slice(0, 9)"
              :key="`${item.id_str}-opus-${idx}`"
              type="button"
              class="dynamic-media-item"
              @click="openPreview(img.url, $event)"
            >
              <img :src="getProxyUrl(img.url, 'grid')" alt="" loading="lazy" />
            </button>
          </div>

          <div
            v-if="item.modules.module_dynamic.major?.type === 'MAJOR_TYPE_ARCHIVE' && item.modules.module_dynamic.major.archive"
            class="dynamic-archive"
          >
            <div class="dynamic-archive-cover">
              <img
                :src="getProxyUrl(item.modules.module_dynamic.major.archive.cover, 'cover')"
                :alt="item.modules.module_dynamic.major.archive.title"
                loading="lazy"
              />
              <span class="dynamic-archive-duration">
                {{ item.modules.module_dynamic.major.archive.duration_text }}
              </span>
            </div>
            <div class="dynamic-archive-info">
              <h4>{{ item.modules.module_dynamic.major.archive.title }}</h4>
              <p>
                <span>{{ item.modules.module_dynamic.major.archive.stat.play }}</span>
                <span>{{ item.modules.module_dynamic.major.archive.stat.danmaku }}</span>
              </p>
            </div>
          </div>
        </div>

        <footer class="dynamic-stats">
          <span>{{ copy.forward }} {{ formatNumber(item.modules.module_stat.forward.count) }}</span>
          <span>{{ copy.comment }} {{ formatNumber(item.modules.module_stat.comment.count) }}</span>
          <span>{{ copy.like }} {{ formatNumber(item.modules.module_stat.like.count) }}</span>
        </footer>
      </a>
    </div>

    <p class="dynamic-disclaimer">{{ copy.disclaimer }}</p>
  </div>
</template>

<style scoped>
.bili-dynamic-feed {
  display: grid;
  gap: 12px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.section-head h3 {
  margin: 0;
  font-size: 20px;
}

.space-link {
  font-size: 13px;
  color: #7a6552;
  text-decoration: none;
}

.space-link:hover {
  color: #c24e2f;
}

.dynamic-list {
  display: grid;
  gap: 12px;
}

.dynamic-card {
  display: grid;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid rgba(162, 128, 98, 0.2);
  background: rgba(255, 255, 255, 0.88);
  text-decoration: none;
  color: inherit;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.dynamic-card:hover {
  transform: translateY(-1px);
  border-color: rgba(194, 132, 82, 0.52);
  box-shadow: 0 12px 20px rgba(157, 119, 83, 0.16);
}

.dynamic-card--skeleton {
  min-height: 180px;
  pointer-events: none;
}

.dynamic-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.dynamic-avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.dynamic-meta {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.dynamic-meta-top {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.dynamic-name {
  font-weight: 700;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dynamic-action {
  font-size: 12px;
  color: #7a6655;
  white-space: nowrap;
}

.dynamic-time {
  font-size: 12px;
  color: #9a8574;
}

.dynamic-body {
  display: grid;
  gap: 10px;
}

.dynamic-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.55;
  color: #4a3f35;
  white-space: pre-wrap;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.dynamic-text--expanded {
  display: block;
  -webkit-line-clamp: unset;
}

.dynamic-expand {
  justify-self: start;
  border: none;
  background: transparent;
  color: #c24e2f;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  padding: 0;
}

.dynamic-media-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.dynamic-media-item {
  border: none;
  padding: 0;
  background: transparent;
  border-radius: 10px;
  overflow: hidden;
  cursor: zoom-in;
  aspect-ratio: 1;
}

.dynamic-media-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.dynamic-archive {
  display: grid;
  grid-template-columns: 160px minmax(0, 1fr);
  gap: 10px;
  border-radius: 12px;
  overflow: hidden;
  background: rgba(244, 228, 210, 0.45);
}

.dynamic-archive-cover {
  position: relative;
  min-height: 90px;
}

.dynamic-archive-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.dynamic-archive-duration {
  position: absolute;
  right: 6px;
  bottom: 6px;
  padding: 2px 6px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.65);
  color: #fff;
  font-size: 11px;
}

.dynamic-archive-info {
  padding: 10px 10px 10px 0;
  min-width: 0;
}

.dynamic-archive-info h4 {
  margin: 0;
  font-size: 14px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.dynamic-archive-info p {
  margin: 6px 0 0;
  display: flex;
  gap: 10px;
  font-size: 12px;
  color: #7a6655;
}

.dynamic-stats {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #8d7a6a;
}

.dynamic-disclaimer {
  margin: 0;
  font-size: 12px;
  color: #9a8574;
  text-align: center;
}

.bili-preview-image {
  width: 100%;
  max-height: 80vh;
  object-fit: contain;
  display: block;
}

@media (max-width: 780px) {
  .dynamic-archive {
    grid-template-columns: 1fr;
  }

  .dynamic-media-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
