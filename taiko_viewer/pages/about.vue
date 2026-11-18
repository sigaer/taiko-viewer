<script setup lang="ts">
import { computed } from "vue";
import { buildPageDescription } from "~/utils/seo";

const { t } = useI18n();

definePageMeta({
  contentLayout: "standard", // slice G: one content width for the 工具 group (the column keeps 800 px)
  pageTitleKey: "nav.about",
  pageDescKey: "page.about.desc",
  navKey: "/about",
  hidePageHeader: true,
  breadcrumbs: [{ labelKey: "nav.about", to: "/about" }]
});

useViewerSeo(() => ({
  title: t("nav.about"),
  description: buildPageDescription(t("page.about.desc")),
  path: "/about",
  keywords: [t("nav.about"), t("rework.aboutPage.teamTitle")]
}));

// Copy and roles in locales/{zh,ja}.json rework.aboutPage (moved word for word in slice F); names and photos as before.
const team = computed(() => [
  { name: "马路", role: t("rework.aboutPage.roles.maru"), avatar: "/avatar/maru.jpg" },
  { name: "sigaer", role: t("rework.aboutPage.roles.sigaer"), avatar: "/avatar/sigaer.jpg" },
  { name: "Sparklizm/星川sutari", role: t("rework.aboutPage.roles.sutari"), avatar: "/avatar/sutari.png" },
  { name: "Hyperionml/百里莫凌", role: t("rework.aboutPage.roles.baili"), avatar: "/avatar/baili.jpg" }
]);

const stacks = [
  "Nuxt 3",
  "Vue 3",
  "TypeScript",
  "Element Plus",
  "Spring Boot 3",
  "Java 21",
  "MyBatis",
  "MySQL",
  "PageHelper",
  "Springdoc OpenAPI",
  "JWT (jjwt)",
  "Fastjson2",
  "Maven"
];
</script>

<template>
  <div class="rw-stack">
    <ReworkPageHeader :title="t('nav.about')" />
    <ReworkInfoAbout :team="team" :stacks="stacks" />
  </div>
</template>
