<script setup lang="ts">
// Layout of the signed-in home with data (redesign 2026-11-27, Main / Mobile-Today): greeting, notices, a deck of the
// vermilion Rating card, the six dimensions and the goal; the phone's 常用 grid; then two columns from a 1000 px
// container: recent changes and the recommendations on the left, today's progress and current events on the right;
// latest songs across the width. Below 1000 px the columns stack; on phones the wrappers dissolve so the Rating card
// comes first and the 常用 grid right after it. Every block is a card (--r-panel) with hairline rows.
// RecentGrowth and DailyProgress retain their data, interactions and test hooks.
</script>

<template>
  <div class="tb">
    <div class="tb-hello"><slot name="hello" /></div>
    <div class="tb-notice"><slot name="notice" /></div>
    <div class="tb-deck" :class="{ 'has-goal': !!$slots.goal }">
      <div v-if="$slots.hero" class="tb-hero"><slot name="hero" /></div>
      <div v-if="$slots.profile" class="tb-profile"><slot name="profile" /></div>
      <div v-if="$slots.goal" class="tb-goal"><slot name="goal" /></div>
    </div>
    <div v-if="$slots.quick" class="tb-quick"><slot name="quick" /></div>
    <div class="tb-main">
      <div v-if="$slots.recent" class="tb-recent"><slot name="recent" /></div>
      <div v-if="$slots.plan" class="tb-plan"><slot name="plan" /></div>
    </div>
    <aside class="tb-side">
      <div v-if="$slots.daily" class="tb-daily"><slot name="daily" /></div>
      <div v-if="$slots.events" class="tb-events"><slot name="events" /></div>
    </aside>
    <div v-if="$slots.latest" class="tb-latest"><slot name="latest" /></div>
    <slot />
  </div>
</template>

<style scoped>
.tb {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--sp-5);
  min-width: 0;
  color: var(--ink);
  font-family: var(--font-ui);
}
.tb > div,
.tb-main > div,
.tb-side > div,
.tb-deck > div {
  min-width: 0;
}
.tb-notice:has(> :not(:empty)) {
  display: grid;
  gap: var(--sp-3);
}
.tb-notice:not(:has(> :not(:empty))) {
  display: none;
}
.tb-deck {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
  gap: var(--sp-5);
  align-items: stretch;
}
.tb-hero,
.tb-profile,
.tb-goal {
  display: grid;
}
.tb-quick {
  display: none;
}
.tb-main,
.tb-side {
  display: grid;
  gap: var(--sp-5);
  align-content: start;
  min-width: 0;
}
@container home-layout (min-width: 1000px) {
  .tb {
    grid-template-columns: minmax(0, 1.8fr) minmax(0, 1fr);
    align-items: start;
  }
  .tb-hello,
  .tb-notice,
  .tb-deck,
  .tb-latest {
    grid-column: 1 / -1;
  }
  .tb-deck {
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  }
  .tb-deck.has-goal {
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr) minmax(0, 1fr);
  }
  .tb-main {
    container: home-main / inline-size;
  }
  .tb-side :deep(.te-list) {
    grid-template-columns: minmax(0, 1fr);
  }
}
/* Phones: one column in reading order, the Rating card first and the 常用 grid right after it. */
@media (max-width: 767px) {
  .tb {
    gap: var(--sp-4);
  }
  .tb-deck,
  .tb-main,
  .tb-side {
    display: contents;
  }
  .tb-hello { order: 0; }
  .tb-notice { order: 1; }
  .tb-hero { order: 2; }
  .tb-quick { order: 3; display: block; }
  .tb-goal { order: 4; }
  .tb-recent { order: 5; }
  .tb-daily { order: 6; }
  .tb-plan { order: 7; }
  .tb-profile { order: 8; }
  .tb-latest { order: 9; }
  .tb-events { order: 10; }
}

/* ---------- cards: recent changes and today's progress ---------- */
.tb :deep(.recent-growth),
.tb :deep(.growth-progress) {
  padding: var(--sp-4) var(--sp-5) var(--sp-3);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
}
@media (max-width: 767px) {
  .tb :deep(.recent-growth),
  .tb :deep(.growth-progress) {
    padding: var(--sp-3) var(--sp-4) var(--sp-2);
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
  font-size: var(--fs-16);
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
}
.tb :deep(.recent-growth__fact) {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  align-items: center;
  gap: var(--sp-3);
  min-height: 56px;
  padding: var(--sp-2) 0;
  border-top: 1px solid var(--line);
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
  margin: 0 0 var(--sp-1);
}
.tb :deep(.recent-growth__state) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--sp-2) var(--sp-4);
  padding: var(--sp-2) 0 var(--sp-3);
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
  margin: 0 0 var(--sp-2);
  color: var(--ink-2);
  font-size: var(--fs-14);
  line-height: var(--lh-body);
}
.tb :deep(.growth-progress__events) {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}
.tb :deep(.growth-progress__state + .growth-progress__events) {
  margin-top: var(--sp-3);
}
.tb :deep(.growth-event) {
  display: grid;
  gap: var(--sp-2);
  padding: var(--sp-3) 0;
  border-top: 1px solid var(--line);
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
  font-family: var(--font-display);
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
