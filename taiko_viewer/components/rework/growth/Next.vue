<script setup lang="ts">
// "想继续的话" of the growth page: the active goal and the recently completed goal (linked to their charts, with what
// is being aimed for / what was achieved), the invitation of the current next action and its songs.
// Goals are only shown here; choosing, evaluating and replacing them stays on the home page.
import type { PlayerGoal } from "~/types/player-goal";
import type { GrowthPlanItem } from "~/types/player-growth";
import { GOAL_COMPLETED_KEYS, GOAL_TYPE_KEYS, keyOf } from "~/utils/rework/today";

defineProps<{
  activeGoal: PlayerGoal | null;
  completedGoal: PlayerGoal | null;
  invitation: string;
  items: GrowthPlanItem[];
}>();
const { t } = useI18n();
const localePath = useLocalePath();
const chartTo = (goal: PlayerGoal) => localePath({ path: `/songs/${goal.songId}`, query: { difficulty: String(goal.difficultyType) } });
</script>

<template>
  <section class="gx passport-next" aria-labelledby="gx-title">
    <h2 id="gx-title" class="gx-title">{{ t("passport.nextTitle") }}</h2>
    <NuxtLink v-if="activeGoal" class="gx-goal passport-goal" :to="chartTo(activeGoal)">
      <DsCover :song-id="activeGoal.songId" size="md" />
      <span class="gx-goal-body">
        <small>{{ t("passport.activeGoalTitle") }}</small>
        <b>{{ activeGoal.title }}</b>
        <span v-if="keyOf(GOAL_TYPE_KEYS, activeGoal.goalType)">{{ t(keyOf(GOAL_TYPE_KEYS, activeGoal.goalType)) }}</span>
      </span>
    </NuxtLink>
    <NuxtLink v-if="completedGoal" class="gx-goal passport-goal is-done" :to="chartTo(completedGoal)">
      <DsCover :song-id="completedGoal.songId" size="md" />
      <span class="gx-goal-body">
        <small>{{ t("passport.completedGoalTitle") }}</small>
        <b>{{ completedGoal.title }}</b>
        <span v-if="keyOf(GOAL_COMPLETED_KEYS, completedGoal.goalType)">{{ t(keyOf(GOAL_COMPLETED_KEYS, completedGoal.goalType)) }}</span>
      </span>
    </NuxtLink>
    <p v-if="invitation" class="gx-say passport-next__focus">{{ invitation }}</p>
    <ReworkGrowthSongs v-if="items.length" class="passport-next__songs" :items="items" />
  </section>
</template>

<style scoped>
.gx {
  display: grid;
  gap: var(--sp-3);
  min-width: 0;
}
.gx > * {
  min-width: 0;
}
.gx-title {
  margin: 0;
  font-size: var(--fs-18);
  font-weight: 700;
}
.gx-goal {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  min-height: var(--hit);
  padding: var(--sp-3) var(--sp-4);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
  color: var(--ink);
  text-decoration: none;
}
.gx-goal.is-done {
  border-color: var(--ok);
}
.gx-goal:hover b {
  color: var(--link);
}
.gx-goal:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.gx-goal-body {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.gx-goal-body small {
  color: var(--ink-3);
  font-size: var(--fs-12);
}
.gx-goal-body b {
  font-size: var(--fs-16);
  overflow-wrap: anywhere;
}
.gx-goal-body span {
  color: var(--emph-num);
  font-size: var(--fs-13);
  font-weight: 600;
}
.gx-say {
  margin: 0;
  color: var(--ink-2);
  font-size: var(--fs-14);
  line-height: var(--lh-body);
}
</style>
