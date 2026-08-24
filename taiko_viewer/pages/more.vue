<script setup lang="ts">
import { buildPageDescription } from "~/utils/seo";

const { t } = useI18n();
const localePath = useLocalePath();

definePageMeta({
  pageTitleKey: "nav.more",
  pageDescKey: "page.more.desc",
  navKey: "/more",
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
      { path: "/titles", label: "nav.titles" },
      { path: "/forum", label: "nav.forum" }
    ]
  },
  {
    key: "tools",
    title: "nav.toolbox",
    items: [
      { path: "/tools", label: "nav.tools" },
      { path: "/tools/chart-config", label: "tools.chartConfig" },
      { path: "/tools/note-count", label: "tools.noteCount" },
      { path: "/tools/word-cloud", label: "tools.wordCloud" }
    ]
  },
  {
    key: "account",
    title: "nav.accountGroup",
    items: [
      { path: "/account/sync", label: "account.sync" },
      { path: "/account/developer", label: "account.developer" },
      { path: "/settings", label: "nav.settings" },
      { path: "/about", label: "nav.about" }
    ]
  },
  {
    key: "support",
    title: "nav.community",
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
  color: var(--viewer-text);
  font-size: 16px;
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
  color: var(--viewer-text);
  background: rgba(255, 255, 255, 0.42);
  text-decoration: none;
  font-size: 13px;
  font-weight: 600;
}

.more-link:hover,
.more-link:focus-visible {
  border-color: rgba(196, 164, 132, 0.62);
  background: rgba(196, 164, 132, 0.12);
}

@media (max-width: 560px) {
  .more-group__items {
    grid-template-columns: 1fr;
  }
}
</style>
