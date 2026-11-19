<script setup lang="ts">
// ReworkToolsExamples — the example queries of a lookup tool (slice F: /tools/chart-config). Each example fills the
// field when chosen; the note says what an omitted part defaults to.
defineProps<{ examples: string[]; note?: string }>();
const emit = defineEmits<{ pick: [value: string] }>();
const { t } = useI18n();
</script>

<template>
  <div class="rte">
    <span class="rte-label">{{ t("rework.toolPages.examples") }}</span>
    <ul class="rte-list">
      <li v-for="example in examples" :key="example">
        <button type="button" class="rte-chip num" @click="emit('pick', example)"><code>{{ example }}</code></button>
      </li>
    </ul>
    <span v-if="note" class="rte-note">{{ note }}</span>
  </div>
</template>

<style scoped>
.rte {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-2) var(--sp-3);
  margin-top: var(--sp-3);
  font-family: var(--font-ui);
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.rte-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.rte-chip {
  display: inline-flex;
  align-items: center;
  min-height: var(--hit);
  padding: 0 var(--sp-3);
  border: 1px solid var(--line);
  border-radius: var(--r-ctl);
  background: var(--bg-sunk);
  color: var(--ink);
  font: inherit;
  cursor: pointer;
}
.rte-chip:hover {
  border-color: var(--line-strong);
}
.rte-chip:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.rte-chip code {
  font-family: var(--font-num), ui-monospace, monospace;
  font-size: var(--fs-14);
}
.rte-note {
  color: var(--ink-3);
}
</style>
