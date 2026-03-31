<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

const route = useRoute();
const isPageLoading = ref(false);
const isPageLoadingVisible = ref(false);
const isMobile = ref(false);
const isMobileNavOpen = ref(false);
const nuxtApp = useNuxtApp();
let loadingTimer: ReturnType<typeof setTimeout> | null = null;

const fallbackMeta = {
  title: "taiko viewer",
  desc: "taiko viewer 太鼓达人数据看板，提供歌曲列表、谱面攻略与段位查询。"
};

type BreadcrumbItem = {
  label: string;
  to?: string;
};

const pageTitle = computed(() => (route.meta.pageTitle as string) || fallbackMeta.title);
const pageDesc = computed(() => (route.meta.pageDesc as string) || fallbackMeta.desc);
const pageIcon = computed(() => {
  if (route.path.startsWith("/songs")) return "music";
  if (route.path.startsWith("/forum")) return "forum";
  if (route.path.startsWith("/guide")) return "book";
  if (route.path.startsWith("/grade")) return "trophy";
  if (route.path.startsWith("/account")) return "user";
  if (route.path.startsWith("/settings")) return "settings";
  if (route.path.startsWith("/about")) return "info";
  return "home";
});
const breadcrumbItems = ref<BreadcrumbItem[]>([]);

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
    if (items[0].label === "首页") return items;
    return [{ label: "首页", to: "/" }, ...items];
  }
  if (route.path.startsWith("/grade/")) {
    const year = route.path.split("/").pop();
    return [
      { label: "首页", to: "/" },
      { label: "段位查询", to: "/grade/2025" },
      { label: `虹 ${year}`, to: route.path }
    ];
  }
  return [{ label: "首页", to: "/" }];
};

watch(
  [() => route.fullPath, () => route.meta.breadcrumbs],
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
  <div class="app-shell" :class="{ 'mobile-nav-open': isMobileNavOpen }">
    <transition name="mobile-mask">
      <button
        v-if="isMobile && isMobileNavOpen"
        type="button"
        class="mobile-nav-mask"
        aria-label="关闭导航"
        @click="closeMobileNav"
      ></button>
    </transition>
    <aside class="app-sidebar">
      <div class="logo-space">
        <NuxtLink to="/" class="logo-link" aria-label="回到首页">
          <div class="logo-placeholder">TAIKO</div>
        </NuxtLink>
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
          <span>菜单</span>
        </button>
      </div>
      <nav class="breadcrumb-bar">
        <el-breadcrumb :key="route.fullPath" separator="/">
          <el-breadcrumb-item v-for="(item, index) in breadcrumbItems" :key="`${item.label}-${index}`">
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
            <NuxtLink v-if="item.to" :to="item.to">{{ item.label }}</NuxtLink>
            <span v-else>{{ item.label }}</span>
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
                <path
                  d="M5 6H3v1a4 4 0 0 0 4 4"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                />
                <path
                  d="M19 6h2v1a4 4 0 0 1-4 4"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                />
                <path
                  d="M9 18h6M10.5 18v2.5h3V18"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                />
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
                <path
                  d="M4.5 20a7.5 7.5 0 0 1 15 0"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                />
              </svg>
              <svg v-else-if="pageIcon === 'info'" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6" />
                <path d="M12 10v6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
                <path d="M12 7h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
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
          <span>加载中...</span>
        </div>
        <slot />
      </section>
    </main>
  </div>
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
  background: rgba(196, 127, 79, 0.15);
  color: #9a6d47;
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
