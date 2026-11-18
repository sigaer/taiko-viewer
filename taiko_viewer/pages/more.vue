<script setup lang="ts">
import { buildPageDescription, SITE_TITLE } from "~/utils/seo";
import { MORE_GROUPS } from "~/utils/rework/navigation";

const { t, locale } = useI18n();
const localePath = useLocalePath();
const switchLocalePath = useSwitchLocalePath();
const runtimeConfig = useRuntimeConfig();
const appVersion = String(runtimeConfig.public.appVersion || "").trim() || "dev";

const localeOptions = computed(() => [
  { code: "zh", label: t("locale.zh"), path: switchLocalePath("zh") || localePath("/more") },
  { code: "ja", label: t("locale.ja"), path: switchLocalePath("ja") || localePath("/more") }
]);

definePageMeta({
  pageTitleKey: "nav.more",
  pageDescKey: "page.more.desc",
  navKey: "/more",
  hidePageDescription: true,
  hidePageHeader: true,
  reworkElementPlus: true,
  breadcrumbs: [{ labelKey: "nav.more", to: "/more" }]
});

useViewerSeo(() => ({
  title: t("nav.more"),
  description: buildPageDescription(t("page.more.desc")),
  path: "/more"
}));
</script>

<template>
  <div class="rw-stack">
    <ReworkPageHeader :title="t('rework.tools')" />
    <ReworkInfoMoreHub :groups="MORE_GROUPS" :locales="localeOptions" :current-locale="locale">
      <template #meta>{{ SITE_TITLE }} · v{{ appVersion }}</template>
    </ReworkInfoMoreHub>
  </div>
</template>
