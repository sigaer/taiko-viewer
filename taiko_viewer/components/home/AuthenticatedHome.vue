<script setup lang="ts">
import type { AccountAuthUser } from "~/composables/useAccountAuthStatus";
import type { HomeState } from "~/utils/homeState";
import type { SongCatalogItem } from "~/types/content";
import { trackViewerEvent } from "~/utils/analytics";

const props = defineProps<{
  state: Exclude<HomeState, "guest">;
  user: AccountAuthUser | null;
  latestSongs: SongCatalogItem[];
  contentPending?: boolean;
  contentFailed?: boolean;
  events: Array<{ image: string; title: string }>;
}>();

const { t } = useI18n();
const localePath = useLocalePath();
const userId = computed(() => props.user?.id || null);
const isReady = computed(() => props.state === "authenticated_ready");
const { growth, pending: growthPending, error: growthError, refreshing: overviewRefreshing, refreshError: overviewRefreshError, identity: growthIdentity, refresh: refreshGrowth } = usePlayerGrowth(isReady, userId);
const { recent, pending: recentPending, error: recentError, refresh: refreshRecent, acknowledge: acknowledgeRecent } = useRecentGrowth(isReady, userId);

const displayName = computed(() => props.user?.username || t("account.title"));
const stateCopy = computed(() => {
  if (props.state === "authenticated_unbound") {
    return {
      title: t("home.personal.unboundTitle"),
      body: t("home.personal.unboundBody"),
      cta: t("home.personal.bindCta"),
      to: "/account/profile"
    };
  }
  if (props.state === "authenticated_bound_empty") {
    return {
      title: t("home.personal.emptyTitle"),
      body: t("home.personal.emptyBody"),
      cta: t("home.personal.syncCta"),
      to: "/account/sync"
    };
  }
  return null;
});

onMounted(() => {
  trackViewerEvent("home_view", { home_state: props.state });
  if (isReady.value) trackViewerEvent("home_personal_view", { home_state: props.state });
});

const trackClick = (event: string, source: string) => {
  trackViewerEvent(event, { home_state: props.state, source });
};
</script>

<template>
  <div class="authenticated-home">
    <section v-if="stateCopy" class="personal-onboarding" aria-labelledby="personal-onboarding-title">
      <div class="personal-onboarding__mark" aria-hidden="true"><span></span><span></span></div>
      <div class="personal-onboarding__copy">
        <p class="personal-eyebrow">{{ t("home.personal.eyebrow") }}</p>
        <h1 id="personal-onboarding-title">{{ stateCopy.title }}</h1>
        <p>{{ stateCopy.body }}</p>
        <NuxtLink
          :to="localePath(stateCopy.to)"
          class="personal-button personal-button--primary"
          @click="trackClick(props.state === 'authenticated_unbound' ? 'home_bind_click' : 'home_sync_click', 'onboarding')"
        >
          {{ stateCopy.cta }}
          <span aria-hidden="true">→</span>
        </NuxtLink>
        <NuxtLink class="personal-button personal-button--secondary" :to="localePath('/my')" @click="trackClick('home_personal_scores_click', 'status')">{{ t('home.personal.viewScores') }}</NuxtLink>
      </div>
    </section>

    <HomePlayerGrowthSurface
      v-if="isReady"
      :overview="growth"
      :display-name="displayName"
      :pending="growthPending"
      :failed="!!growthError"
      :overview-refreshing="overviewRefreshing"
      :overview-refresh-failed="!!overviewRefreshError"
      :identity="growthIdentity"
      :refresh-growth="refreshGrowth"
      :recent="recent"
      :recent-pending="recentPending"
      :recent-failed="!!recentError"
      :refresh-recent="refreshRecent"
      :acknowledge-recent="acknowledgeRecent"
    />

    <section v-else-if="!stateCopy" class="personal-top" aria-labelledby="personal-home-title">
      <div class="personal-status panel-card">
        <p class="personal-eyebrow">{{ t("home.personal.eyebrow") }}</p>
        <h1 id="personal-home-title">{{ t("home.personal.greeting", { name: displayName }) }}</h1>
        <NuxtLink
          :to="localePath('/my')"
          class="personal-button personal-button--secondary"
          @click="trackClick('home_personal_scores_click', 'status')"
        >
          {{ t("home.personal.viewScores") }}
          <span aria-hidden="true">→</span>
        </NuxtLink>
      </div>

    </section>

    <HomeLatestSongs :songs="latestSongs" :pending="contentPending" :failed="contentFailed" />
    <HomeCurrentEvents :events="events" />
    <HomeDanSummary />
    <HomePublicTools v-if="!isReady" />
  </div>
</template>

<style scoped>
.authenticated-home {
  --personal-ink:var(--viewer-text);
  --personal-muted: var(--viewer-text-muted);
  --personal-accent: var(--viewer-primary);
  --personal-accent-soft:var(--viewer-selected);
  display: grid;
  gap: clamp(28px, 4.5vw, 52px);
}

.personal-top {
  display: grid;
  grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
  gap: 16px;
  align-items: stretch;
}

.personal-status,
.recommendation-card,
.personal-onboarding {
  border: 1px solid var(--viewer-border);
  border-radius: 24px;
  background:var(--viewer-surface-subtle);
  box-shadow:none;
}

.personal-status {
  display: grid;
  align-content: space-between;
  gap: 18px;
  min-height: 330px;
  padding: clamp(22px, 4vw, 38px);
}

.recommendation-card__heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.personal-eyebrow {
  margin: 0;
  color:var(--personal-accent);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.personal-status h1,
.recommendation-card h2,
.personal-onboarding h1 {
  margin: 0;
  color:var(--personal-ink);
  font-family: var(--viewer-display-font);
  line-height: 1.1;
}

.personal-status h1 {
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: clamp(24px, 3vw, 34px);
}
.recommendation-card h2 { font-size: clamp(22px, 2.5vw, 30px); }

.personal-rating { display: grid; gap: 4px; }
.personal-rating span { color:var(--personal-muted); font-size: 13px; font-weight: 700; }
.personal-rating strong { color:var(--personal-ink); font: 800 clamp(40px, 6vw, 66px)/0.95 var(--viewer-display-font); letter-spacing: -0.04em; }
.personal-rating small { color:var(--personal-muted); font-size: 12px; }

.personal-button {
  width: fit-content;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 0 16px;
  border-radius: 12px;
  text-decoration: none;
  font-size: 13px;
  font-weight: 800;
  transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}
.personal-button:hover { transform: translateY(-2px); }
.personal-button:focus-visible { outline: 3px solid var(--viewer-link); outline-offset: 3px; }
.personal-button--primary { color:var(--viewer-on-primary); background:var(--personal-accent); box-shadow:none; }
.personal-button--secondary { color:var(--personal-accent); border: 1px solid var(--viewer-border); background:var(--viewer-surface-subtle); }

.recommendation-card { display: grid; align-content: space-between; gap: 20px; min-height: 330px; padding: clamp(20px, 3.5vw, 32px); }
.recommendation-card__song { min-width: 0; display: grid; grid-template-columns: 132px minmax(0, 1fr) auto; align-items: center; gap: 18px; color:inherit; text-decoration: none; }
.recommendation-card__cover { aspect-ratio: 1; overflow: hidden; border-radius: 18px; background:linear-gradient(145deg, var(--viewer-surface), var(--personal-accent-soft)); box-shadow:none; }
.recommendation-card__details { min-width: 0; display: grid; gap: 8px; }
.recommendation-card__details strong {
  display: -webkit-box;
  overflow: hidden;
  color:var(--personal-ink);
  font-size: clamp(17px, 2vw, 24px);
  line-height: 1.25;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}
.recommendation-card__details span { color:var(--personal-accent); font-size: 14px; font-weight: 800; }
.recommendation-card__arrow { color:var(--personal-accent); font-size: 26px; }
.recommendation-card__loading { min-height: 170px; border-radius: 18px; }

.personal-onboarding { display: grid; grid-template-columns: 104px minmax(0, 1fr); align-items: center; gap: 24px; padding: clamp(24px, 5vw, 48px); }
.personal-onboarding__mark { width: 86px; height: 86px; display: grid; grid-template-columns: 1fr 1fr; overflow: hidden; border: 6px solid var(--viewer-surface); border-radius: 50%; background:var(--personal-accent); box-shadow:none; }
.personal-onboarding__mark span:first-child { background:var(--viewer-primary); }
.personal-onboarding__mark span:last-child { background:var(--viewer-primary-hover); }
.personal-onboarding__copy { display: grid; gap: 10px; }
.personal-onboarding h1 { font-size: clamp(26px, 4vw, 42px); }
.personal-onboarding p:not(.personal-eyebrow) { max-width: 540px; margin: 0 0 4px; color:var(--personal-muted); line-height: 1.65; }

:global(body.theme-dark .authenticated-home) {
  --personal-ink:var(--viewer-text);
  --personal-muted: var(--viewer-text-muted);
  --personal-accent: var(--viewer-primary);
  --personal-accent-soft:var(--viewer-selected);





}
:global(body.theme-dark .personal-status),
:global(body.theme-dark .recommendation-card),
:global(body.theme-dark .personal-onboarding) { border-color:var(--viewer-border); background:var(--viewer-surface-subtle); }
:global(body.theme-dark .personal-button--secondary) { background:var(--viewer-surface-subtle); }

@media (max-width: 820px) {
  .personal-top { grid-template-columns: 1fr; }
  .personal-status, .recommendation-card { min-height: 0; }
}

@media (max-width: 520px) {
  .personal-onboarding { grid-template-columns: 1fr; gap: 16px; padding: 22px; }
  .personal-onboarding__mark { width: 62px; height: 62px; border-width: 4px; }
  .personal-status, .recommendation-card { padding: 20px; border-radius: 20px; }
  .recommendation-card__song { grid-template-columns: 104px minmax(0, 1fr); gap: 14px; }
  .recommendation-card__arrow { display: none; }
  .recommendation-card__cover { border-radius: 14px; }
  .personal-button { width: 100%; }
}

@media (prefers-reduced-motion: reduce) {
  .personal-button { transition: none; }
  .personal-button:hover { transform: none; }
}
</style>
