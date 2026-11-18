<script setup lang="ts">
import { buildPageDescription } from "~/utils/seo";
import { legacyGradePage } from "~/utils/gradeDojoLegacy";
import { danSongTitles } from "~/utils/rework/dan";

const pageMeta = {
  title: "虹段位道场 2024",
  desc: buildPageDescription("太鼓达人虹段位道场 2024 入口，查看各级段位课题曲与合格条件。")
};

definePageMeta({
  contentLayout: "wide",
  pageTitle: "段位查询",
  pageDesc: "虹 2024",
  navKey: "/grade/2024",
  hidePageHeader: true,
  reworkElementPlus: true,
  breadcrumbs: [{ label: "段位查询", to: "/grade/2025" }, { label: "虹 2024", to: "/grade/2024" }]
});

useViewerSeo({
  title: pageMeta.title,
  description: pageMeta.desc,
  path: "/grade/2024",
  keywords: ["段位查询", "虹段位道场", "2024"]
});

const { t } = useI18n();
const page = legacyGradePage("2024");
const { data: songLinks } = useDanSongLinks(() => "2024", () => danSongTitles(page));
</script>

<template>
  <div class="rw-stack">
    <ReworkPageHeader :title="t('rework.grade')" />
    <ReworkDanCourse :page="page" year="2024" base-path="/grade/2024" :links="songLinks" />
  </div>
</template>
