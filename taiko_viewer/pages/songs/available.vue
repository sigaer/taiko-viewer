<script setup lang="ts">
import { buildPageDescription } from "~/utils/seo";

const pageMeta = {
  title: "现有歌曲",
  desc: buildPageDescription("国行太鼓现有歌曲列表，支持按曲名、分类与难度搜索。")
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
  path: "/songs/available",
  keywords: ["现有歌曲", "国行歌曲列表"],
  breadcrumbs: [
    { name: "首页", path: "/" },
    { name: "现有歌曲", path: "/songs/available" }
  ]
});
</script>

<template>
  <SongListContent
    :shelf-status="0"
    default-sort="open-day-desc"
    title="现有歌曲"
    desc="展示当前可用歌曲，默认按实装日期倒序排列，支持按名称与分类搜索。"
  />
</template>
