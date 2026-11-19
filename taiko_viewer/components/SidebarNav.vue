<script setup lang="ts">
import { computed, ref, watch, useId, onMounted } from "vue";
import type { MenuInstance } from "element-plus";
import { handleSidebarMenuKeydown } from "~/utils/sidebarKeyboard";
import { GUIDE_DIFFICULTY_OPTIONS } from "~/utils/guide";
import { primeAnnualBgm, releasePrimedAnnualBgm } from "~/utils/annualBgm.client";

const emit = defineEmits<{ navigate: [] }>();
const navId = useId();
const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const localePath = useLocalePath();
const apiFetch = useViewerApiFetch();
const { accountUser, fetchCurrentUser, clearAccountUser } = useAccountState();
await fetchCurrentUser();

const buildGuideChildren = () => {
  return GUIDE_DIFFICULTY_OPTIONS.map((group) => ({
    key: `/guide/d${group.value}`,
    label: t(`difficulty.${group.value}`),
    iconImage: group.iconImage,
    children: Array.from({ length: group.max }, (_, index) => {
      const level = index + 1;
      return {
        key: `/guide/${group.value}/${level}`,
        label: `${level}${t("guide.starSuffix", "星")}`
      };
    })
  }));
};

const iconPaths: Record<string, string> = {
  music: "M9 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z M17 15V6l-9 2.5v9.5",
  trophy:
    "M7 4h10v3a5 5 0 0 1-10 0V4z M5 6H3v1a4 4 0 0 0 4 4 M19 6h2v1a4 4 0 0 1-4 4 M9 18h6 M10.5 18v2.5h3V18",
  book:
    "M4.5 5.5h7.5a2 2 0 0 1 2 2v11H6.5a2 2 0 0 0-2 2v-15z M19.5 5.5h-7.5a2 2 0 0 0-2 2v11h7.5a2 2 0 0 1 2 2v-15z",
  badge:
    "M12 3l3 2 3.5-.5.5 3.5 2.5 2.5-2.5 2.5-.5 3.5L15 18l-3 2-3-2-3.5.5-.5-3.5L2 10.5 4.5 8 .5 4.5 4 5l3-2z",
  history:
    "M12 6v6l3.5 2 M12 3a9 9 0 1 1-6.36 2.64 M4 4v4h4",
  settings:
    "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z M4 12h2.2l.4-1.4-1.6-1.2 2-3.2 1.8.7 1.1-1.1-.7-1.8 3.2-1.2 1 1.6h1.6l1-1.6 3.2 1.2-.7 1.8 1.1 1.1 1.8-.7 2 3.2-1.6 1.2.4 1.4H20",
  info: "M12 10v6 M12 7h.01 M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0",
  forum:
    "M5 6.5h14A1.5 1.5 0 0 1 20.5 8v8A1.5 1.5 0 0 1 19 17.5H10l-4.5 3V8A1.5 1.5 0 0 1 7 6.5z M9 10.25h6 M9 13.75h4",
  support:
    "M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5z M5 8l7 5 7-5",
  grid: "M4 6h6v6H4z M14 6h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z",
  user:
    "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4.5 20a7.5 7.5 0 0 1 15 0",
  key:
    "M14 8a4 4 0 1 0 0 8h1.5l3.5 3.5 1-1-1.6-1.6 1.6-1.6-1-1-1.6 1.6-1.6-1.6-1 1 1.7 1.7H14a4 4 0 0 0 0-8z",
  logout:
    "M10 17l5-5-5-5 M15 12H6 M18 4h-7a2 2 0 0 0-2 2v2 M18 20h-7a2 2 0 0 1-2-2v-2",
  home: "M4 11.5l8-6 8 6v7a1 1 0 0 1-1 1h-4v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5H5a1 1 0 0 1-1-1v-7z"
};

const handleLogout = async () => {
  try {
    await apiFetch("/api/account/auth/logout", { method: "POST" });
    clearAccountUser();
    await navigateTo(localePath("/account/login"));
  } catch {
    // Ignore logout errors in sidebar shortcut.
  }
};

const goTo = async (path: string) => {
  if (!path) return;
  emit("navigate");
  const target = localePath(path);
  // useRoute() follows Nuxt's resolved page and can still describe the page
  // we are leaving while Suspense is pending. Vue Router owns navigation.
  if (!target || target === router.currentRoute.value.fullPath) {
    return;
  }
  const enteringAnnual = path === "/account/version-summary";
  if (enteringAnnual) void primeAnnualBgm();
  try {
    await navigateTo(target);
  } finally {
    if (enteringAnnual) {
      window.setTimeout(() => {
        if (!window.location.pathname.includes("/account/version-summary")) releasePrimedAnnualBgm();
      }, 1000);
    }
  }
};

const isDeveloperReviewer = computed(
  () => accountUser.value?.username === "sigaer" && accountUser.value?.email === "1106865024@qq.com"
);

const groups = computed(() => [
  {
    key: "discover",
    title: t("nav.discovery"),
    icon: "music",
    items: [
      {
        key: "/songs",
        label: t("nav.songs"),
        icon: "music",
        children: [
          { key: "/songs/available", label: t("nav.songsAvailable") },
          { key: "/songs/removed", label: t("nav.songsRemoved") },
          { key: "/songs/other", label: t("nav.songsOther") },
          { key: "/songs/v2-constants", label: t("nav.v2Constants") }
        ]
      },
      {
        key: "/grade",
        label: t("nav.grade"),
        icon: "trophy",
        children: [
          { key: "/grade/2026", label: "虹 2026" },
          { key: "/grade/2025", label: "虹 2025" },
          { key: "/grade/2024", label: "虹 2024" },
          { key: "/grade/2023", label: "虹 2023" }
        ]
      },
      {
        key: "/guide",
        label: t("nav.guide"),
        icon: "book",
        children: buildGuideChildren()
      },
      { key: "/titles", label: t("nav.titles"), icon: "badge" }
    ]
  },
  {
    key: "my",
    title: t("nav.myTaiko"),
    icon: "user",
    items: [
      { key: "/my", label: t("nav.myTaikoHome"), icon: "user" },
      { key: "/my/growth", label: t("passport.title"), icon: "history" },
      { key: "/my/weekly", label: t("weekly.title"), icon: "history" },
      { key: "/account/songs", label: t("account.songs"), icon: "music" },
      { key: "/tools/b30", label: t("tools.b30"), icon: "trophy" },
      { key: "/tools/trend", label: t("tools.trend"), icon: "history" },
      { key: "/tools/recommend", label: t("tools.recommend"), icon: "music" },
      { key: "/tools/progress", label: t("tools.progress"), icon: "trophy" },
      { key: "/tools/word-cloud", label: t("tools.wordCloud"), icon: "badge" },
      ...(accountUser.value?.annualSummaryAccess
        ? [{ key: "/account/version-summary", label: t("account.versionSummary"), icon: "trophy" }]
        : [])
    ]
  },
  {
    key: "community",
    title: t("nav.community"),
    icon: "forum",
    items: [
      { key: "/forum", label: t("nav.communityHome"), icon: "forum" },
      { key: "/forum/discussions", label: t("nav.allDiscussions"), icon: "forum" },
      { key: "/forum/new", label: t("forum.newThread"), icon: "book" },
      { key: "/forum/me", label: t("forum.myCommunity"), icon: "user" },
      { key: "/forum/notifications", label: t("forum.notifications"), icon: "info" }
    ]
  },
  {
    key: "tools",
    title: t("nav.toolsGroup"),
    icon: "grid",
    items: [
      { key: "/tools/rt-calculator", label: t("tools.rtCalculator"), icon: "grid" },
      { key: "/tools/chart-config", label: t("tools.chartConfig"), icon: "grid" },
      { key: "/tools/tja-constants", label: t("tools.tjaConstants"), icon: "music" },
      { key: "/tools/note-count", label: t("tools.noteCount"), icon: "music" }
    ]
  },
  {
    key: "account",
    title: t("nav.accountSettings"),
    icon: "settings",
    items: [
      { key: "/account/sync", label: t("account.sync"), icon: "history" },
      { key: "/docs/score-token", label: t("page.more.apiDocs"), icon: "book" },
      { key: "/account/profile", label: t("account.profile"), icon: "user" },
      { key: "/account/developer", label: t("account.developer"), icon: "badge" },
      ...(isDeveloperReviewer.value
        ? [
            { key: "/account/developer/review", label: t("account.developerReview"), icon: "key" },
            { key: "/account/support/review", label: t("account.supportReview"), icon: "support" }
          ]
        : []),
      ...(!accountUser.value
        ? [
            { key: "/account/login", label: t("account.login"), icon: "key" },
            { key: "/account/register", label: t("account.register"), icon: "user" }
          ]
        : []),
      { key: "/support", label: t("nav.support"), icon: "support" },
      { key: "/alias-log", label: t("nav.aliasLog"), icon: "history" },
      { key: "/settings", label: t("nav.settings"), icon: "settings" },
      { key: "/about", label: t("nav.about"), icon: "info" }
    ]
  }
]);

const activePath = computed(() => {
  const normalizedPath =
    route.path === "/ja"
      ? "/"
      : route.path.startsWith("/ja/")
        ? route.path.slice(3) || "/"
        : route.path;
  if (normalizedPath === "/") return "/";
  if (normalizedPath === "/my") return "/my";
  if (normalizedPath.startsWith("/tools")) return normalizedPath === "/tools" ? "/tools" : normalizedPath;
  if (normalizedPath.startsWith("/forum")) {
    if (/^\/forum\/(new|me|notifications|discussions)$/.test(normalizedPath)) return normalizedPath;
    if (/^\/forum\/(thread|section)\//.test(normalizedPath)) return "/forum/discussions";
    return "/forum";
  }
  if (normalizedPath === "/songs") return "/songs/available";
  if (normalizedPath === "/songs/removed") return "/songs/removed";
  if (normalizedPath === "/songs/other") return "/songs/other";
  if (normalizedPath === "/songs/v2-constants") return "/songs/v2-constants";
  if (normalizedPath.startsWith("/songs/")) {
    if (route.query.list === "removed") return "/songs/removed";
    if (route.query.list === "other") return "/songs/other";
    return "/songs/available";
  }
  if (normalizedPath.startsWith("/account/profile")) return "/account/profile";
  if (normalizedPath.startsWith("/account/songs")) return "/account/songs";
  if (normalizedPath.startsWith("/account/sync")) return "/account/sync";
  if (normalizedPath.startsWith("/account/version-summary")) return "/account/version-summary";
  if (normalizedPath.startsWith("/account/developer/review")) return "/account/developer/review";
  if (normalizedPath.startsWith("/account/support/review")) return "/account/support/review";
  if (normalizedPath.startsWith("/account/developer")) return "/account/developer";
  if (normalizedPath.startsWith("/account/login")) return "/account/login";
  if (normalizedPath.startsWith("/account/register")) return "/account/register";
  if (normalizedPath.startsWith("/guide/")) {
    const segments = normalizedPath.split("/").filter(Boolean);
    if (segments.length >= 3) {
      return `/guide/${segments[1]}/${segments[2]}`;
    }
  }
  return normalizedPath;
});

const openedGroups = computed(() => {
  if (activePath.value === "/my") return [];
  if (activePath.value.startsWith("/songs")) return ["/songs"];
  if (activePath.value.startsWith("/grade")) return ["/grade"];
  if (activePath.value.startsWith("/forum")) return ["/forum"];
  if (activePath.value.startsWith("/tools")) return ["/tools"];
  if (activePath.value.startsWith("/account")) return [];
  if (activePath.value.startsWith("/guide")) {
    const normalizedPath =
      route.path === "/ja"
        ? "/"
        : route.path.startsWith("/ja/")
          ? route.path.slice(3) || "/"
          : route.path;
    const segments = normalizedPath.split("/").filter(Boolean);
    if (segments.length >= 2) return ["/guide", `/guide/d${segments[1]}`];
    return ["/guide"];
  }
  return [];
});
// Route changes reveal only the owning category; manual collapse lasts until navigation.
const expandedGroup = ref("");
const menus = new Map<string, MenuInstance>();
const syncMenus = () => {
  for (const [key, menu] of menus) {
    menu.updateActiveIndex(activePath.value);
    // Only Discovery has Element Plus submenus; the other groups are flat.
    if (key === 'discover' && key === expandedGroup.value) for (const index of openedGroups.value) menu.open(index);
  }
};
onMounted(syncMenus);
watch([activePath, openedGroups], syncMenus, { flush: 'post' });
watch([activePath, () => groups.value.map(group => group.key + group.items.map(item => item.key).join()).join()], () => {
  expandedGroup.value = groups.value.find(group => group.items.some(item =>
    activePath.value === item.key || activePath.value.startsWith(`${item.key}/`)
  ))?.key || "";
}, { immediate: true });
</script>

<template>
  <div class="nav-groups">
    <div v-if="accountUser" class="account-brief">
      <div class="account-brief__meta">
        <strong>{{ accountUser.username }}</strong>
        <span>{{ accountUser.email }}</span>
      </div>
      <el-button text class="account-brief__logout" @click="handleLogout">
        <span class="nav-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path
              :d="iconPaths.logout"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
        <span>{{ t("nav.logout") }}</span>
      </el-button>
    </div>
    <NuxtLink :to="localePath('/')" class="nav-home" :class="{ active: activePath === '/' }" :aria-current="activePath === '/' ? 'page' : undefined" @click="emit('navigate')">
      <span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path :d="iconPaths.home" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" /></svg></span>
      {{ t('nav.home') }}
    </NuxtLink>
    <div v-for="group in groups" :key="group.key" class="nav-group">
      <button type="button" class="nav-title" :aria-expanded="expandedGroup === group.key" :aria-controls="`${navId}-${group.key}`" @click="expandedGroup = expandedGroup === group.key ? '' : group.key">
        <span class="nav-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path
              :d="iconPaths[group.icon]"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
        <span>{{ group.title }}</span>
        <span class="nav-chevron" aria-hidden="true">{{ expandedGroup === group.key ? '−' : '+' }}</span>
      </button>
      <Transition name="nav-expand">
      <div :id="`${navId}-${group.key}`" v-show="expandedGroup === group.key" class="nav-panel" :inert="expandedGroup !== group.key" :aria-hidden="expandedGroup !== group.key">
      <div class="nav-panel__inner">
      <el-menu :ref="(menu) => { if (menu) menus.set(group.key, menu as MenuInstance); else menus.delete(group.key); }" :default-active="activePath" :default-openeds="openedGroups" unique-opened class="nav-menu" @keydown="handleSidebarMenuKeydown">
        <template v-for="item in group.items" :key="item.key">
          <el-sub-menu v-if="item.children" :index="item.key" tabindex="0">
            <template #title>
              <span class="nav-item-label">
                <span class="nav-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path
                      :d="iconPaths[item.icon]"
                      stroke="currentColor"
                      stroke-width="1.6"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </span>
                <span>{{ item.label }}</span>
              </span>
            </template>
            <template v-for="child in item.children" :key="child.key">
              <el-sub-menu v-if="child.children" :index="child.key" tabindex="0">
                <template #title>
                  <span class="nav-item-label">
                    <img
                      v-if="child.iconImage"
                      class="sub-icon"
                      :src="child.iconImage"
                      :alt="child.label"
                    />
                    <span v-else class="sub-dot" aria-hidden="true"></span>
                    <span>{{ child.label }}</span>
                  </span>
                </template>
                <el-menu-item v-for="sub in child.children" :key="sub.key" :index="sub.key" tabindex="0" @click="goTo(sub.key)">
                  <span>{{ sub.label }}</span>
                </el-menu-item>
              </el-sub-menu>
              <el-menu-item v-else :index="child.key" tabindex="0" @click="goTo(child.key)">
                <span>{{ child.label }}</span>
              </el-menu-item>
            </template>
          </el-sub-menu>
          <el-menu-item v-else :index="item.key" :data-nav-key="item.key" tabindex="0" @click="goTo(item.key)">
            <span class="nav-item-label">
              <span class="nav-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    :d="iconPaths[item.icon]"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
              <span>{{ item.label }}</span>
            </span>
          </el-menu-item>
        </template>
      </el-menu>
      </div>
      </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.nav-groups{display:flex;flex-direction:column;gap:4px;}.account-brief{padding:12px;border-radius:10px;background:var(--viewer-surface-subtle);display:grid;gap:8px;}.account-brief__meta{display:grid;gap:4px;}.account-brief__meta strong{font-weight:600;}.account-brief__meta span{font-size:13px;color:var(--viewer-text-muted);overflow-wrap:anywhere;}.account-brief__logout{justify-content:flex-start;padding:0;min-height:36px;}.nav-group{padding:0;background:transparent;}.nav-title{display:flex;align-items:center;gap:8px;color:var(--viewer-text-muted);font-size:13px;font-weight:500;margin-bottom:0;}.nav-icon{display:inline-flex;width:16px;height:16px;align-items:center;justify-content:center;color:currentColor;}.nav-icon svg{width:100%;height:100%;}.nav-item-label{display:inline-flex;align-items:center;gap:8px;min-width:0;}.sub-icon{width:18px;height:18px;object-fit:contain;}.sub-dot{display:inline-flex;width:5px;height:5px;border-radius:50%;background:var(--viewer-text-muted);}.nav-menu{border-right:0;}.nav-groups :deep(.el-menu){border:0;}.nav-groups :deep(.el-menu-item),.nav-groups :deep(.el-sub-menu__title){min-width:0;white-space:normal;line-height:1.5;}.nav-groups :deep(.el-sub-menu__title){height:auto;min-height:44px;padding-block:10px;}.nav-groups :deep(.el-sub-menu .el-menu-item){padding-left:40px;}

.nav-title, .nav-home { width:100%; box-sizing:border-box; min-height:44px; padding:10px 12px; border:0; border-radius:10px; background:transparent; color:var(--viewer-text); font:inherit; font-weight:600; text-align:left; cursor:pointer; display:flex; align-items:center; gap:8px; text-decoration:none; }
.nav-title:hover, .nav-home:hover, .nav-home.active { background:var(--viewer-surface-subtle); color:var(--viewer-primary); }
.nav-title:focus-visible, .nav-home:focus-visible { outline:2px solid var(--viewer-primary); outline-offset:-2px; }
.nav-chevron { margin-left:auto; }
.nav-icon { flex-shrink:0; }
.nav-menu { margin:4px 0 8px; }
.nav-groups :deep([role="menuitem"]:focus-visible) { outline:2px solid var(--viewer-primary); outline-offset:-2px; }
.nav-panel { display:grid; grid-template-rows:1fr; opacity:1; transform:translateY(0); }
.nav-panel__inner { min-height:0; overflow:hidden; }
@media (min-width:961px) {
  .nav-expand-enter-active { transition:grid-template-rows 210ms ease-out, opacity 210ms ease-out, transform 210ms ease-out; }
  .nav-expand-leave-active { transition:grid-template-rows 180ms ease-out, opacity 180ms ease-out, transform 180ms ease-out; }
  .nav-expand-enter-from,.nav-expand-leave-to { grid-template-rows:0fr; opacity:0; transform:translateY(-3px); }
}
@media (prefers-reduced-motion:reduce) {
  .nav-expand-enter-active,.nav-expand-leave-active { transition:none; }
}
</style>
