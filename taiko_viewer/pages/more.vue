<script setup lang="ts">
import { buildPageDescription, SITE_TITLE } from "~/utils/seo";
import { NAV_GROUPS, SUPPORT_LINKS } from "~/utils/rework/navigation";

const { t, locale } = useI18n();
const localePath = useLocalePath();
const switchLocalePath = useSwitchLocalePath();
const runtimeConfig = useRuntimeConfig();
const appVersion = String(runtimeConfig.public.appVersion || "").trim() || "dev";
const { accountUser } = useAccountState();
const { signingOut, signOut } = useAccountSignOut();

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
    <ReworkPageHeader :title="t('rework.shell.allFeatures')" />
    <ReworkInfoMoreHub
      :groups="NAV_GROUPS"
      :links="SUPPORT_LINKS"
      :user="accountUser"
      :signing-out="signingOut"
      :locales="localeOptions"
      :current-locale="locale"
      @sign-out="signOut"
    >
      <template #meta>{{ SITE_TITLE }} · v{{ appVersion }}</template>
    </ReworkInfoMoreHub>
  </div>
</template>
