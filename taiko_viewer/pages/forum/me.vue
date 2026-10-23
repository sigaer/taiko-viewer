<script setup lang="ts">
import { computed } from "vue";
import { ElMessage } from "element-plus";
import type { ForumHomePayload, ForumThreadCard } from "~/types/forum";
import { parseForumListQuery, forumPageInRange } from "~/utils/forumListQuery";
import { resolveForumSectionTranslation } from "~/utils/forum";

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
const route = useRoute();
const router = useRouter();
const apiFetch = useViewerApiFetch();
const { accountUser } = useAccountState();
const guard = useAccountRequestGuard(false);
const moderationBusy = ref(false);
let active = true;
onDeactivated(() => { active = false; guard.invalidate(); moderationBusy.value = false; });
onActivated(() => { active = true; });
watch(() => accountUser.value?.id, () => { moderationBusy.value = false; }, { flush: 'sync' });

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
        emptyPage: "このページには投稿がありません",
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
        emptyPage: "当前页暂无帖子",
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
const getSectionLabel = (slug: string) => resolveForumSectionTranslation(t, slug, slug);

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
    <section class="panel-card me-profile-panel">
      <div class="me-profile-panel__main">
        <ForumUserBadge v-if="currentUser" :user="currentUser" />
        <div>
          <h2>{{ copy.title }}</h2>
          <p>
            <span v-if="profileData">{{ copy.bound }}：{{ profileData.currentBinding?.taikoId || copy.unbound }} </span>
            <span v-if="myThreadsData">{{ copy.threadCount }} {{ myThreadsData.total }} </span>
            <span v-if="homeData">{{ copy.unread }} {{ homeData.unreadNotificationCount }}</span>
          </p>
          <ForumReadState :pending="profilePending" :error="profileError" @retry="refreshProfile" />
          <ForumReadState :pending="homePending" :error="homeError" @retry="refreshHome" />
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
      <ForumReadState v-if="threadsLoading || threadsError" :pending="threadsLoading" :error="threadsError" @retry="refreshMyThreads" />
      <el-empty v-else-if="myThreadsData && !myThreadsData.items.length" :description="myThreadsData.total === 0 ? copy.noThreads : copy.emptyPage" />
      <div v-else-if="myThreadsData" class="thread-stack">
        <ForumThreadCard v-for="thread in myThreadsData?.items" :key="thread.id" :thread="thread" compact />
      </div>
    </section>

    <div v-if="myThreadsData && myThreadsData.total > myThreadsData.pageSize && !correctingPage" class="me-pager">
      <el-button :disabled="page <= 1 || threadsPending" @click="changePage(page - 1)">{{ t('page.forum.section.prevPage') }}</el-button>
      <span>{{ page }} / {{ Math.ceil(myThreadsData.total / myThreadsData.pageSize) }}</span>
      <el-button :disabled="page * myThreadsData.pageSize >= myThreadsData.total || threadsPending" @click="changePage(page + 1)">{{ t('page.forum.section.nextPage') }}</el-button>
    </div>
    <section v-if="canModerate" class="panel-card moderation-panel">
      <div class="panel-head">
        <div>
          <h3>{{ copy.moderation }}</h3>
          <p>{{ copy.moderationDesc }}</p>
        </div>
      </div>
      <ForumReadState :pending="moderationPending" :error="moderationError" @retry="refreshModeration" />
      <div v-if="!moderationPending && !moderationError" class="moderation-list">
        <article v-for="thread in moderationData?.items" :key="thread.id" class="moderation-item">
          <div class="moderation-item__meta">
            <strong>{{ thread.title }}</strong>
            <span>{{ getSectionLabel(thread.section.slug) }} · {{ thread.author.username }}</span>
          </div>
          <div class="moderation-item__actions">
            <el-button size="small" :disabled="moderationBusy" @click="runModeration(thread.id, 'pin', !thread.isPinned)">
              {{ thread.isPinned ? copy.unpin : copy.pin }}
            </el-button>
            <el-button size="small" :disabled="moderationBusy" @click="runModeration(thread.id, 'feature', !thread.isFeatured)">
              {{ thread.isFeatured ? copy.unfeature : copy.feature }}
            </el-button>
            <el-button size="small" :disabled="moderationBusy" @click="runModeration(thread.id, 'lock', !thread.isLocked)">
              {{ thread.isLocked ? copy.unlock : copy.lock }}
            </el-button>
            <el-button size="small" type="danger" plain :disabled="moderationBusy" @click="runModeration(thread.id, 'hide', thread.status === 'published')">
              {{ thread.status === "published" ? copy.hide : copy.restore }}
            </el-button>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.me-pager { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
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
  color:var(--viewer-text-muted);
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
  color:var(--viewer-on-primary);
  background:linear-gradient(135deg, var(--viewer-primary), var(--viewer-primary-hover));
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
  color:var(--viewer-text-muted);
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
  background:var(--viewer-surface-subtle);
}

.moderation-item__meta {
  display: grid;
  gap: 6px;
}

.moderation-item__meta span {
  color:var(--viewer-text-muted);
  font-size: 13px;
}

body.theme-dark .me-profile-panel__main p,
body.theme-dark .panel-head p,
body.theme-dark .moderation-item__meta span {
  color:var(--viewer-text-muted);
}

body.theme-dark .moderation-item {
  background:var(--viewer-surface-subtle);
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
