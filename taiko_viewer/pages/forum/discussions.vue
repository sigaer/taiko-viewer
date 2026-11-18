<script setup lang="ts">
definePageMeta({
  pageTitleKey: "community.relatedDiscussions",
  navKey: "/forum",
  hidePageHeader: true,
  contentLayout: "wide",
  reworkElementPlus: true,
  breadcrumbs: [
    { labelKey: "forum.title", to: "/forum" },
    { labelKey: "community.relatedDiscussions" }
  ]
});
</script>

<template>
  <ReworkCommunityListPage />
</template>
