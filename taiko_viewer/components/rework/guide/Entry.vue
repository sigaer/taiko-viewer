<script setup lang="ts">
// ReworkGuideEntry — /guide (slice F; frozen design: Guide.vue). Difficulty × star: one row per difficulty with a
// link to every star page that exists (utils/guide.ts GUIDE_DIFFICULTY_OPTIONS, unchanged order). The guide counts
// per star are only known on each star page (one remote read per tag), so the index does not show counts.
import type { PropType } from "vue";
import type { GuideDifficultyOption } from "~/types/content";

defineProps({ groups: { type: Array as PropType<GuideDifficultyOption[]>, required: true } });
const { t } = useI18n();
const localePath = useLocalePath();
</script>

<template>
  <div class="gi">
    <ul class="gi-rows">
      <li v-for="group in groups" :key="group.value" class="gi-row">
        <h2 class="gi-diff">
          <span aria-hidden="true"><DsDiff :difficulty="group.value" :show-constant="false" size="lg" /></span>
          <span>{{ t(`difficulty.${group.value}`) }}</span>
        </h2>
        <ul class="gi-levels" :aria-label="t(`difficulty.${group.value}`)">
          <li v-for="level in group.max" :key="`${group.value}-${level}`">
            <NuxtLink class="gi-level num" :to="localePath(`/guide/${group.value}/${level}`)" :aria-label="t('rework.guidePage.levelAria', { difficulty: t(`difficulty.${group.value}`), level })">
              ★{{ level }}
            </NuxtLink>
          </li>
        </ul>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.gi {
  min-width: 0;
  font-family: var(--font-ui);
  color: var(--ink);
}
.gi-rows {
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
}
.gi-row {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  align-items: center;
  gap: var(--sp-3) var(--sp-5);
  padding: var(--sp-4) var(--sp-5);
  border-bottom: 1px solid var(--line);
}
.gi-row:last-child {
  border-bottom: 0;
}
.gi-diff {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  margin: 0;
  font-size: var(--fs-16);
  font-weight: 700;
}
.gi-levels {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.gi-level {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 56px;
  min-height: var(--hit);
  padding: 0 var(--sp-3);
  border: 1px solid var(--line);
  border-radius: var(--r-ctl);
  color: var(--ink);
  font-size: var(--fs-16);
  text-decoration: none;
}
.gi-level:hover {
  border-color: var(--action-bg);
  color: var(--link);
}
.gi-level:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
@media (max-width: 767px) {
  .gi-row {
    grid-template-columns: minmax(0, 1fr);
    padding: var(--sp-4);
  }
  .gi-level {
    min-width: 52px;
  }
}
</style>
