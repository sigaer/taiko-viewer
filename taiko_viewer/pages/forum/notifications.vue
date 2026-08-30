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
const { formatDateTime, formatDate } = useViewerDateTime();

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

const formatNotificationTime = (value: string) => {
  const timestamp = new Date(value).getTime();
  const ageMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (ageMinutes < 60) return t("forum.relativeMinutes", { count: ageMinutes });
  if (ageMinutes < 1440) return t("forum.relativeHours", { count: Math.floor(ageMinutes / 60) });
  if (ageMinutes < 2880) return t("forum.relativeYesterday");
  return formatDate(value);
};
</script>

<template>
  <div class="forum-notifications-page">
    <section class="panel-card notification-head">
      <div>
        <p class="notification-count">{{ t("page.forum.notifications.summary", { unread: data?.unreadCount || 0, total: data?.total || 0 }) }}</p>
      </div>
      <el-button v-if="data?.unreadCount" type="primary" plain @click="markAllRead">{{ t("forum.markAllRead") }}</el-button>
    </section>

    <section class="notification-list">
      <el-empty v-if="!pending && !data?.items.length" :description="t('forum.emptyNotifications')" />
      <article
        v-for="item in data?.items"
        :key="item.id"
        class="notification-card"
        :class="{ unread: !item.isRead }"
        :tabindex="item.threadId ? 0 : undefined"
        :role="item.threadId ? 'link' : undefined"
        @click="openNotification(item)"
        @keydown.enter="openNotification(item)"
      >
        <div class="notification-card__main">
          <div class="notification-card__meta">
            <span class="notification-type"><span aria-hidden="true">{{ item.type === 'reply' ? '↩' : item.type === 'like' ? '♡' : item.type === 'mention' ? '@' : '!' }}</span> {{ typeLabelMap[item.type] || item.type }}</span>
            <span :title="formatDateTime(item.createdAt)">{{ formatNotificationTime(item.createdAt) }}</span>
          </div>
          <h3>{{ item.title }}</h3>
          <p>{{ item.body }}</p>
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
  padding: 14px 4px;
}

.notification-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.notification-count { margin: 0; color: var(--viewer-text-muted); font-size: 14px; }

.notification-head p,
.notification-card p {
  margin: 8px 0 0;
  color: #725b4a;
  line-height: 1.8;
}

.notification-list {
  display: grid;
  gap: 0;
  border-top: 1px solid var(--viewer-border);
}

.notification-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid var(--viewer-border);
  border-left: 3px solid transparent;
  cursor: pointer;
  transition: background .18s ease, border-color .18s ease;
}

.notification-card:hover, .notification-card:focus-visible { background: color-mix(in srgb, var(--viewer-accent-strong) 8%, var(--viewer-surface)); outline: none; }

.notification-card.unread {
  border-left-color: #d84a34;
}

.notification-card__main {
  display: grid;
  gap: 5px;
}

.notification-card__meta {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: #846956;
}

.notification-type {
  padding: 2px 7px;
  border-radius: 999px;
  color: #fff;
  background: linear-gradient(135deg, #d84a34, #f08a24);
}

.notification-card h3 {
  margin: 0;
  font-size: 16px;
}

.notification-card p { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; font-size: 13px; line-height: 1.5; }

.notification-card__arrow { color: var(--viewer-accent-strong); font-size: 22px; }

body.theme-dark .notification-head p,
body.theme-dark .notification-card p,
body.theme-dark .notification-card__meta {
  color: #c6b4a7;
}

@media (min-width: 861px) {
  .notification-list, .notification-head { max-width: 760px; }
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
