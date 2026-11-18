<script setup lang="ts">
import { GUIDE_DIFFICULTY_OPTIONS } from "~/utils/guide";
import { buildPageDescription } from "~/utils/seo";

const route = useRoute();
const { t } = useI18n();
const localePath = useLocalePath();
const difficulty = Number(route.query.difficulty || 0);
const level = Number(route.query.level || 0);

if (Number.isInteger(difficulty) && difficulty > 0 && Number.isInteger(level) && level > 0) {
  await navigateTo(localePath(`/guide/${difficulty}/${level}`), { redirectCode: 301 });
}

definePageMeta({
  pageTitleKey: "guide.title",
  pageDescKey: "page.guide.index.desc",
  navKey: "/guide",
  hidePageHeader: true,
  reworkElementPlus: true,
  breadcrumbs: [{ labelKey: "guide.title", to: "/guide" }]
});

useViewerSeo(() => ({
  title: t("guide.title"),
  description: buildPageDescription(t("page.guide.index.desc")),
  path: "/guide",
  keywords: [t("guide.title"), t("page.guide.index.keyword")],
  breadcrumbs: [
    { name: t("nav.home"), path: "/" },
    { name: t("guide.title"), path: "/guide" }
  ]
}));
</script>

<template>
  <div class="rw-stack">
    <ReworkPageHeader :title="t('rework.guide')">
      <template #actions><img src="/optimized/guide-makina-160.webp" alt="" width="72" height="72" decoding="async" /></template>
    </ReworkPageHeader>
    <ReworkGuideEntry :groups="GUIDE_DIFFICULTY_OPTIONS" />
  </div>
</template>
