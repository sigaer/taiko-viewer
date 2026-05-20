<script setup lang="ts">
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

const headers = import.meta.server ? useRequestHeaders(["cookie"]) : undefined;

const pageMeta = {
  title: "我的社区",
  desc: "查看个人论坛资料、我的帖子和站务管理入口。"
};

definePageMeta({
  middleware: "account-auth",
  pageTitle: pageMeta.title,
  pageDesc: pageMeta.desc,
  navKey: "/forum",
  breadcrumbs: [
    { label: "论坛社区", to: "/forum" },
    { label: "我的社区", to: "/forum/me" }
  ]
});

const { data: homeData, refresh: refreshHome } = await useAsyncData<ForumHomePayload>(
  "forum-me-home",
  () => $fetch("/api/forum/home", { headers })
);

const { data: profileData } = await useAsyncData<ProfilePayload>(
  "forum-me-profile",
  () => $fetch("/api/account/profile", { headers })
);

const { data: myThreadsData, refresh: refreshMyThreads } = await useAsyncData<ThreadListPayload>(
  "forum-me-threads",
  () =>
    $fetch("/api/forum/threads", {
      headers,
      query: {
        scope: "mine",
        pageSize: 10
      }
    })
);

const { data: moderationData, refresh: refreshModeration } = await useAsyncData<ThreadListPayload>(
  "forum-moderation-threads",
  () =>
    $fetch("/api/forum/threads", {
      headers,
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
    await $fetch("/api/forum/moderation/action", {
      method: "POST",
      body: {
        threadId,
        action,
        enabled
      }
    });
    ElMessage.success("帖子状态已更新");
    await Promise.all([refreshHome(), refreshMyThreads(), refreshModeration()]);
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || "操作失败");
  }
};
</script>

<template>
  <div class="forum-me-page">
    <section class="panel-card me-profile-panel">
      <div class="me-profile-panel__main">
        <ForumUserBadge v-if="currentUser" :user="currentUser" />
        <div>
          <h2>我的社区</h2>
          <p>
            已绑定鼓众 ID：{{ profileData?.currentBinding?.taikoId || "未绑定" }}，
            发帖数 {{ myThreadsData?.total || 0 }}，
            未读通知 {{ homeData?.unreadNotificationCount || 0 }}。
          </p>
        </div>
      </div>
      <div class="me-profile-panel__actions">
        <NuxtLink to="/forum/new">写新帖</NuxtLink>
        <NuxtLink to="/forum/notifications">通知中心</NuxtLink>
      </div>
    </section>

    <section class="panel-card">
      <div class="panel-head">
        <div>
          <h3>我的帖子</h3>
          <p>你在论坛里发布的主题都会出现在这里。</p>
        </div>
      </div>
      <el-empty v-if="!myThreadsData?.items.length" description="你还没有发过帖子" />
      <div v-else class="thread-stack">
        <ForumThreadCard v-for="thread in myThreadsData?.items" :key="thread.id" :thread="thread" compact />
      </div>
    </section>

    <section v-if="canModerate" class="panel-card moderation-panel">
      <div class="panel-head">
        <div>
          <h3>站务操作台</h3>
          <p>对近期主题执行置顶、加精、锁帖和隐藏操作。</p>
        </div>
      </div>
      <div class="moderation-list">
        <article v-for="thread in moderationData?.items" :key="thread.id" class="moderation-item">
          <div class="moderation-item__meta">
            <strong>{{ thread.title }}</strong>
            <span>{{ thread.section.name }} · {{ thread.author.username }}</span>
          </div>
          <div class="moderation-item__actions">
            <el-button size="small" @click="runModeration(thread.id, 'pin', !thread.isPinned)">
              {{ thread.isPinned ? "取消置顶" : "置顶" }}
            </el-button>
            <el-button size="small" @click="runModeration(thread.id, 'feature', !thread.isFeatured)">
              {{ thread.isFeatured ? "取消加精" : "加精" }}
            </el-button>
            <el-button size="small" @click="runModeration(thread.id, 'lock', !thread.isLocked)">
              {{ thread.isLocked ? "解除锁帖" : "锁帖" }}
            </el-button>
            <el-button size="small" type="danger" plain @click="runModeration(thread.id, 'hide', thread.status === 'published')">
              {{ thread.status === "published" ? "隐藏" : "恢复" }}
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
