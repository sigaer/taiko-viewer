<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import zhCn from "element-plus/es/locale/lang/zh-cn";
import ja from "element-plus/es/locale/lang/ja";
import { SITE_TITLE } from "~/utils/seo";

type BreadcrumbItem = {
  label?: string;
  labelKey?: string;
  to?: string;
};

const route = useRoute();
const { t, locale } = useI18n();
const localePath = useLocalePath();
const switchLocalePath = useSwitchLocalePath();
const localeHead = useLocaleHead({ seo: true });
const isPageLoading = ref(false);
const isPageLoadingVisible = ref(false);
const isMobile = ref(false);
const isMobileNavOpen = ref(false);
const breadcrumbItems = ref<BreadcrumbItem[]>([]);
const nuxtApp = useNuxtApp();
let loadingTimer: ReturnType<typeof setTimeout> | null = null;

useHead(() => ({
  htmlAttrs: localeHead.value.htmlAttrs,
  meta: localeHead.value.meta,
  link: localeHead.value.link.filter((item) => item.rel !== "canonical")
}));

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

const syncViewport = () => {
  if (!process.client) return;
  isMobile.value = window.innerWidth <= 960;
  if (!isMobile.value) {
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
    if (isMobile.value) {
      closeMobileNav();
    }
  }
);

onMounted(() => {
  stopPageLoading();
  syncViewport();
  window.addEventListener("resize", syncViewport);
});

onBeforeUnmount(() => {
  stopPageLoading();
  if (!process.client) return;
  window.removeEventListener("resize", syncViewport);
});
</script>

<template>
  <el-config-provider :locale="elementLocale">
    <div class="app-shell" :class="{ 'mobile-nav-open': isMobileNavOpen }">
      <transition name="mobile-mask">
        <button
          v-if="isMobile && isMobileNavOpen"
          type="button"
          class="mobile-nav-mask"
          :aria-label="t('layout.closeNav')"
          @click="closeMobileNav"
        ></button>
      </transition>
      <aside class="app-sidebar">
        <div class="logo-space">
          <NuxtLink :to="localePath('/')" class="logo-link" :aria-label="`${SITE_TITLE} ${t('nav.home')}`">
            <img src="/logo.png" alt="" class="logo-image" />
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
        <SidebarNav />
      </aside>
      <main class="app-content">
        <div v-if="isMobile" class="mobile-nav-row">
          <button type="button" class="mobile-nav-toggle" @click="toggleMobileNav">
            <span class="mobile-nav-toggle__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M4 7h16 M4 12h16 M4 17h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
              </svg>
            </span>
            <span>{{ t("layout.menu") }}</span>
          </button>
          <div class="locale-switcher locale-switcher--mobile" :aria-label="t('layout.switchLanguage')">
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
        <nav class="breadcrumb-bar">
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
        <header class="page-header">
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
            <p>{{ pageDesc }}</p>
          </div>
        </header>
        <section class="page-body">
          <div v-if="isPageLoadingVisible" class="page-loading">
            <div class="spinner"></div>
            <span>{{ t("layout.loading") }}</span>
          </div>
          <slot />
        </section>
      </main>
    </div>
  </el-config-provider>
</template>

<style scoped>
.page-loading {
  position: absolute;
  top: 0;
  right: 0;
  display: inline-flex;
  gap: 10px;
  align-items: center;
  padding: 10px 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  box-shadow: 0 14px 28px rgba(160, 130, 100, 0.16);
  z-index: 3;
  color: #6c5a4b;
  font-size: 13px;
  font-weight: 600;
  pointer-events: none;
}

.mobile-nav-mask {
  position: fixed;
  inset: 0;
  border: 0;
  margin: 0;
  background: rgba(15, 12, 10, 0.38);
  backdrop-filter: blur(2px);
  z-index: 11;
}

.mobile-mask-enter-active,
.mobile-mask-leave-active {
  transition: opacity 0.2s ease;
}

.mobile-mask-enter-from,
.mobile-mask-leave-to {
  opacity: 0;
}

.mobile-nav-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.mobile-nav-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(139, 107, 77, 0.32);
  background: rgba(255, 255, 255, 0.88);
  border-radius: 10px;
  color: #7a5a3e;
  font-size: 13px;
  font-weight: 700;
  padding: 6px 10px;
  cursor: pointer;
}

.mobile-nav-toggle__icon {
  width: 16px;
  height: 16px;
  display: inline-flex;
}

.mobile-nav-toggle__icon svg {
  width: 100%;
  height: 100%;
}

.logo-link {
  text-decoration: none;
  display: inline-flex;
  border-radius: 20px;
  transition: transform 0.2s ease, filter 0.2s ease;
}

.logo-link:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

.locale-switcher {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.locale-switcher--mobile {
  margin-top: 0;
}

.locale-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 74px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(139, 107, 77, 0.22);
  background: rgba(255, 255, 255, 0.88);
  color: #7a5a3e;
  text-decoration: none;
  font-size: 12px;
  font-weight: 600;
}

.locale-chip.active {
  color: #fff;
  background: linear-gradient(135deg, #d46d3b, #f0ab42);
  border-color: transparent;
}

.breadcrumb-bar {
  margin-bottom: 10px;
  font-size: 12px;
  color: #7a6552;
}

.breadcrumb-bar :deep(a) {
  color: inherit;
  text-decoration: none;
}

.crumb-icon {
  display: inline-flex;
  width: 16px;
  height: 16px;
  margin-right: 6px;
  vertical-align: middle;
}

.crumb-icon svg {
  width: 100%;
  height: 100%;
}

.page-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.page-title-icon {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(210, 185, 160, 0.22);
  color: #9a846f;
}

.page-title-icon svg {
  width: 20px;
  height: 20px;
}

.page-body {
  position: relative;
  min-height: 120px;
}

.spinner {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid rgba(108, 90, 75, 0.2);
  border-top-color: #c47f4f;
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (min-width: 961px) {
  .mobile-nav-row {
    display: none;
  }
}
</style>
