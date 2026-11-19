<script setup lang="ts">
// "能力变化" of /my/weekly (measurementChange of /api/account/growth/weekly). Comparable: the main dimension
// before → after, the Rating change, every dimension's change as a signed number with a bar (share of the largest
// change; the largest increase is marked), and the focus sentence. Not comparable because the way of recording changed:
// the existing note behind a disclosure; otherwise the existing reason sentence. No value is drawn that the API did
// not return (a dimension without a delta shows "—").
import type { WeeklyMeasurementChange } from "~/types/player-growth";
import { GROWTH_DIMENSION_ORDER } from "~/utils/playerGrowth";
import { WEEKLY_METHOD_KEYS, WEEKLY_REASON_KEYS, deltaRows, dimensionLabelKey, keyOf, signedFixed } from "~/utils/rework/today";

const props = defineProps<{
  change: WeeklyMeasurementChange | null;
  completeWeek: boolean;
  focusText: string;
  recordMethodChanged: boolean;
}>();
const { t } = useI18n();
const rows = computed(() => deltaRows(GROWTH_DIMENSION_ORDER, props.change?.dimensionDeltas));
const hasDeltas = computed(() => rows.value.some((r) => r.delta !== null));
</script>

<template>
  <ReworkPanel class="wc weekly-measurement" plain :title="t('weekly.measurement.title')">
    <template #actions>
      <span v-if="change?.start && change?.end" class="rw-count">{{ t(completeWeek ? "weekly.measurement.weekEnd" : "weekly.measurement.now") }}</span>
    </template>
    <template v-if="change?.compatible">
      <div v-if="change.primaryDimension" class="wc-main weekly-measurement__change">
        <span class="wc-k">{{ t(dimensionLabelKey(change.primaryDimension.key)) }}</span>
        <b class="num wc-v">{{ change.primaryDimension.before.toFixed(2) }} <span aria-hidden="true">→</span> {{ change.primaryDimension.after.toFixed(2) }}</b>
        <span class="num wc-d">{{ signedFixed(change.primaryDimension.delta) }}</span>
      </div>
      <p v-if="change.ratingDelta !== null" class="wc-rating weekly-measurement__rating">Rating <span class="num">{{ signedFixed(change.ratingDelta) }}</span></p>
      <ul v-if="hasDeltas" class="wc-rows">
        <li v-for="row in rows" :key="row.key" :class="{ 'is-top': row.top }">
          <span class="wc-name">{{ t(dimensionLabelKey(row.key)) }}</span>
          <span class="wc-bar" aria-hidden="true"><i :class="{ 'is-down': row.delta !== null && row.delta < 0 }" :style="{ width: `${row.share}%` }" /></span>
          <b class="num">{{ signedFixed(row.delta) }}</b>
        </li>
      </ul>
      <p v-if="focusText" class="wc-say">{{ focusText }}</p>
    </template>
    <details v-else-if="recordMethodChanged" class="wc-details">
      <summary>{{ t("weekly.segmentUpdated") }}</summary>
      <p>{{ t(keyOf(WEEKLY_METHOD_KEYS, change?.reason, WEEKLY_METHOD_KEYS["algorithm-mismatch"])) }}</p>
    </details>
    <p v-else class="wc-say">{{ t(keyOf(WEEKLY_REASON_KEYS, change?.reason, WEEKLY_REASON_KEYS.insufficient)) }}</p>
  </ReworkPanel>
</template>

<style scoped>
.wc-main {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--sp-1) var(--sp-3);
  margin-bottom: var(--sp-2);
}
.wc-k {
  color: var(--ink-2);
  font-size: var(--fs-14);
}
.wc-v {
  font-size: var(--fs-22);
}
.wc-d {
  color: var(--emph-num);
  font-size: var(--fs-16);
}
.wc-rating {
  margin: 0 0 var(--sp-3);
  color: var(--ink-2);
  font-size: var(--fs-14);
}
.wc-rating .num {
  color: var(--emph-num);
  font-size: var(--fs-16);
}
.wc-rows {
  display: grid;
  gap: 2px;
  margin: 0 0 var(--sp-3);
  padding: 0;
  list-style: none;
}
.wc-rows li {
  display: grid;
  grid-template-columns: minmax(5.5em, auto) minmax(0, 1fr) 4.5em;
  align-items: center;
  gap: var(--sp-3);
  min-height: 32px;
  font-size: var(--fs-13);
}
.wc-name {
  color: var(--ink-2);
}
.wc-rows li.is-top .wc-name {
  color: var(--ink);
  font-weight: 700;
}
.wc-bar {
  height: 6px;
  border-radius: var(--r-xs);
  background: var(--bg-sunk);
  overflow: hidden;
}
.wc-bar i {
  display: block;
  height: 100%;
  border-radius: var(--r-xs);
  background: var(--series);
}
.wc-bar i.is-down {
  background: var(--ink-3);
}
.wc-rows b {
  text-align: right;
}
.wc-say {
  margin: 0;
  color: var(--ink-2);
  font-size: var(--fs-14);
  line-height: var(--lh-body);
}
.wc-details {
  color: var(--ink-2);
  font-size: var(--fs-14);
}
.wc-details summary {
  display: flex;
  align-items: center;
  min-height: var(--hit);
  color: var(--link);
  cursor: pointer;
}
.wc-details summary:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.wc-details p {
  margin: 0;
  line-height: var(--lh-body);
}
</style>
