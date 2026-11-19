<script setup lang="ts">
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

onMounted(() => {
  trackViewerEvent("home_view", {
    home_state: props.accountStatusUnavailable ? "error" : "guest"
  });
});
</script>

<template>
  <div class="guest-home">
    <el-alert
      v-if="accountStatusUnavailable"
      :title="t('page.home.guest.accountStatusUnavailable')"
      type="warning"
      :closable="false"
      show-icon
      class="viewer-friendly-alert"
    />
    <HomeGuestHero :account-status-unavailable="accountStatusUnavailable" />
    <HomeLatestSongs
      :songs="latestSongs"
      :pending="contentPending"
      :failed="contentFailed"
    />
    <HomeCurrentEvents :events="events" />
    <HomeDanSummary />
    <HomePublicTools />
    <HomeAccountValue :account-status-unavailable="accountStatusUnavailable" />
  </div>
</template>

<style scoped>
.guest-home {
  display: grid;
  gap: clamp(28px, 4.5vw, 52px);
}



@media (max-width: 720px) {
  .guest-home {
    gap: 30px;
  }
}
</style>
