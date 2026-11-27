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
  // slice G: settings in the account menu (a cog: hub and eight teeth)
  settings: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1",
  // redesign v2 shell: the navigation model's entries (utils/rework/navigation.ts), the drawer button
  music: "M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
  table: "M3 5h18v14H3zM3 10h18M3 15h18M9 5v14",
  medal: "M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8.5 14.5 7 22l5-3 5 3-1.5-7.5",
  book: "M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z",
  tag: "M3 12V3h9l9 9-9 9zM7.5 7.5h.01",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  bars: "M5 21V10M12 21V3M19 21v-7",
  trend: "M3 17l6-6 4 4 8-8M15 7h6v6",
  grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
  sprout: "M12 21V11M12 11c0-4 3-7 8-7 0 5-3 8-8 7zM12 14c0-3-2-5-7-5 0 4 2 6 7 5z",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  calc: "M6 3h12v18H6zM9 7h6M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01",
  config: "M4 6h9M17 6h3M15 4v4M4 12h3M11 12h9M9 10v4M4 18h11M19 18h1M17 16v4",
  hash: "M5 9h14M5 15h14M10 4 8 20M16 4l-2 16",
  file: "M7 3h7l5 5v13H7zM14 3v5h5",
  cloud: "M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9.5 4.3 4.3 0 0 1 17.5 18z",
  support: "M4 13a8 8 0 0 1 16 0M4 13v4h3v-5H4M20 13v4h-3v-5h3M17 17c0 2-2 3-5 3",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 11v6M12 7.5h.01",
  code: "m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16",
  history: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2",
  menu: "M4 6h16M4 12h16M4 18h16",
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
