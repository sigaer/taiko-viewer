<script setup lang="ts">
import { computed } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import type { ForumHomePayload, ForumMeSummary, ForumRelationshipItem, ForumThreadCard } from "~/types/forum";
import { parseForumListQuery, forumPageInRange } from "~/utils/forumListQuery";
import { ME_TABS, meTab, meTabRequest, type MeTab } from "~/utils/rework/community";

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
type PeoplePayload = {
  total: number;
  page: number;
  pageSize: number;
  items: ForumRelationshipItem[];
};

const { t } = useI18n();
const localePath = useLocalePath();
const route = useRoute();
const router = useRouter();
const apiFetch = useViewerApiFetch();
const { accountUser } = useAccountState();
const guard = useAccountRequestGuard(false);
const moderationBusy = ref(false);
const moderationOpen = ref(false);
// Follow / unblock on a people tab, the history preference and clearing the history.
const peopleBusyId = ref<number | null>(null);
const historyBusy = ref(false);
let active = true;
onDeactivated(() => { active = false; guard.invalidate(); moderationBusy.value = false; peopleBusyId.value = null; historyBusy.value = false; });
onActivated(() => { active = true; });
watch(() => accountUser.value?.id, () => { moderationBusy.value = false; peopleBusyId.value = null; historyBusy.value = false; }, { flush: 'sync' });

definePageMeta({
  middleware: "account-auth",
  hidePageHeader: true,
  contentLayout: "wide",
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

// Visible text moved from the inline zh / ja table to locales (rework.forum.me.*).
const copy = computed(() => ({
  actionUpdated: t("rework.forum.me.actionUpdated"),
  actionFailed: t("rework.forum.me.actionFailed")
}));

const { data: homeData, pending: homePending, error: homeError, refresh: refreshHome } = useForumResource<ForumHomePayload>(
  'forum-me-home', () => apiFetch('/api/forum/home', { retry: 0 }), { enabled: () => !!accountUser.value }
);
const { data: profileData, pending: profilePending, error: profileError, refresh: refreshProfile } = useForumResource<ProfilePayload>(
  'forum-me-profile', () => apiFetch('/api/account/profile', { retry: 0 }), { enabled: () => !!accountUser.value }
);
// Counts of every tab and the history preference.
const { data: summaryData, refresh: refreshSummary } = useForumResource<ForumMeSummary>(
  'forum-me-summary', () => apiFetch('/api/forum/me/summary', { retry: 0 }), { enabled: () => !!accountUser.value }
);
const tab = computed<MeTab>(() => meTab(route.query.tab));
const tabRequest = computed(() => meTabRequest(tab.value));
const page = computed(() => parseForumListQuery(route.query).page);
const { data: myThreadsData, pending: threadsPending, error: threadsError, refresh: refreshMyThreads } = useForumResource<ThreadListPayload>(
  'forum-me-threads', () => apiFetch('/api/forum/threads', { query: { scope: 'mine', page: tab.value === 'threads' ? page.value : 1, pageSize: 10 }, retry: 0 }),
  { context: () => String(tab.value === 'threads' ? page.value : 1), enabled: () => !!accountUser.value }
);
// Replied / favourites / history: the same list endpoint with its existing `scope` filter.
const { data: scopedData, pending: scopedPending, error: scopedError, refresh: refreshScoped } = useForumResource<ThreadListPayload>(
  'forum-me-scoped', () => apiFetch('/api/forum/threads', { query: { scope: tabRequest.value.scope, page: page.value, pageSize: 10 }, retry: 0 }),
  { context: () => `${tab.value}:${page.value}`, enabled: () => !!accountUser.value && tab.value !== 'threads' && tabRequest.value.kind === 'threads' }
);
const { data: peopleData, pending: peoplePending, error: peopleError, refresh: refreshPeople } = useForumResource<PeoplePayload>(
  'forum-me-people', () => apiFetch('/api/forum/relationships', { query: { scope: tabRequest.value.scope, page: page.value, pageSize: 20 }, retry: 0 }),
  { context: () => `${tab.value}:${page.value}`, enabled: () => !!accountUser.value && tabRequest.value.kind === 'people' }
);
const listData = computed(() => (tab.value === 'threads' ? myThreadsData.value : tabRequest.value.kind === 'threads' ? scopedData.value : peopleData.value));
const listPending = computed(() => (tab.value === 'threads' ? threadsPending.value : tabRequest.value.kind === 'threads' ? scopedPending.value : peoplePending.value));
const correctedPage = computed(() => listData.value ? forumPageInRange(page.value, listData.value.total, listData.value.pageSize) : page.value);
const correctingPage = computed(() => correctedPage.value !== page.value);
const threadsLoading = computed(() => listPending.value || correctingPage.value);
watch(listData, payload => {
  if (!payload || !correctingPage.value) return;
  void router.replace({ query: { ...route.query, page: correctedPage.value > 1 ? String(correctedPage.value) : undefined } });
}, { immediate: true, flush: 'post' });
const currentUser = computed(() => homeData.value?.currentUser || null);
const canModerate = computed(() => ['moderator', 'admin'].includes(currentUser.value?.role || ''));
const { data: moderationData, pending: moderationPending, error: moderationError, refresh: refreshModeration } = useForumResource<ThreadListPayload>(
  'forum-moderation-threads', () => apiFetch('/api/forum/threads', { query: { sort: 'latest', pageSize: 10, includeHidden: 1 }, retry: 0 }),
  { enabled: () => canModerate.value }
);
const listPageCount = computed(() => (listData.value ? Math.ceil(listData.value.total / listData.value.pageSize) : 0));
const changePage = (value: number) => router.push({ query: { ...route.query, page: value > 1 ? String(value) : undefined } });

const tabCount = (key: MeTab) => {
  const stats = summaryData.value?.stats;
  if (!stats) return key === 'threads' && myThreadsData.value ? myThreadsData.value.total : null;
  return ({ threads: stats.threadCount, replied: stats.repliedThreadCount, favorites: stats.favoriteCount, history: stats.historyCount,
    following: stats.followingCount, followers: stats.followerCount, blocked: stats.blockedCount } as Record<MeTab, number>)[key];
};
const tabs = computed(() => ME_TABS.map((key) => ({
  key,
  label: key === 'threads' ? t("rework.forum.me.myThreads") : t(`rework.forum.mine.${key}`),
  count: tabCount(key),
  to: localePath({ path: '/forum/me', query: key === 'threads' ? {} : { tab: key } })
})));
const currentTabLabel = computed(() => tabs.value.find((item) => item.key === tab.value)?.label || '');
const emptyTitle = computed(() => {
  if (listData.value && listData.value.total > 0) return t('rework.forum.me.emptyPage');
  return tab.value === 'threads' ? t('rework.forum.me.noThreads') : t(`rework.forum.mine.empty${tab.value[0].toUpperCase()}${tab.value.slice(1)}`);
});

const runModeration = async (threadId: number, action: string, enabled: boolean) => {
  if (!active || !canModerate.value || moderationBusy.value) return;
  const request = guard.capture();
  moderationBusy.value = true;
  try {
    await apiFetch("/api/forum/moderation/action", {
      method: "POST",
      body: {
        threadId,
        action,
        enabled
      }
    });
    if (!active || !guard.current(request)) return;
    ElMessage.success(copy.value.actionUpdated);
    await Promise.all([refreshHome(), refreshMyThreads(), refreshModeration()]);
  } catch (error: any) {
    if (active && guard.current(request)) ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.actionFailed);
  } finally {
    if (guard.current(request)) moderationBusy.value = false;
  }
};

// People tabs: unfollow / follow back (users/:id/follow) and unblock (users/:id/block), then re-read the list and counts.
const runRelationship = async (userId: number, kind: 'follow' | 'block', enabled: boolean) => {
  if (!active || peopleBusyId.value !== null) return;
  const request = guard.capture();
  peopleBusyId.value = userId;
  try {
    await apiFetch(`/api/forum/users/${userId}/${kind}`, { method: "POST", body: { enabled } });
    if (!active || !guard.current(request)) return;
    ElMessage.success(t("rework.forum.user.updated"));
    await Promise.all([refreshPeople(), refreshSummary()]);
  } catch (error: any) {
    if (active && guard.current(request)) ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.actionFailed);
  } finally {
    if (guard.current(request)) peopleBusyId.value = null;
  }
};

// History tab: the record-history preference and clearing the history (confirmed first).
const recordHistory = computed(() => summaryData.value?.preferences.recordHistoryEnabled ?? null);
const setRecordHistory = async (enabled: boolean) => {
  if (!active || historyBusy.value) return;
  const request = guard.capture();
  historyBusy.value = true;
  try {
    await apiFetch("/api/forum/preferences", { method: "POST", body: { recordHistoryEnabled: enabled } });
    if (!active || !guard.current(request)) return;
    ElMessage.success(t("rework.forum.user.updated"));
    await refreshSummary();
  } catch (error: any) {
    if (active && guard.current(request)) ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.actionFailed);
  } finally {
    if (guard.current(request)) historyBusy.value = false;
  }
};
const clearHistory = async () => {
  if (!active || historyBusy.value) return;
  try {
    await ElMessageBox.confirm(t("rework.forum.mine.clearHistoryConfirm"), t("rework.forum.mine.clearHistory"), {
      type: "warning", confirmButtonText: t("rework.forum.mine.clearHistory"), cancelButtonText: t("common.cancel")
    });
  } catch {
    return;
  }
  if (!active) return;
  const request = guard.capture();
  historyBusy.value = true;
  try {
    await apiFetch("/api/forum/history/clear", { method: "POST" });
    if (!active || !guard.current(request)) return;
    ElMessage.success(t("rework.forum.mine.historyCleared"));
    await Promise.all([refreshScoped(), refreshSummary()]);
  } catch (error: any) {
    if (active && guard.current(request)) ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.actionFailed);
  } finally {
    if (guard.current(request)) historyBusy.value = false;
  }
};
</script>

<template>
  <div class="forum-me-page">
    <ReworkCommunityMeHead
      :title="t('rework.myPosts')"
      :user="currentUser"
      :taiko-id="profileData ? profileData.currentBinding?.taikoId || '' : null"
      :thread-count="myThreadsData ? myThreadsData.total : null"
      :unread="homeData ? homeData.unreadNotificationCount : null"
    >
      <ReworkState v-if="profilePending || homePending" kind="loading" :lines="1" compact />
      <ReworkState v-if="profileError" kind="failed" :text="profileError" compact @retry="refreshProfile" />
      <ReworkState v-if="homeError" kind="failed" :text="homeError" compact @retry="refreshHome" />
    </ReworkCommunityMeHead>

    <ReworkCommunityMeTabs :tabs="tabs" :current="tab" :label="t('rework.forum.mine.tabsLabel')" />

    <ReworkPanel :title="currentTabLabel" plain class="me-threads">
      <template v-if="tab === 'history' && recordHistory !== null" #actions>
        <label class="rw-check me-record">
          <input type="checkbox" :checked="recordHistory" :disabled="historyBusy" @change="setRecordHistory(($event.target as HTMLInputElement).checked)" />
          <span>{{ t("rework.forum.mine.recordHistory") }}</span>
        </label>
        <button v-if="tabCount('history')" type="button" class="rw-btn rw-btn--sm rw-btn--danger" :disabled="historyBusy" @click="clearHistory">{{ t("rework.forum.mine.clearHistory") }}</button>
      </template>
      <template v-if="tabRequest.kind === 'threads'">
        <ReworkCommunityThreadList
          :items="threadsLoading || (tab === 'threads' ? threadsError : scopedError) ? null : (tab === 'threads' ? myThreadsData : scopedData)?.items || null"
          :pending="threadsLoading"
          :error="tab === 'threads' ? threadsError : scopedError"
          :empty-title="emptyTitle"
          @retry="tab === 'threads' ? refreshMyThreads() : refreshScoped()"
        >
          <template #empty>
            <NuxtLink v-if="tab === 'threads' && myThreadsData?.total === 0" :to="localePath('/forum/new')" class="rw-btn rw-btn--primary">{{ t("rework.forum.me.newThread") }}</NuxtLink>
          </template>
        </ReworkCommunityThreadList>
      </template>
      <template v-else>
        <ReworkState v-if="threadsLoading" kind="loading" :lines="4" />
        <ReworkState v-else-if="peopleError" kind="failed" :text="peopleError" compact @retry="refreshPeople" />
        <ReworkCommunityCard v-else-if="peopleData?.items.length" flush>
          <ReworkCommunityPeople
            :items="peopleData.items"
            :scope="tab as 'following' | 'followers' | 'blocked'"
            :busy-id="peopleBusyId"
            @follow="(userId, enabled) => runRelationship(userId, 'follow', enabled)"
            @unblock="(userId) => runRelationship(userId, 'block', false)"
          />
        </ReworkCommunityCard>
        <ReworkState v-else-if="peopleData" kind="empty" :title="emptyTitle" compact />
      </template>
      <ReworkPager v-if="listData && listData.total > listData.pageSize && !correctingPage" class="me-pager" :page="page" :count="listPageCount" @select="changePage" />
    </ReworkPanel>

    <ReworkCommunityModeration
      v-if="canModerate"
      :items="moderationData?.items || []"
      :pending="moderationPending"
      :error="moderationError"
      v-model:open="moderationOpen"
      :busy="moderationBusy"
      @action="runModeration"
      @retry="refreshModeration"
    />
  </div>
</template>

<style scoped>
/* Layout only; colours and type come from the reworked components. */
.forum-me-page {
  display: grid;
  gap: 24px;
  min-width: 0;
  max-width: 920px;
}
.me-record {
  flex: none;
}
</style>
