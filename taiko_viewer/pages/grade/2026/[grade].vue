<script setup lang="ts">
import { computed } from "vue";
import GradeDojoShell from "~/components/GradeDojoShell.vue";
import { buildPageDescription } from "~/utils/seo";
import gradeDojoData from "~/assets/data/grade_dojo_nijiiro_2026.json";

const pageMeta = {
  title: "虹段位道场 2026",
  desc: buildPageDescription("太鼓达人虹段位道场 2026，按级位与段位查看课题曲、合格条件与攻略。")
};

definePageMeta({
  pageTitle: "段位查询",
  pageDesc: "虹 2026",
  navKey: "/grade/2026",
  breadcrumbs: [{ label: "段位查询", to: "/grade/2026" }, { label: "虹 2026", to: "/grade/2026" }]
});

const route = useRoute();

const gradeGroups = [
  { label: "级位", items: ["五級", "四級", "三級", "二級", "一級"] },
  { label: "段位", items: ["初段", "二段", "三段", "四段", "五段", "六段", "七段", "八段", "九段", "十段"] }
] as const;

const pages = gradeDojoData.grades;
const defaultGrade = "五級";

const selectedSlug = computed(() => {
  const routeGrade = String(route.params.grade || "");
  return pages.some((page) => page.slug === routeGrade) ? routeGrade : defaultGrade;
});

const selectedPage = computed(() => {
  return pages.find((page) => page.slug === selectedSlug.value) ?? pages[0];
});

useViewerSeo(() => ({
  title: selectedPage.value ? `${selectedPage.value.displayTitle} - ${pageMeta.title}` : pageMeta.title,
  description: selectedPage.value
    ? buildPageDescription(`${selectedPage.value.displayTitle} 段位课题曲、合格条件与攻略摘录。`)
    : pageMeta.desc,
  path: `/grade/2026/${selectedSlug.value}`,
  keywords: ["段位查询", "虹段位道场", selectedPage.value?.displayTitle || "2026"]
}));
</script>

<template>
  <GradeDojoShell
    year-title="虹段位道场 2026"
    :pages="pages"
    :selected-slug="selectedSlug"
    :grade-groups="gradeGroups"
    base-path="/grade/2026"
  />
</template>
