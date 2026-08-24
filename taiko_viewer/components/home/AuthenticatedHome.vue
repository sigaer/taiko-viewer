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
const { rating, ratingPending, ratingError, recommendations, recommendationsPending, recommendationsError } =
  usePersonalHome(isReady, userId);

const displayName = computed(() => props.user?.username || t("account.title"));
const recommendation = computed(() => recommendations.value.items[0] || null);
const recommendationTitle = computed(() => {
  if (!recommendation.value) return "";
  return recommendation.value.title || t("home.personal.recommendationSong");
});
const formatRating = computed(() =>
  rating.value.current === null ? "" : rating.value.current.toFixed(2)
);
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
      </div>
    </section>

    <section v-else class="personal-top" aria-labelledby="personal-home-title">
      <div class="personal-status panel-card">
        <div class="personal-status__topline">
          <p class="personal-eyebrow">{{ t("home.personal.eyebrow") }}</p>
          <span class="personal-status__dot" aria-hidden="true"></span>
        </div>
        <h1 id="personal-home-title">{{ t("home.personal.title") }}</h1>
        <p class="personal-greeting">{{ t("home.personal.greeting", { name: displayName }) }}</p>
        <div class="personal-rating" :class="{ 'personal-rating--loading': ratingPending }" aria-live="polite">
          <span>{{ t("home.personal.rating") }}</span>
          <strong v-if="ratingPending">—</strong>
          <strong v-else-if="formatRating">{{ formatRating }}</strong>
          <strong v-else>{{ t("home.personal.connected") }}</strong>
          <small v-if="!ratingPending && formatRating">{{ t("home.personal.ratingUpdated") }}</small>
          <small v-else-if="!ratingPending && ratingError">{{ t("home.personal.summaryUnavailable") }}</small>
        </div>
        <NuxtLink
          :to="localePath('/my')"
          class="personal-button personal-button--primary"
          @click="trackClick('home_personal_scores_click', 'status')"
        >
          {{ t("home.personal.viewScores") }}
          <span aria-hidden="true">→</span>
        </NuxtLink>
      </div>

      <section class="recommendation-card panel-card" aria-labelledby="recommendation-title">
        <div class="recommendation-card__heading">
          <div>
            <p class="personal-eyebrow">{{ t("home.personal.recommendationEyebrow") }}</p>
            <h2 id="recommendation-title">{{ t("home.personal.recommendationTitle") }}</h2>
          </div>
          <span class="recommendation-card__beat" aria-hidden="true">●</span>
        </div>
        <div v-if="recommendationsPending" class="recommendation-card__loading shimmer-card" aria-busy="true"></div>
        <template v-else-if="recommendation">
          <NuxtLink
            :to="localePath(`/songs/${recommendation.song_id}`)"
            class="recommendation-card__song"
            @click="trackClick('home_recommendation_click', 'spotlight')"
          >
            <div class="recommendation-card__cover">
              <SongCoverImage
                :song-id="recommendation.song_id"
                :alt="recommendationTitle"
                sizes="(max-width: 720px) 112px, 160px"
                :priority="true"
                fit="contain"
              />
            </div>
            <div class="recommendation-card__details">
              <strong>{{ recommendationTitle }}</strong>
              <span>{{ t("home.personal.level", { level: recommendation.level }) }}</span>
              <small v-if="recommendation.is_unplayed">{{ t("home.personal.newToYou") }}</small>
              <small v-else>{{ t("home.personal.keepPlaying") }}</small>
            </div>
            <span class="recommendation-card__arrow" aria-hidden="true">↗</span>
          </NuxtLink>
          <NuxtLink
            :to="localePath(`/songs/${recommendation.song_id}`)"
            class="personal-button personal-button--secondary"
            @click="trackClick('home_recommendation_click', 'cta')"
          >
            {{ t("home.personal.viewSong") }}
            <span aria-hidden="true">→</span>
          </NuxtLink>
        </template>
        <div v-else class="recommendation-card__empty">
          <p>{{ recommendationsError ? t("home.personal.recommendationUnavailable") : t("home.personal.noRecommendation") }}</p>
          <NuxtLink :to="localePath('/tools/recommend')" class="personal-button personal-button--secondary">
            {{ t("home.personal.openRecommendationTool") }}
          </NuxtLink>
        </div>
      </section>
    </section>

    <HomeLatestSongs :songs="latestSongs" :pending="contentPending" :failed="contentFailed" />
    <HomeCurrentEvents :events="events" />
    <HomeDanSummary />
    <HomePublicTools v-if="!isReady" />
  </div>
</template>

<style scoped>
.authenticated-home {
  --personal-ink: #342922;
  --personal-muted: #806b5c;
  --personal-accent: #b84d37;
  --personal-accent-soft: #f6dfd4;
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
  border: 1px solid rgba(151, 105, 73, 0.18);
  border-radius: 24px;
  background: linear-gradient(135deg, rgba(255, 252, 247, 0.98), rgba(248, 235, 225, 0.92));
  box-shadow: 0 20px 44px rgba(104, 70, 45, 0.1);
}

.personal-status {
  display: grid;
  align-content: space-between;
  gap: 18px;
  min-height: 330px;
  padding: clamp(22px, 4vw, 38px);
}

.personal-status__topline,
.recommendation-card__heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.personal-eyebrow {
  margin: 0;
  color: var(--personal-accent);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.personal-status h1,
.recommendation-card h2,
.personal-onboarding h1 {
  margin: 0;
  color: var(--personal-ink);
  font-family: var(--viewer-display-font);
  line-height: 1.1;
}

.personal-status h1 { font-size: clamp(24px, 3vw, 34px); }
.recommendation-card h2 { font-size: clamp(22px, 2.5vw, 30px); }
.personal-greeting { margin: -8px 0 0; color: var(--personal-muted); font-size: 15px; }
.personal-status__dot,
.recommendation-card__beat { width: 14px; height: 14px; border-radius: 50%; background: var(--personal-accent); box-shadow: 0 0 0 7px rgba(184, 77, 55, 0.12); }
.recommendation-card__beat { color: var(--personal-accent); font-size: 12px; line-height: 14px; text-align: center; box-shadow: none; }

.personal-rating { display: grid; gap: 4px; }
.personal-rating span { color: var(--personal-muted); font-size: 13px; font-weight: 700; }
.personal-rating strong { color: var(--personal-ink); font: 800 clamp(40px, 6vw, 66px)/0.95 var(--viewer-display-font); letter-spacing: -0.04em; }
.personal-rating small { color: var(--personal-muted); font-size: 12px; }

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
.personal-button:focus-visible { outline: 3px solid #d18366; outline-offset: 3px; }
.personal-button--primary { color: #fff; background: var(--personal-accent); box-shadow: 0 9px 18px rgba(184, 77, 55, 0.2); }
.personal-button--secondary { color: var(--personal-accent); border: 1px solid rgba(184, 77, 55, 0.28); background: rgba(255, 255, 255, 0.66); }

.recommendation-card { display: grid; align-content: space-between; gap: 20px; min-height: 330px; padding: clamp(20px, 3.5vw, 32px); }
.recommendation-card__song { min-width: 0; display: grid; grid-template-columns: 132px minmax(0, 1fr) auto; align-items: center; gap: 18px; color: inherit; text-decoration: none; }
.recommendation-card__cover { aspect-ratio: 1; overflow: hidden; border-radius: 18px; background: linear-gradient(145deg, #fff, var(--personal-accent-soft)); box-shadow: 0 12px 25px rgba(104, 70, 45, 0.14); }
.recommendation-card__details { min-width: 0; display: grid; gap: 8px; }
.recommendation-card__details strong { overflow: hidden; color: var(--personal-ink); font-size: clamp(17px, 2vw, 24px); line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }
.recommendation-card__details span { color: var(--personal-accent); font-size: 14px; font-weight: 800; }
.recommendation-card__details small { color: var(--personal-muted); font-size: 12px; }
.recommendation-card__arrow { color: var(--personal-accent); font-size: 26px; }
.recommendation-card__loading { min-height: 170px; border-radius: 18px; }
.recommendation-card__empty { display: grid; align-content: center; justify-items: start; gap: 14px; min-height: 170px; color: var(--personal-muted); }
.recommendation-card__empty p { margin: 0; }

.personal-onboarding { display: grid; grid-template-columns: 104px minmax(0, 1fr); align-items: center; gap: 24px; padding: clamp(24px, 5vw, 48px); }
.personal-onboarding__mark { width: 86px; height: 86px; display: grid; grid-template-columns: 1fr 1fr; overflow: hidden; border: 6px solid #fff; border-radius: 50%; background: var(--personal-accent); box-shadow: 0 12px 25px rgba(104, 70, 45, 0.16); }
.personal-onboarding__mark span:first-child { background: #d8785d; }
.personal-onboarding__mark span:last-child { background: #8c3f37; }
.personal-onboarding__copy { display: grid; gap: 10px; }
.personal-onboarding h1 { font-size: clamp(26px, 4vw, 42px); }
.personal-onboarding p:not(.personal-eyebrow) { max-width: 540px; margin: 0 0 4px; color: var(--personal-muted); line-height: 1.65; }

:global(body.theme-dark .authenticated-home) { --personal-ink: #f5e7dc; --personal-muted: #c6b3a5; --personal-accent: #e58b6e; --personal-accent-soft: #493128; }
:global(body.theme-dark .personal-status),
:global(body.theme-dark .recommendation-card),
:global(body.theme-dark .personal-onboarding) { border-color: rgba(255, 255, 255, 0.12); background: linear-gradient(135deg, rgba(46, 35, 29, 0.98), rgba(54, 38, 31, 0.94)); }
:global(body.theme-dark .personal-button--secondary) { background: rgba(48, 36, 30, 0.8); }

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
