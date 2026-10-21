<script setup lang="ts">
import inputs from './completion-inputs.json';
import type { PlayerGrowthOverview, RecentGrowthResponse } from '~/types/player-growth';
import type { SongCatalogItem } from '~/types/content';
definePageMeta({ hidePageHeader: true, navKey: '/' });
const route = useRoute();
const state = computed(() => String(route.query.state || 'changes'));
const fixture = computed(() => inputs.states[state.value as keyof typeof inputs.states] || inputs.states.changes);
const overview = computed(() => {
  const value = JSON.parse(JSON.stringify(fixture.value.overview)) as PlayerGrowthOverview;
  if (state.value === 'no-recommendations') value.todayPlan.items = [];
  return value;
});
const recent = computed(() => {
  const value = JSON.parse(JSON.stringify(fixture.value.recent)) as RecentGrowthResponse;
  if (state.value === 'recent-unknown') value.state = 'unavailable';
  return value;
});
const latestSongs = inputs.latestSongs as unknown as SongCatalogItem[];
const noop = async () => false;
</script>
<template>
  <div style="display:grid;gap:32px">
    <HomePlayerGrowthSurface :overview="overview" :recent="recent" display-name="预览鼓众" identity="completion-fixture:1"
      :pending="state === 'daily-loading'" :failed="state === 'daily-failed'"
      :recent-pending="state === 'recent-loading'" :recent-failed="state === 'recent-failed'"
      :refresh-growth="noop" :refresh-recent="noop" :acknowledge-recent="async () => {}" />
    <HomeLatestSongs :songs="latestSongs" :pending="state === 'latest-loading'" />
  </div>
</template>
