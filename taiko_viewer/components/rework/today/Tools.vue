<script setup lang="ts">
// Public tools of the home page (was components/home/HomePublicTools.vue): the same four destinations and "view all"
// (/more); analytics event unchanged.
import { trackViewerEvent } from "~/utils/analytics";

const { t } = useI18n();
const localePath = useLocalePath();
const tools = [
  { path: "/tools/chart-config", label: "tools.chartConfig", icon: "M5 5h14v14H5z M8 9h8 M8 12h5 M8 15h7" },
  { path: "/tools/note-count", label: "tools.noteCount", icon: "M7 4h10v16H7z M10 8h4 M10 12h4 M10 16h2" },
  { path: "/guide", label: "nav.guide", icon: "M4.5 5.5H12a2 2 0 0 1 2 2v11H6.5a2 2 0 0 0-2 2z M19.5 5.5H12a2 2 0 0 0-2 2v11h7.5a2 2 0 0 1 2 2z" },
  { path: "/grade/2026", label: "nav.grade", icon: "M7 4h10v3a5 5 0 0 1-10 0z M5 6H3v1a4 4 0 0 0 4 4 M19 6h2v1a4 4 0 0 1-4 4 M9 19h6" }
];
</script>

<template>
  <ReworkPanel class="tt guest-tools" plain :title="t('page.home.guest.publicTools')">
    <template #actions>
      <NuxtLink class="rw-link tt-more" :to="localePath('/more')">{{ t("common.viewAll") }}</NuxtLink>
    </template>
    <ul class="tt-grid">
      <li v-for="tool in tools" :key="tool.path">
        <NuxtLink :to="localePath(tool.path)" class="tt-tool" @click="trackViewerEvent('home_public_tool_click', { home_state: 'guest', tool_path: tool.path })">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="tool.icon" /></svg>
          <b>{{ t(tool.label) }}</b>
        </NuxtLink>
      </li>
    </ul>
  </ReworkPanel>
</template>

<style scoped>
.tt-more {
  display: inline-flex;
  align-items: center;
  min-height: var(--hit);
  font-size: var(--fs-13);
}
.tt-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 0;
  padding: 0;
  overflow: hidden;
  list-style: none;
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
}
.tt-grid li {
  min-width: 0;
}
.tt-grid li + li {
  border-left: 1px solid var(--line);
}
.tt-tool {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  min-height: 92px;
  padding: var(--sp-4) var(--sp-5);
  color: var(--ink);
  text-decoration: none;
}
.tt-tool:hover {
  background: var(--surface-2);
}
.tt-tool:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: -2px;
}
.tt-tool svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: var(--ink-2);
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.tt-tool b {
  font-size: var(--fs-16);
  font-weight: 700;
  overflow-wrap: anywhere;
}
@media (max-width: 767px) {
  .tt-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .tt-grid li + li {
    border-left: 0;
  }
  .tt-grid li:nth-child(2n) {
    border-left: 1px solid var(--line);
  }
  .tt-grid li:nth-child(-n + 2) {
    border-bottom: 1px solid var(--line);
  }
  .tt-tool {
    min-height: 76px;
    padding: var(--sp-3) var(--sp-4);
  }
  .tt-tool b {
    font-size: var(--fs-14);
  }
}
</style>
