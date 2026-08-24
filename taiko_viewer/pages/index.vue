<script setup lang="ts">
import { computed } from "vue";
import { useAccountAuthStatus } from "~/composables/useAccountAuthStatus";
import { buildPageDescription } from "~/utils/seo";
import { resolveHomePresentation } from "~/utils/homePresentation";

const { t } = useI18n();
const { data: homeContent, pending, error } = await useHomeContent();
const { accountUser } = useAccountAuthStatus();
const homeStateResolver = useHomeState();
await homeStateResolver.resolve();
const homeState = homeStateResolver.homeState;
const homeStateStatus = homeStateResolver.status;
const homePresentation = computed(() =>
  resolveHomePresentation(homeStateStatus.value, homeState.value)
);
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
    <HomeGuestHome
      v-if="homePresentation === 'guest' || homePresentation === 'public_error'"
      :latest-songs="latestSongs"
      :content-pending="pending"
      :content-failed="!!error"
      :account-status-unavailable="homePresentation === 'public_error'"
      :events="eventSlides"
    />

    <section v-else-if="homePresentation === 'loading'" class="home-neutral-loading" aria-live="polite">
      <div class="home-neutral-loading__hero shimmer-card"></div>
      <div class="home-neutral-loading__rail">
        <div v-for="index in 4" :key="index" class="shimmer-card"></div>
      </div>
      <span class="sr-only">{{ t("layout.loading") }}</span>
    </section>

    <HomeAuthenticatedHome
      v-else
      :state="homeState || 'authenticated_unbound'"
      :user="accountUser"
      :latest-songs="latestSongs"
      :content-pending="pending"
      :content-failed="!!error"
      :events="eventSlides"
    />
  </div>
</template>

<style scoped>
.home-page { display: grid; gap: 16px; }
.home-neutral-loading { display: grid; gap: 18px; }
.home-neutral-loading__hero { min-height: 360px; border-radius: 26px; }
.home-neutral-loading__rail { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.home-neutral-loading__rail > div { min-height: 220px; border-radius: 18px; }
@media (max-width: 720px) {
  .home-neutral-loading__hero { min-height: 270px; }
  .home-neutral-loading__rail { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .home-neutral-loading__rail > div { min-height: 150px; }
}
</style>
