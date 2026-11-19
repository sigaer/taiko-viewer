<script setup lang="ts">
definePageMeta({
  pageTitleKey: "community.relatedDiscussions",
  navKey: "/forum",
  breadcrumbs: [
    { labelKey: "forum.title", to: "/forum" },
    { labelKey: "community.relatedDiscussions" }
  ]
});
</script>

<template>
  <ForumThreadListPage />
</template>
