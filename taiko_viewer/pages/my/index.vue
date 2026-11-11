<script setup lang="ts">
import { buildPageDescription } from "~/utils/seo";

const { t, locale } = useI18n();
const localePath = useLocalePath();
const { accountUser, accountAuthStatus, fetchCurrentUser } = useAccountState();
// A prerendered public page can carry a cached anonymous build identity.
// Recheck that state on entry; join pending reads and retain known accounts.
const initialAuth = fetchCurrentUser(import.meta.client && accountAuthStatus.value === 'guest');
if (import.meta.server) await initialAuth;
const retryAuth = () => fetchCurrentUser(true);

definePageMeta({
  pageTitleKey: "nav.myTaiko",
  pageDescKey: "page.myTaiko.desc",
  navKey: "/my",
  hidePageDescription: true,
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
    { path: "/account/songs", label: "page.myTaiko.scores", icon: "M9 18V5l11-2v13 M9 8l11-2 M9 18a3 3 0 1 1-3-3c1.7 0 3 1.3 3 3Zm11-2a3 3 0 1 1-3-3c1.7 0 3 1.3 3 3Z" },
    { path: "/my/growth", label: "passport.title", icon: "M4 4h16v16H4z M8 15l4-4 3 2 3-6 M8 8h1" },
    { path: "/tools/recommend", label: "tools.recommend", icon: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z" }
  ] },
  { key: 'data', items: [
    { path: "/my/weekly", label: "page.myTaiko.weekly", icon: "M4 5h16v16H4z M8 3v4m8-4v4M4 11h16 M8 15h2m4 0h2m-8 3h2" },
    { path: "/tools/b30", label: "tools.b30", icon: "M4 21h16 M6 17v-7h4v7m4 0V3h4v14" },
    { path: "/tools/trend", label: "tools.trend", icon: "M4 4v16h16 M7 15l4-5 4 2 5-7" },
    { path: "/tools/progress", label: "tools.progress", icon: "M9 5h11m-11 7h11m-11 7h11 M3 5l1 1 2-3m-3 9 1 1 2-3m-3 9 1 1 2-3" },
    { path: "/tools/word-cloud", label: "tools.wordCloud", icon: "M7 18H6a4 4 0 0 1-.7-7.9 7 7 0 0 1 13.4 0A4 4 0 0 1 18 18h-1 M9 18h6m-5-4h4" }
  ] }
]);
const annualLink = computed(() => accountUser.value?.annualSummaryAccess
  ? { path: '/account/version-summary', label: 'account.versionSummary' }
  : null);
const useDefaultAvatar = (event: Event) => {
  const image = event.target as HTMLImageElement;
  if (image.getAttribute('src') !== '/default-avatar.svg') image.src = '/default-avatar.svg';
};
</script>

<template>
  <div class="my-page" :lang="locale" :data-auth-status="accountAuthStatus">
    <section v-if="accountAuthStatus === 'loading'" class="my-status" role="status" aria-busy="true">
      <p>{{ t('layout.loading') }}</p>
    </section>
    <section v-else-if="accountAuthStatus === 'error'" class="my-status" role="alert">
      <p>{{ t('page.myTaiko.authFailed') }}</p>
      <button type="button" @click="retryAuth">{{ t('home.growth.recent.retry') }}</button>
    </section>
    <NuxtLink v-else-if="accountAuthStatus === 'guest'" :to="localePath('/account/login')" class="my-profile my-profile--guest">
      <img class="my-avatar" src="/default-avatar.svg" alt="" width="64" height="64" />
      <span class="my-profile-name">{{ t('account.login') }}</span>
      <svg class="my-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
    </NuxtLink>
    <NuxtLink v-else :to="localePath('/account/profile')" class="my-profile">
      <img :key="`${accountUser?.id}:${accountUser?.avatarUrl}`" class="my-avatar" :src="accountUser?.avatarUrl || '/default-avatar.svg'" alt="" width="64" height="64" @error="useDefaultAvatar" />
      <span class="my-profile-info">
        <span class="my-profile-name">{{ accountUser?.username }}</span>
        <AccountTitleBadges :titles="accountUser?.titles" />
        <span class="my-profile-label">{{ t('account.profile') }}</span>
      </span>
      <svg class="my-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
    </NuxtLink>

    <div class="my-groups">
      <nav v-for="group in linkGroups" :key="group.key" class="my-links" :aria-labelledby="`my-group-${group.key}`">
        <h2 :id="`my-group-${group.key}`">{{ t(`page.myTaiko.groups.${group.key}`) }}</h2>
        <div class="my-grid">
          <NuxtLink v-for="item in group.items" :key="item.path" :to="localePath(item.path)" class="my-link">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="item.icon" /></svg>
            <span>{{ t(item.label) }}</span>
          </NuxtLink>
        </div>
      </nav>
    </div>
    <NuxtLink v-if="annualLink" :to="localePath(annualLink.path)" class="my-annual">
      <svg class="my-annual-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v17H5z M8 2v4m8-4v4 M8 10h8m-8 4h5" /></svg>
      <span>{{ t(annualLink.label) }}</span>
      <svg class="my-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
    </NuxtLink>
  </div>
</template>

<style scoped>
.my-page { display:grid; gap:24px; width:100%; max-width:760px; min-width:0; }
.my-page svg { fill:none; stroke:currentColor; stroke-width:1.7; stroke-linecap:round; stroke-linejoin:round; flex-shrink:0; }
.my-profile { display:flex; align-items:center; gap:16px; min-height:96px; padding:8px; margin:-8px; border-radius:10px; color:var(--viewer-text); text-decoration:none; }
.my-avatar { width:64px; height:64px; flex-shrink:0; border-radius:50%; object-fit:cover; background:var(--viewer-surface-subtle); }
.my-profile-info { flex:1; display:flex; flex-direction:column; align-items:flex-start; gap:6px; min-width:0; }
.my-profile-name { font-size:22px; font-weight:700; line-height:1.4; overflow-wrap:anywhere; }
.my-profile-label { font-size:14px; color:var(--viewer-text-muted); line-height:1.5; }
.my-chevron { width:18px; height:18px; margin-left:auto; color:var(--viewer-text-muted); }
.my-status p { margin:0; color:var(--viewer-text-muted); line-height:1.6; }
.my-status { display:flex; align-items:center; flex-wrap:wrap; gap:12px 20px; padding-block:8px 16px; }
.my-status button { display:inline-flex; align-items:center; justify-content:center; min-height:44px; padding:8px 16px; border:1px solid var(--viewer-border); border-radius:10px; color:var(--viewer-link); background:var(--viewer-surface); font:inherit; cursor:pointer; }
.my-groups { display:grid; gap:24px; }
.my-links { min-width:0; border-top:1px solid var(--viewer-border); padding-top:16px; }
.my-links h2 { margin:0 0 12px; font-size:16px; font-weight:600; color:var(--viewer-text); line-height:1.5; }
.my-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; max-width:640px; }
.my-link { display:flex; flex-direction:column; align-items:center; justify-content:flex-start; gap:8px; min-height:88px; box-sizing:border-box; padding:12px 4px; border-radius:8px; color:var(--viewer-text); text-decoration:none; text-align:center; font-size:14px; line-height:1.5; overflow-wrap:anywhere; }
.my-link svg,.my-annual-icon { width:26px; height:26px; color:var(--viewer-link); }
.my-annual { display:flex; align-items:center; gap:12px; min-height:56px; padding:8px; margin-inline:-8px; border-top:1px solid var(--viewer-border); color:var(--viewer-text); text-decoration:none; font-size:15px; line-height:1.5; }
.my-profile:hover,.my-link:hover,.my-annual:hover,.my-profile:active,.my-link:active,.my-annual:active { background:var(--viewer-surface-subtle); }
.my-profile:focus-visible,.my-link:focus-visible,.my-annual:focus-visible,.my-status button:focus-visible { outline:3px solid var(--viewer-link); outline-offset:3px; }
@media(max-width:720px) { .my-page,.my-groups { gap:20px; } .my-profile-name { font-size:20px; } }
@media(max-width:360px) { .my-grid { grid-template-columns:repeat(3,minmax(0,1fr)); } }
@media(max-width:420px) { .my-page:lang(ja) .my-grid { grid-template-columns:repeat(3,minmax(0,1fr)); } }
</style>
