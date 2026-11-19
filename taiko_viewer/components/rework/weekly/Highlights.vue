<script setup lang="ts">
// Highlights of the week (/api/account/growth/weekly highlights, in the server's order): the change line built by
// the page, the chart (cover, title, difficulty) linked to the song, a crown with its name or the ranks with their
// names for crown / rank highlights, and "the goal was completed too".
import type { WeeklyGrowthHighlight } from "~/types/player-growth";
import { difficultyLabelKey } from "~/utils/difficulty";
import { factCrown, rankValue } from "~/utils/rework/today";

defineProps<{ items: WeeklyGrowthHighlight[]; change: (highlight: WeeklyGrowthHighlight) => string }>();
const { t } = useI18n();
const localePath = useLocalePath();
const to = (h: WeeklyGrowthHighlight) => localePath({ path: `/songs/${h.songId}`, query: { difficulty: String(h.difficultyType) } });
</script>

<template>
  <ol class="wl">
    <li v-for="highlight in items" :key="highlight.id" class="wl-item weekly-highlight">
      <NuxtLink :to="to(highlight)" class="wl-cover weekly-highlight__cover" tabindex="-1" aria-hidden="true">
        <DsCover :song-id="highlight.songId" size="md" />
      </NuxtLink>
      <div class="wl-body weekly-highlight__body">
        <p class="wl-change weekly-highlight__change">{{ change(highlight) }}</p>
        <NuxtLink :to="to(highlight)" class="rw-link wl-name">{{ highlight.title }}</NuxtLink>
        <span class="wl-meta">
          <span>{{ t(difficultyLabelKey(highlight.difficultyType)) }}</span>
          <DsCrown v-if="factCrown(highlight.primaryType)" :state="factCrown(highlight.primaryType)!" size="sm" text="full" />
          <span v-else-if="highlight.primaryType === 'rank-upgrade' && rankValue(highlight.after) !== null" class="wl-rank">
            <template v-if="rankValue(highlight.before) !== null"><DsRank :value="rankValue(highlight.before)" named /><span aria-hidden="true">→</span></template>
            <DsRank :value="rankValue(highlight.after)" named />
          </span>
        </span>
        <small v-if="highlight.goalCompleted" class="wl-goal">{{ t("weekly.goalCompleted") }}</small>
      </div>
    </li>
  </ol>
</template>

<style scoped>
.wl {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--line-strong);
}
.wl-item {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: var(--sp-4);
  align-items: start;
  padding: var(--sp-4) 0;
  border-bottom: 1px solid var(--line);
}
.wl-cover {
  display: block;
  line-height: 0;
}
.wl-body {
  display: grid;
  justify-items: start;
  gap: 4px;
  min-width: 0;
}
.wl-change {
  margin: 0;
  font-size: var(--fs-16);
  font-weight: 700;
  line-height: var(--lh-snug);
  overflow-wrap: anywhere;
}
.wl-name {
  font-size: var(--fs-14);
  font-weight: 600;
  overflow-wrap: anywhere;
}
.wl-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--sp-1) var(--sp-3);
  color: var(--ink-2);
  font-size: var(--fs-13);
}
.wl-rank {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
}
.wl-goal {
  color: var(--ink-2);
  font-size: var(--fs-13);
  font-weight: 600;
}
@media (max-width: 767px) {
  .wl-item {
    gap: var(--sp-3);
  }
}
</style>
