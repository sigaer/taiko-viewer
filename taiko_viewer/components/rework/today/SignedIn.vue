<script setup lang="ts">
// Home page for a signed-in player (was components/home/AuthenticatedHome.vue). The script is the old one: the home
// state decides between the binding prompt (authenticated_unbound), the sync prompt (authenticated_bound_empty) and
// the growth surface (authenticated_ready); the growth reads, analytics events and links are unchanged.
// Below: latest songs and current events, the 段位 summary; the public tools only while there is no personal data.
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
const { currentBinding } = useHomeState();
const isReady = computed(() => props.state === "authenticated_ready");
const { growth, pending: growthPending, error: growthError, refreshing: overviewRefreshing, refreshError: overviewRefreshError, identity: growthIdentity, refresh: refreshGrowth } = usePlayerGrowth(isReady, userId);
const { recent, pending: recentPending, error: recentError, refresh: refreshRecent, acknowledge: acknowledgeRecent } = useRecentGrowth(isReady, userId);

const displayName = computed(() => props.user?.username || t("account.title"));

onMounted(() => {
  trackViewerEvent("home_view", { home_state: props.state });
  if (isReady.value) trackViewerEvent("home_personal_view", { home_state: props.state });
});

const trackClick = (event: string, source: string) => {
  trackViewerEvent(event, { home_state: props.state, source });
};
</script>

<template>
  <div class="tsi authenticated-home" :data-state="state">
    <template v-if="!isReady">
      <header class="tsi-who">
        <DsPlayerAvatar :key="`${user?.id}:${user?.avatarUrl}`" :src="user?.avatarUrl || ''" :size="44" />
        <span class="tsi-name">{{ displayName }}</span>
        <AccountTitleBadges :titles="user?.titles" />
      </header>
      <h1 class="rw-vh">{{ t("rework.today") }}</h1>
      <ReworkGate
        v-if="state === 'authenticated_unbound'"
        class="tsi-gate personal-onboarding"
        need="binding"
        :title="t('home.personal.unboundTitle')"
        :text="t('home.personal.unboundBody')"
        @primary="trackClick('home_bind_click', 'onboarding')"
      >
        <template #actions>
          <NuxtLink class="rw-btn" :to="localePath('/my')" @click="trackClick('home_personal_scores_click', 'status')">{{ t("home.personal.viewScores") }}</NuxtLink>
        </template>
      </ReworkGate>
      <ReworkState
        v-else
        kind="empty"
        class="tsi-gate personal-onboarding"
        :title="t('home.personal.emptyTitle')"
        :text="t('home.personal.emptyBody')"
      >
        <NuxtLink class="rw-btn rw-btn--primary" :to="localePath('/account/sync')" @click="trackClick('home_sync_click', 'onboarding')">{{ t("home.personal.syncCta") }}</NuxtLink>
        <NuxtLink class="rw-btn" :to="localePath('/my')" @click="trackClick('home_personal_scores_click', 'status')">{{ t("home.personal.viewScores") }}</NuxtLink>
      </ReworkState>
    </template>

    <HomePlayerGrowthSurface
      v-else
      :overview="growth"
      :can-external-sync="!!currentBinding && ['wahlap', 'hiroba'].includes(currentBinding.source)"
      :display-name="displayName"
      :titles="user?.titles"
      :avatar-url="user?.avatarUrl || ''"
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
    >
      <template #latest>
        <ReworkTodayLatestSongs tiles :limit="6" :songs="latestSongs" :pending="contentPending" :failed="contentFailed" />
      </template>
      <template #events><ReworkTodayEvents :events="events" /></template>
    </HomePlayerGrowthSurface>

    <div v-if="!isReady" class="tsi-more">
      <ReworkTodayLatestSongs :songs="latestSongs" :pending="contentPending" :failed="contentFailed" />
      <ReworkTodayEvents :events="events" />
    </div>
    <ReworkTodayDan />
    <ReworkTodayTools v-if="!isReady" />
  </div>
</template>

<style scoped>
.tsi {
  display: grid;
  gap: var(--sp-6);
  min-width: 0;
  color: var(--ink);
  font-family: var(--font-ui);
}
.tsi-who {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--sp-2) var(--sp-3);
  min-width: 0;
  margin-bottom: calc(var(--sp-2) * -1);
}
.tsi-name {
  min-width: 0;
  font-family: var(--font-display);
  font-size: var(--fs-22);
  font-weight: 800;
  letter-spacing: -0.01em;
  overflow-wrap: anywhere;
}
.tsi-gate {
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
}
.tsi-more {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
  gap: var(--sp-5);
  align-items: start;
}
@media (max-width: 1099px) {
  .tsi-more {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 767px) {
  .tsi {
    gap: var(--sp-4);
  }
  .tsi-who {
    margin-bottom: 0;
  }
}
</style>
