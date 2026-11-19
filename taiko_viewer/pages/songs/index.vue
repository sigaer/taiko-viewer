<script setup lang="ts">
import { buildPageDescription } from "~/utils/seo";
import { catalogQuery, catalogState, isLibraryPath, type CatalogState } from "~/utils/rework/catalog";

const { t } = useI18n();
const route = useRoute();

definePageMeta({
  contentLayout: "wide",
  pageTitleKey: "rework.songs",
  hidePageHeader: true,
  breadcrumbs: [{ labelKey: "rework.songs", to: "/songs" }]
});

// SEO follows this page's own query only (the page is kept alive across routes).
const seoState = shallowRef<CatalogState>(catalogState(route.query));
watch(
  () => route.fullPath,
  () => {
    if (isLibraryPath(route.path)) seoState.value = catalogState(route.query);
  }
);
useViewerSeo(() => {
  const { shelf, sort, page, q } = seoState.value;
  return {
    title: t(`page.songs.${shelf}.title`),
    description: buildPageDescription(t(`page.songs.${shelf}.desc`)),
    path: "/songs",
    // Keyword results are not advertised as their own pages: canonical without q, and noindex.
    query: catalogQuery({ shelf, sort, page }),
    robots: q ? "noindex, follow" : undefined,
    keywords: [t(`page.songs.${shelf}.title`), t(`page.songs.${shelf}.keyword`)],
    breadcrumbs: [
      { name: t("nav.home"), path: "/" },
      { name: t(`page.songs.${shelf}.title`), path: "/songs" }
    ]
  };
});
</script>

<template>
  <ReworkLibrary />
</template>
