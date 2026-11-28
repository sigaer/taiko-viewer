<script setup lang="ts">
import type { WeeklyMeasurementChange } from "~/types/player-growth";
import { GROWTH_DIMENSION_ORDER } from "~/utils/playerGrowth";
import { deltaRows, dimensionLabelKey, signedFixed } from "~/utils/rework/today";

const props = defineProps<{
  change: WeeklyMeasurementChange | null;
  completeWeek: boolean;
  focusText: string;
}>();
const { t, locale } = useI18n();
const rows = computed(() => [
  { key: 'rating', label: 'Rating', before: props.change?.start?.rating, after: props.change?.end?.rating, delta: props.change?.ratingDelta, top: false },
  ...deltaRows(GROWTH_DIMENSION_ORDER, props.change?.dimensionDeltas).map(row => ({
    ...row, label: t(dimensionLabelKey(row.key)),
    before: props.change?.start?.dimensions[row.key], after: props.change?.end?.dimensions[row.key]
  }))
]);
const value = (raw: number | null | undefined) => typeof raw === 'number' && Number.isFinite(raw) ? raw.toFixed(2) : '—';
const time = (raw: string | undefined) => raw ? new Intl.DateTimeFormat(locale.value, {
  timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
}).format(new Date(raw)) : '—';
</script>

<template>
  <ReworkPanel class="wc weekly-measurement" plain :title="t('weekly.measurement.title')">
    <template #actions>
      <span class="rw-count">{{ t(completeWeek ? "weekly.measurement.weekEnd" : "weekly.measurement.now") }}</span>
    </template>
    <table class="wc-table" :aria-label="t('weekly.measurement.title')">
      <thead>
        <tr>
          <th scope="col">{{ t('weekly.measurement.metric') }}</th>
          <th scope="col"><time :datetime="change?.start?.capturedAt">{{ time(change?.start?.capturedAt) }}</time></th>
          <th scope="col"><time :datetime="change?.end?.capturedAt">{{ time(change?.end?.capturedAt) }}</time></th>
          <th scope="col">{{ t('weekly.measurement.delta') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.key" :class="{ 'is-top': row.top }">
          <th scope="row">{{ row.label }}</th>
          <td class="num">{{ value(row.before) }}</td>
          <td class="num">{{ value(row.after) }}</td>
          <td class="num wc-delta">{{ signedFixed(row.delta) }}</td>
        </tr>
      </tbody>
    </table>
    <p v-if="!change?.start || !change?.end" class="wc-say">{{ t('weekly.measurement.insufficient') }}</p>
    <p v-if="focusText" class="wc-say">{{ focusText }}</p>
  </ReworkPanel>
</template>

<style scoped>
.wc-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: var(--fs-13);
}
.wc-table th, .wc-table td {
  padding: 8px 4px;
  text-align: right;
  vertical-align: middle;
}
.wc-table th:first-child {
  width: 26%;
  padding-left: 0;
  text-align: left;
  color: var(--ink-2);
  font-weight: 400;
}
.wc-table th:last-child, .wc-table td:last-child { padding-right: 0; }
.wc-table thead th {
  color: var(--ink-2);
  font-size: var(--fs-12);
  font-weight: 400;
}
.wc-table tbody tr { border-top: 1px solid var(--line); }
.wc-table .is-top th, .wc-delta { color: var(--ink); font-weight: 700; }
.wc-say {
  margin: var(--sp-3) 0 0;
  color: var(--ink-2);
  font-size: var(--fs-14);
  line-height: var(--lh-body);
}
</style>
