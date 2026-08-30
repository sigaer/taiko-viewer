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

const { t } = useI18n();
const localePath = useLocalePath();
const apiFetch = useViewerApiFetch();
const { formatDateTime } = useViewerDateTime();

definePageMeta({
  middleware: "account-auth",
  pageTitleKey: "forum.notifications",
  pageDescKey: "page.forum.notifications.desc",
  navKey: "/forum",
  breadcrumbs: [
    { labelKey: "forum.title", to: "/forum" },
    { labelKey: "forum.notifications", to: "/forum/notifications" }
  ]
});

const { data, pending, refresh } = await useAsyncData<NotificationPayload>(
  "forum-notifications",
  () => apiFetch("/api/forum/notifications"),
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
    await apiFetch("/api/forum/notifications/read", {
      method: "POST",
      body: {}
    });
    ElMessage.success(t("forum.allMarkedRead"));
    await refresh();
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || t("errors.actionFailed"));
  }
};

const typeLabelMap = computed<Record<string, string>>(() => ({
  reply: t("forum.notificationsType.reply"),
  mention: t("forum.notificationsType.mention"),
  like: t("forum.notificationsType.like"),
  system: t("forum.notificationsType.system")
}));

const openNotification = async (item: ForumNotification) => {
  if (!item.threadId) return;
  await navigateTo(localePath(`/forum/thread/${item.threadId}`));
};
</script>

<template>
  <div class="forum-notifications-page">
    <section class="panel-card notification-head">
      <div>
        <h2>{{ t("forum.notifications") }}</h2>
        <p>{{ t("page.forum.notifications.summary", { unread: data?.unreadCount || 0, total: data?.total || 0 }) }}</p>
      </div>
      <el-button type="primary" plain @click="markAllRead">{{ t("forum.markAllRead") }}</el-button>
    </section>

    <section class="notification-list">
      <el-empty v-if="!pending && !data?.items.length" :description="t('forum.emptyNotifications')" />
      <article
        v-for="item in data?.items"
        :key="item.id"
        class="panel-card notification-card"
        :class="{ unread: !item.isRead }"
        :tabindex="item.threadId ? 0 : undefined"
        :role="item.threadId ? 'link' : undefined"
        @click="openNotification(item)"
        @keydown.enter="openNotification(item)"
      >
        <div class="notification-card__main">
          <div class="notification-card__meta">
            <span class="notification-type"><span aria-hidden="true">{{ item.type === 'reply' ? '↩' : item.type === 'like' ? '♡' : item.type === 'mention' ? '@' : '!' }}</span> {{ typeLabelMap[item.type] || item.type }}</span>
            <span>{{ formatDateTime(item.createdAt) }}</span>
          </div>
          <h3>{{ item.title }}</h3>
          <p>{{ item.body }}</p>
          <div v-if="item.actor" class="notification-card__actor">
            <ForumUserBadge :user="item.actor" compact />
          </div>
        </div>
        <span v-if="item.threadId" class="notification-card__arrow" aria-hidden="true">→</span>
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
  cursor: pointer;
  transition: background .18s ease, border-color .18s ease;
}

.notification-card:hover, .notification-card:focus-visible { background: color-mix(in srgb, var(--viewer-accent-strong) 8%, var(--viewer-surface)); outline: none; }

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

.notification-card__arrow { color: var(--viewer-accent-strong); font-size: 22px; }

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

  .notification-card__arrow { align-self: flex-end; }
}
</style>
