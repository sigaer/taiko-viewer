<script setup lang="ts">
import { computed } from "vue";
import { buildPageDescription } from "~/utils/seo";
import { danSongTitles, type GradeGroup, type GradePage } from "~/utils/rework/dan";
import gradeDojoData from "~/assets/data/grade_dojo_nijiiro_2026.json";

const pageMeta = {
  title: "虹段位道场 2026",
  desc: buildPageDescription("太鼓达人虹段位道场 2026，按级位、段位与达人位查看课题曲、合格条件与攻略。")
};

definePageMeta({
  contentLayout: "wide",
  pageTitle: "段位查询",
  pageDesc: "虹 2026",
  navKey: "/grade/2026",
  hidePageHeader: true,
  reworkElementPlus: true,
  breadcrumbs: [{ label: "段位查询", to: "/grade/2026" }, { label: "虹 2026", to: "/grade/2026" }]
});

const route = useRoute();
const { t } = useI18n();

const gradeGroups: readonly GradeGroup[] = [
  { key: "kyu", items: ["五級", "四級", "三級", "二級", "一級"] },
  { key: "dan", items: ["初段", "二段", "三段", "四段", "五段", "六段", "七段", "八段", "九段", "十段"] },
  { key: "jin", items: ["玄人", "名人", "超人", "達人"] }
];

const pages = gradeDojoData.grades as GradePage[];
const defaultGrade = "五級";
// Each grade is its own (kept-alive) page instance: it follows only the grade it was opened with.
const routeGrade = String(route.params.grade || "");

const selectedSlug = computed(() => {
  return pages.some((page) => page.slug === routeGrade) ? routeGrade : defaultGrade;
});

const selectedPage = computed(() => {
  return pages.find((page) => page.slug === selectedSlug.value) ?? pages[0];
});

const { data: songLinks } = useDanSongLinks(
  () => `2026-${selectedSlug.value}`,
  () => danSongTitles(selectedPage.value)
);

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
  <div class="rw-stack">
    <ReworkPageHeader :title="t('rework.grade')" />
    <ReworkDanCourse
      :page="selectedPage"
      year="2026"
      :groups="gradeGroups"
      base-path="/grade/2026"
      :links="songLinks"
      :overview="{ href: '/nijiiro_2026_dan_overview.png' }"
    />
  </div>
</template>
