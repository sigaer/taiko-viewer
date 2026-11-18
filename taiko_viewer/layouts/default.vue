<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import zhCn from "element-plus/es/locale/lang/zh-cn";
import ja from "element-plus/es/locale/lang/ja";
import { SITE_TITLE } from "~/utils/seo";
import { buildAnalyticsRouteTemplate, buildAnonymousPageLocation } from "~/utils/analytics";
import { resolveHomePresentation, shouldHideHomeChrome } from "~/utils/homePresentation";
import { isImmersiveRoute, resolveMobileTab } from "~/utils/navigation";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

type BreadcrumbItem = {
  label?: string;
  labelKey?: string;
  to?: string;
};

const route = useRoute();
const contentLayout = computed(() => ['wide', 'reading', 'immersive'].includes(String(route.meta.contentLayout)) ? String(route.meta.contentLayout) : 'standard');
const runtimeConfig = useRuntimeConfig();
const { t, locale } = useI18n();
const localePath = useLocalePath();
const localeHead = useLocaleHead({ seo: true });
const isPageLoading = ref(false);
const isPageLoadingVisible = ref(false);
const breadcrumbItems = ref<BreadcrumbItem[]>([]);
const lastTrackedPath = ref("");
const nuxtApp = useNuxtApp();
let loadingTimer: ReturnType<typeof setTimeout> | null = null;
const googleAnalyticsId = computed(() => String(runtimeConfig.public.googleAnalyticsId || "").trim());
const mobileActiveTab = computed(() => resolveMobileTab(route.path, route.meta.mobileNav));
const homeStateResolver = useHomeState();
if (route.meta.navKey === "/") await homeStateResolver.resolve();
const homePresentation = computed(() =>
  resolveHomePresentation(homeStateResolver.status.value, homeStateResolver.homeState.value)
);
const hideGuestHomeChrome = computed(
  () => shouldHideHomeChrome(route.meta.navKey, homePresentation.value)
);
const hidePageHeader = computed(() => Boolean(route.meta.hidePageHeader));
const mobileParent = computed(() => [...breadcrumbItems.value].reverse().find(item => item.to && item.to !== '/' && localePath(item.to) !== route.path));
const keyboardOpen = ref(false);
const showMobileTabBar = computed(
  () => !keyboardOpen.value && Boolean(mobileActiveTab.value) && !isImmersiveRoute(route.path, route.meta.mobileNav)
);

useHead(() => ({
  htmlAttrs: localeHead.value.htmlAttrs,
  meta: localeHead.value.meta,
  link: localeHead.value.link.filter((item) => item.rel !== "canonical")
}));

useHead(() => {
  const measurementId = googleAnalyticsId.value;
  if (!measurementId) return {};
  return {
    script: [
      {
        key: "google-analytics-loader",
        async: true,
        src: `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`
      },
      {
        key: "google-analytics-bootstrap",
        children: [
          "window.dataLayer = window.dataLayer || [];",
          "function gtag(){dataLayer.push(arguments);}",
          "window.gtag = window.gtag || gtag;",
          "gtag('js', new Date());",
          `gtag('config', ${JSON.stringify(measurementId)}, { send_page_view: false });`
        ].join("")
      }
    ]
  };
});

const translateMetaText = (key?: string, fallback?: string) => {
  if (key) return t(key);
  return fallback || "";
};

const fallbackMeta = computed(() => ({
  title: SITE_TITLE,
  desc: t("site.defaultDescription")
}));

const pageTitle = computed(
  () =>
    translateMetaText(route.meta.pageTitleKey as string | undefined, route.meta.pageTitle as string | undefined) ||
    fallbackMeta.value.title
);
const pageDesc = computed(
  () =>
    translateMetaText(route.meta.pageDescKey as string | undefined, route.meta.pageDesc as string | undefined) ||
    fallbackMeta.value.desc
);
const elementLocale = computed(() => (locale.value === "ja" ? ja : zhCn));

const stopPageLoading = () => {
  isPageLoading.value = false;
  isPageLoadingVisible.value = false;
  if (loadingTimer) {
    clearTimeout(loadingTimer);
    loadingTimer = null;
  }
};

const trackGooglePageView = async (path: string) => {
  if (!process.client || !googleAnalyticsId.value) return;
  if (!path || lastTrackedPath.value === path) return;
  await nextTick();
  if (typeof window.gtag !== "function") return;
  const routeTemplate = buildAnalyticsRouteTemplate(path);
  window.gtag("event", "page_view", {
    page_title: document.title,
    page_location: buildAnonymousPageLocation(path),
    page_path: routeTemplate
  });
  lastTrackedPath.value = path;
};

const startPageLoading = () => {
  isPageLoading.value = true;
  if (loadingTimer) {
    clearTimeout(loadingTimer);
  }
  loadingTimer = setTimeout(() => {
    if (isPageLoading.value) {
      isPageLoadingVisible.value = true;
    }
  }, 120);
};

const buildBreadcrumbs = () => {
  const items = (route.meta.breadcrumbs as BreadcrumbItem[]) || [];
  if (items.length) {
    const firstLabel = items[0].labelKey ? t(items[0].labelKey) : items[0].label;
    if (firstLabel === t("nav.home")) return items;
    return [{ labelKey: "nav.home", to: "/" }, ...items];
  }
  if (/^\/(?:ja\/)?songs\/[^/]+$/.test(route.path)) {
    const isRemovedList = route.query.list === "removed";
    const isOtherList = route.query.list === "other";
    return [
      { labelKey: "nav.home", to: "/" },
      {
        labelKey: isRemovedList ? "nav.songsRemoved" : isOtherList ? "nav.songsOther" : "nav.songsAvailable",
        to: isRemovedList ? "/songs/removed" : isOtherList ? "/songs/other" : "/songs/available"
      },
      { labelKey: "songs.detail" }
    ];
  }
  if (route.path.startsWith("/grade/")) {
    const year = route.path.split("/").pop();
    return [
      { labelKey: "nav.home", to: "/" },
      { labelKey: "nav.grade", to: "/grade/2025" },
      { label: `虹 ${year}`, to: route.path }
    ];
  }
  return [{ labelKey: "nav.home", to: "/" }];
};

watch(
  [() => route.fullPath, () => route.meta.breadcrumbs, () => locale.value],
  () => {
    breadcrumbItems.value = buildBreadcrumbs();
  },
  { immediate: true, deep: true }
);

const removeStartHook = nuxtApp.hook("page:start", () => {
  startPageLoading();
});
const removeFinishHook = nuxtApp.hook("page:finish", () => {
  stopPageLoading();
});

watch(
  () => route.fullPath,
  async () => {
    await nextTick();
    stopPageLoading();
    await trackGooglePageView(route.fullPath);
  }
);

const syncKeyboard = () => { keyboardOpen.value = Boolean(window.visualViewport && window.innerHeight - window.visualViewport.height > 150 && /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')); };
onMounted(() => {
  window.visualViewport?.addEventListener('resize',syncKeyboard);
  stopPageLoading();
  trackGooglePageView(route.fullPath);
});

onBeforeUnmount(() => {
  stopPageLoading();
  if (!process.client) return;
  window.visualViewport?.removeEventListener('resize',syncKeyboard);
  removeStartHook();
  removeFinishHook();
});
</script>

<template>
  <el-config-provider :locale="elementLocale">
    <ReworkShell :title="pageTitle" :content-layout="contentLayout" :show-mobile-nav="showMobileTabBar" :back-path="mobileParent?.to">
      <header v-if="!hideGuestHomeChrome && !hidePageHeader" class="page-header">
        <h1>{{ pageTitle }}</h1><p v-if="!route.meta.hidePageDescription">{{ pageDesc }}</p>
      </header>
      <section class="page-body" :aria-busy="isPageLoading">
        <span v-if="isPageLoadingVisible" class="page-loading" role="status">{{ t('layout.loading') }}</span>
        <slot />
      </section>
    </ReworkShell>
  </el-config-provider>
</template>
<style scoped>
.page-loading{position:absolute;right:0;top:0;padding:8px 12px;background:var(--viewer-surface);color:var(--viewer-text-muted);z-index:3;font-size:14px}
</style>
