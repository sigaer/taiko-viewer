<script setup lang="ts">
// Content of the goal dialog on the signed-in home. The <dialog> element, focus handling and the POST stay in
// components/home/PlayerGrowthSurface.vue; this renders the two steps:
//   no chart chosen   the other plan items that allow a goal (or that there are none) and "more recommendations"
//   chart chosen      what to aim for (the item's goal options), the save error, cancel / confirm
import type { GoalType } from "~/types/player-goal";
import type { GrowthPlanItem } from "~/types/player-growth";
import { GOAL_TYPE_KEYS, keyOf } from "~/utils/rework/today";

const props = defineProps<{
  selected: GrowthPlanItem | null;
  items: GrowthPlanItem[];
  type: GoalType | null;
  replacing?: boolean;
  busy?: boolean;
  disabled?: boolean;
  error?: string;
}>();
const emit = defineEmits<{ "update:type": [value: GoalType]; pick: [item: GrowthPlanItem]; close: []; confirm: [] }>();
const { t } = useI18n();
const localePath = useLocalePath();
</script>

<template>
  <div class="tgp">
    <template v-if="!selected">
      <h2 id="goal-dialog-title" class="rw-dialog__title">{{ t("rework.home.pickTitle") }}</h2>
      <div v-if="items.length" class="tgp-list goal-replacements">
        <button v-for="item in items" :key="`${item.songId}-${item.difficultyType}`" type="button" class="tgp-option" :disabled="disabled" @click="emit('pick', item)">
          <DsSongCell :song-id="item.songId" :title="item.title" :difficulty="item.difficultyType" :star="item.starLevel" :show-constant="false" cover-size="sm" />
        </button>
      </div>
      <p v-else class="tgp-empty" role="status">{{ t("rework.home.pickEmpty") }}</p>
      <div class="rw-dialog__actions">
        <NuxtLink class="rw-btn rw-btn--ghost" :to="localePath('/tools/recommend')" @click="emit('close')">{{ t("rework.home.pickMore") }}</NuxtLink>
        <button type="button" class="rw-btn" @click="emit('close')">{{ t("home.goal.cancel") }}</button>
      </div>
    </template>
    <template v-else>
      <h2 id="goal-dialog-title" class="rw-dialog__title">{{ t(replacing ? "home.goal.replaceConfirm" : "home.goal.question") }}</h2>
      <DsSongCell :song-id="selected.songId" :title="selected.title" :difficulty="selected.difficultyType" :star="selected.starLevel" :show-constant="false" />
      <fieldset class="tgp-types" :disabled="busy" aria-labelledby="goal-dialog-title">
        <legend v-if="replacing" class="tgp-legend">{{ t("home.goal.question") }}</legend>
        <label v-for="option in selected.goalOptions" :key="option" class="rw-choice">
          <input type="radio" name="goal-type" :value="option" :checked="type === option" @change="emit('update:type', option)" />{{ keyOf(GOAL_TYPE_KEYS, option) ? t(keyOf(GOAL_TYPE_KEYS, option)) : option }}
        </label>
      </fieldset>
      <p v-if="error" role="alert" class="tgp-error goal-error">{{ error }}</p>
      <div class="rw-dialog__actions">
        <button type="button" class="rw-btn" @click="emit('close')">{{ t("home.goal.cancel") }}</button>
        <button type="button" class="rw-btn rw-btn--primary" :disabled="busy || !type" :aria-busy="busy" @click="emit('confirm')">{{ t(busy ? "home.goal.saving" : "home.goal.confirm") }}</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.tgp {
  display: grid;
  gap: var(--sp-3);
}
.tgp-list {
  display: grid;
  gap: var(--sp-2);
}
.tgp-option {
  display: block;
  width: 100%;
  min-height: var(--hit);
  padding: var(--sp-2) var(--sp-3);
  border: 1px solid var(--line);
  border-radius: var(--r-ctl);
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  text-align: start;
  cursor: pointer;
}
.tgp-option:hover {
  background: var(--bg-sunk);
}
.tgp-option:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.tgp-option:disabled {
  cursor: not-allowed;
  color: var(--ink-3);
}
.tgp-empty {
  margin: 0;
  color: var(--ink-2);
  font-size: var(--fs-14);
}
.tgp-types {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  border: 0;
}
.tgp-legend {
  margin-bottom: var(--sp-2);
  padding: 0;
  color: var(--ink-2);
  font-size: var(--fs-14);
}
.tgp-error {
  margin: 0;
  color: var(--danger);
  font-size: var(--fs-14);
}
</style>
