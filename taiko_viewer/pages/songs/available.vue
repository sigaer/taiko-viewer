<script setup lang="ts">
import { buildPageDescription } from "~/utils/seo";
const { t } = useI18n();

definePageMeta({
  pageTitleKey: "page.songs.available.title",
  pageDescKey: "page.songs.available.desc",
  navKey: "/songs/available",
  breadcrumbs: [{ labelKey: "page.songs.available.title", to: "/songs/available" }]
});

useViewerSeo(() => ({
  title: t("page.songs.available.title"),
  description: buildPageDescription(t("page.songs.available.desc")),
  path: "/songs/available",
  keywords: [t("page.songs.available.title"), t("page.songs.available.keyword")],
  breadcrumbs: [
    { name: t("nav.home"), path: "/" },
    { name: t("page.songs.available.title"), path: "/songs/available" }
  ]
}));
</script>

<template>
  <SongListContent
    :shelf-status="0"
    default-sort="open-day-desc"
    :title="t('page.songs.available.title')"
    :desc="t('page.songs.available.panelDesc')"
  />
</template>
