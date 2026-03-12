<script setup lang="ts">
import { ElMessage } from "element-plus";
import type { ForumNotification } from "~/types/forum";

type NotificationPayload = {
  total: number;
  unreadCount: number;
  page: number;
  pageSize: number;
  items: ForumNotification[];
};

const headers = import.meta.server ? useRequestHeaders(["cookie"]) : undefined;

const pageMeta = {
  title: "站内通知",
  desc: "查看回复、提及、点赞和系统通知。"
};

definePageMeta({
  middleware: "account-auth",
  pageTitle: pageMeta.title,
  pageDesc: pageMeta.desc,
  navKey: "/forum",
  breadcrumbs: [
    { label: "论坛社区", to: "/forum" },
    { label: "站内通知", to: "/forum/notifications" }
  ]
});

const { data, pending, refresh } = await useAsyncData<NotificationPayload>(
  "forum-notifications",
  () => $fetch("/api/forum/notifications", { headers }),
  {
    default: () => ({
      total: 0,
      unreadCount: 0,
      page: 1,
      pageSize: 20,
      items: []
    })
  }
);

const markAllRead = async () => {
  try {
    await $fetch("/api/forum/notifications/read", {
      method: "POST",
      body: {}
    });
    ElMessage.success("通知已全部标记为已读");
    await refresh();
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || "操作失败");
  }
};

const typeLabelMap: Record<string, string> = {
  reply: "回复",
  mention: "提及",
  like: "点赞",
  system: "系统"
};
</script>

<template>
  <div class="forum-notifications-page">
    <section class="panel-card notification-head">
      <div>
        <h2>站内通知</h2>
        <p>未读 {{ data?.unreadCount || 0 }} 条，共 {{ data?.total || 0 }} 条。</p>
      </div>
      <el-button type="primary" plain @click="markAllRead">全部标记已读</el-button>
    </section>

    <section class="notification-list">
      <el-empty v-if="!pending && !data?.items.length" description="通知中心还是空的" />
      <article
        v-for="item in data?.items"
        :key="item.id"
        class="panel-card notification-card"
        :class="{ unread: !item.isRead }"
      >
        <div class="notification-card__main">
          <div class="notification-card__meta">
            <span class="notification-type">{{ typeLabelMap[item.type] || item.type }}</span>
            <span>{{ new Date(item.createdAt).toLocaleString("zh-CN") }}</span>
          </div>
          <h3>{{ item.title }}</h3>
          <p>{{ item.body }}</p>
          <div v-if="item.actor" class="notification-card__actor">
            <ForumUserBadge :user="item.actor" compact />
          </div>
        </div>
        <NuxtLink v-if="item.threadId" :to="`/forum/thread/${item.threadId}`" class="notification-card__link">
          查看主题
        </NuxtLink>
      </article>
    </section>
  </div>
</template>

<style scoped>
.forum-notifications-page {
  display: grid;
  gap: 18px;
}

.notification-head,
.notification-card {
  padding: 20px;
}

.notification-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.notification-head h2 {
  margin: 0;
  font-size: 30px;
}

.notification-head p,
.notification-card p {
  margin: 8px 0 0;
  color: #725b4a;
  line-height: 1.8;
}

.notification-list {
  display: grid;
  gap: 14px;
}

.notification-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-left: 6px solid transparent;
}

.notification-card.unread {
  border-left-color: #d84a34;
}

.notification-card__main {
  display: grid;
  gap: 10px;
}

.notification-card__meta {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: #846956;
}

.notification-type {
  padding: 4px 10px;
  border-radius: 999px;
  color: #fff;
  background: linear-gradient(135deg, #d84a34, #f08a24);
}

.notification-card h3 {
  margin: 0;
  font-size: 22px;
}

.notification-card__link {
  min-width: 100px;
  text-align: center;
  padding: 12px 16px;
  border-radius: 999px;
  color: #fff;
  text-decoration: none;
  background: linear-gradient(135deg, #3a7aa3, #57a8d7);
}

body.theme-dark .notification-head p,
body.theme-dark .notification-card p,
body.theme-dark .notification-card__meta {
  color: #c6b4a7;
}

@media (max-width: 860px) {
  .notification-head,
  .notification-card {
    flex-direction: column;
    align-items: flex-start;
  }

  .notification-card__link {
    width: 100%;
  }
}
</style>
