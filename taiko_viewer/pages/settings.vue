<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { buildPageDescription } from "~/utils/seo";

const { t, locale } = useI18n();
const localePath = useLocalePath();
const switchLocalePath = useSwitchLocalePath();
const { accountUser, fetchCurrentUser } = useAccountState();
await fetchCurrentUser();

definePageMeta({
  pageTitleKey: "nav.settings",
  pageDescKey: "page.settings.desc",
  navKey: "/settings",
  contentLayout: "reading",
  hidePageHeader: true,
  reworkElementPlus: true,
  breadcrumbs: [{ labelKey: "nav.settings", to: "/settings" }]
});

useViewerSeo(() => ({
  title: t("nav.settings"),
  description: buildPageDescription(t("page.settings.desc")),
  path: "/settings"
}));

// Slice E1: the inline zh / ja table moved to locales (rework.account.settings.*), same texts.
const s = (key: string) => t(`rework.account.settings.${key}`);

const isDeveloperReviewer = computed(
  () => accountUser.value?.username === "sigaer" && accountUser.value?.email === "1106865024@qq.com"
);

// Theme: the same state the shell's toggle writes (useViewerTheme; plugins/theme.ts persists it to the
// taiko_theme cookie). Language: the same localized links as the shell's language switch.
const { theme } = useViewerTheme();
const languages = computed(() => [
  { code: "zh", label: s("languageZh"), lang: "zh-CN", to: switchLocalePath("zh") || localePath("/settings") },
  { code: "ja", label: s("languageJa"), lang: "ja", to: switchLocalePath("ja") || localePath("/settings") }
]);

const cacheItems = ref<string[]>([]);
const refreshCacheItems = () => { if (import.meta.client) cacheItems.value = Object.keys(localStorage); };
onMounted(refreshCacheItems);
const cacheSize = computed(() => {
  if (!import.meta.client) return 0;
  const total = cacheItems.value.reduce((size, key) => size + key.length + (localStorage.getItem(key)?.length || 0), 0);
  return Math.round((total / 1024) * 10) / 10;
});
const clearCache = () => {
  if (!import.meta.client) return;
  localStorage.clear();
  refreshCacheItems();
};

const shortcuts = computed(() => [
  { to: "/forum", label: s("forum") },
  { to: "/support", label: s("support") },
  { to: "/account/sync", label: s("sync") },
  { to: "/account/developer", label: s("developer") },
  ...(isDeveloperReviewer.value
    ? [
        { to: "/account/developer/review", label: s("review") },
        { to: "/account/support/review", label: s("supportReview") }
      ]
    : [])
]);
</script>

<template>
  <ReworkAccountSettings
    :theme="theme"
    :locale="locale"
    :languages="languages"
    :cache-items="cacheItems"
    :cache-size="cacheSize"
    :shortcuts="shortcuts.map((item) => ({ ...item, to: localePath(item.to) }))"
    @update:theme="(value) => (theme = value)"
    @clear-cache="clearCache"
    @toggle-details="refreshCacheItems"
  />
</template>
