<script setup lang="ts">
// Layout of the signed-in home (frozen Today.vue, adapted to the real data): who / greeting, then the deck (Rating
// and the six dimensions | the current goal), then what changed (since the last sync | today), then what to play next.
// The 21-day lane of the prototype is not drawn: no API returns per-day activity (stage-2-progress.md 切片 C).
// Slots: hello, notice, profile, goal, recent, daily, plan, default (dialogs). The markup of
// components/home/RecentGrowth.vue and DailyProgress.vue is styled here (they keep their logic and test hooks).
</script>

<template>
  <div class="tb">
    <slot name="hello" />
    <slot name="notice" />
    <div v-if="$slots.profile || $slots.goal" class="tb-deck" :class="{ 'has-goal': !!$slots.goal }">
      <div v-if="$slots.profile" class="tb-profile"><slot name="profile" /></div>
      <div v-if="$slots.goal" class="tb-goal"><slot name="goal" /></div>
    </div>
    <div v-if="$slots.recent || $slots.daily" class="tb-activity">
      <div v-if="$slots.recent" class="tb-recent"><slot name="recent" /></div>
      <div v-if="$slots.daily" class="tb-daily"><slot name="daily" /></div>
    </div>
    <slot name="plan" />
    <slot />
  </div>
</template>

<style scoped>
.tb {
  display: grid;
  gap: var(--sp-8);
  min-width: 0;
  color: var(--ink);
  font-family: var(--font-ui);
}
.tb-deck {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--sp-5);
  align-items: stretch;
}
.tb-deck.has-goal {
  grid-template-columns: minmax(0, 1.5fr) minmax(300px, 1fr);
}
.tb-profile,
.tb-goal {
  min-width: 0;
  display: grid;
}
/* The goal card keeps its natural height: song, goal line and actions stay together at the top. */
.tb-goal {
  align-self: start;
}
.tb-activity {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--sp-8);
  align-items: start;
}
.tb-recent,
.tb-daily {
  min-width: 0;
}
@media (max-width: 1099px) {
  .tb-deck.has-goal,
  .tb-activity {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 767px) {
  .tb {
    gap: var(--sp-6);
  }
}

/* ---------- section heads shared by recent / today ---------- */
.tb :deep(.recent-growth__head),
.tb :deep(.growth-progress__head) {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--sp-1) var(--sp-3);
  min-height: var(--hit);
  margin-bottom: var(--sp-2);
}
.tb :deep(.recent-growth h2),
.tb :deep(.growth-progress h2) {
  margin: 0;
  margin-right: auto;
  font-size: var(--fs-18);
  font-weight: 700;
  line-height: var(--lh-snug);
}
.tb :deep(.recent-growth time),
.tb :deep(.growth-progress time),
.tb :deep(.growth-progress__count) {
  color: var(--ink-3);
  font-size: var(--fs-13);
}

/* ---------- since the last sync (components/home/RecentGrowth.vue) ---------- */
.tb :deep(.recent-growth) {
  display: grid;
  min-width: 0;
}
.tb :deep(.recent-growth__list) {
  display: grid;
  border-top: 1px solid var(--line-strong);
}
.tb :deep(.recent-growth__fact) {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  align-items: center;
  gap: var(--sp-3);
  min-height: 56px;
  padding: var(--sp-2) 0;
  border-bottom: 1px solid var(--line);
  color: var(--ink);
  text-decoration: none;
}
.tb :deep(.recent-growth__fact:hover strong) {
  color: var(--link);
}
.tb :deep(.recent-growth__fact:focus-visible),
.tb :deep(.growth-event__identity:focus-visible) {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
  border-radius: var(--r-xs);
}
.tb :deep(.recent-growth__pulse) {
  justify-self: center;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--series);
}
.tb :deep(.recent-growth__copy) {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.tb :deep(.recent-growth__copy strong) {
  overflow: hidden;
  font-size: var(--fs-14);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tb :deep(.recent-growth__copy small) {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px 6px;
  color: var(--ink-2);
  font-size: var(--fs-13);
}
.tb :deep(.recent-growth__more),
.tb :deep(.recent-growth__empty) {
  margin: var(--sp-2) 0 0;
  color: var(--ink-2);
  font-size: var(--fs-14);
  line-height: var(--lh-body);
}
.tb :deep(.recent-growth--quiet .recent-growth__empty) {
  margin: 0;
  padding: var(--sp-3) var(--sp-4);
  border-radius: var(--r-panel);
  background: var(--surface-2);
}
.tb :deep(.recent-growth__state) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--sp-2) var(--sp-4);
  padding: var(--sp-3) var(--sp-4);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
  color: var(--ink-2);
  font-size: var(--fs-14);
}
.tb :deep(.recent-growth__loading) {
  display: grid;
  gap: var(--sp-2);
}
.tb :deep(.recent-growth__loading span) {
  height: 48px;
  border-radius: var(--r-ctl);
  background: var(--bg-sunk);
}

/* ---------- today (components/home/DailyProgress.vue) ---------- */
.tb :deep(.growth-progress) {
  display: grid;
  min-width: 0;
}
.tb :deep(.growth-progress__state) {
  margin: 0;
  padding: var(--sp-3) var(--sp-4);
  border-radius: var(--r-panel);
  background: var(--surface-2);
  color: var(--ink-2);
  font-size: var(--fs-14);
  line-height: var(--lh-body);
}
.tb :deep(.growth-progress__events) {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--line-strong);
}
.tb :deep(.growth-progress__state + .growth-progress__events) {
  margin-top: var(--sp-3);
}
.tb :deep(.growth-event) {
  display: grid;
  gap: var(--sp-2);
  padding: var(--sp-3) 0;
  border-bottom: 1px solid var(--line);
}
.tb :deep(.growth-event__identity) {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--sp-3);
  min-height: var(--hit);
  color: var(--ink);
  text-decoration: none;
}
.tb :deep(.growth-event__identity strong) {
  overflow: hidden;
  font-size: var(--fs-14);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tb :deep(.growth-event__identity:hover strong) {
  color: var(--link);
}
.tb :deep(.growth-event__diff) {
  color: var(--ink-3);
  font-size: var(--fs-12);
}
.tb :deep(.growth-event__facts) {
  display: grid;
  gap: var(--sp-1);
  margin: 0 0 0 44px;
  padding: 0;
  list-style: none;
  color: var(--ink);
  font-size: var(--fs-14);
}
.tb :deep(.growth-event__facts li) {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px var(--sp-2);
  min-width: 0;
}
.tb :deep(.growth-event__label),
.tb :deep(.growth-event__before),
.tb :deep(.growth-event__values small) {
  color: var(--ink-3);
}
.tb :deep(.growth-event__values) {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px 6px;
  font-family: var(--font-num);
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.tb :deep(.growth-event__values strong) {
  font-size: var(--fs-16);
  font-weight: 700;
}
@media (max-width: 767px) {
  .tb :deep(.growth-event__facts) {
    margin-left: 0;
  }
}
</style>
