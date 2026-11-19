<script setup lang="ts">
// The current goal of the signed-in home (frozen GoalCard). Presentation only: the goal, its evaluation and every
// action stay in components/home/PlayerGrowthSurface.vue, which passes the state down and receives the actions.
//   active     the chart (cover, title, difficulty and star), what is being aimed for, the value when it was chosen,
//              the day it was set, "not available" when the chart is gone; view chart, sync after playing (synced
//              bindings), confirm progress, choose another, cancel
//   completed  the chart, what changed (before → after; a crown with its name, ranks with their names), the other
//              facts of that play, choose the next one
// The attempt trail of the prototype is not drawn: the API keeps no attempts of a goal.
import type { PlayerGoal } from "~/types/player-goal";
import { difficultyLabelKey } from "~/utils/difficulty";
import { formatScoreRank } from "~/utils/scoreRank";
import { GOAL_TYPE_KEYS, factCrown, keyOf, rankValue, shortDay } from "~/utils/rework/today";

const props = defineProps<{
  goal: PlayerGoal;
  completed?: boolean;
  heading: string;
  /** completed: "score 900,000 → 950,000" built by the surface from completionEvidence */
  change?: string;
  /** completed: the copy line for the goal type when there is no before / after */
  typeText?: string;
  support?: string[];
  busy?: boolean;
  disabled?: boolean;
  canExternalSync?: boolean;
  profileId?: string;
}>();
const emit = defineEmits<{ evaluate: []; replace: []; cancel: []; next: [] }>();
const { t, locale } = useI18n();
const localePath = useLocalePath();

const chartTo = computed(() => localePath({ path: `/songs/${props.goal.songId}`, query: { difficulty: String(props.goal.difficultyType) } }));
const result = computed(() => (props.completed ? props.goal.completionEvidence?.result || null : null));
const resultCrown = computed(() => factCrown(result.value?.goalType));
const resultRank = computed(() => (result.value?.goalType === "rank-upgrade" ? { before: rankValue(result.value.before), after: rankValue(result.value.after) } : null));
const baseline = computed(() => {
  const g = props.goal;
  if (g.goalType === "score-pb" && g.baseline.highScore !== null) return t("home.goal.baseline", { value: g.baseline.highScore.toLocaleString() });
  if (g.goalType === "ng-reduced" && g.baseline.ngCnt !== null) return t("home.goal.baselineNg", { value: g.baseline.ngCnt });
  if (g.goalType === "rank-upgrade") return t("home.goal.baseline", { value: formatScoreRank(g.baseline.bestScoreRank, locale.value) });
  return "";
});
const setOn = computed(() => {
  const date = shortDay(props.goal.createdAt, locale.value);
  return date ? t("rework.home.goalSet", { date }) : "";
});
const typeKey = computed(() => keyOf(GOAL_TYPE_KEYS, props.goal.goalType));
</script>

<template>
  <section
    id="current-goal"
    class="tgo growth-goal"
    :class="{ 'growth-goal--completed': completed }"
    :aria-labelledby="completed ? 'goal-completed-title' : 'growth-goal-title'"
    aria-live="polite"
  >
    <header class="tgo-head">
      <h2 :id="completed ? 'goal-completed-title' : 'growth-goal-title'" class="tgo-title">{{ heading }}</h2>
      <span v-if="!completed && setOn" class="tgo-when">{{ setOn }}</span>
    </header>

    <NuxtLink :to="chartTo" class="tgo-song">
      <DsCover :song-id="goal.songId" size="lg" />
      <span class="tgo-song-body">
        <span v-if="!completed && typeKey" class="tgo-type">{{ t(typeKey) }}</span>
        <strong class="tgo-name">{{ goal.title }}</strong>
        <span class="tgo-diff">
          <DsDiff v-if="goal.difficultyType >= 1 && goal.difficultyType <= 5" :difficulty="goal.difficultyType" :star="goal.starLevel" :show-constant="false" />
          <span v-else>{{ t(difficultyLabelKey(goal.difficultyType)) }}</span>
        </span>
      </span>
    </NuxtLink>

    <template v-if="!completed">
      <p v-if="baseline" class="tgo-line num">{{ baseline }}</p>
      <p v-if="goal.unavailable" class="rw-note tgo-unavailable">{{ t("home.goal.unavailable") }}</p>
      <div class="tgo-actions goal-actions">
        <NuxtLink class="rw-btn" :to="chartTo">{{ t("rework.home.viewChart") }}</NuxtLink>
        <NuxtLink v-if="canExternalSync" class="rw-btn" :to="localePath({ path: '/account/sync', query: { profileId, from: 'goal' } })">{{ t("rework.home.syncAfter") }}</NuxtLink>
        <button type="button" class="rw-btn rw-btn--primary goal-evaluate" :disabled="disabled" @click="emit('evaluate')">{{ t(busy ? "home.goal.saving" : "home.goal.evaluate") }}</button>
        <button type="button" class="rw-btn rw-btn--ghost" :disabled="disabled" @click="emit('replace')">{{ t("home.goal.replace") }}</button>
        <button type="button" class="rw-btn rw-btn--ghost" :disabled="disabled" @click="emit('cancel')">{{ t(busy ? "home.goal.saving" : "home.goal.cancel") }}</button>
      </div>
    </template>
    <template v-else>
      <div class="tgo-result">
        <DsCrown v-if="resultCrown" :state="resultCrown" size="md" text="full" />
        <span v-else-if="resultRank && resultRank.after !== null" class="tgo-rank">
          <DsRank v-if="resultRank.before !== null" :value="resultRank.before" named />
          <span v-if="resultRank.before !== null" aria-hidden="true">→</span>
          <DsRank :value="resultRank.after" named />
        </span>
        <strong v-else-if="change" class="tgo-change num">{{ change }}</strong>
        <span v-else class="tgo-line">{{ typeText }}</span>
      </div>
      <p v-for="(line, index) in support || []" :key="index" class="tgo-line growth-goal__support">{{ line }}</p>
      <div class="tgo-actions goal-actions">
        <button type="button" class="rw-btn rw-btn--primary" :disabled="disabled" @click="emit('next')">{{ t("home.goal.chooseNext") }}</button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.tgo {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  box-sizing: border-box;
  min-width: 0;
  padding: var(--sp-4) var(--sp-5) var(--sp-5);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
}
.tgo.growth-goal--completed {
  border-color: var(--ok);
}
.tgo-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--sp-1) var(--sp-3);
}
.tgo-title {
  margin: 0;
  font-size: var(--fs-16);
  font-weight: 700;
}
.tgo-when {
  color: var(--ink-3);
  font-size: var(--fs-12);
}
.tgo-song {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  min-width: 0;
  color: var(--ink);
  text-decoration: none;
}
.tgo-song:hover .tgo-name {
  color: var(--link);
}
.tgo-song:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
  border-radius: var(--r-xs);
}
.tgo-song-body {
  display: grid;
  gap: 4px;
  min-width: 0;
}
.tgo-type {
  color: var(--emph-num);
  font-size: var(--fs-13);
  font-weight: 700;
}
.tgo-name {
  font-size: var(--fs-18);
  font-weight: 800;
  line-height: var(--lh-snug);
  overflow-wrap: anywhere;
}
.tgo-diff {
  display: flex;
  color: var(--ink-2);
  font-size: var(--fs-13);
}
.tgo-line {
  margin: 0;
  color: var(--ink-2);
  font-size: var(--fs-14);
  line-height: var(--lh-body);
}
.tgo-unavailable {
  font-size: var(--fs-13);
}
.tgo-result {
  display: flex;
  align-items: center;
  min-height: var(--hit);
}
.tgo-rank {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
}
.tgo-change {
  font-size: var(--fs-18);
  overflow-wrap: anywhere;
}
.tgo-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
  padding-top: var(--sp-2);
}
@media (max-width: 767px) {
  .tgo {
    padding: var(--sp-4);
  }
  .tgo-actions > .rw-btn {
    flex: 1 1 auto;
  }
}
</style>
