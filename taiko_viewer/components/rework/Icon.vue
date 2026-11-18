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
  // slice B: score list and image tools
  lock: "M6 11h12v10H6zM8 11V8a4 4 0 0 1 8 0v3",
  edit: "M4 20h4L19 9l-4-4L4 16zM13 7l4 4",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14",
  chevron: "m6 9 6 6 6-6",
  plus: "M12 5v14M5 12h14",
  upload: "M12 16V4m-5 5 5-5 5 5M4 20h16",
  download: "M12 4v12m-5-5 5 5 5-5M4 20h16",
  open: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
  // slice C: a row that opens something (right), week / point stepping
  forward: "m9 4 8 8-8 8",
  // slice D: community (reply, like, views, mention, image, send)
  reply: "M5 5.5h14v10H9l-4 3z",
  heart: "M12 20.2 4.8 13a4.6 4.6 0 0 1 6.5-6.5l.7.7.7-.7A4.6 4.6 0 0 1 19.2 13z",
  heartFilled: "M12 20.2 4.8 13a4.6 4.6 0 0 1 6.5-6.5l.7.7.7-.7A4.6 4.6 0 0 1 19.2 13z",
  eye: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12M12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6",
  mention: "M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-3.5 7.1",
  image: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15.5 9h.01",
  send: "m4 12 16-8-5 16-3-7z",
  // slice E1: account (verified state, linked sign-in, sign out, e-mail, a warning)
  check: "m5 12.5 4.5 4.5L19 7.5",
  link: "M10 14a4.2 4.2 0 0 0 6 0l3-3a4.2 4.2 0 0 0-6-6l-1 1M14 10a4.2 4.2 0 0 0-6 0l-3 3a4.2 4.2 0 0 0 6 6l1-1",
  logout: "M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10",
  mail: "M3 6h18v12H3zM3 7l9 6.5L21 7",
  warn: "M12 4 2.5 20h19zM12 10v4.5M12 17.5h.01",
  // slice E2: copy an example or a token, a key (score token)
  copy: "M9 9h11v11H9zM15 5V4H4v11h1",
  key: "M14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0M13 13l7 7M17 17l2-2M15 15l1.5-1.5",
};
/** Icons drawn filled (the pressed state of like). */
const filled = new Set(["heartFilled"]);
</script>
<template>
  <svg
    viewBox="0 0 24 24"
    :fill="filled.has(name) ? 'currentColor' : 'none'"
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
