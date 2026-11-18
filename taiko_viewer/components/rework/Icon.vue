<script setup lang="ts">
defineProps<{ name: string }>();
const paths: Record<string, string> = {
  today: "M3 11 12 3l9 8M5 10v11h5v-7h4v7h5V10",
  songs: "M4 4h5v16H4zM12 4h4v16h-4zM19 5l3 14",
  play: "m8 4 12 8-12 8z",
  growth: "M3 20V4m0 16h18M6 15l5-5 4 3 6-8",
  community: "M3 4h18v13H9l-6 4zM7 8h10M7 12h7",
  tools: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  my: "M8 7a4 4 0 1 0 8 0 4 4 0 1 0-8 0M4 21a8 8 0 0 1 16 0",
  search: "M10 3a7 7 0 1 0 0 14 7 7 0 1 0 0-14m5 12 6 6",
  bell: "M5 17h14l-2-3V9a5 5 0 0 0-10 0v5zM10 21h4",
  sync: "M20 7a9 9 0 0 0-15-2L2 8m0-5v5h5M4 17a9 9 0 0 0 15 2l3-3m0 5v-5h-5",
  theme: "M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11",
  back: "m15 4-8 8 8 8",
  close: "m5 5 14 14M19 5 5 19",
};
</script>
<template>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="paths[name] || paths.tools" />
  </svg>
</template>
<style scoped>
svg {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
}
</style>
