<script setup lang="ts">
// A member's community page: identity, thread / follower / following counts, the relationship (follows you, mutual),
// follow and block (POST users/:id/follow and users/:id/block, block confirmed first), and their latest threads —
// all from GET /api/forum/users/:id. The API returns the six latest threads only; there is no full list per member.
import { computed } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import type { ForumUserProfile } from "~/types/forum";

const route = useRoute();
const { t } = useI18n();
const localePath = useLocalePath();
const apiFetch = useViewerApiFetch();
const { accountUser } = useAccountState();
const guard = useAccountRequestGuard(false);
const busy = ref(false);
let active = true;
onDeactivated(() => { active = false; guard.invalidate(); busy.value = false; });
onActivated(() => { active = true; });
watch(() => [accountUser.value?.id, route.params.id], () => { busy.value = false; }, { flush: "sync" });

definePageMeta({
  hidePageHeader: true,
  contentLayout: "wide",
  pageTitleKey: "rework.forum.user.title",
  navKey: "/forum",
  breadcrumbs: [{ labelKey: "forum.title", to: "/forum" }, { labelKey: "rework.forum.user.title" }]
});

const resource = useForumResource<ForumUserProfile>(
  `forum-user:${route.params.id}`, () => apiFetch(`/api/forum/users/${route.params.id}`, { retry: 0 }),
  { context: () => String(route.params.id) }
);
const { data, pending: readPending, error: readFailure, refresh } = resource;
const { pending, error: readError } = useForumHydratedState(readPending, readFailure);
const profile = computed(() => data.value);
useViewerSeo(() => ({ title: profile.value?.user.username || t("rework.forum.user.title"), description: t("page.forum.index.desc"), path: `/forum/user/${route.params.id}`, robots: "noindex, follow" }));
const signedIn = computed(() => Boolean(accountUser.value));
const loginTo = computed(() => localePath({ path: "/account/login", query: { redirect: route.fullPath } }));

const post = async (kind: "follow" | "block", enabled: boolean) => {
  if (!active || busy.value || !profile.value) return;
  const request = guard.capture(), requested = String(route.params.id);
  busy.value = true;
  try {
    const result = await apiFetch<{ ok: boolean; relationship: ForumUserProfile["relationship"] }>(`/api/forum/users/${requested}/${kind}`, {
      method: "POST",
      body: { enabled }
    });
    if (!active || !guard.current(request) || String(route.params.id) !== requested) return;
    ElMessage.success(t("rework.forum.user.updated"));
    // Counts and the latest threads depend on the relationship (blocked members' threads are not listed): read again.
    if (profile.value) profile.value.relationship = result.relationship;
    await refresh();
  } catch (error: any) {
    if (active && guard.current(request)) ElMessage.error(error?.data?.statusMessage || error?.message || t("rework.forum.me.actionFailed"));
  } finally {
    if (guard.current(request)) busy.value = false;
  }
};
const toggleFollow = () => profile.value && post("follow", !profile.value.relationship.isFollowing);
const toggleBlock = async () => {
  if (!profile.value) return;
  if (!profile.value.relationship.isBlocked) {
    try {
      await ElMessageBox.confirm(t("rework.forum.user.blockConfirm"), t("rework.forum.user.blockTitle"), {
        type: "warning", confirmButtonText: t("rework.forum.user.block"), cancelButtonText: t("common.cancel")
      });
    } catch {
      return;
    }
  }
  await post("block", !profile.value.relationship.isBlocked);
};
</script>

<template>
  <div class="forum-user-page">
    <ReworkState v-if="pending" kind="loading" :lines="6" />
    <ReworkState v-else-if="readError" kind="failed" :text="readError" @retry="refresh">
      <NuxtLink :to="localePath('/forum')" class="rw-btn">{{ t("rework.forum.thread.back") }}</NuxtLink>
    </ReworkState>
    <template v-else-if="profile">
      <ReworkCommunityUserHead :profile="profile" :signed-in="signedIn" :login-to="loginTo" :busy="busy" @follow="toggleFollow" @block="toggleBlock" />
      <ReworkPanel :title="t('rework.forum.user.latest')" plain>
        <ReworkState v-if="profile.relationship.isBlocked" kind="empty" :title="t('rework.forum.user.blockedNote')" compact />
        <ReworkCommunityThreadList v-else :items="profile.latestThreads" :empty-title="t('rework.forum.user.noThreads')" />
      </ReworkPanel>
    </template>
  </div>
</template>

<style scoped>
/* Layout only; colours and type come from the reworked components. */
.forum-user-page {
  display: grid;
  gap: 24px;
  min-width: 0;
  max-width: 920px;
}
</style>
