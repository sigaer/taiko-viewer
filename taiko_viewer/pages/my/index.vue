<script setup lang="ts">
import { buildPageDescription } from "~/utils/seo";

const { t } = useI18n();
const localePath = useLocalePath();
const { accountUser, accountAuthStatus, fetchCurrentUser } = useAccountState();
const initialAuth = fetchCurrentUser();
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

const linkGroups = [
  { key: 'practice', items: [
    { path: "/my/growth", label: "passport.title" },
    { path: "/my/weekly", label: "weekly.title" },
    { path: "/tools/recommend", label: "tools.recommend" }
  ] },
  { key: 'scores', items: [
    { path: "/account/songs", label: "account.songs" },
    { path: "/tools/b30", label: "tools.b30" },
    { path: "/tools/progress", label: "tools.progress" },
    { path: "/tools/word-cloud", label: "tools.wordCloud" }
  ] },
  { key: 'account', items: [
    { path: "/account/profile", label: "account.profile" },
    { path: "/account/version-summary", label: "account.versionSummary" }
  ] }
];
</script>

<template>
  <div class="my-page" :data-auth-status="accountAuthStatus">
    <section v-if="accountAuthStatus === 'loading'" class="my-status" role="status" aria-busy="true">
      <p>{{ t('layout.loading') }}</p>
    </section>
    <section v-else-if="accountAuthStatus === 'error'" class="my-status" role="alert">
      <p>{{ t('page.myTaiko.authFailed') }}</p>
      <button type="button" @click="retryAuth">{{ t('home.growth.recent.retry') }}</button>
    </section>
    <section v-else-if="accountAuthStatus === 'guest'" class="my-intro">
      <h2>{{ t("page.myTaiko.guestTitle") }}</h2>
      <p>{{ t("page.myTaiko.guestDesc") }}</p>
      <NuxtLink :to="localePath('/account/login')" class="my-cta">{{ t("page.myTaiko.guestCta") }}</NuxtLink>
    </section>
    <section v-else class="my-intro">
      <h2>{{ t("page.myTaiko.readyTitle", { name: accountUser?.username }) }}</h2>
    </section>

    <div class="my-groups">
      <nav v-for="group in linkGroups" :key="group.key" class="my-links" :aria-labelledby="`my-group-${group.key}`">
        <h2 :id="`my-group-${group.key}`">{{ t(`page.myTaiko.groups.${group.key}`) }}</h2>
        <NuxtLink v-for="item in group.items" :key="item.path" :to="localePath(item.path)" class="my-link"><span>{{ t(item.label) }}</span><span aria-hidden="true">→</span></NuxtLink>
      </nav>
    </div>
  </div>
</template>

<style scoped>
.my-page { display:grid; gap:28px; min-width:0; }
.my-intro { padding-block:4px 16px; }
.my-intro h2 { margin:0 0 8px; color:var(--viewer-text); font-size:22px; overflow-wrap:anywhere; }
.my-intro p,.my-status p { margin:0; color:var(--viewer-text-muted); line-height:1.6; }
.my-status { display:flex; align-items:center; flex-wrap:wrap; gap:12px 20px; padding-block:8px 16px; }
.my-status button,.my-cta { display:inline-flex; align-items:center; justify-content:center; min-height:44px; padding:8px 16px; border:1px solid var(--viewer-border); border-radius:10px; color:var(--viewer-link); background:var(--viewer-surface); font:inherit; cursor:pointer; text-decoration:none; }
.my-cta { margin-top:16px; border-color:transparent; background:var(--viewer-primary); color:var(--viewer-on-primary); }
.my-groups { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:24px; }
.my-links { min-width:0; border-top:1px solid var(--viewer-border); padding-top:16px; }
.my-links h2 { margin:0 0 8px; font-size:16px; color:var(--viewer-text-muted); line-height:1.5; }
.my-link { display:flex; align-items:center; justify-content:space-between; gap:12px; min-height:48px; padding:10px 8px; margin-inline:-8px; border-radius:8px; color:var(--viewer-text); text-decoration:none; font-size:16px; line-height:1.5; overflow-wrap:anywhere; }
.my-link>span:last-child { flex-shrink:0; color:var(--viewer-link); }
.my-link:hover { background:var(--viewer-surface-subtle); color:var(--viewer-link); }
.my-link:focus-visible,.my-status button:focus-visible,.my-cta:focus-visible { outline:3px solid var(--viewer-link); outline-offset:3px; }
@media(max-width:720px) { .my-groups { grid-template-columns:1fr; gap:20px; } .my-page { gap:20px; } }
</style>
