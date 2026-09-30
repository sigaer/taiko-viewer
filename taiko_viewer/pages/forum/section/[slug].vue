<script setup lang="ts">
definePageMeta({
  pageTitleKey: "page.forum.section.title",
  pageDescKey: "page.forum.section.desc",
  navKey: "/forum",
  breadcrumbs: [
    { labelKey: "forum.title", to: "/forum" },
    { labelKey: "page.forum.section.title" }
  ]
});
</script>

<template>
  <ForumThreadListPage />
</template>
