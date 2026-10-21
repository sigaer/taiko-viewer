<script setup lang="ts">
import { buildPageDescription, SITE_TITLE } from "~/utils/seo";

const { t, locale } = useI18n();
const localePath = useLocalePath();
const switchLocalePath = useSwitchLocalePath();
const runtimeConfig = useRuntimeConfig();
const appVersion = String(runtimeConfig.public.appVersion || "").trim() || "dev";

const localeOptions = computed(() => [
  { code: "zh", label: t("locale.zh"), path: switchLocalePath("zh") || localePath("/more") },
  { code: "ja", label: t("locale.ja"), path: switchLocalePath("ja") || localePath("/more") }
]);

definePageMeta({
  pageTitleKey: "nav.more",
  pageDescKey: "page.more.desc",
  navKey: "/more",
  hidePageDescription: true,
  breadcrumbs: [{ labelKey: "nav.more", to: "/more" }]
});

useViewerSeo(() => ({
  title: t("nav.more"),
  description: buildPageDescription(t("page.more.desc")),
  path: "/more"
}));

const groups = [
  {
    key: "discovery",
    title: "nav.discovery",
    items: [
      { path: "/grade", label: "nav.grade" },
      { path: "/guide", label: "nav.guide" },
      { path: "/titles", label: "nav.titles" }
    ]
  },
  {
    key: "tools",
    title: "nav.toolbox",
    items: [
      { path: "/tools", label: "nav.tools" },
      { path: "/tools/chart-config", label: "tools.chartConfig" },
      { path: "/tools/note-count", label: "tools.noteCount" }
    ]
  },
  {
    key: "account",
    title: "nav.accountGroup",
    items: [
      { path: "/account/sync", label: "account.sync" },
      { path: "/docs/score-token", label: "page.more.apiDocs" },
      { path: "/account/developer", label: "account.developer" },
      { path: "/settings", label: "nav.settings" },
      { path: "/about", label: "nav.about" }
    ]
  },
  {
    key: "support",
    title: "nav.support",
    items: [
      { path: "/support", label: "nav.support" },
      { path: "/alias-log", label: "nav.aliasLog" }
    ]
  }
];
</script>

<template>
  <div class="more-hub">
    <section v-for="group in groups" :key="group.key" class="more-group panel-card">
      <h2>{{ t(group.title) }}</h2>
      <div class="more-group__items">
        <NuxtLink v-for="item in group.items" :key="item.path" :to="localePath(item.path)" class="more-link">
          <span>{{ t(item.label) }}</span>
          <span aria-hidden="true">→</span>
        </NuxtLink>
      </div>
    </section>
    <section class="more-group panel-card more-language">
      <h2>{{ t("page.more.language") }}</h2>
      <div class="more-language__options">
        <NuxtLink
          v-for="item in localeOptions"
          :key="item.code"
          :to="item.path"
          class="more-language__option"
          :class="{ active: item.code === locale }"
        >
          {{ item.label }}
        </NuxtLink>
      </div>
    </section>
    <footer class="more-product-meta">
      {{ SITE_TITLE }} · v{{ appVersion }}
    </footer>
  </div>
</template>

<style scoped>
.more-hub {
  display: grid;
  gap: 16px;
}

.more-group {
  padding: 18px;
}

.more-group h2 {
  margin: 0 0 12px;
  color:var(--viewer-text);
  font-size: 16px;
}

.more-language__options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.more-language__option {
  min-height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 14px;
  border: 1px solid var(--viewer-border);
  border-radius: 999px;
  color:var(--viewer-text-muted);
  text-decoration: none;
  font-size: 13px;
  font-weight: 600;
}

.more-language__option.active {
  border-color:transparent;
  color:var(--viewer-on-primary);
  background:var(--viewer-accent-strong);
}

.more-product-meta {
  padding: 4px 4px 2px;
  color:var(--viewer-text-muted);
  font-size: 12px;
  line-height: 1.5;
  text-align: center;
}

:global(body.theme-dark .more-product-meta) {
  color:var(--viewer-text-muted);
}

.more-language__option:focus-visible,
.more-link:focus-visible {
  outline: 3px solid var(--viewer-accent-strong);
  outline-offset: 2px;
}

.more-group__items {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.more-link {
  min-height: 46px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--viewer-border);
  border-radius: 12px;
  color:var(--viewer-text);
  background:var(--viewer-surface-subtle);
  text-decoration: none;
  font-size: 13px;
  font-weight: 600;
}

.more-link:hover,
.more-link:focus-visible {
  border-color:var(--viewer-border);
  background:var(--viewer-surface-subtle);
}

@media (max-width: 560px) {
  .more-group__items {
    grid-template-columns: 1fr;
  }
}
</style>
