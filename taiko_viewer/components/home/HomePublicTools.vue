<script setup lang="ts">
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
  <section class="guest-tools" aria-labelledby="guest-tools-title">
    <HomeSectionHeader
      heading-id="guest-tools-title"
      :title="t('page.home.guest.publicTools')"
      :description="t('page.home.guest.publicToolsDescription')"
      :link-label="t('common.viewAll')"
      :link-to="localePath('/tools')"
    />
    <div class="guest-tools__grid">
      <NuxtLink
        v-for="tool in tools"
        :key="tool.path"
        :to="localePath(tool.path)"
        class="guest-tool panel-card"
        @click="trackViewerEvent('home_public_tool_click', { home_state: 'guest', tool_path: tool.path })"
      >
        <span aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path :d="tool.icon" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
        <strong>{{ t(tool.label) }}</strong>
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m9 6 6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
      </NuxtLink>
    </div>
  </section>
</template>

<style scoped>
.guest-tools {
  display: grid;
  gap: 14px;
}

.guest-tools__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.guest-tool {
  min-height: 108px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 18px;
  color: var(--viewer-text);
  text-decoration: none;
  transition: transform 0.18s ease, border-color 0.18s ease;
}

.guest-tool > span {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: 13px;
  color: #a85f3e;
  background: rgba(168, 95, 62, 0.1);
}

.guest-tool svg {
  width: 21px;
  height: 21px;
}

.guest-tool > svg {
  width: 18px;
  color: var(--viewer-text-muted);
}

.guest-tool:hover {
  transform: translateY(-2px);
  border-color: rgba(168, 95, 62, 0.34);
}

.guest-tool:focus-visible {
  outline: 3px solid #a85f3e;
  outline-offset: 3px;
}

@media (max-width: 980px) {
  .guest-tools__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .guest-tools__grid {
    gap: 8px;
  }

  .guest-tool {
    min-height: 88px;
    grid-template-columns: auto minmax(0, 1fr);
    padding: 13px;
  }

  .guest-tool > svg {
    display: none;
  }

  .guest-tool strong {
    font-size: 13px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .guest-tool {
    transition: none;
  }
}
</style>
