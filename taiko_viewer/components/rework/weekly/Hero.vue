<script setup lang="ts">
// Head of /my/weekly (frozen Weekly.vue): the page title, which week (current or completed) and its days, previous /
// next week over the existing `?week=` contract, refresh, the week's theme sentence, the coverage notice and the six
// totals of /api/account/growth/weekly. The 7-day lane of the prototype is not drawn: the API returns no per-day data.
import type { WeeklyGrowthResponse } from "~/types/player-growth";
import { WEEKLY_TOTAL_FIELDS, WEEKLY_TOTAL_KEYS, weekNavigation } from "~/utils/rework/today";

const props = defineProps<{
  weekly: WeeklyGrowthResponse;
  theme: string;
  rangeText: string;
  coverageNote: string;
  numberLocale: string;
}>();
const emit = defineEmits<{ refresh: [] }>();
const { t } = useI18n();
const localePath = useLocalePath();
const weekTo = (day: string | null) => (day ? localePath({ path: "/my/weekly", query: { week: day } }) : null);
const previousTo = computed(() => weekTo(weekNavigation(props.weekly.week).previous));
const nextTo = computed(() => weekTo(weekNavigation(props.weekly.week).next));
const fields = WEEKLY_TOTAL_FIELDS;
</script>

<template>
  <div class="wh">
    <ReworkPageHeader :title="t('weekly.title')">
      <template #eyebrow>
        <span class="wh-kicker">{{ t(weekly.week.isCompleteWeek ? "weekly.completeWeek" : "weekly.currentWeek") }}</span>
      </template>
      <div class="wh-nav" role="group" :aria-label="t('weekly.recordsRange')">
        <NuxtLink v-if="previousTo" class="rw-btn rw-btn--sm wh-step" :to="previousTo" :aria-label="t('rework.weeklyPage.previous')"><ReworkIcon name="back" class="wh-icon" /></NuxtLink>
        <span v-else class="rw-btn rw-btn--sm wh-step" aria-disabled="true" :aria-label="t('rework.weeklyPage.previous')" role="link"><ReworkIcon name="back" class="wh-icon" /></span>
        <time class="num wh-range" :datetime="`${weekly.week.from}/${weekly.week.to}`" aria-live="polite">{{ rangeText }}</time>
        <NuxtLink v-if="nextTo" class="rw-btn rw-btn--sm wh-step" :to="nextTo" :aria-label="t('rework.weeklyPage.next')"><ReworkIcon name="forward" class="wh-icon" /></NuxtLink>
        <span v-else class="rw-btn rw-btn--sm wh-step" aria-disabled="true" :aria-label="t('rework.weeklyPage.next')" role="link"><ReworkIcon name="forward" class="wh-icon" /></span>
      </div>
      <template #actions>
        <button class="rw-btn weekly-refresh" type="button" @click="emit('refresh')">{{ t("weekly.refresh") }}</button>
      </template>
    </ReworkPageHeader>
    <p class="wh-theme weekly-theme">{{ theme }}</p>
    <p v-if="coverageNote" class="rw-note wh-coverage weekly-coverage" role="note">{{ coverageNote }}</p>
    <dl class="wh-totals weekly-summary" :aria-label="t('weekly.recordedTotals')">
      <div v-for="field in fields" :key="field" class="wh-total">
        <dt>{{ t(WEEKLY_TOTAL_KEYS[field]) }}</dt>
        <dd class="num">{{ props.weekly.totals[field].toLocaleString(numberLocale) }}</dd>
      </div>
    </dl>
  </div>
</template>

<style scoped>
.wh {
  display: grid;
  gap: var(--sp-4);
  min-width: 0;
}
.wh-kicker {
  color: var(--ink-3);
  font-size: var(--fs-13);
  font-weight: 600;
}
.wh-nav {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  margin-top: var(--sp-2);
}
.wh-step {
  min-width: var(--hit);
  padding: 0;
}
.wh-icon {
  width: 18px;
  height: 18px;
}
.wh-range {
  color: var(--ink-2);
  font-size: var(--fs-16);
  white-space: nowrap;
}
.wh-theme {
  margin: 0;
  font-size: clamp(1.375rem, 2.6vw, 2.25rem);
  font-weight: 900;
  line-height: var(--lh-tight);
  text-wrap: pretty;
  overflow-wrap: anywhere;
}
.wh-totals {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  margin: 0;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}
.wh-total {
  display: flex;
  flex-direction: column-reverse;
  justify-content: flex-end;
  gap: 2px;
  min-width: 0;
  padding: var(--sp-3) var(--sp-3) var(--sp-3) 0;
}
.wh-total + .wh-total {
  padding-left: var(--sp-3);
  border-left: 1px solid var(--line);
}
.wh-total dd {
  margin: 0;
  font-size: var(--fs-28);
  line-height: 1.1;
}
.wh-total dt {
  color: var(--ink-2);
  font-size: var(--fs-13);
  overflow-wrap: anywhere;
}
@media (max-width: 767px) {
  .wh-totals {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .wh-total:nth-child(odd) {
    padding-left: 0;
    border-left: 0;
  }
  .wh-total:nth-child(n + 3) {
    border-top: 1px solid var(--line);
  }
  .wh-total dd {
    font-size: var(--fs-22);
  }
}
</style>
