<script setup lang="ts">
import { computed } from "vue";
import type { TitleCatalogItem } from "~/types/content";
import { buildPageDescription } from "~/utils/seo";

const { data: titleTableData, pending, error, refresh } = await useTitlesContent();

const titles = computed<TitleCatalogItem[]>(() => titleTableData.value?.titles || []);
const { t } = useI18n();

definePageMeta({
  contentLayout: "wide",
  pageTitleKey: "page.titles.title",
  pageDescKey: "page.titles.desc",
  navKey: "/titles",
  hidePageHeader: true,
  breadcrumbs: [{ labelKey: "nav.titles", to: "/titles" }]
});

useViewerSeo(() => ({
  title: t("page.titles.title"),
  description: buildPageDescription(t("page.titles.desc")),
  path: "/titles",
  keywords: [t("page.titles.title"), t("page.titles.keyword")],
  breadcrumbs: [
    { name: t("nav.home"), path: "/" },
    { name: t("nav.titles"), path: "/titles" }
  ]
}));
</script>

<template>
  <div class="rw-stack">
    <ReworkPageHeader :title="t('rework.titles')" />
    <ReworkTitlesList :titles="titles" :pending="pending" :failed="Boolean(error)" @retry="refresh()" />
  </div>
</template>
