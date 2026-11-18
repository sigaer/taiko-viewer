<script setup lang="ts">
// Home page for visitors who are not signed in (was components/home/GuestHome.vue + GuestHero.vue). Frozen layout
// Today.vue (guest): the product line, the song search and the sign-in action on the left, real content on the right
// (latest songs; under the search on phones, so the first screen shows songs and not only a prompt), then the public
// tools, current events with the Bilibili feed, the 段位 summary and what an account adds.
// Every block of the old guest home is kept; analytics events unchanged.
import type { SongCatalogItem } from "~/types/content";
import { trackViewerEvent } from "~/utils/analytics";

const props = defineProps<{
  latestSongs: SongCatalogItem[];
  contentPending?: boolean;
  contentFailed?: boolean;
  accountStatusUnavailable?: boolean;
  events: Array<{ image: string; title: string }>;
}>();

const { t } = useI18n();
const localePath = useLocalePath();
const runtimeConfig = useRuntimeConfig();
const appVersion = String(runtimeConfig.public.appVersion || "").trim() || "dev";
const homeState = computed(() => (props.accountStatusUnavailable ? "error" : "guest"));

onMounted(() => {
  trackViewerEvent("home_view", { home_state: homeState.value });
});
</script>

<template>
  <div class="tg guest-home">
    <p v-if="accountStatusUnavailable" class="rw-note tg-note" role="status">{{ t("page.home.guest.accountStatusUnavailable") }}</p>
    <div class="tg-top">
      <section class="tg-hero guest-hero" aria-labelledby="guest-home-title">
        <p class="tg-brand">Sakura Taiko Viewer <span class="num">v{{ appVersion }}</span></p>
        <h1 id="guest-home-title" class="tg-title">{{ t("page.home.guest.heroTitle") }}</h1>
        <p class="tg-lead">{{ t("page.home.guest.heroDescription") }}</p>
        <ReworkTodaySongSearch />
        <div class="tg-actions">
          <NuxtLink
            :to="localePath('/account/login')"
            class="rw-btn rw-btn--primary tg-btn"
            @click="trackViewerEvent('home_account_value_click', { home_state: homeState, source: 'hero' })"
          >{{ t("page.home.guest.accountCta") }}</NuxtLink>
          <NuxtLink
            :to="localePath('/songs')"
            class="rw-btn tg-btn"
            @click="trackViewerEvent('home_browse_songs_click', { home_state: homeState, source: 'hero' })"
          >{{ t("page.home.guest.browseSongs") }}</NuxtLink>
        </div>
        <p class="tg-scope">{{ t("page.home.guest.scope") }}</p>
      </section>
      <ReworkTodayLatestSongs class="tg-latest" :songs="latestSongs" :pending="contentPending" :failed="contentFailed" />
    </div>
    <ReworkTodayTools />
    <div class="tg-duo">
      <ReworkTodayEvents :events="events" />
      <ReworkTodayDan />
    </div>
    <ReworkTodayAccountValue :account-status-unavailable="accountStatusUnavailable" />
  </div>
</template>

<style scoped>
.tg {
  display: grid;
  gap: var(--sp-10);
  min-width: 0;
  color: var(--ink);
  font-family: var(--font-ui);
}
.tg-top {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  gap: var(--sp-12);
  align-items: start;
  padding-top: var(--sp-4);
}
.tg-hero {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  min-width: 0;
}
.tg-brand {
  margin: 0;
  color: var(--ink-3);
  font-size: var(--fs-12);
  font-weight: 600;
  letter-spacing: 0.06em;
}
.tg-title {
  margin: 0;
  font-size: clamp(1.75rem, 3.2vw, 2.75rem);
  font-weight: 900;
  line-height: var(--lh-tight);
  text-wrap: balance;
}
.tg-lead {
  margin: 0;
  max-width: 34em;
  color: var(--ink-2);
  font-size: var(--fs-16);
  line-height: var(--lh-body);
}
.tg-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}
.tg-btn {
  min-height: var(--ctl-h-lg);
  padding-inline: var(--btn-pad-x-lg);
  font-size: var(--fs-16);
}
.tg-scope {
  margin: 0;
  color: var(--ink-3);
  font-size: var(--fs-12);
}
.tg-latest {
  min-width: 0;
}
.tg-duo {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: var(--sp-8);
  align-items: start;
}
@media (max-width: 1239px) {
  .tg-top {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--sp-8);
  }
}
@media (max-width: 1099px) {
  .tg-duo {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 767px) {
  .tg {
    gap: var(--sp-8);
  }
  .tg-top {
    padding-top: 0;
    gap: var(--sp-6);
  }
  .tg-hero {
    gap: var(--sp-3);
  }
  .tg-title {
    font-size: var(--fs-22);
  }
  .tg-lead {
    font-size: var(--fs-14);
  }
  .tg-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  .tg-btn {
    min-height: var(--hit);
    padding-inline: var(--sp-3);
    font-size: var(--fs-14);
    white-space: normal;
    text-align: center;
  }
  .tg-scope {
    display: none;
  }
}
</style>
