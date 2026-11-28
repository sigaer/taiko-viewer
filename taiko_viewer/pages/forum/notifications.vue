<script setup lang="ts">
import { ElMessage } from "element-plus";
import { isNavigationFailure } from "vue-router";
import type { ForumHomePayload, ForumNotification } from "~/types/forum";
import { NOTIFICATION_FILTERS, filterNotifications, type NotificationFilter } from "~/utils/rework/community";

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

const { t } = useI18n();
const localePath = useLocalePath();
const route = useRoute();
const apiFetch = useViewerApiFetch();
const { accountUser } = useAccountState();
const { setUnreadCount } = useForumUnreadCount();
const guard = useAccountRequestGuard(false);
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
// Visible text moved from the inline zh / ja table to locales (rework.forum.notifications.*).
const copy = computed(() => ({
  failed: t("rework.forum.notifications.failed"),
  retry: t("rework.forum.notifications.retry"),
  pages: (n: number, total: number) => t("rework.forum.notifications.pages", { page: n, total })
}));

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
  hidePageHeader: true,
  contentLayout: "wide",
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

// Mark one notification read without opening it (same request and lock as opening it).
const markRead = async (item: ForumNotification) => {
  if (actionsDisabled.value || item.isRead || !data.value?.items.includes(item)) return;
  const request = guard.capture(), requestedContext = context.value;
  mutationBusy.value = true;
  openingNotificationId.value = item.id;
  try {
    const result = await apiFetch<{ unreadCount: number }>("/api/forum/notifications/read", {
      method: "POST", body: { ids: [item.id] }, retry: 0
    });
    if (!isCurrent(request, requestedContext)) return;
    item.isRead = true;
    syncUnreadCount(result.unreadCount);
  } catch (error: any) {
    if (isCurrent(request, requestedContext)) {
      ElMessage.error(error?.data?.statusMessage || error?.message || t("errors.actionFailed"));
    }
  } finally {
    if (isCurrent(request, requestedContext)) {
      mutationBusy.value = false;
      openingNotificationId.value = null;
    }
  }
};

// Type filter over the loaded page (the API returns each item's type; it has no type filter of its own).
const typeFilter = ref<NotificationFilter>("all");
const typeFilters = computed(() => NOTIFICATION_FILTERS.map((key) => ({
  key, label: key === "all" ? t("rework.forum.notify.all") : t(`forum.notificationsType.${key}`)
})));
const visibleItems = computed(() => filterNotifications(data.value?.items || [], typeFilter.value));

const selectPage = (value: number) => movePage(value - page.value);
// Relative times ("{n} 分钟前" / yesterday / date) are drawn by ReworkCommunityTime after mount.
</script>

<template>
  <div class="forum-notifications-page" :aria-busy="pending || mutationBusy || undefined">
    <ReworkPageHeader class="notification-head" :title="t('rework.notifications')">
      <p v-if="data && !loadError" class="notification-count rw-count" aria-live="polite">{{ t("page.forum.notifications.summary", { unread: data.unreadCount, total: data.total }) }}</p>
      <template v-if="data && !loadError && data.unreadCount" #actions>
        <button type="button" class="rw-btn" :disabled="actionsDisabled" @click="markAllRead">{{ t("forum.markAllRead") }}</button>
      </template>
    </ReworkPageHeader>
    <ReworkState v-if="pending" kind="loading" :lines="6" />
    <ReworkState v-else-if="loadError" kind="failed" :text="loadError" :retry-label="copy.retry" @retry="retry" />
    <template v-else-if="data">
      <ReworkState v-if="!data.items.length" kind="empty" :title="t('forum.emptyNotifications')" />
      <template v-else>
        <div class="rw-seg notification-filters" role="group" :aria-label="t('rework.forum.notify.filterLabel')">
          <button v-for="filter in typeFilters" :key="filter.key" type="button" :aria-pressed="typeFilter === filter.key" @click="typeFilter = filter.key">{{ filter.label }}</button>
        </div>
        <ReworkState v-if="!visibleItems.length" kind="empty" :title="t('rework.forum.notify.filteredEmpty')" compact />
        <ReworkCommunityCard v-else flush>
          <ul class="notification-list">
            <ReworkCommunityNotificationItem
              v-for="item in visibleItems"
              :key="item.id"
              :item="item"
              :disabled="actionsDisabled"
              :busy="openingNotificationId === item.id"
              @open="openNotification(item)"
              @mark="markRead(item)"
            />
          </ul>
        </ReworkCommunityCard>
      </template>
      <ReworkPager v-if="totalPages > 1 || page > 1" class="notification-pager" :page="page" :count="totalPages" @select="selectPage" />
    </template>
  </div>
</template>

<style scoped>
/* Layout only; colours and type come from the reworked components. */
.forum-notifications-page {
  display: grid;
  gap: 20px;
  min-width: 0;
  max-width: 760px;
}
.notification-count {
  margin: 6px 0 0;
}
.notification-filters {
  justify-self: start;
}
.notification-list {
  display: grid;
  margin: 0;
  padding: 0;
}
@media (max-width: 767px) {
  .notification-head :deep(.rw-head__actions) {
    flex-basis: auto;
  }
}
</style>
