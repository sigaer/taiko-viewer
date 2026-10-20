<script setup lang="ts">
import type { MobileTab } from "~/utils/navigation";
import { mobileTabLabelKey } from "~/utils/navigation";

defineProps<{ activeTab: MobileTab | null }>();

const { t } = useI18n();
const localePath = useLocalePath();

const tabs: Array<{ key: MobileTab; path: string; icon: string }> = [
  { key: "home", path: "/", icon: "M4 11.5l8-6 8 6v7a1 1 0 0 1-1 1h-4v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5H5a1 1 0 0 1-1-1v-7z" },
  { key: "songs", path: "/songs/available", icon: "M9 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zm8-2.5V6l-9 2.5v9.5" },
  { key: "community", path: "/forum", icon: "M5 6.5h14A1.5 1.5 0 0 1 20.5 8v8A1.5 1.5 0 0 1 19 17.5H10l-4.5 3V8A1.5 1.5 0 0 1 7 6.5z M9 10.25h6 M9 13.75h4" },
  { key: "my", path: "/my", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4.5 20a7.5 7.5 0 0 1 15 0" },
  { key: "more", path: "/more", icon: "M4 6h6v6H4z M14 6h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z" }
];
</script>

<template>
  <nav class="mobile-tabbar" :aria-label="t('layout.mobileNavigation')">
    <NuxtLink
      v-for="tab in tabs"
      :key="tab.key"
      :to="localePath(tab.path)"
      class="mobile-tabbar__item"
      :class="{ 'is-active': activeTab === tab.key }"
      :aria-current="activeTab === tab.key ? 'page' : undefined"
    >
      <span class="mobile-tabbar__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path :d="tab.icon" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </span>
      <span>{{ t(mobileTabLabelKey[tab.key]) }}</span>
    </NuxtLink>
  </nav>
</template>

<style scoped>
.mobile-tabbar{position:fixed;left:0;right:0;bottom:0;z-index:30;display:none;grid-template-columns:repeat(5,minmax(0,1fr));min-height:64px;padding:8px 10px max(8px,env(safe-area-inset-bottom));border-top:1px solid var(--viewer-border);background:var(--viewer-surface);}
.mobile-tabbar__item{min-width:44px;min-height:44px;display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:var(--viewer-text-muted);text-decoration:none;font-size:12px;font-weight:400;}
.mobile-tabbar__item.is-active{color:var(--viewer-primary);font-weight:600;}.mobile-tabbar__item:focus-visible{outline:3px solid var(--viewer-link);outline-offset:-3px;}
.mobile-tabbar__icon{width:20px;height:20px;display:inline-flex;}.mobile-tabbar__icon svg{width:100%;height:100%;}@media(max-width:960px){.mobile-tabbar{display:grid;}}
</style>
