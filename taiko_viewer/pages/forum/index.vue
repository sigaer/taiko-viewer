<script setup lang="ts">
import type { ForumHomePayload } from "~/types/forum";
import { buildPageDescription } from "~/utils/seo";

const { t } = useI18n();
const localePath = useLocalePath();
const apiFetch = useViewerApiFetch();

definePageMeta({
  pageTitleKey: "forum.title",
  pageDescKey: "page.forum.index.desc",
  navKey: "/forum",
  breadcrumbs: [{ labelKey: "forum.title", to: "/forum" }]
});

useViewerSeo(() => ({
  title: t("forum.title"),
  description: buildPageDescription(t("page.forum.index.desc")),
  path: "/forum",
  keywords: [t("forum.title"), t("page.forum.index.keyword"), t("forum.types.achievement")]
}));

const { data, pending, refresh } = useLazyAsyncData<ForumHomePayload>(
  "forum-home",
  () => apiFetch("/api/forum/home"),
  {
    default: () => ({
      sections: [],
      featuredThreads: [],
      hotThreads: [],
      latestGuides: [],
      announcements: [],
      leaderboard: [],
      currentUser: null,
      unreadNotificationCount: 0,
      highlightedTags: []
    })
  }
);

const home = computed(() => data.value);
const getSectionName = (slug: string, fallback: string) => t(`forum.sections.${slug}.name`, fallback);
const getSectionDescription = (slug: string, fallback: string) => t(`forum.sections.${slug}.description`, fallback);
</script>

<template>
  <div class="forum-home-page">
    <section class="forum-home-hero panel-card">
      <div class="forum-home-hero__copy">
        <span class="forum-home-hero__eyebrow">Taiko Festival Forum</span>
        <h2>{{ t("page.forum.index.heroTitle") }}</h2>
        <p>{{ t("page.forum.index.heroDesc") }}</p>
        <div class="forum-home-hero__actions">
          <NuxtLink :to="localePath('/forum/new')" class="hero-action hero-action--primary">{{ t("forum.newThread") }}</NuxtLink>
          <NuxtLink :to="localePath('/forum/notifications')" class="hero-action">
            {{ t("forum.notifications") }}
            <span v-if="home?.unreadNotificationCount" class="hero-action__count">
              {{ home.unreadNotificationCount }}
            </span>
          </NuxtLink>
        </div>
      </div>
      <div class="forum-home-hero__poster">
        <div class="poster-disc poster-disc--outer"></div>
        <div class="poster-disc poster-disc--inner"></div>
        <div class="poster-score">
          <span>{{ t("page.forum.index.posterLabel") }}</span>
          <strong>{{ home?.sections.length || 0 }}</strong>
          <small>{{ t("page.forum.index.posterSuffix") }}</small>
        </div>
      </div>
    </section>

    <div class="forum-home-grid">
      <aside class="forum-home-side">
        <section class="panel-card side-panel">
          <div class="side-panel__head">
            <h3>{{ t("page.forum.index.sectionsTitle") }}</h3>
            <NuxtLink :to="localePath('/forum/section/score-guides')">{{ t("page.forum.index.viewGuides") }}</NuxtLink>
          </div>
          <div class="section-list">
            <NuxtLink
              v-for="section in home?.sections"
              :key="section.id"
              :to="localePath(`/forum/section/${section.slug}`)"
              class="section-item"
              :style="{ '--section-accent': section.accentColor }"
            >
              <strong>{{ getSectionName(section.slug, section.name) }}</strong>
              <span>{{ getSectionDescription(section.slug, section.description) }}</span>
              <em>{{ t("page.forum.index.threadCount", { count: section.threadCount }) }}</em>
            </NuxtLink>
          </div>
        </section>

        <section class="panel-card side-panel">
          <div class="side-panel__head">
            <h3>{{ t("page.forum.index.quickLinks") }}</h3>
          </div>
          <div class="quick-links">
            <NuxtLink :to="localePath('/forum/section/official')">{{ getSectionName("official", "") }}</NuxtLink>
            <NuxtLink :to="localePath('/forum/section/dojo')">{{ getSectionName("dojo", "") }}</NuxtLink>
            <NuxtLink :to="localePath('/forum/section/achievements')">{{ getSectionName("achievements", "") }}</NuxtLink>
            <NuxtLink :to="localePath('/forum/me')">{{ t("forum.myCommunity") }}</NuxtLink>
            <NuxtLink :to="localePath('/account/sync')">{{ t("account.sync") }}</NuxtLink>
            <NuxtLink :to="localePath('/account/developer')">{{ t("account.developer") }}</NuxtLink>
          </div>
        </section>
      </aside>

      <main class="forum-home-main">
        <section class="forum-stream panel-card">
          <div class="panel-head">
            <div>
              <h3>{{ t("page.forum.index.featuredTitle") }}</h3>
              <p>{{ t("page.forum.index.featuredDesc") }}</p>
            </div>
            <span class="panel-head__meta">{{ t("page.forum.index.featuredMeta") }}</span>
          </div>
          <div v-if="pending" class="forum-skeleton-grid">
            <div class="shimmer-card" v-for="index in 2" :key="index"></div>
          </div>
          <el-empty v-else-if="!home?.featuredThreads.length" :description="t('page.forum.index.noFeatured')" />
          <div v-else class="thread-stack">
            <ForumThreadCard
              v-for="thread in home.featuredThreads"
              :key="thread.id"
              :thread="thread"
              :compact="home.featuredThreads.length > 1"
            />
          </div>
        </section>

        <section class="forum-stream panel-card">
          <div class="panel-head">
            <div>
              <h3>{{ t("page.forum.index.hotTitle") }}</h3>
              <p>{{ t("page.forum.index.hotDesc") }}</p>
            </div>
          </div>
          <el-empty v-if="!pending && !home?.hotThreads.length" :description="t('page.forum.index.noHot')" />
          <div v-else class="thread-stack thread-stack--compact">
            <ForumThreadCard v-for="thread in home?.hotThreads" :key="thread.id" :thread="thread" compact />
          </div>
        </section>

        <section class="forum-stream panel-card">
          <div class="panel-head">
            <div>
              <h3>{{ t("page.forum.index.latestGuideTitle") }}</h3>
              <p>{{ t("page.forum.index.latestGuideDesc") }}</p>
            </div>
            <NuxtLink :to="localePath('/forum/section/score-guides')">{{ t("page.forum.index.enterGuide") }}</NuxtLink>
          </div>
          <el-empty v-if="!pending && !home?.latestGuides.length" :description="t('page.forum.index.noGuides')" />
          <div v-else class="thread-stack thread-stack--compact">
            <ForumThreadCard v-for="thread in home?.latestGuides" :key="thread.id" :thread="thread" compact />
          </div>
        </section>
      </main>

      <aside class="forum-home-side forum-home-side--right">
        <section class="panel-card side-panel user-panel">
          <div class="side-panel__head">
            <h3>{{ home?.currentUser ? t("page.forum.index.currentUser") : t("page.forum.index.joinCommunity") }}</h3>
            <button type="button" class="link-button" @click="refresh">{{ t("common.retry") }}</button>
          </div>
          <template v-if="home?.currentUser">
            <ForumUserBadge :user="home.currentUser" />
            <div class="user-panel__actions">
              <NuxtLink :to="localePath('/forum/me')">{{ t("page.forum.index.myThreads") }}</NuxtLink>
              <NuxtLink :to="localePath('/forum/notifications')">{{ t("forum.notifications") }} {{ home.unreadNotificationCount }}</NuxtLink>
            </div>
          </template>
          <div v-else class="guest-card">
            <p>{{ t("page.forum.index.guestDesc") }}</p>
            <div class="user-panel__actions">
              <NuxtLink :to="localePath('/account/login')">{{ t("account.login") }}</NuxtLink>
              <NuxtLink :to="localePath('/account/register')">{{ t("account.register") }}</NuxtLink>
            </div>
          </div>
        </section>

        <section class="panel-card side-panel">
          <div class="side-panel__head">
            <h3>{{ t("page.forum.index.announcements") }}</h3>
          </div>
          <el-empty v-if="!pending && !home?.announcements.length" :description="t('page.forum.index.noAnnouncements')" />
          <div v-else class="announcement-list">
            <NuxtLink v-for="thread in home?.announcements" :key="thread.id" :to="localePath(`/forum/thread/${thread.id}`)">
              <strong>{{ thread.title }}</strong>
              <span>{{ thread.summary }}</span>
            </NuxtLink>
          </div>
        </section>

        <section class="panel-card side-panel">
          <div class="side-panel__head">
            <h3>{{ t("page.forum.index.tags") }}</h3>
          </div>
          <div class="tag-cloud">
            <span v-for="tag in home?.highlightedTags" :key="tag">#{{ tag }}</span>
          </div>
        </section>

        <section class="panel-card side-panel">
          <div class="side-panel__head">
            <h3>{{ t("page.forum.index.leaderboard") }}</h3>
          </div>
          <el-empty v-if="!pending && !home?.leaderboard.length" :description="t('page.forum.index.noLeaderboard')" />
          <div v-else class="leaderboard-list">
            <div v-for="(entry, index) in home?.leaderboard" :key="entry.author.id" class="leaderboard-item">
              <span class="leaderboard-item__rank">{{ index + 1 }}</span>
              <ForumUserBadge :user="entry.author" compact />
              <div class="leaderboard-item__stats">
                <span>{{ t("page.forum.index.postStat", { count: entry.threadCount }) }}</span>
                <span>{{ t("page.forum.index.likeStat", { count: entry.likeCount }) }}</span>
              </div>
            </div>
          </div>
        </section>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.forum-home-page {
  display: grid;
  gap: 18px;
}

.forum-home-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(260px, 0.7fr);
  gap: 18px;
  overflow: hidden;
  position: relative;
  background:
    radial-gradient(circle at top left, rgba(255, 194, 129, 0.46), transparent 38%),
    radial-gradient(circle at bottom right, rgba(59, 124, 168, 0.18), transparent 36%),
    linear-gradient(135deg, rgba(255, 251, 246, 0.94), rgba(255, 242, 224, 0.92));
}

.forum-home-hero__copy {
  display: grid;
  gap: 14px;
  padding: 12px 4px;
}

.forum-home-hero__eyebrow {
  font-size: 12px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #b55a38;
}

.forum-home-hero__copy h2 {
  margin: 0;
  font-size: 38px;
  line-height: 1.16;
}

.forum-home-hero__copy p {
  margin: 0;
  line-height: 1.9;
  color: #705846;
}

.forum-home-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.hero-action {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 18px;
  border-radius: 999px;
  text-decoration: none;
  color: #7b5637;
  background: rgba(255, 255, 255, 0.72);
}

.hero-action--primary {
  color: #fff;
  background: linear-gradient(135deg, #d84a34, #f08a24);
  box-shadow: 0 16px 26px rgba(216, 74, 52, 0.22);
}

.hero-action__count {
  min-width: 24px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(216, 74, 52, 0.16);
  color: #c34a34;
  text-align: center;
}

.forum-home-hero__poster {
  position: relative;
  min-height: 280px;
  display: grid;
  place-items: center;
}

.poster-disc {
  position: absolute;
  border-radius: 50%;
}

.poster-disc--outer {
  width: 260px;
  height: 260px;
  background: radial-gradient(circle at center, #ffe7cb 0%, #f2b767 45%, #dd5936 80%, #bf3f2e 100%);
  box-shadow: inset 0 0 0 22px rgba(255, 250, 239, 0.82);
}

.poster-disc--inner {
  width: 120px;
  height: 120px;
  background: radial-gradient(circle at center, #fff4ea, #ffd8a9);
  box-shadow: 0 12px 24px rgba(170, 90, 46, 0.25);
}

.poster-score {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 4px;
  text-align: center;
}

.poster-score span,
.poster-score small {
  color: #7e6048;
}

.poster-score strong {
  font-size: 56px;
  line-height: 1;
  color: #d84a34;
}

.forum-home-grid {
  display: grid;
  grid-template-columns: minmax(220px, 0.85fr) minmax(0, 1.65fr) minmax(240px, 0.9fr);
  gap: 18px;
  align-items: start;
}

.forum-home-side,
.forum-home-main {
  display: grid;
  gap: 18px;
}

.side-panel,
.forum-stream {
  padding: 18px;
}

.side-panel__head,
.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.side-panel__head h3,
.panel-head h3 {
  margin: 0;
  font-size: 20px;
}

.side-panel__head a,
.panel-head a,
.link-button {
  color: #b25237;
  text-decoration: none;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
}

.panel-head__meta {
  color: #9b6a46;
  font-size: 13px;
}

.panel-head p {
  margin: 4px 0 0;
  color: #776353;
  line-height: 1.7;
}

.section-list,
.thread-stack,
.announcement-list,
.leaderboard-list {
  display: grid;
  gap: 12px;
}

.thread-stack--compact {
  gap: 14px;
}

.section-item,
.announcement-list a {
  display: grid;
  gap: 4px;
  padding: 12px 14px;
  border-radius: 18px;
  text-decoration: none;
  color: #382d24;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--section-accent, #d84a34) 11%, white), rgba(255, 255, 255, 0.82));
}

.section-item span,
.announcement-list a span {
  font-size: 13px;
  line-height: 1.6;
  color: #765d4b;
}

.section-item em {
  font-style: normal;
  font-size: 12px;
  color: #b15a3b;
}

.quick-links,
.user-panel__actions,
.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.quick-links a,
.user-panel__actions a,
.tag-cloud span {
  display: inline-flex;
  align-items: center;
  padding: 9px 12px;
  border-radius: 999px;
  text-decoration: none;
  background: rgba(255, 245, 230, 0.88);
  color: #8c5731;
}

.guest-card p {
  margin: 0 0 14px;
  color: #765f4d;
  line-height: 1.8;
}

.leaderboard-item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 10px;
  align-items: center;
}

.leaderboard-item__rank {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: #fff;
  background: linear-gradient(135deg, #d84a34, #f0a53f);
}

.leaderboard-item__stats {
  display: grid;
  justify-items: end;
  gap: 4px;
  font-size: 12px;
  color: #7f6856;
}

.forum-skeleton-grid {
  display: grid;
  gap: 14px;
}

body.theme-dark .forum-home-hero {
  background:
    radial-gradient(circle at top left, rgba(237, 138, 82, 0.22), transparent 38%),
    radial-gradient(circle at bottom right, rgba(59, 124, 168, 0.22), transparent 36%),
    linear-gradient(135deg, rgba(30, 25, 22, 0.96), rgba(23, 19, 17, 0.94));
}

body.theme-dark .forum-home-hero__copy p,
body.theme-dark .panel-head p,
body.theme-dark .section-item span,
body.theme-dark .announcement-list a span,
body.theme-dark .guest-card p,
body.theme-dark .leaderboard-item__stats {
  color: #c5b3a6;
}

body.theme-dark .hero-action,
body.theme-dark .quick-links a,
body.theme-dark .user-panel__actions a,
body.theme-dark .tag-cloud span {
  background: rgba(72, 50, 36, 0.54);
  color: #f1d7bc;
}

body.theme-dark .section-item,
body.theme-dark .announcement-list a {
  color: #f0e2d6;
}

@media (max-width: 1180px) {
  .forum-home-grid {
    grid-template-columns: 1fr;
  }

  .forum-home-side {
    order: 2;
  }

  .forum-home-main {
    order: 1;
  }

  .forum-home-side--right {
    order: 3;
  }
}

@media (max-width: 860px) {
  .forum-home-hero {
    grid-template-columns: 1fr;
  }

  .forum-home-hero__copy h2 {
    font-size: 30px;
  }
}
</style>
