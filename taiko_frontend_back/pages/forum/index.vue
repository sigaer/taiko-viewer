<script setup lang="ts">
import type { ForumHomePayload } from "~/types/forum";
import { buildPageDescription } from "~/utils/seo";

const headers = import.meta.server ? useRequestHeaders(["cookie"]) : undefined;

const pageMeta = {
  title: "论坛社区",
  desc: buildPageDescription("太鼓达人玩家交流社区，聚合公告、谱面攻略、段位道场与晒分战报。")
};

definePageMeta({
  pageTitle: pageMeta.title,
  pageDesc: pageMeta.desc,
  navKey: "/forum",
  breadcrumbs: [{ label: "论坛社区", to: "/forum" }]
});

useViewerSeo({
  title: pageMeta.title,
  description: pageMeta.desc,
  path: "/forum",
  keywords: ["论坛", "玩家社区", "晒分战报"]
});

const { data, pending, refresh } = useLazyAsyncData<ForumHomePayload>(
  "forum-home",
  () => $fetch("/api/forum/home", { headers }),
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
</script>

<template>
  <div class="forum-home-page">
    <section class="forum-home-hero panel-card">
      <div class="forum-home-hero__copy">
        <span class="forum-home-hero__eyebrow">Taiko Festival Forum</span>
        <h2>把攻略、晒分、段位和鼓众交流放进同一个鼓面里。</h2>
        <p>
          这里面向国服与鼓众广场玩家，既保留传统论坛的版块秩序，也保留游戏官方社区的活动氛围。
        </p>
        <div class="forum-home-hero__actions">
          <NuxtLink to="/forum/new" class="hero-action hero-action--primary">发布新帖</NuxtLink>
          <NuxtLink to="/forum/notifications" class="hero-action">
            站内通知
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
          <span>鼓友频道</span>
          <strong>{{ home?.sections.length || 0 }}</strong>
          <small>个固定版块</small>
        </div>
      </div>
    </section>

    <div class="forum-home-grid">
      <aside class="forum-home-side">
        <section class="panel-card side-panel">
          <div class="side-panel__head">
            <h3>版块索引</h3>
            <NuxtLink to="/forum/section/score-guides">看攻略</NuxtLink>
          </div>
          <div class="section-list">
            <NuxtLink
              v-for="section in home?.sections"
              :key="section.id"
              :to="`/forum/section/${section.slug}`"
              class="section-item"
              :style="{ '--section-accent': section.accentColor }"
            >
              <strong>{{ section.name }}</strong>
              <span>{{ section.description }}</span>
              <em>{{ section.threadCount }} 主题</em>
            </NuxtLink>
          </div>
        </section>

        <section class="panel-card side-panel">
          <div class="side-panel__head">
            <h3>快捷入口</h3>
          </div>
          <div class="quick-links">
            <NuxtLink to="/forum/section/official">公告区</NuxtLink>
            <NuxtLink to="/forum/section/dojo">段位道场</NuxtLink>
            <NuxtLink to="/forum/section/achievements">晒分战报</NuxtLink>
            <NuxtLink to="/forum/me">我的社区</NuxtLink>
            <NuxtLink to="/account/sync">多端同步</NuxtLink>
            <NuxtLink to="/account/developer">开发者权限</NuxtLink>
          </div>
        </section>
      </aside>

      <main class="forum-home-main">
        <section class="forum-stream panel-card">
          <div class="panel-head">
            <div>
              <h3>精选推荐</h3>
              <p>置顶、加精和核心讨论优先展示。</p>
            </div>
            <span class="panel-head__meta">精选聚合</span>
          </div>
          <div v-if="pending" class="forum-skeleton-grid">
            <div class="shimmer-card" v-for="index in 2" :key="index"></div>
          </div>
          <el-empty v-else-if="!home?.featuredThreads.length" description="暂时还没有精选主题" />
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
              <h3>热帖榜</h3>
              <p>近 7 天综合回复、点赞与浏览热度。</p>
            </div>
          </div>
          <el-empty v-if="!pending && !home?.hotThreads.length" description="最近 7 天暂无热帖" />
          <div v-else class="thread-stack thread-stack--compact">
            <ForumThreadCard v-for="thread in home?.hotThreads" :key="thread.id" :thread="thread" compact />
          </div>
        </section>

        <section class="forum-stream panel-card">
          <div class="panel-head">
            <div>
              <h3>最新攻略</h3>
              <p>谱面分析、配速拆解和段位练习路线。</p>
            </div>
            <NuxtLink to="/forum/section/score-guides">进入攻略区</NuxtLink>
          </div>
          <el-empty v-if="!pending && !home?.latestGuides.length" description="攻略区还没有新内容" />
          <div v-else class="thread-stack thread-stack--compact">
            <ForumThreadCard v-for="thread in home?.latestGuides" :key="thread.id" :thread="thread" compact />
          </div>
        </section>
      </main>

      <aside class="forum-home-side forum-home-side--right">
        <section class="panel-card side-panel user-panel">
          <div class="side-panel__head">
            <h3>{{ home?.currentUser ? "当前鼓友" : "加入社区" }}</h3>
            <button type="button" class="link-button" @click="refresh">刷新</button>
          </div>
          <template v-if="home?.currentUser">
            <ForumUserBadge :user="home.currentUser" />
            <div class="user-panel__actions">
              <NuxtLink to="/forum/me">我的帖子</NuxtLink>
              <NuxtLink to="/forum/notifications">通知 {{ home.unreadNotificationCount }}</NuxtLink>
            </div>
          </template>
          <div v-else class="guest-card">
            <p>登录后可以发帖、回复、点赞，并把鼓众广场称号展示在社区名片上。</p>
            <div class="user-panel__actions">
              <NuxtLink to="/account/login">登录</NuxtLink>
              <NuxtLink to="/account/register">注册</NuxtLink>
            </div>
          </div>
        </section>

        <section class="panel-card side-panel">
          <div class="side-panel__head">
            <h3>公告看板</h3>
          </div>
          <el-empty v-if="!pending && !home?.announcements.length" description="暂时没有公告" />
          <div v-else class="announcement-list">
            <NuxtLink v-for="thread in home?.announcements" :key="thread.id" :to="`/forum/thread/${thread.id}`">
              <strong>{{ thread.title }}</strong>
              <span>{{ thread.summary }}</span>
            </NuxtLink>
          </div>
        </section>

        <section class="panel-card side-panel">
          <div class="side-panel__head">
            <h3>热门标签</h3>
          </div>
          <div class="tag-cloud">
            <span v-for="tag in home?.highlightedTags" :key="tag">#{{ tag }}</span>
          </div>
        </section>

        <section class="panel-card side-panel">
          <div class="side-panel__head">
            <h3>达人榜</h3>
          </div>
          <el-empty v-if="!pending && !home?.leaderboard.length" description="还没有榜单数据" />
          <div v-else class="leaderboard-list">
            <div v-for="(entry, index) in home?.leaderboard" :key="entry.author.id" class="leaderboard-item">
              <span class="leaderboard-item__rank">{{ index + 1 }}</span>
              <ForumUserBadge :user="entry.author" compact />
              <div class="leaderboard-item__stats">
                <span>{{ entry.threadCount }} 帖</span>
                <span>{{ entry.likeCount }} 赞</span>
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
