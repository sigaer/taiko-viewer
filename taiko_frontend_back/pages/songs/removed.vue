<script setup lang="ts">
const pageMeta = {
  title: "已下架歌曲",
  desc: "展示已下架歌曲，支持按名称与分类搜索。"
};

definePageMeta({
  pageTitle: pageMeta.title,
  pageDesc: pageMeta.desc,
  navKey: "/songs/removed",
  breadcrumbs: [{ label: "已下架歌曲", to: "/songs/removed" }]
});

useViewerSeo({
  title: pageMeta.title,
  description: pageMeta.desc,
  path: "/songs/removed"
});
</script>

<template>
  <SongListContent :shelf-status="1" title="已下架歌曲" desc="展示已下架歌曲，支持按名称与分类搜索。" />
</template>
