<script setup lang="ts">
import { computed } from "vue";
import GradeDojoShell from "~/components/GradeDojoShell.vue";
import { buildPageDescription } from "~/utils/seo";
import gradeDojoData from "~/assets/data/grade_dojo_nijiiro_2025.json";

const pageMeta = {
  title: "虹段位道场 2025",
  desc: buildPageDescription("太鼓达人虹段位道场 2025，按级位、段位与达人位查看课题曲、合格条件与攻略。")
};

definePageMeta({
  contentLayout: "wide",
  pageTitle: "段位查询",
  pageDesc: "虹 2025",
  navKey: "/grade/2025",
  breadcrumbs: [{ label: "段位查询", to: "/grade/2025" }, { label: "虹 2025", to: "/grade/2025" }]
});

const route = useRoute();

const gradeGroups = [
  { label: "级位", items: ["五級", "四級", "三級", "二級", "一級"] },
  { label: "段位", items: ["初段", "二段", "三段", "四段", "五段", "六段", "七段", "八段", "九段", "十段"] },
  { label: "达人位", items: ["玄人", "名人", "超人", "達人"] }
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
  path: `/grade/2025/${selectedSlug.value}`,
  keywords: ["段位查询", "虹段位道场", selectedPage.value?.displayTitle || "2025"]
}));
</script>

<template>
  <GradeDojoShell
    year-title="虹段位道场 2025"
    :pages="pages"
    :selected-slug="selectedSlug"
    :grade-groups="gradeGroups"
    base-path="/grade/2025"
  />
</template>
