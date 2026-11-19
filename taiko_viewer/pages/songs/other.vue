<script setup lang="ts">
import { buildPageDescription } from "~/utils/seo";
const { t } = useI18n();

definePageMeta({
  pageTitleKey: "page.songs.other.title",
  pageDescKey: "page.songs.other.desc",
  navKey: "/songs/other",
  breadcrumbs: [{ labelKey: "page.songs.other.title", to: "/songs/other" }]
});

useViewerSeo(() => ({
  title: t("page.songs.other.title"),
  description: buildPageDescription(t("page.songs.other.desc")),
  path: "/songs/other",
  keywords: [t("page.songs.other.title"), t("page.songs.other.keyword")],
  breadcrumbs: [
    { name: t("nav.home"), path: "/" },
    { name: t("page.songs.other.title"), path: "/songs/other" }
  ]
}));
</script>

<template>
  <SongListContent :shelf-status="2" :title="t('page.songs.other.title')" :desc="t('page.songs.other.panelDesc')" />
</template>
