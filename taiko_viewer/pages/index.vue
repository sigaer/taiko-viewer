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
  hidePageHeader: true,
  reworkElementPlus: true,
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
    <div class="home-annual"><AnnualHero /></div>
    <ReworkTodayGuest
      v-if="homePresentation === 'guest'"
      :latest-songs="latestSongs"
      :content-pending="pending"
      :content-failed="!!error"
      :account-status-unavailable="homePresentation === 'public_error'"
      :events="eventSlides"
    />
    <ReworkTodayPublic
      v-else-if="homePresentation === 'loading' || homePresentation === 'public_error'"
      :presentation="homePresentation"
      :stage="homeStateResolver.error.value?.stage || null"
      :latest-songs="latestSongs"
      :content-pending="pending"
      :content-failed="!!error"
      :events="eventSlides"
      @retry="homeStateResolver.refresh()"
    />
    <ReworkTodaySignedIn
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
.home-page { display: grid; gap: 24px; width: 100%; min-width: 0; }
.home-annual { width: 100%; max-width: 612px; }
</style>
