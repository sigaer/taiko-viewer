<script setup lang="ts">
// ReworkSyncGoalResult — the goal progress block of /account/sync, shown when the page was opened from a goal
// (?from=goal) or a sync returned a goal evaluation. Same content and conditions as before; the retry (evaluation
// error only) is the page's retryGoalEvaluation.
import type { PropType } from "vue";
import type { GoalEvaluationResponse } from "~/types/goal-evaluation";

defineProps({
  evaluation: { type: Object as PropType<GoalEvaluationResponse | null>, default: null },
  contextChanged: { type: Boolean, default: false },
  evaluating: { type: Boolean, default: false },
  submitting: { type: Boolean, default: false },
  /** "<fact> before → after" of the completed goal (the page's goalChange) */
  change: { type: String, default: "" },
  /** the completed goal's type name (the page's home.goal.completedTypes.* text) */
  completedLabel: { type: String, default: "" }
});
const emit = defineEmits<{ retry: [] }>();
const { t } = useI18n();
const localePath = useLocalePath();
const g = (key: string) => t(`rework.account.sync.goal.${key}`);
</script>

<template>
  <section class="goal-sync-result rs-goal" aria-live="polite" aria-labelledby="sync-goal-title">
    <h2 id="sync-goal-title" class="rs-goal__title">{{ g("title") }}</h2>
    <p v-if="contextChanged" class="rw-alert rw-alert--warn" role="alert">{{ g("changed") }}</p>
    <template v-else-if="evaluation && evaluation.outcome !== 'no-active-goal'">
      <p class="rs-goal__outcome">{{ g(evaluation.outcome) }}</p>
      <strong v-if="evaluation.recentCompletedGoal || evaluation.activeGoal" class="rs-goal__name">{{ evaluation.recentCompletedGoal?.title || evaluation.activeGoal?.title }}</strong>
      <p v-if="change" class="rs-goal__change">{{ change }}</p>
      <p v-else-if="evaluation.recentCompletedGoal" class="rs-goal__change">{{ completedLabel }}</p>
      <div v-if="evaluation.outcome === 'evaluation-error'">
        <button type="button" class="rw-btn" :class="{ 'is-busy': evaluating }" :disabled="submitting || evaluating" :aria-busy="evaluating || undefined" @click="emit('retry')">{{ g("retry") }}</button>
      </div>
    </template>
    <NuxtLink :to="localePath({ path: '/', hash: '#current-goal' })" class="goal-return rw-link">{{ g("back") }}</NuxtLink>
  </section>
</template>

<style scoped>
.rs-goal {
  display: grid;
  justify-items: start;
  gap: var(--sp-2);
  min-width: 0;
  padding: var(--sp-4) var(--sp-5);
  border: 1px solid var(--line);
  border-left: 3px solid var(--info-line);
  border-radius: var(--r-panel);
  background: var(--surface);
  color: var(--ink);
  font-family: var(--font-ui);
}
.rs-goal__title {
  margin: 0;
  font-size: var(--fs-16);
  font-weight: 700;
}
.rs-goal__outcome,
.rs-goal__change {
  margin: 0;
  font-size: var(--fs-14);
  line-height: var(--lh-body);
  overflow-wrap: anywhere;
}
.rs-goal__change {
  color: var(--ink-2);
}
.rs-goal__name {
  overflow-wrap: anywhere;
}
.goal-return {
  display: inline-flex;
  align-items: center;
  min-height: var(--hit);
}
</style>
