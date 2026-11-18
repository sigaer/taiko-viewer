<script setup lang="ts">
import { computed } from "vue";
import { buildPageDescription } from "~/utils/seo";
import { danSongTitles, type GradeGroup, type GradePage } from "~/utils/rework/dan";
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
  hidePageHeader: true,
  reworkElementPlus: true,
  breadcrumbs: [{ label: "段位查询", to: "/grade/2025" }, { label: "虹 2025", to: "/grade/2025" }]
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
  () => `2025-${selectedSlug.value}`,
  () => danSongTitles(selectedPage.value)
);

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
  <div class="rw-stack">
    <ReworkPageHeader :title="t('rework.grade')" />
    <ReworkDanCourse
      :page="selectedPage"
      year="2025"
      :groups="gradeGroups"
      base-path="/grade/2025"
      :links="songLinks"
      :overview="null"
    />
  </div>
</template>
