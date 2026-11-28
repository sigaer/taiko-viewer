<script setup lang="ts">
// ReworkCommunityMeTabs — the sections of /forum/me as links (the `tab` query), each with its count from
// /api/forum/me/summary once that read has returned. One row that scrolls sideways on phones; the current one is
// marked (aria-current) in the selected style.
import type { PropType } from "vue";

defineProps({
  tabs: { type: Array as PropType<Array<{ key: string; label: string; count: number | null; to: string }>>, required: true },
  current: { type: String, required: true },
  label: { type: String, required: true }
});
</script>

<template>
  <nav class="cmt" :aria-label="label">
    <ul class="cmt__list">
      <li v-for="tab in tabs" :key="tab.key">
        <NuxtLink :to="tab.to" class="cmt__tab" :aria-current="current === tab.key ? 'page' : undefined">
          <span>{{ tab.label }}</span><b v-if="tab.count !== null" class="cmt__n num">{{ tab.count }}</b>
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.cmt {
  min-width: 0;
  font-family: var(--font-ui);
}
.cmt__list {
  display: flex;
  gap: var(--sp-2);
  margin: 0;
  padding: 4px 4px var(--sp-1);
  list-style: none;
  overflow-x: auto;
  scrollbar-width: none;
}
.cmt__list::-webkit-scrollbar {
  display: none;
}
.cmt__tab {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  min-height: var(--hit);
  padding: 0 var(--sp-4);
  border: 1px solid var(--line-strong);
  border-radius: var(--r-note);
  background: var(--surface);
  color: var(--ink-2);
  font-size: var(--fs-14);
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
}
.cmt__tab:hover {
  background: var(--bg-sunk);
  color: var(--ink);
}
.cmt__tab:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.cmt__tab[aria-current] {
  border-color: var(--selected-line);
  background: var(--selected-bg);
  color: var(--selected-ink);
  font-weight: 700;
}
.cmt__n {
  font-size: var(--fs-12);
  color: var(--ink-3);
}
.cmt__tab[aria-current] .cmt__n {
  color: inherit;
}
</style>
