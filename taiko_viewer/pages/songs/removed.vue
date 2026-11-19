<script setup lang="ts">
import { buildPageDescription } from "~/utils/seo";
const { t } = useI18n();

definePageMeta({
  pageTitleKey: "page.songs.removed.title",
  pageDescKey: "page.songs.removed.desc",
  navKey: "/songs/removed",
  breadcrumbs: [{ labelKey: "page.songs.removed.title", to: "/songs/removed" }]
});

useViewerSeo(() => ({
  title: t("page.songs.removed.title"),
  description: buildPageDescription(t("page.songs.removed.desc")),
  path: "/songs/removed",
  keywords: [t("page.songs.removed.title"), t("page.songs.removed.keyword")],
  breadcrumbs: [
    { name: t("nav.home"), path: "/" },
    { name: t("page.songs.removed.title"), path: "/songs/removed" }
  ]
}));
</script>

<template>
  <SongListContent :shelf-status="1" :title="t('page.songs.removed.title')" :desc="t('page.songs.removed.panelDesc')" />
</template>
