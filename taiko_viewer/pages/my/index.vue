<script setup lang="ts">
import { buildPageDescription } from "~/utils/seo";

const { t } = useI18n();
const { accountUser, accountAuthStatus, accountLoaded, accountAuthError, fetchCurrentUser } = useAccountState();
// A prerendered public page can carry a cached anonymous build identity.
// Recheck that state on entry; join pending reads and retain known accounts.
const initialAuth = fetchCurrentUser(import.meta.client && accountAuthStatus.value === 'guest');
if (import.meta.server) await initialAuth;
const retryAuth = () => fetchCurrentUser(true);
// The first client render shows the session the server rendered: the entry recheck above may already be pending,
// which would replace the server's prompt before hydration. From mount on the hub follows the live status.
const mounted = ref(false);
onMounted(() => { mounted.value = true; });
const hubStatus = computed(() =>
  mounted.value ? accountAuthStatus.value : !accountLoaded.value ? "loading" : accountAuthError.value ? "error" : accountUser.value ? "authenticated" : "guest"
);

definePageMeta({
  pageTitleKey: "nav.myTaiko",
  pageDescKey: "page.myTaiko.desc",
  navKey: "/my",
  hidePageDescription: true,
  hidePageHeader: true,
  reworkElementPlus: true,
  breadcrumbs: [{ labelKey: "nav.myTaiko", to: "/my" }]
});

useViewerSeo(() => ({
  title: t("nav.myTaiko"),
  description: buildPageDescription(t("page.myTaiko.desc")),
  path: "/my"
}));

// Keep the existing entry permissions reactive to account changes.
const linkGroups = computed(() => [
  { key: 'common', items: [
    ...(accountUser.value ? [{ path: "/account/sync", label: "account.sync", icon: "M20 7h-9m6-4 4 4-4 4 M4 17h9m-6-4-4 4 4 4" }] : []),
    { path: "/account/songs", label: "rework.scoreList.title", icon: "M9 18V5l11-2v13 M9 8l11-2 M9 18a3 3 0 1 1-3-3c1.7 0 3 1.3 3 3Zm11-2a3 3 0 1 1-3-3c1.7 0 3 1.3 3 3Z" },
    { path: "/my/growth", label: "passport.title", icon: "M4 4h16v16H4z M8 15l4-4 3 2 3-6 M8 8h1" },
    { path: "/tools/recommend", label: "tools.recommend", icon: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z" }
  ] },
  { key: 'data', items: [
    { path: "/my/weekly", label: "weekly.title", icon: "M4 5h16v16H4z M8 3v4m8-4v4M4 11h16 M8 15h2m4 0h2m-8 3h2" },
    { path: "/tools/b30", label: "tools.b30", icon: "M4 21h16 M6 17v-7h4v7m4 0V3h4v14" },
    { path: "/tools/trend", label: "tools.trend", icon: "M4 4v16h16 M7 15l4-5 4 2 5-7" },
    { path: "/tools/progress", label: "tools.progress", icon: "M9 5h11m-11 7h11m-11 7h11 M3 5l1 1 2-3m-3 9 1 1 2-3m-3 9 1 1 2-3" },
    { path: "/tools/word-cloud", label: "tools.wordCloud", icon: "M7 18H6a4 4 0 0 1-.7-7.9 7 7 0 0 1 13.4 0A4 4 0 0 1 18 18h-1 M9 18h6m-5-4h4" }
  ] }
]);
const annualLink = computed(() => accountUser.value?.annualSummaryAccess
  ? { path: '/account/version-summary', label: 'account.versionSummary' }
  : null);
</script>

<template>
  <ReworkMyHub :status="hubStatus" :user="accountUser" :groups="linkGroups" :annual="annualLink" @retry="retryAuth" />
</template>
