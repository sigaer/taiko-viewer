<script setup lang="ts">
import { computed } from "vue";
import { ElMessage } from "element-plus";
import type { ForumHomePayload, ForumThreadCard } from "~/types/forum";
import { parseForumListQuery, forumPageInRange } from "~/utils/forumListQuery";

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

const { t } = useI18n();
const localePath = useLocalePath();
const route = useRoute();
const router = useRouter();
const apiFetch = useViewerApiFetch();
const { accountUser } = useAccountState();
const guard = useAccountRequestGuard(false);
const moderationBusy = ref(false);
const moderationOpen = ref(false);
let active = true;
onDeactivated(() => { active = false; guard.invalidate(); moderationBusy.value = false; });
onActivated(() => { active = true; });
watch(() => accountUser.value?.id, () => { moderationBusy.value = false; }, { flush: 'sync' });

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
const page = computed(() => parseForumListQuery(route.query).page);
const { data: myThreadsData, pending: threadsPending, error: threadsError, refresh: refreshMyThreads } = useForumResource<ThreadListPayload>(
  'forum-me-threads', () => apiFetch('/api/forum/threads', { query: { scope: 'mine', page: page.value, pageSize: 10 }, retry: 0 }),
  { context: () => String(page.value), enabled: () => !!accountUser.value }
);
const correctedPage = computed(() => myThreadsData.value ? forumPageInRange(page.value, myThreadsData.value.total, myThreadsData.value.pageSize) : page.value);
const correctingPage = computed(() => correctedPage.value !== page.value);
const threadsLoading = computed(() => threadsPending.value || correctingPage.value);
watch(myThreadsData, payload => {
  if (!payload || !correctingPage.value) return;
  void router.replace({ query: { ...route.query, page: correctedPage.value > 1 ? String(correctedPage.value) : undefined } });
}, { immediate: true, flush: 'post' });
const currentUser = computed(() => homeData.value?.currentUser || null);
const canModerate = computed(() => ['moderator', 'admin'].includes(currentUser.value?.role || ''));
const { data: moderationData, pending: moderationPending, error: moderationError, refresh: refreshModeration } = useForumResource<ThreadListPayload>(
  'forum-moderation-threads', () => apiFetch('/api/forum/threads', { query: { sort: 'latest', pageSize: 10, includeHidden: 1 }, retry: 0 }),
  { enabled: () => canModerate.value }
);
const myThreadsPageCount = computed(() => (myThreadsData.value ? Math.ceil(myThreadsData.value.total / myThreadsData.value.pageSize) : 0));
const changePage = (value: number) => router.push({ query: { ...route.query, page: value > 1 ? String(value) : undefined } });

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

    <ReworkPanel :title="t('rework.forum.me.myThreads')" plain class="me-threads">
      <ReworkCommunityThreadList
        :items="threadsLoading || threadsError ? null : myThreadsData?.items || null"
        :pending="threadsLoading"
        :error="threadsError"
        :empty-title="myThreadsData?.total === 0 ? t('rework.forum.me.noThreads') : t('rework.forum.me.emptyPage')"
        @retry="refreshMyThreads"
      >
        <template #empty>
          <NuxtLink v-if="myThreadsData?.total === 0" :to="localePath('/forum/new')" class="rw-btn rw-btn--primary">{{ t("rework.forum.me.newThread") }}</NuxtLink>
        </template>
      </ReworkCommunityThreadList>
      <ReworkPager v-if="myThreadsData && myThreadsData.total > myThreadsData.pageSize && !correctingPage" class="me-pager" :page="page" :count="myThreadsPageCount" @select="changePage" />
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
</style>
