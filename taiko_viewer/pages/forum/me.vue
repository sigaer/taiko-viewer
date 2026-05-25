<script setup lang="ts">
import { computed } from "vue";
import { ElMessage } from "element-plus";
import type { ForumHomePayload, ForumThreadCard } from "~/types/forum";

type ProfilePayload = {
  user: {
    id: number;
    username: string;
    email: string;
    avatarUrl: string;
    emailVerified: boolean;
    createdAt: string;
  };
  currentBinding: {
    taikoId: string;
    verifiedTitle: string | null;
  } | null;
  bindings: Array<{ id: number }>;
};

type ThreadListPayload = {
  total: number;
  page: number;
  pageSize: number;
  sort: string;
  items: ForumThreadCard[];
};

const { t, locale } = useI18n();
const localePath = useLocalePath();
const apiFetch = useViewerApiFetch();

definePageMeta({
  middleware: "account-auth",
  pageTitleKey: "forum.myCommunity",
  pageDescKey: "page.forum.me.desc",
  navKey: "/forum",
  breadcrumbs: [
    { labelKey: "forum.title", to: "/forum" },
    { labelKey: "forum.myCommunity", to: "/forum/me" }
  ]
});

useViewerSeo(() => ({
  title: t("forum.myCommunity"),
  description: t("page.forum.me.desc"),
  path: "/forum/me"
}));

const copy = computed(() =>
  locale.value === "ja"
    ? {
        title: "マイコミュニティ",
        bound: "連携中の ID",
        unbound: "未連携",
        threadCount: "投稿数",
        unread: "未読通知",
        newThread: "新規投稿",
        notifications: "通知センター",
        myThreads: "自分の投稿",
        myThreadsDesc: "フォーラムに投稿したスレッドがここに表示されます。",
        noThreads: "まだ投稿していません",
        moderation: "管理コンソール",
        moderationDesc: "最近のスレッドに対して固定、注目、ロック、非表示を操作します。",
        actionUpdated: "スレッド状態を更新しました",
        actionFailed: "操作に失敗しました",
        pin: "固定",
        unpin: "固定解除",
        feature: "注目",
        unfeature: "注目解除",
        lock: "ロック",
        unlock: "ロック解除",
        hide: "非表示",
        restore: "復元"
      }
    : {
        title: "我的社区",
        bound: "已绑定鼓众 ID",
        unbound: "未绑定",
        threadCount: "发帖数",
        unread: "未读通知",
        newThread: "写新帖",
        notifications: "通知中心",
        myThreads: "我的帖子",
        myThreadsDesc: "你在论坛里发布的主题都会出现在这里。",
        noThreads: "你还没有发过帖子",
        moderation: "站务操作台",
        moderationDesc: "对近期主题执行置顶、加精、锁帖和隐藏操作。",
        actionUpdated: "帖子状态已更新",
        actionFailed: "操作失败",
        pin: "置顶",
        unpin: "取消置顶",
        feature: "加精",
        unfeature: "取消加精",
        lock: "锁帖",
        unlock: "解除锁帖",
        hide: "隐藏",
        restore: "恢复"
      }
);
const getSectionLabel = (slug: string) => t(`forum.sections.${slug}.name`);

const { data: homeData, refresh: refreshHome } = await useAsyncData<ForumHomePayload>(
  "forum-me-home",
  () => apiFetch("/api/forum/home")
);

const { data: profileData } = await useAsyncData<ProfilePayload>(
  "forum-me-profile",
  () => apiFetch("/api/account/profile")
);

const { data: myThreadsData, refresh: refreshMyThreads } = await useAsyncData<ThreadListPayload>(
  "forum-me-threads",
  () =>
    apiFetch("/api/forum/threads", {
      query: {
        scope: "mine",
        pageSize: 10
      }
    })
);

const { data: moderationData, refresh: refreshModeration } = await useAsyncData<ThreadListPayload>(
  "forum-moderation-threads",
  () =>
    apiFetch("/api/forum/threads", {
      query: {
        sort: "latest",
        pageSize: 10,
        includeHidden: 1
      }
    })
);

const currentUser = computed(() => homeData.value?.currentUser || null);
const canModerate = computed(() => ["moderator", "admin"].includes(currentUser.value?.role || ""));

const runModeration = async (threadId: number, action: string, enabled: boolean) => {
  try {
    await apiFetch("/api/forum/moderation/action", {
      method: "POST",
      body: {
        threadId,
        action,
        enabled
      }
    });
    ElMessage.success(copy.value.actionUpdated);
    await Promise.all([refreshHome(), refreshMyThreads(), refreshModeration()]);
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.actionFailed);
  }
};
</script>

<template>
  <div class="forum-me-page">
    <section class="panel-card me-profile-panel">
      <div class="me-profile-panel__main">
        <ForumUserBadge v-if="currentUser" :user="currentUser" />
        <div>
          <h2>{{ copy.title }}</h2>
          <p>
            {{ copy.bound }}：{{ profileData?.currentBinding?.taikoId || copy.unbound }}，
            {{ copy.threadCount }} {{ myThreadsData?.total || 0 }}，
            {{ copy.unread }} {{ homeData?.unreadNotificationCount || 0 }}。
          </p>
        </div>
      </div>
      <div class="me-profile-panel__actions">
        <NuxtLink :to="localePath('/forum/new')">{{ copy.newThread }}</NuxtLink>
        <NuxtLink :to="localePath('/forum/notifications')">{{ copy.notifications }}</NuxtLink>
      </div>
    </section>

    <section class="panel-card">
      <div class="panel-head">
        <div>
          <h3>{{ copy.myThreads }}</h3>
          <p>{{ copy.myThreadsDesc }}</p>
        </div>
      </div>
      <el-empty v-if="!myThreadsData?.items.length" :description="copy.noThreads" />
      <div v-else class="thread-stack">
        <ForumThreadCard v-for="thread in myThreadsData?.items" :key="thread.id" :thread="thread" compact />
      </div>
    </section>

    <section v-if="canModerate" class="panel-card moderation-panel">
      <div class="panel-head">
        <div>
          <h3>{{ copy.moderation }}</h3>
          <p>{{ copy.moderationDesc }}</p>
        </div>
      </div>
      <div class="moderation-list">
        <article v-for="thread in moderationData?.items" :key="thread.id" class="moderation-item">
          <div class="moderation-item__meta">
            <strong>{{ thread.title }}</strong>
            <span>{{ getSectionLabel(thread.section.slug) }} · {{ thread.author.username }}</span>
          </div>
          <div class="moderation-item__actions">
            <el-button size="small" @click="runModeration(thread.id, 'pin', !thread.isPinned)">
              {{ thread.isPinned ? copy.unpin : copy.pin }}
            </el-button>
            <el-button size="small" @click="runModeration(thread.id, 'feature', !thread.isFeatured)">
              {{ thread.isFeatured ? copy.unfeature : copy.feature }}
            </el-button>
            <el-button size="small" @click="runModeration(thread.id, 'lock', !thread.isLocked)">
              {{ thread.isLocked ? copy.unlock : copy.lock }}
            </el-button>
            <el-button size="small" type="danger" plain @click="runModeration(thread.id, 'hide', thread.status === 'published')">
              {{ thread.status === "published" ? copy.hide : copy.restore }}
            </el-button>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.forum-me-page {
  display: grid;
  gap: 18px;
}

.me-profile-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 20px;
}

.me-profile-panel__main {
  display: flex;
  align-items: center;
  gap: 16px;
}

.me-profile-panel__main h2 {
  margin: 0;
  font-size: 30px;
}

.me-profile-panel__main p {
  margin: 8px 0 0;
  color: #765f4d;
  line-height: 1.8;
}

.me-profile-panel__actions,
.moderation-item__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.me-profile-panel__actions a {
  display: inline-flex;
  align-items: center;
  padding: 11px 16px;
  border-radius: 999px;
  text-decoration: none;
  color: #fff;
  background: linear-gradient(135deg, #d84a34, #f08a24);
}

.panel-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.panel-head h3 {
  margin: 0;
  font-size: 22px;
}

.panel-head p {
  margin: 6px 0 0;
  color: #77604d;
  line-height: 1.8;
}

.thread-stack,
.moderation-list {
  display: grid;
  gap: 14px;
}

.moderation-panel {
  padding: 20px;
}

.moderation-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px;
  border-radius: 18px;
  background: rgba(255, 247, 238, 0.92);
}

.moderation-item__meta {
  display: grid;
  gap: 6px;
}

.moderation-item__meta span {
  color: #816754;
  font-size: 13px;
}

body.theme-dark .me-profile-panel__main p,
body.theme-dark .panel-head p,
body.theme-dark .moderation-item__meta span {
  color: #c7b4a7;
}

body.theme-dark .moderation-item {
  background: rgba(45, 33, 27, 0.7);
}

@media (max-width: 860px) {
  .me-profile-panel,
  .me-profile-panel__main,
  .moderation-item {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
