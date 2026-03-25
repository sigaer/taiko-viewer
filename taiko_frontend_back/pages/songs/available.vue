<script setup lang="ts">
const pageMeta = {
  title: "现有歌曲",
  desc: "展示当前可用歌曲，支持按名称与分类搜索。"
};

definePageMeta({
  pageTitle: pageMeta.title,
  pageDesc: pageMeta.desc,
  navKey: "/songs/available",
  breadcrumbs: [{ label: "现有歌曲", to: "/songs/available" }]
});

useViewerSeo({
  title: pageMeta.title,
  description: pageMeta.desc,
  path: "/songs/available"
});
</script>

<template>
  <SongListContent :shelf-status="0" title="现有歌曲" desc="展示当前可用歌曲，支持按名称与分类搜索。" />
</template>
