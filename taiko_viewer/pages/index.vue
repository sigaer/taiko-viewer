<script setup lang="ts">
import { computed } from "vue";
import { useAccountAuthStatus } from "~/composables/useAccountAuthStatus";
import { buildPageDescription } from "~/utils/seo";
import { resolveHomePresentation } from "~/utils/homePresentation";

const { t } = useI18n();
const { data: homeContent, pending, error } = useHomeContent();
const { accountUser } = useAccountAuthStatus();
const homeStateResolver = useHomeState();
const initialState = homeStateResolver.resolve();
if (import.meta.server) await initialState;
const homeActive = ref(true);
watch(homeStateResolver.revision, () => { if (homeActive.value) void homeStateResolver.resolve(); });
onDeactivated(() => { homeActive.value = false; homeStateResolver.suspend(); });
onActivated(() => { homeActive.value = true; void homeStateResolver.resolve(); });
const homeState = homeStateResolver.homeState;
const homeStateStatus = homeStateResolver.status;
const homePresentation = computed(() =>
  resolveHomePresentation(homeStateStatus.value, homeState.value)
);
const authenticatedHomeState = computed(() => {
  if (homeState.value === "authenticated_bound_empty" || homeState.value === "authenticated_ready") {
    return homeState.value;
  }
  return "authenticated_unbound";
});
const latestSongs = computed(() => homeContent.value.latestSongs || []);
const eventSlides = computed(() => [
  { image: "/optimized/2026-autumn-800.webp", title: t("page.home.eventAutumn") },
  { image: "/optimized/huali-esports-800.webp", title: t("page.home.eventHualiEsports") }
]);

definePageMeta({
  pageTitleKey: "site.homeTitle",
  pageDescKey: "page.home.desc",
  navKey: "/",
  breadcrumbs: [{ labelKey: "nav.home", to: "/" }]
});

useViewerSeo(() => ({
  title: t("site.homeTitle"),
  description: buildPageDescription(t("page.home.desc")),
  path: "/",
  siteSchema: true,
  keywords: [t("site.homeTitle"), "Taiko Viewer", t("home.latestSongs")]
}));
</script>

<template>
  <div
    class="home-page"
    :data-home-state="homeState || undefined"
    :data-home-state-status="homeStateStatus"
    :data-home-presentation="homePresentation"
  >
    <AnnualHero />
    <HomeGuestHome
      v-if="homePresentation === 'guest'"
      :latest-songs="latestSongs"
      :content-pending="pending"
      :content-failed="!!error"
      :account-status-unavailable="homePresentation === 'public_error'"
      :events="eventSlides"
    />

    <div v-else-if="homePresentation === 'loading' || homePresentation === 'public_error'" class="home-recovery">
      <section class="home-account-status" :role="homePresentation === 'public_error' ? 'alert' : 'status'" :aria-busy="homePresentation === 'loading'">
        <p>{{ homePresentation === 'loading' ? t('layout.loading') : t(`home.recovery.${homeStateResolver.error.value?.stage || 'auth'}`) }}</p>
        <button v-if="homePresentation === 'public_error'" type="button" @click="homeStateResolver.refresh()">{{ t('home.growth.recent.retry') }}</button>
      </section>
      <HomeLatestSongs :songs="latestSongs" :pending="pending" :failed="!!error" />
      <HomeCurrentEvents :events="eventSlides" />
      <HomeDanSummary />
      <HomePublicTools />
    </div>

    <HomeAuthenticatedHome
      v-else
      :state="authenticatedHomeState"
      :user="accountUser"
      :latest-songs="latestSongs"
      :content-pending="pending"
      :content-failed="!!error"
      :events="eventSlides"
    />
  </div>
</template>

<style scoped>
.home-page { display: grid; gap: 16px; width: 100%; min-width: 0;  }
.home-recovery { display:grid; gap:var(--viewer-space-group); min-width:0; }
.home-account-status { display:flex; flex-wrap:wrap; gap:12px 20px; align-items:center; padding:16px 0; border-bottom:1px solid var(--viewer-border); }
.home-account-status p { margin:0; color:var(--viewer-text-muted); }
.home-account-status button { min-height:44px; padding:8px 16px; border:1px solid var(--viewer-border); border-radius:10px; background:var(--viewer-surface); color:var(--viewer-link); font:inherit; cursor:pointer; }
.home-account-status button:focus-visible { outline:3px solid var(--viewer-link); outline-offset:3px; }
</style>
