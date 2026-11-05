<script setup lang="ts">
import { ElMessage } from "element-plus";
import { isNavigationFailure } from "vue-router";
import type { ForumHomePayload, ForumNotification } from "~/types/forum";

type NotificationPayload = {
  total: number;
  unreadCount: number;
  page: number;
  pageSize: number;
  items: ForumNotification[];
};
type NotificationState = {
  context: string;
  payload: NotificationPayload | null;
  error: string;
};

const { t, locale } = useI18n();
const localePath = useLocalePath();
const route = useRoute();
const apiFetch = useViewerApiFetch();
const { accountUser } = useAccountState();
const { setUnreadCount } = useForumUnreadCount();
const guard = useAccountRequestGuard(false);
const { formatDateTime, formatDate } = useViewerDateTime();
const forumHome = useNuxtData<ForumHomePayload>("forum-home").data;
const forumMeHome = useNuxtData<ForumHomePayload>("forum-me-home").data;
const page = ref(1);
const pageSize = 20;
const viewGeneration = ref(0);
const context = computed(() => `${accountUser.value?.id || 'guest'}:${viewGeneration.value}:${page.value}`);
const mutationBusy = ref(false);
const openingNotificationId = ref<number | null>(null);
let active = true;
let disposed = false;
let refreshQueued = false;
const copy = computed(() => locale.value === 'ja'
  ? { loading: '通知を読み込み中', failed: '通知を読み込めませんでした', retry: '再試行', previous: '前へ', next: '次へ', pages: (n: number, total: number) => `${n} / ${total} ページ` }
  : { loading: '正在加载通知', failed: '通知加载失败', retry: '重试', previous: '上一页', next: '下一页', pages: (n: number, total: number) => `第 ${n} / ${total} 页` });

// Each accepted write is reflected only after its response. Single-read and
// mark-all share one lock, so an older failure cannot roll back a newer success.
const syncCachedUnreadCount = (unreadCount: number) => {
  setUnreadCount(unreadCount);
  if (forumHome.value) forumHome.value.unreadNotificationCount = unreadCount;
  if (forumMeHome.value) forumMeHome.value.unreadNotificationCount = unreadCount;
};
const syncUnreadCount = (unreadCount: number) => {
  if (data.value) data.value.unreadCount = unreadCount;
  syncCachedUnreadCount(unreadCount);
};

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

const fetchNotifications = async (): Promise<NotificationState> => {
  const requestedContext = context.value;
  const request = guard.capture();
  if (!active || !accountUser.value) return { context: requestedContext, payload: null, error: "" };
  try {
    const payload = await apiFetch<NotificationPayload>("/api/forum/notifications", {
      query: { page: page.value, pageSize }, retry: 0
    });
    if (!active || !guard.current(request) || context.value !== requestedContext) {
      return { context: requestedContext, payload: null, error: "" };
    }
    return { context: requestedContext, payload, error: "" };
  } catch {
    return { context: requestedContext, payload: null,
      error: active && guard.current(request) && context.value === requestedContext ? copy.value.failed : "" };
  }
};
const { data: notificationState, pending, refresh, clear } = await useAsyncData<NotificationState>(
  `forum-notifications:${accountUser.value?.id || 'guest'}:${route.path}`,
  fetchNotifications,
  { default: () => ({ context: "", payload: null, error: "" }), dedupe: "cancel" }
);
const data = computed(() => notificationState.value?.context === context.value ? notificationState.value.payload : null);
// An accepted write may complete while this KeepAlive view is inactive. Only
// current, valid reads can reconcile its count with the other cached pages.
watch(data, payload => {
  if (payload && active && !disposed && accountUser.value) syncCachedUnreadCount(payload.unreadCount);
}, { immediate: true, flush: 'sync' });
const loadError = computed(() => notificationState.value?.context === context.value ? notificationState.value.error : "");
const totalPages = computed(() => Math.max(1, Math.ceil((data.value?.total || 0) / pageSize)));
const actionsDisabled = computed(() => mutationBusy.value || pending.value || !active || !accountUser.value || !data.value || Boolean(loadError.value));

const scheduleRefresh = () => {
  if (refreshQueued || !active || disposed || !accountUser.value) return;
  refreshQueued = true;
  void nextTick(() => {
    refreshQueued = false;
    if (active && !disposed && accountUser.value) void refresh();
  });
};
const invalidateView = () => {
  guard.invalidate();
  viewGeneration.value++;
  mutationBusy.value = false;
  openingNotificationId.value = null;
  clear();
};
watch(() => accountUser.value?.id, () => {
  invalidateView();
  page.value = 1;
  scheduleRefresh();
}, { flush: 'sync' });
watch(page, () => { invalidateView(); scheduleRefresh(); }, { flush: 'sync' });
onDeactivated(() => { active = false; invalidateView(); });
onActivated(() => { if (!active && !disposed) { active = true; scheduleRefresh(); } });
onBeforeUnmount(() => { disposed = true; active = false; invalidateView(); });

const retry = async () => {
  if (!active || !accountUser.value || mutationBusy.value || pending.value) return;
  await refresh();
};
const movePage = (offset: number) => {
  if (actionsDisabled.value) return;
  page.value = Math.max(1, Math.min(totalPages.value, page.value + offset));
};
const isCurrent = (request: number, requestedContext: string) => active && !disposed
  && guard.current(request) && context.value === requestedContext;

const markAllRead = async () => {
  if (actionsDisabled.value || !data.value?.unreadCount) return;
  const request = guard.capture(), requestedContext = context.value;
  mutationBusy.value = true;
  try {
    const result = await apiFetch<{ unreadCount: number }>("/api/forum/notifications/read", {
      method: "POST", body: {}, retry: 0
    });
    if (!isCurrent(request, requestedContext)) return;
    syncUnreadCount(result.unreadCount);
    data.value?.items.forEach(item => { item.isRead = true; });
    ElMessage.success(t("forum.allMarkedRead"));
    // Re-read the server's unread-first ordering, including off-page records.
    await refresh();
  } catch (error: any) {
    if (isCurrent(request, requestedContext)) {
      ElMessage.error(error?.data?.statusMessage || error?.message || t("errors.actionFailed"));
    }
  } finally {
    if (isCurrent(request, requestedContext)) mutationBusy.value = false;
  }
};

const typeLabelMap = computed<Record<string, string>>(() => ({
  reply: t("forum.notificationsType.reply"),
  mention: t("forum.notificationsType.mention"),
  like: t("forum.notificationsType.like"),
  system: t("forum.notificationsType.system")
}));
const getNotificationTarget = (item: ForumNotification) => {
  if (!item.threadId) return null;
  return localePath({ path: `/forum/thread/${item.threadId}`, hash: item.postId ? `#reply-${item.postId}` : undefined });
};
const openNotification = async (item: ForumNotification) => {
  if (actionsDisabled.value || !data.value?.items.includes(item)) return;
  const request = guard.capture(), requestedContext = context.value;
  mutationBusy.value = true;
  openingNotificationId.value = item.id;
  let marked = false;
  try {
    if (!item.isRead) {
      const result = await apiFetch<{ unreadCount: number }>("/api/forum/notifications/read", {
        method: "POST", body: { ids: [item.id] }, retry: 0
      });
      if (!isCurrent(request, requestedContext)) return;
      item.isRead = true;
      syncUnreadCount(result.unreadCount);
      marked = true;
    }
    if (!isCurrent(request, requestedContext)) return;
    const target = getNotificationTarget(item);
    if (target) {
      const failure = await navigateTo(target);
      if (isCurrent(request, requestedContext) && isNavigationFailure(failure)) {
        ElMessage.error(t("errors.actionFailed"));
      }
    }
  } catch (error: any) {
    // A navigation failure does not undo an already accepted mark-read write.
    if (isCurrent(request, requestedContext)) {
      ElMessage.error(error?.data?.statusMessage || error?.message || t("errors.actionFailed"));
    }
  } finally {
    if (isCurrent(request, requestedContext)) {
      try {
        if (marked) await refresh();
      } finally {
        if (isCurrent(request, requestedContext)) {
          mutationBusy.value = false;
          openingNotificationId.value = null;
        }
      }
    }
  }
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
  <div class="forum-notifications-page" :aria-busy="pending || mutationBusy || undefined">
    <section v-if="data && !loadError" class="panel-card notification-head">
      <p class="notification-count" aria-live="polite">{{ t("page.forum.notifications.summary", { unread: data.unreadCount, total: data.total }) }}</p>
      <el-button v-if="data.unreadCount" type="primary" plain :disabled="actionsDisabled" @click="markAllRead">{{ t("forum.markAllRead") }}</el-button>
    </section>
    <p v-if="pending" role="status">{{ copy.loading }}</p>
    <section v-else-if="loadError" class="notification-error" role="alert">
      <p>{{ loadError }}</p>
      <el-button :disabled="mutationBusy" @click="retry">{{ copy.retry }}</el-button>
    </section>
    <template v-else-if="data">
      <section class="notification-list">
        <el-empty v-if="!data.items.length" :description="t('forum.emptyNotifications')" />
        <article
          v-for="item in data.items"
          :key="item.id"
          class="notification-card"
          :class="{ unread: !item.isRead }"
          :tabindex="actionsDisabled ? -1 : 0"
          :role="item.threadId ? 'link' : 'button'"
          :aria-label="item.title"
          :aria-disabled="actionsDisabled || undefined"
          :aria-busy="openingNotificationId === item.id"
          @click="openNotification(item)"
          @keydown.enter.prevent="openNotification(item)"
          @keydown.space="!item.threadId && ($event.preventDefault(), openNotification(item))"
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
      <nav v-if="totalPages > 1 || page > 1" class="notification-pager" :aria-label="copy.pages(page, totalPages)">
        <el-button :disabled="actionsDisabled || page <= 1" @click="movePage(-1)">{{ copy.previous }}</el-button>
        <span aria-live="polite">{{ copy.pages(page, totalPages) }}</span>
        <el-button :disabled="actionsDisabled || page >= totalPages" @click="movePage(1)">{{ copy.next }}</el-button>
      </nav>
    </template>
  </div>
</template>

<style scoped>
.notification-error { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.notification-pager { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 12px; }
.notification-pager :deep(button) { min-height: 44px; }
.notification-card[aria-disabled="true"] { cursor: wait; }
.notification-card:focus-visible { outline: 2px solid var(--viewer-accent-strong); outline-offset: 2px; }

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

.notification-count { margin: 0; color:var(--viewer-text-muted); font-size: 14px; }

.notification-head p,
.notification-card p {
  margin: 8px 0 0;
  color:var(--viewer-text-muted);
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

.notification-card:hover, .notification-card:focus-visible { background:color-mix(in srgb, var(--viewer-accent-strong) 8%, var(--viewer-surface)); }

.notification-card.unread {
  border-left-color:var(--viewer-primary);
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
  color:var(--viewer-text-muted);
}

.notification-type {
  padding: 2px 7px;
  border-radius: 999px;
  color:var(--viewer-on-primary);
  background:linear-gradient(135deg, var(--viewer-primary), var(--viewer-primary-hover));
}

.notification-card h3 {
  margin: 0;
  font-size: 16px;
}

.notification-card p { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; font-size: 13px; line-height: 1.5; }

.notification-card__arrow { color:var(--viewer-accent-strong); font-size: 22px; }

body.theme-dark .notification-head p,
body.theme-dark .notification-card p,
body.theme-dark .notification-card__meta {
  color:var(--viewer-text-muted);
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
