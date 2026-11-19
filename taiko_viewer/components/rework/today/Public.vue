<script setup lang="ts">
// Home while the account state is being resolved (`loading`) or could not be resolved (`public_error`, with the
// stage the resolver reports and the same retry). The public blocks stay usable in both: latest songs, current events,
// the 段位 summary and the public tools — as before.
import type { SongCatalogItem } from "~/types/content";
import { RECOVERY_KEYS, keyOf } from "~/utils/rework/today";

defineProps<{
  presentation: "loading" | "public_error";
  stage?: string | null;
  latestSongs: SongCatalogItem[];
  contentPending?: boolean;
  contentFailed?: boolean;
  events: Array<{ image: string; title: string }>;
}>();
const emit = defineEmits<{ retry: [] }>();
const { t } = useI18n();
</script>

<template>
  <div class="tp home-recovery">
    <h1 class="rw-vh">{{ t("rework.today") }}</h1>
    <ReworkState v-if="presentation === 'loading'" kind="loading" :lines="2" class="tp-status home-account-status" :title="t('layout.loading')" />
    <ReworkState
      v-else
      kind="failed"
      class="tp-status home-account-status"
      :title="t(keyOf(RECOVERY_KEYS, stage, RECOVERY_KEYS.auth))"
      :retry-label="t('home.growth.recent.retry')"
      @retry="emit('retry')"
    />
    <div class="tp-grid">
      <ReworkTodayLatestSongs :songs="latestSongs" :pending="contentPending" :failed="contentFailed" />
      <ReworkTodayEvents :events="events" />
    </div>
    <ReworkTodayDan />
    <ReworkTodayTools />
  </div>
</template>

<style scoped>
.tp {
  display: grid;
  gap: var(--sp-8);
  min-width: 0;
}
.tp-status {
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
}
.tp-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
  gap: var(--sp-8);
  align-items: start;
}
@media (max-width: 1099px) {
  .tp-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
