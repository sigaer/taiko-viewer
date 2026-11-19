<script setup lang="ts">
// ReworkToolsCharts — the charts a lookup tool returns as title + course text (slice F: /tools/note-count), in the
// returned order. The API returns at most 20, so all are mounted.
defineProps<{ items: Array<{ title: string; course: string }> }>();
</script>

<template>
  <ol class="rtc">
    <li v-for="(item, index) in items" :key="`${item.title}-${item.course}-${index}`">
      <span class="rtc-title">{{ item.title }}</span>
      <span class="rtc-course">{{ item.course }}</span>
    </li>
  </ol>
</template>

<style scoped>
.rtc {
  margin: var(--sp-3) 0 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--line);
  font-family: var(--font-ui);
}
.rtc li {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px var(--sp-4);
  padding: var(--sp-2) 0;
  border-bottom: 1px solid var(--line);
  font-size: var(--fs-14);
}
.rtc-title {
  min-width: 0;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.rtc-course {
  color: var(--ink-2);
}
</style>
