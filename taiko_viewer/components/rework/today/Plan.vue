<script setup lang="ts">
// What to play next on the signed-in home: the overview's todayPlan items (cover, title, difficulty and star, the
// current best score and rank when the player has one) with the goal choice where the item allows one. The choice,
// its dialog and the analytics event stay in components/home/PlayerGrowthSurface.vue.
import type { GrowthPlanItem } from "~/types/player-growth";
import { rankValue } from "~/utils/rework/today";

defineProps<{
  title: string;
  items: GrowthPlanItem[];
  selected: (item: GrowthPlanItem) => boolean;
  disabled?: boolean;
  busy?: boolean;
}>();
const emit = defineEmits<{ choose: [item: GrowthPlanItem]; browse: [songId: number] }>();
const { t } = useI18n();
const localePath = useLocalePath();
</script>

<template>
  <ReworkPanel class="tpl growth-plan" plain :title="title">
    <template #actions>
      <NuxtLink class="rw-link tpl-more" :to="localePath('/tools/recommend')">{{ t("rework.home.allRecommendations") }}</NuxtLink>
    </template>
    <ul v-if="items.length" class="tpl-list growth-plan__items">
      <li v-for="item in items" :key="`${item.songId}-${item.difficultyType}`" class="tpl-row growth-plan__choice" :data-song-id="item.songId" :data-difficulty="item.difficultyType">
        <NuxtLink
          class="tpl-song"
          :to="localePath({ path: `/songs/${item.songId}`, query: { difficulty: String(item.difficultyType) } })"
          @click="emit('browse', item.songId)"
        >
          <DsSongCell :song-id="item.songId" :title="item.title" :difficulty="item.difficultyType" :star="item.starLevel" :show-constant="false" />
        </NuxtLink>
        <span v-if="item.currentBestScore != null || rankValue(item.currentBestRank) !== null" class="tpl-best">
          <span v-if="item.currentBestScore != null" class="num">{{ item.currentBestScore.toLocaleString() }}</span>
          <DsRank v-if="rankValue(item.currentBestRank) !== null" :value="rankValue(item.currentBestRank)" named />
        </span>
        <button
          v-if="item.goalOptions?.length"
          type="button"
          class="rw-btn rw-btn--sm tpl-choose growth-plan__choose"
          :class="{ 'is-selected': selected(item) }"
          :disabled="disabled"
          :aria-busy="busy"
          @click="emit('choose', item)"
        >{{ selected(item) ? t("home.goal.selected") : t("rework.home.choose") }}</button>
      </li>
    </ul>
    <ReworkState v-else kind="empty" compact :title="t('home.growth.noRecommendation')" />
  </ReworkPanel>
</template>

<style scoped>
.tpl-more {
  display: inline-flex;
  align-items: center;
  min-height: var(--hit);
  font-size: var(--fs-13);
}
.tpl-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: var(--sp-8);
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--line-strong);
}
.tpl-row {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  min-width: 0;
  min-height: var(--hit);
  padding: var(--sp-2) 0;
  border-bottom: 1px solid var(--line);
}
.tpl-song {
  flex: 1;
  min-width: 0;
  color: var(--ink);
  text-decoration: none;
}
.tpl-song:hover :deep(.ds-song-cell__title),
.tpl-song:hover :deep(strong) {
  color: var(--link);
}
.tpl-song:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
  border-radius: var(--r-xs);
}
.tpl-best {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  flex: none;
  color: var(--ink-2);
  font-size: var(--fs-13);
}
.tpl-choose {
  flex: none;
}
.tpl-choose.is-selected {
  border-color: var(--selected-line);
  background: var(--selected-bg);
  color: var(--selected-ink);
}
@media (max-width: 1099px) {
  .tpl-list {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 767px) {
  .tpl-row {
    flex-wrap: wrap;
  }
  .tpl-song {
    flex-basis: 100%;
  }
  .tpl-best {
    margin-left: 56px;
  }
  .tpl-choose {
    margin-left: auto;
  }
}
</style>
