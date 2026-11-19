<script setup lang="ts">
// Songs of a current next action (growth page "想继续的话", weekly page "当前建议"): the todayPlan items the API
// returned, each linked to the chart (cover, title, difficulty and star).
import type { GrowthPlanItem } from "~/types/player-growth";

defineProps<{ items: GrowthPlanItem[] }>();
const localePath = useLocalePath();
</script>

<template>
  <ul class="gs">
    <li v-for="item in items" :key="`${item.songId}-${item.difficultyType}`">
      <NuxtLink class="gs-row" :to="localePath({ path: `/songs/${item.songId}`, query: { difficulty: String(item.difficultyType) } })">
        <DsSongCell :song-id="item.songId" :title="item.title" :difficulty="item.difficultyType" :star="item.starLevel" :show-constant="false" />
        <ReworkIcon name="forward" class="gs-go" />
      </NuxtLink>
    </li>
  </ul>
</template>

<style scoped>
.gs {
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--line-strong);
}
.gs-row {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  min-height: var(--hit);
  padding: var(--sp-2) 0;
  border-bottom: 1px solid var(--line);
  color: var(--ink);
  text-decoration: none;
}
.gs-row > :first-child {
  flex: 1;
  min-width: 0;
}
.gs-row:hover :deep(strong) {
  color: var(--link);
}
.gs-row:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
  border-radius: var(--r-xs);
}
.gs-go {
  width: 18px;
  height: 18px;
  color: var(--ink-3);
}
</style>
