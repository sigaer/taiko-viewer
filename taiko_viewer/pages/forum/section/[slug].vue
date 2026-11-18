<script setup lang="ts">
definePageMeta({
  pageTitleKey: "page.forum.section.title",
  pageDescKey: "page.forum.section.desc",
  navKey: "/forum",
  hidePageHeader: true,
  contentLayout: "wide",
  breadcrumbs: [
    { labelKey: "forum.title", to: "/forum" },
    { labelKey: "page.forum.section.title" }
  ]
});
</script>

<template>
  <ReworkCommunityListPage />
</template>
