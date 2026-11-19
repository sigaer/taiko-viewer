<script setup lang="ts">
// Bilibili feed of the home page (was components/home/BilibiliDynamicFeed.vue). Third-party content: fetching
// (useBilibiliDynamics, 5 min cache), the image proxy, link targets and image loading attributes are unchanged;
// only the presentation is new. The preview dialog is mounted only while it is open.
import type { BilibiliDynamicItem } from "~/types/bilibili";
import { useBilibiliDynamics } from "~/composables/useBilibiliDynamics";
import { BILIBILI_DYNAMIC_UID, BILIBILI_SPACE_URL } from "~/utils/bilibili";

const props = withDefaults(defineProps<{ limit?: number }>(), { limit: 0 });
const emit = defineEmits<{ unavailable: [] }>();

const { t } = useI18n();
const { items, pending, error } = useBilibiliDynamics(BILIBILI_DYNAMIC_UID);

const previewVisible = ref(false);
const previewImage = ref<string | null>(null);
const expandedMap = ref<Record<string, boolean>>({});
const visibleItems = computed(() => (props.limit > 0 ? items.value.slice(0, props.limit) : items.value));

watch(error, (value) => {
  if (value) emit("unavailable");
});

const formatNumber = (num: number) => (num >= 10000 ? t("rework.home.feed.tenThousand", { value: (num / 10000).toFixed(1) }) : String(num));

const getProxyUrl = (url: string, type: "avatar" | "cover" | "grid" | "preview" = "preview") => {
  if (!url) return "";
  const cleanUrl = url.split("@")[0];
  const suffix = { avatar: "@100w_100h_1c.webp", cover: "@480w_270h_1c.webp", grid: "@300w_300h_1c.webp", preview: "@.webp" }[type];
  return `/api/bilibili/image?url=${encodeURIComponent(cleanUrl + suffix)}`;
};

const getItemText = (item: BilibiliDynamicItem) =>
  item.modules.module_dynamic.desc?.text ||
  item.modules.module_dynamic.major?.opus?.summary?.text ||
  item.modules.module_dynamic.major?.archive?.desc ||
  "";

const getJumpUrl = (item: BilibiliDynamicItem) => {
  const jumpUrl = item.basic.jump_url;
  if (!jumpUrl) return `https://t.bilibili.com/${item.id_str}`;
  if (!jumpUrl.startsWith("http")) return `https:${jumpUrl}`;
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
onDeactivated(() => {
  previewVisible.value = false;
  previewImage.value = null;
});
</script>

<template>
  <div class="fd bili-dynamic-feed">
    <div class="fd-head">
      <h3 class="fd-title">{{ t("rework.home.feed.title") }}</h3>
      <a :href="BILIBILI_SPACE_URL" target="_blank" rel="noopener noreferrer" class="rw-link fd-space">{{ t("rework.home.feed.profile") }}</a>
    </div>

    <el-dialog v-if="previewVisible" v-model="previewVisible" width="90%" class="bili-preview-dialog" @close="previewImage = null">
      <img v-if="previewImage" :src="previewImage" :alt="t('rework.home.feed.previewAlt')" class="fd-preview" />
    </el-dialog>

    <ReworkState v-if="pending" kind="loading" :lines="3" compact />
    <ReworkState v-else-if="!visibleItems.length" kind="empty" compact :title="t('rework.home.feed.empty')" />

    <div v-else class="fd-list">
      <a v-for="item in visibleItems" :key="item.id_str" :href="getJumpUrl(item)" target="_blank" rel="noopener noreferrer" class="fd-card">
        <header class="fd-author">
          <img :src="getProxyUrl(item.modules.module_author.face, 'avatar')" :alt="item.modules.module_author.name" class="fd-avatar" loading="lazy" />
          <span class="fd-meta">
            <span class="fd-name-line"><b class="fd-name">{{ item.modules.module_author.name }}</b><span class="fd-action">{{ item.modules.module_author.pub_action }}</span></span>
            <span class="fd-time">{{ item.modules.module_author.pub_time }}</span>
          </span>
        </header>

        <div class="fd-body">
          <p v-if="getItemText(item)" class="fd-text" :class="{ 'is-expanded': expandedMap[item.id_str] }">{{ getItemText(item) }}</p>
          <button v-if="getItemText(item) && isLongText(getItemText(item))" type="button" class="rw-btn rw-btn--ghost rw-btn--sm fd-expand" @click="toggleExpanded(item.id_str, $event)">
            {{ expandedMap[item.id_str] ? t("rework.home.feed.collapse") : t("rework.home.feed.expand") }}
          </button>

          <div v-if="item.modules.module_dynamic.major?.type === 'MAJOR_TYPE_DRAW' && item.modules.module_dynamic.major.draw" class="fd-grid">
            <button v-for="(img, idx) in item.modules.module_dynamic.major.draw.items.slice(0, 9)" :key="`${item.id_str}-draw-${idx}`" type="button" class="fd-media" :aria-label="t('rework.home.feed.previewAlt')" @click="openPreview(img.src, $event)">
              <img :src="getProxyUrl(img.src, 'grid')" alt="" loading="lazy" />
            </button>
          </div>

          <div v-if="item.modules.module_dynamic.major?.type === 'MAJOR_TYPE_OPUS' && item.modules.module_dynamic.major.opus" class="fd-grid">
            <button v-for="(img, idx) in item.modules.module_dynamic.major.opus.pics.slice(0, 9)" :key="`${item.id_str}-opus-${idx}`" type="button" class="fd-media" :aria-label="t('rework.home.feed.previewAlt')" @click="openPreview(img.url, $event)">
              <img :src="getProxyUrl(img.url, 'grid')" alt="" loading="lazy" />
            </button>
          </div>

          <div v-if="item.modules.module_dynamic.major?.type === 'MAJOR_TYPE_ARCHIVE' && item.modules.module_dynamic.major.archive" class="fd-archive">
            <span class="fd-archive-cover">
              <img :src="getProxyUrl(item.modules.module_dynamic.major.archive.cover, 'cover')" :alt="item.modules.module_dynamic.major.archive.title" loading="lazy" />
              <span class="fd-duration num">{{ item.modules.module_dynamic.major.archive.duration_text }}</span>
            </span>
            <span class="fd-archive-info">
              <b>{{ item.modules.module_dynamic.major.archive.title }}</b>
              <small><span>{{ item.modules.module_dynamic.major.archive.stat.play }}</span><span>{{ item.modules.module_dynamic.major.archive.stat.danmaku }}</span></small>
            </span>
          </div>
        </div>

        <footer class="fd-stats">
          <span>{{ t("rework.home.feed.forward") }} <span class="num">{{ formatNumber(item.modules.module_stat.forward.count) }}</span></span>
          <span>{{ t("rework.home.feed.comment") }} <span class="num">{{ formatNumber(item.modules.module_stat.comment.count) }}</span></span>
          <span>{{ t("rework.home.feed.like") }} <span class="num">{{ formatNumber(item.modules.module_stat.like.count) }}</span></span>
        </footer>
      </a>
    </div>

    <p class="fd-source">{{ t("rework.home.feed.source") }}</p>
  </div>
</template>

<style scoped>
.fd {
  display: grid;
  gap: var(--sp-3);
  min-width: 0;
  font-family: var(--font-ui);
  color: var(--ink);
}
.fd-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--sp-2) var(--sp-4);
}
.fd-title {
  margin: 0;
  font-size: var(--fs-16);
  font-weight: 700;
}
.fd-space {
  display: inline-flex;
  align-items: center;
  min-height: var(--hit);
  font-size: var(--fs-13);
}
.fd-list {
  display: grid;
  gap: var(--sp-3);
}
.fd-card {
  display: grid;
  gap: var(--sp-3);
  min-width: 0;
  padding: var(--sp-3) var(--sp-4);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
  color: var(--ink);
  text-decoration: none;
}
.fd-card:hover {
  border-color: var(--line-strong);
}
.fd-card:focus-visible,
.fd-media:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.fd-author {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  min-width: 0;
}
.fd-avatar {
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
}
.fd-meta {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.fd-name-line {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
  min-width: 0;
}
.fd-name {
  overflow: hidden;
  font-size: var(--fs-14);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fd-action,
.fd-time {
  color: var(--ink-3);
  font-size: var(--fs-12);
  white-space: nowrap;
}
.fd-body {
  display: grid;
  gap: var(--sp-2);
  min-width: 0;
}
.fd-text {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  font-size: var(--fs-14);
  line-height: var(--lh-body);
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
}
.fd-text.is-expanded {
  display: block;
  -webkit-line-clamp: unset;
}
.fd-expand {
  justify-self: start;
  padding-inline: 0;
}
.fd-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--sp-2);
}
.fd-media {
  aspect-ratio: 1;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: var(--r-ctl);
  background: var(--bg-sunk);
  cursor: zoom-in;
}
.fd-media img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.fd-archive {
  display: grid;
  grid-template-columns: 160px minmax(0, 1fr);
  gap: var(--sp-3);
  overflow: hidden;
  border-radius: var(--r-ctl);
  background: var(--bg-sunk);
}
.fd-archive-cover {
  position: relative;
  min-height: 90px;
}
.fd-archive-cover img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.fd-duration {
  position: absolute;
  right: 6px;
  bottom: 6px;
  padding: 1px 6px;
  border-radius: var(--r-xs);
  background: var(--scrim);
  color: var(--ink-inv);
  font-size: var(--fs-11);
}
.fd-archive-info {
  display: grid;
  align-content: start;
  gap: var(--sp-1);
  padding: var(--sp-2) var(--sp-2) var(--sp-2) 0;
  min-width: 0;
}
.fd-archive-info b {
  display: -webkit-box;
  overflow: hidden;
  font-size: var(--fs-14);
  line-height: var(--lh-snug);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.fd-archive-info small {
  display: flex;
  gap: var(--sp-3);
  color: var(--ink-3);
  font-size: var(--fs-12);
}
.fd-stats {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-1) var(--sp-4);
  color: var(--ink-3);
  font-size: var(--fs-12);
}
.fd-source {
  margin: 0;
  color: var(--ink-3);
  font-size: var(--fs-12);
}
.fd-preview {
  display: block;
  width: 100%;
  max-height: 80vh;
  object-fit: contain;
}
@media (max-width: 767px) {
  .fd-archive {
    grid-template-columns: minmax(0, 1fr);
  }
  .fd-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
