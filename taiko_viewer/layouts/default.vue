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
const switchLocalePath = useSwitchLocalePath();
const localeHead = useLocaleHead({ seo: true });
const isPageLoading = ref(false);
const isPageLoadingVisible = ref(false);
const isMobileNavOpen = ref(false);
const breadcrumbItems = ref<BreadcrumbItem[]>([]);
const lastTrackedPath = ref("");
const nuxtApp = useNuxtApp();
let loadingTimer: ReturnType<typeof setTimeout> | null = null;
let mobileMediaQuery: MediaQueryList | null = null;
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
const mobileContextTitle = computed(() => hidePageHeader.value || route.meta.navKey === '/' ? 'My Taiko' : pageTitle.value);
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
const pageIcon = computed(() => {
  if (route.path.startsWith("/songs")) return "music";
  if (route.path.startsWith("/forum")) return "forum";
  if (route.path.startsWith("/guide")) return "book";
  if (route.path.startsWith("/grade")) return "trophy";
  if (route.path.startsWith("/account")) return "user";
  if (route.path.startsWith("/settings")) return "settings";
  if (route.path.startsWith("/about")) return "info";
  if (route.path.startsWith("/tools")) return "grid";
  return "home";
});
const elementLocale = computed(() => (locale.value === "ja" ? ja : zhCn));
const localeOptions = computed(() => [
  { code: "zh", label: t("locale.zh"), path: switchLocalePath("zh") || localePath("/") },
  { code: "ja", label: t("locale.ja"), path: switchLocalePath("ja") || localePath("/") }
]);

const syncMobileNavState = (event: MediaQueryListEvent | MediaQueryList) => {
  if (!event.matches) {
    isMobileNavOpen.value = false;
  }
};

const toggleMobileNav = () => {
  isMobileNavOpen.value = !isMobileNavOpen.value;
};

const closeMobileNav = () => {
  isMobileNavOpen.value = false;
};

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

nuxtApp.hook("page:start", () => {
  startPageLoading();
});
nuxtApp.hook("page:finish", () => {
  stopPageLoading();
});

watch(
  () => route.fullPath,
  async () => {
    await nextTick();
    stopPageLoading();
    closeMobileNav();
    await trackGooglePageView(route.fullPath);
  }
);

const syncKeyboard = () => { keyboardOpen.value = Boolean(window.visualViewport && window.innerHeight - window.visualViewport.height > 150 && /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')); };
onMounted(() => {
  window.visualViewport?.addEventListener('resize',syncKeyboard);
  stopPageLoading();
  mobileMediaQuery = window.matchMedia("(max-width: 960px)");
  syncMobileNavState(mobileMediaQuery);
  mobileMediaQuery.addEventListener("change", syncMobileNavState);
  trackGooglePageView(route.fullPath);
});

onBeforeUnmount(() => {
  stopPageLoading();
  if (!process.client) return;
  window.visualViewport?.removeEventListener('resize',syncKeyboard);
  mobileMediaQuery?.removeEventListener("change", syncMobileNavState);
  mobileMediaQuery = null;
});
</script>

<template>
  <el-config-provider :locale="elementLocale">
    <div class="app-shell" :class="{ 'mobile-nav-open': isMobileNavOpen }">
      <transition name="mobile-mask">
        <button
          v-if="isMobileNavOpen"
          type="button"
          class="mobile-nav-mask"
          :aria-label="t('layout.closeNav')"
          @click="closeMobileNav"
        ></button>
      </transition>
      <aside id="site-sidebar" class="app-sidebar">
        <div class="logo-space">
          <NuxtLink :to="localePath('/')" class="logo-link" :aria-label="`${SITE_TITLE} ${t('nav.home')}`">
            <img
              src="/optimized/logo-168.webp"
              alt=""
              class="logo-image"
              width="84"
              height="84"
              decoding="async"
            />
          </NuxtLink>
          <div class="locale-switcher" :aria-label="t('layout.switchLanguage')">
            <NuxtLink
              v-for="item in localeOptions"
              :key="item.code"
              class="locale-chip"
              :class="{ active: item.code === locale }"
              :to="item.path"
            >
              {{ item.label }}
            </NuxtLink>
          </div>
        </div>
        <SidebarNav @navigate="closeMobileNav" />
      </aside>
      <main class="app-content" :class="[{ 'has-mobile-tabbar': showMobileTabBar }, `app-content--${contentLayout}`]">
        <div class="viewer-content" :class="`viewer-content--${contentLayout}`" :data-content-layout="contentLayout">
        <AppMobileHeader v-if="!route.meta.composerHeader" :title="mobileContextTitle" :back-path="mobileParent?.to" :back-label="mobileParent ? (mobileParent.labelKey ? t(mobileParent.labelKey) : mobileParent.label) : undefined" :expanded="isMobileNavOpen" @menu="toggleMobileNav" />
        <nav v-if="!hideGuestHomeChrome && !route.meta.composerHeader" class="breadcrumb-bar" :class="{ 'forum-breadcrumb': route.path.startsWith('/forum') }">
          <el-breadcrumb :key="route.fullPath" separator="/">
            <el-breadcrumb-item
              v-for="(item, index) in breadcrumbItems"
              :key="`${item.labelKey || item.label || 'crumb'}-${index}`"
            >
              <span v-if="index === 0" class="crumb-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M3 11.5l9-7 9 7v8a1 1 0 0 1-1 1h-4.5a1 1 0 0 1-1-1V14a1 1 0 0 0-1-1h-3a1 1 0 0 0-1 1v5.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-8z"
                    stroke="currentColor"
                    stroke-width="1.4"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
              <NuxtLink v-if="item.to" :to="localePath(item.to)">{{
                item.labelKey ? t(item.labelKey) : item.label
              }}</NuxtLink>
              <span v-else>{{ item.labelKey ? t(item.labelKey) : item.label }}</span>
            </el-breadcrumb-item>
          </el-breadcrumb>
        </nav>
        <header v-if="!hideGuestHomeChrome && !hidePageHeader" class="page-header">
          <div class="page-header__info">
            <div class="page-title-row">
              <span class="page-title-icon" aria-hidden="true">
                <svg v-if="pageIcon === 'music'" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M9 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zm8-2.5V6l-9 2.5v9.5"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                <svg v-else-if="pageIcon === 'book'" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4.5 5.5h7.5a2 2 0 0 1 2 2v11H6.5a2 2 0 0 0-2 2v-15z"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M19.5 5.5h-7.5a2 2 0 0 0-2 2v11h7.5a2 2 0 0 1 2 2v-15z"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linejoin="round"
                  />
                </svg>
                <svg v-else-if="pageIcon === 'forum'" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M5 6.5h14A1.5 1.5 0 0 1 20.5 8v8A1.5 1.5 0 0 1 19 17.5H10l-4.5 3V8A1.5 1.5 0 0 1 7 6.5z"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linejoin="round"
                  />
                  <path d="M9 10.25h6M9 13.75h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
                </svg>
                <svg v-else-if="pageIcon === 'trophy'" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M7 4h10v3a5 5 0 0 1-10 0V4z"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linejoin="round"
                  />
                  <path d="M5 6H3v1a4 4 0 0 0 4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
                  <path d="M19 6h2v1a4 4 0 0 1-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
                  <path d="M9 18h6M10.5 18v2.5h3V18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
                </svg>
                <svg v-else-if="pageIcon === 'settings'" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z"
                    stroke="currentColor"
                    stroke-width="1.6"
                  />
                  <path
                    d="M4 12h2.2l.4-1.4-1.6-1.2 2-3.2 1.8.7 1.1-1.1-.7-1.8 3.2-1.2 1 1.6h1.6l1-1.6 3.2 1.2-.7 1.8 1.1 1.1 1.8-.7 2 3.2-1.6 1.2.4 1.4H20"
                    stroke="currentColor"
                    stroke-width="1.4"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                <svg v-else-if="pageIcon === 'user'" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
                    stroke="currentColor"
                    stroke-width="1.6"
                  />
                  <path d="M4.5 20a7.5 7.5 0 0 1 15 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
                </svg>
                <svg v-else-if="pageIcon === 'info'" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6" />
                  <path d="M12 10v6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
                  <path d="M12 7h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                </svg>
                <svg v-else-if="pageIcon === 'grid'" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 6h6v6H4z M14 6h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linejoin="round"
                  />
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 11.5l8-6 8 6v7a1 1 0 0 1-1 1h-4v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5H5a1 1 0 0 1-1-1v-7z"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
              <h1>{{ pageTitle }}</h1>
            </div>
            <p v-if="!route.meta.hidePageDescription">{{ pageDesc }}</p>
          </div>
        </header>
        <section class="page-body">
          <div v-if="isPageLoadingVisible" class="page-loading">
            <div class="spinner"></div>
            <span>{{ t("layout.loading") }}</span>
          </div>
          <slot />
        </section>
        </div>
      </main>
      <MobileTabBar v-if="showMobileTabBar" :active-tab="mobileActiveTab" />
    </div>
  </el-config-provider>
</template>

<style scoped>
.page-loading{position:absolute;top:0;right:0;display:inline-flex;gap:10px;align-items:center;padding:10px 14px;border-radius:8px;background:var(--viewer-surface);z-index:3;color:var(--viewer-text-muted);font-size:14px;pointer-events:none;}
.mobile-nav-mask{position:fixed;inset:0;border:0;margin:0;background:var(--viewer-overlay);z-index:35;}
.mobile-mask-enter-active,.mobile-mask-leave-active{transition:opacity .18s ease;}.mobile-mask-enter-from,.mobile-mask-leave-to{opacity:0;}
.logo-link{display:inline-flex;text-decoration:none;border-radius:10px;}
.locale-switcher{display:flex;flex-wrap:wrap;gap:4px;}
.locale-chip{display:inline-flex;align-items:center;justify-content:center;min-height:36px;padding:6px 8px;border-radius:6px;color:var(--viewer-text-muted);font-size:13px;text-decoration:none;}
.locale-chip.active{color:var(--viewer-primary);background:var(--viewer-selected);font-weight:600;}
.breadcrumb-bar{margin-bottom:12px;font-size:14px;color:var(--viewer-text-muted);}.breadcrumb-bar :deep(a){color:inherit;text-decoration:none;}.breadcrumb-bar :deep(.el-breadcrumb__inner){font-weight:400;color:var(--viewer-text-muted);}
.crumb-icon{display:inline-flex;width:16px;height:16px;margin-right:6px;vertical-align:middle;}.crumb-icon svg{width:100%;height:100%;}
.page-title-row{display:flex;align-items:center;gap:10px;}.page-title-icon{display:none;}
.spinner{width:18px;height:18px;border-radius:50%;border:2px solid var(--viewer-border);border-top-color:var(--viewer-link);animation:spin .9s linear infinite;}@keyframes spin{to{transform:rotate(360deg)}}
@media(max-width:960px){.breadcrumb-bar{display:none;}.app-content.has-mobile-tabbar{padding-bottom:calc(88px + env(safe-area-inset-bottom));}}
@media(prefers-reduced-motion:reduce){.mobile-mask-enter-active,.mobile-mask-leave-active{transition:none;}.spinner{animation:none;}}
</style>
