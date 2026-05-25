<script setup lang="ts">
import { computed } from "vue";

const apiBase = "https://static.sakura-bot.cn";
const runtimeConfig = useRuntimeConfig();
const appVersion = runtimeConfig.public.appVersion || "0.19.1";
const { t, locale } = useI18n();
const localePath = useLocalePath();

import { buildPageDescription, SITE_TITLE } from "~/utils/seo";

definePageMeta({
  pageTitleKey: "site.homeTitle",
  pageDescKey: "page.home.desc",
  navKey: "/",
  breadcrumbs: [{ labelKey: "nav.home", to: "/" }]
});

useViewerSeo(() => ({
  title: t("site.homeTitle"),
  description: buildPageDescription(t("page.home.desc")),
  path: "/",
  siteSchema: true,
  keywords: [t("site.homeTitle"), "Taiko Viewer", t("home.latestSongs")]
}));

const eventSlides = computed(() => [
  {
    image: "/banner.png",
    title: t("page.home.eventMiku")
  },
  {
    image: "/banner2.png",
    title: t("page.home.eventSummer")
  }
]);

const { data: homeContent, pending, error } = useHomeContent();
const latestSongs = computed(() => homeContent.value.latestSongs || []);

const getCoverUrl = (id: number) => `${apiBase}/cover/${id}.png`;
const getSongTitle = (song: (typeof latestSongs.value)[number]) =>
  locale.value === "ja" && song.song_name_jp ? song.song_name_jp : song.song_name;
const getSongSubtitle = (song: (typeof latestSongs.value)[number]) =>
  locale.value === "ja" ? song.song_name || "—" : song.song_name_jp || "—";
</script>

<template>
  <div class="home-page">
    <el-alert
      :title="t('home.betaNotice')"
      type="warning"
      :closable="false"
      show-icon
      class="beta-alert"
    />

    <el-card class="panel-card home-hero">
      <div class="hero-content">
        <div class="hero-title-group">
          <h2>{{ SITE_TITLE }}</h2>
          <p class="hero-tagline">{{ t("home.tagline") }}</p>
          <p class="hero-version">v{{ appVersion }}</p>
        </div>
        <NuxtLink :to="localePath('/songs/available')" class="hero-link hero-link-btn">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M9 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zm8-2.5V6l-9 2.5v9.5"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span>{{ t("nav.songs") }}</span>
        </NuxtLink>
      </div>
    </el-card>

    <section class="home-tools panel-card">
      <div class="section-head">
        <h3>{{ t("nav.tools") }}</h3>
        <NuxtLink :to="localePath('/tools')" class="tools-more">{{ t("common.viewAll") }}</NuxtLink>
      </div>
      <div class="home-tools-grid">
        <NuxtLink :to="localePath('/tools/chart-config')" class="home-tool-card">{{ t("tools.chartConfig") }}</NuxtLink>
        <NuxtLink :to="localePath('/tools/note-count')" class="home-tool-card">{{ t("tools.noteCount") }}</NuxtLink>
        <NuxtLink :to="localePath('/tools/b30')" class="home-tool-card">{{ t("tools.b30") }}</NuxtLink>
        <NuxtLink :to="localePath('/tools/trend')" class="home-tool-card">{{ t("tools.trend") }}</NuxtLink>
        <NuxtLink :to="localePath('/tools/word-cloud')" class="home-tool-card">{{ t("tools.wordCloud") }}</NuxtLink>
        <NuxtLink :to="localePath('/tools')" class="home-tool-card home-tool-card--muted">{{ t("nav.tools") }}</NuxtLink>
      </div>
    </section>

    <section class="home-dynamics panel-card">
      <HomeBilibiliDynamicFeed />
    </section>

    <section class="home-grid">
      <el-card class="panel-card events-panel">
        <div class="section-head">
          <h3>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"
                stroke="currentColor"
                stroke-width="1.35"
                stroke-linejoin="round"
              />
            </svg>
            <span>{{ t("home.latestActivities") }}</span>
          </h3>
        </div>
        <el-carousel class="event-carousel" :interval="4500" trigger="click" indicator-position="outside">
          <el-carousel-item v-for="item in eventSlides" :key="item.image">
            <article class="event-slide">
              <el-image :src="item.image" fit="cover" class="event-image" />
              <div class="event-overlay">
                <h4>{{ item.title }}</h4>
              </div>
            </article>
          </el-carousel-item>
        </el-carousel>
      </el-card>

      <el-card class="panel-card songs-panel">
        <div class="section-head">
          <h3>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M9 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zm8-2.5V6l-9 2.5v9.5"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <span>{{ t("home.latestSongs") }}</span>
          </h3>
        </div>
        <div v-if="pending" class="songs-placeholder shimmer-card"></div>
        <el-empty v-else-if="error || !latestSongs.length" :description="t('home.latestSongsUnavailable')" />
        <div v-else class="songs-list">
          <NuxtLink
            v-for="song in latestSongs"
            :key="song.id"
            :to="localePath(`/songs/${song.id}`)"
            class="song-item"
          >
            <div class="song-cover">
              <el-image :src="getCoverUrl(song.id)" fit="cover" class="song-cover-img">
                <template #error>
                  <div class="song-cover-fallback"></div>
                </template>
              </el-image>
            </div>
            <div class="song-main">
              <h4>{{ getSongTitle(song) }}</h4>
              <p>{{ getSongSubtitle(song) }}</p>
            </div>
            <span class="song-arrow" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="m9 6 6 6-6 6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
              </svg>
            </span>
          </NuxtLink>
        </div>
      </el-card>
    </section>

    <footer class="home-footer">
      {{ t("site.copyright") }}
    </footer>
  </div>
</template>

<style scoped>
.home-page {
  display: grid;
  gap: 16px;
}

.beta-alert {
  border: 1px solid rgba(217, 153, 28, 0.45);
  background: linear-gradient(135deg, #ffef8f, #ffd75f);
}

.home-hero {
  overflow: hidden;
}

.hero-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.hero-title-group h2 {
  margin: 0;
  font-size: 36px;
  line-height: 1.12;
  color: transparent;
  background: linear-gradient(95deg, #c24e2f 0%, #eb9b2a 42%, #f3c146 100%);
  -webkit-background-clip: text;
  background-clip: text;
}

.hero-tagline {
  margin: 8px 0 0;
  font-size: 14px;
  line-height: 1.5;
  color: #5f4d3d;
}

.hero-version {
  margin: 4px 0 0;
  font-size: 12px;
  color: #7a6552;
}

.hero-link {
  text-decoration: none;
}

.hero-link-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #fff;
  padding: 10px 14px;
  border-radius: 12px;
  font-weight: 700;
  font-size: 13px;
  background: linear-gradient(135deg, #2b8dff 0%, #415fff 100%);
  box-shadow: 0 10px 22px rgba(46, 95, 232, 0.28);
  transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
}

.hero-link-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 25px rgba(46, 95, 232, 0.34);
  filter: brightness(1.04);
}

.hero-link-btn svg {
  width: 16px;
  height: 16px;
}

.home-grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
  gap: 16px;
}

.section-head h3 {
  margin: 0 0 12px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 20px;
}

.section-head h3 svg {
  width: 18px;
  height: 18px;
  color: #bf7744;
}

.event-carousel {
  width: 100%;
}

.event-slide {
  position: relative;
  height: 100%;
  border-radius: 14px;
  overflow: hidden;
  background: #21160f;
}

.event-image {
  width: 100%;
  height: 100%;
}

.event-overlay {
  position: absolute;
  inset: auto 0 0;
  padding: 14px 16px;
  background: linear-gradient(to top, rgba(19, 12, 8, 0.78), rgba(19, 12, 8, 0.12));
}

.event-overlay h4 {
  margin: 0;
  color: #fff9f1;
  font-size: 22px;
  line-height: 1.2;
}

.songs-panel {
  min-width: 0;
}

.songs-list {
  display: grid;
  gap: 10px;
}

.songs-placeholder {
  min-height: 320px;
}

.song-item {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: inherit;
  border: 1px solid rgba(162, 128, 98, 0.2);
  border-radius: 12px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.82);
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.song-item:hover {
  transform: translateY(-1px);
  border-color: rgba(194, 132, 82, 0.52);
  box-shadow: 0 12px 20px rgba(157, 119, 83, 0.18);
}

.song-cover {
  width: 54px;
  height: 54px;
  border-radius: 10px;
  overflow: hidden;
  flex-shrink: 0;
  background: #f4e4d2;
}

.song-cover-img {
  width: 100%;
  height: 100%;
}

.song-cover-fallback {
  width: 100%;
  height: 100%;
}

.song-main {
  min-width: 0;
  flex: 1;
}

.song-main h4 {
  margin: 0;
  font-size: 15px;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-main p {
  margin: 4px 0 0;
  font-size: 12px;
  color: #7a6655;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-arrow {
  width: 18px;
  height: 18px;
  color: #b1835f;
  flex-shrink: 0;
  transition: transform 0.2s ease, color 0.2s ease;
}

.song-item:hover .song-arrow {
  transform: translateX(2px);
  color: #d07b42;
}

.song-arrow svg {
  width: 100%;
  height: 100%;
}

.home-dynamics {
  padding: 18px 20px;
}

.home-tools {
  padding: 18px 20px;
  border-radius: 20px;
  background: var(--viewer-surface, rgba(255, 252, 248, 0.92));
  border: 1px solid var(--viewer-border, rgba(160, 140, 120, 0.14));
  box-shadow: 0 12px 28px var(--viewer-shadow, rgba(150, 132, 115, 0.1));
}

.home-tools .section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.home-tools h3 {
  margin: 0;
  font-size: 18px;
}

.tools-more {
  font-size: 13px;
  color: #a89580;
  text-decoration: none;
}

.home-tools-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.home-tool-card {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 52px;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(252, 248, 243, 0.98);
  border: 1px solid rgba(196, 164, 132, 0.2);
  color: #5f564e;
  font-weight: 600;
  font-size: 14px;
  text-decoration: none;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.home-tool-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(150, 132, 115, 0.12);
}

.home-tool-card--muted {
  color: #7a6552;
  font-weight: 500;
}

.home-footer {
  color: #6f5a49;
  font-size: 12px;
  text-align: center;
  padding: 6px 0 2px;
}

:deep(.event-carousel .el-carousel__container) {
  height: 350px;
}

:deep(.event-carousel .el-carousel__indicator-button) {
  background-color: rgba(176, 129, 90, 0.65);
}

@media (max-width: 1100px) {
  .home-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 780px) {
  .home-tools-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .hero-content {
    flex-direction: column;
    align-items: flex-start;
  }

  .hero-title-group h2 {
    font-size: 30px;
  }

  :deep(.event-carousel .el-carousel__container) {
    height: 260px;
  }

  .event-overlay h4 {
    font-size: 18px;
  }
}
</style>
