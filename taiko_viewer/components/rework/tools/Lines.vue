<script setup lang="ts">
// ReworkToolsLines — the text lines a lookup tool returns (slice F: /tools/chart-config), as returned, one per line.
// Long lines wrap inside the block; the page never scrolls sideways.
defineProps<{ lines: string[]; label: string }>();
</script>

<template>
  <section class="rtl" :aria-label="label">
    <pre class="rtl-pre" tabindex="0">{{ lines.join("\n") }}</pre>
  </section>
</template>

<style scoped>
.rtl {
  min-width: 0;
}
.rtl-pre {
  margin: 0;
  padding: var(--sp-4);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
  color: var(--ink);
  font-family: var(--font-ui);
  font-size: var(--fs-14);
  line-height: 1.7;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-height: 70vh;
  overflow: auto;
}
.rtl-pre:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
</style>
