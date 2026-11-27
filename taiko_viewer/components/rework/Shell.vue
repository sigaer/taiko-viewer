<script setup lang="ts">
import "~/assets/css/ds/tokens.css";
import "~/assets/css/ds/fonts.css";
import "~/assets/css/ds/element-plus.css";
import "~/assets/css/ds/rework.css";
import {
  MAIN_NAV,
  MOBILE_TABS,
  ALL_FEATURES,
  FOOTER_LINKS,
  SONGS_TABS,
  SCORES_TABS,
  TOOLS_TABS,
  activeDestination,
  mobileTab,
  withoutLocale,
  alternateLocale,
  tabCurrent,
  isLegacyPage,
  type NavGroupKey,
} from "~/utils/rework/navigation";
import { searchShortcut } from "~/utils/rework/search";
import { COMMUNITY_TABS } from "~/utils/rework/community";
import { SYNC_INDICATOR_KEY, syncIndicatorMark, type SyncIndicatorState } from "~/utils/rework/sync";
defineProps<{
  title: string;
  contentLayout: string;
  showMobileNav: boolean;
  /** Localized parent location for the mobile back button */
  backHref?: string;
}>();
useHead({ htmlAttrs: { "data-viewer-shell": "" } });
const route = useRoute();
const nuxtApp = useNuxtApp();
const router = useRouter();
const { t, locale } = useI18n();
const localePath = useLocalePath();
const switchLocalePath = useSwitchLocalePath();
const { theme, setTheme } = useViewerTheme();
const { accountUser, fetchCurrentUser } = useAccountState();
// Unread forum notifications on the bell: the existing poll (phones and tablets, 30 s; the old mobile tab bar used
// it) and every count the notification pages confirm (useForumUnreadCount).
const { unreadCount } = useForumNotificationPolling();
// The sync control (同步成绩 in the sidebar) shows what /account/sync last read for this account and binding (slice
// E2): a dot when the next step is the player's or the last sync failed, a turning icon while the page's request runs.
// It never reads the sync API itself (no polling); before the sync page has been opened it is the plain link.
const bindingGeneration = useState("account-binding-generation", () => 0);
const syncIndicator = useState<SyncIndicatorState | null>(SYNC_INDICATOR_KEY, () => null);
const syncKind = computed(() => {
  const s = syncIndicator.value;
  const user = accountUser.value;
  return s && user && s.userId === user.id && s.generation === bindingGeneration.value ? s.kind : null;
});
const syncMark = computed(() => syncIndicatorMark(syncKind.value));
const syncState = computed(() => (syncKind.value ? t(`rework.account.sync.indicator.${syncKind.value}`) : ""));
const syncLabel = computed(() =>
  syncKind.value ? t("rework.shell.syncScoresState", { state: syncState.value }) : t("rework.shell.syncScores"),
);
// Account menu (slice G): the avatar in the top bar opens profile, sync, settings and sign out. A menu button: Enter /
// Space / ArrowDown open it on the first item, ArrowUp on the last; arrows, Home and End move inside; Escape closes and
// returns focus to the button; Tab, an outside click and any navigation close it. Signed out the bar keeps the link.
const { signingOut, signOut } = useAccountSignOut();
const menuOpen = ref(false);
const menuButton = ref<HTMLButtonElement>();
const menuList = ref<HTMLElement>();
const menuItems = () => [...(menuList.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') || [])];
async function openMenu(focus: "first" | "last" = "first") {
  menuOpen.value = true;
  await nextTick();
  const items = menuItems();
  (focus === "last" ? items[items.length - 1] : items[0])?.focus();
}
function closeMenu(returnFocus = false) {
  if (!menuOpen.value) return;
  menuOpen.value = false;
  if (returnFocus) nextTick(() => menuButton.value?.focus());
}
function menuButtonKey(event: KeyboardEvent) {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    openMenu(event.key === "ArrowUp" ? "last" : "first");
  }
}
function menuKey(event: KeyboardEvent) {
  const items = menuItems();
  const at = items.indexOf(document.activeElement as HTMLElement);
  const move = (i: number) => items[(i + items.length) % items.length]?.focus();
  if (event.key === "ArrowDown") move(at + 1);
  else if (event.key === "ArrowUp") move(at - 1);
  else if (event.key === "Home") move(0);
  else if (event.key === "End") move(items.length - 1);
  else if (event.key === "Escape") closeMenu(true);
  else if (event.key === "Tab") return closeMenu();
  else return;
  event.preventDefault();
}
function outsidePointer(event: PointerEvent) {
  const target = event.target as Node;
  if (!menuList.value?.contains(target) && !menuButton.value?.contains(target)) closeMenu();
}
watch(menuOpen, (open) => {
  if (open) document.addEventListener("pointerdown", outsidePointer, true);
  else document.removeEventListener("pointerdown", outsidePointer, true);
});
async function menuSignOut() {
  closeMenu();
  await signOut();
}
const main = ref<HTMLElement>();
const searchOpen = ref(false);
const searchButton = ref<HTMLButtonElement>();
let trigger: HTMLElement | null = null;
// `rework-ep` turns on the V1.3 Element Plus mapping (assets/css/ds/element-plus.css). Since slice G it is the default
// for every page in this shell; only the pages outside the rework that still render here (isLegacyPage: the annual
// entry /annual, admin paths) go without it, and they keep the old page background. The class sits on <html>, so
// popups teleported to <body> follow it, and it follows the current route (also when a page is kept alive).
const legacyPage = computed(() => isLegacyPage(route.path));
useHead(() => ({ htmlAttrs: { class: legacyPage.value ? "viewer-rework" : "viewer-rework rework-ep" } }));
const active = computed(() => activeDestination(route.path));
const path = computed(() => withoutLocale(route.path));
const currentTab = computed(() => mobileTab(route.path));
// Sidebar groups (曲库, 我的成绩, 工具) are disclosures, collapsed by default. The group holding the current page is
// open; what the player toggles is kept for the session in useState (never browser storage), so the server and the
// client render the same first paint from the route alone.
const currentGroup = computed<NavGroupKey | null>(() =>
  active.value === "songs" || active.value === "scores" || active.value === "tools" ? active.value : null,
);
const groupToggles = useState<Partial<Record<NavGroupKey, boolean>>>("rework-nav-groups", () => ({}));
const groupOpen = (key: NavGroupKey) => groupToggles.value[key] ?? currentGroup.value === key;
function toggleGroup(key: NavGroupKey) {
  groupToggles.value = { ...groupToggles.value, [key]: !groupOpen(key) };
}
// Arriving in a group the player had closed opens it again (the current page is always visible in the sidebar).
watch(currentGroup, (key) => {
  if (key && groupToggles.value[key] === false) {
    const next = { ...groupToggles.value };
    delete next[key];
    groupToggles.value = next;
  }
});
// Section tabs below 1100 px (sibling pages of the current group; the sidebar replaces them on wide screens).
// `prefix` tabs stay current on their sub-pages (the dan courses, the guide star pages).
const secondary: Record<string, readonly { key: string; to: string; labelKey: string; prefix?: boolean }[]> = {
  songs: [...SONGS_TABS],
  scores: [...SCORES_TABS],
  community: COMMUNITY_TABS.map((tab) => ({ ...tab, labelKey: `rework.${tab.key}` })),
  tools: [...TOOLS_TABS],
};
const tabs = computed(() =>
  route.meta.composerHeader ||
  /^\/(songs\/\d+|forum\/thread\/)/.test(path.value)
    ? []
    : secondary[active.value || ""] || [],
);
const tabBox = ref<HTMLElement>();
function revealTab() {
  const box = tabBox.value;
  const item = box?.querySelector<HTMLElement>('[aria-current="page"]');
  if (box && item && box.clientWidth) {
    if (item.offsetLeft < box.scrollLeft) box.scrollLeft = item.offsetLeft;
    else if (item.offsetLeft + item.offsetWidth > box.scrollLeft + box.clientWidth)
      box.scrollLeft = item.offsetLeft + item.offsetWidth - box.clientWidth;
  }
}
// Drawer (768–1099 px): the sidebar as a modal. Focus moves to its close button, Tab stays inside, Escape and the
// scrim close it and focus returns to the menu button; navigation and leaving the tablet range close it too.
const drawerOpen = ref(false);
const side = ref<HTMLElement>();
const sideClose = ref<HTMLButtonElement>();
const drawerButton = ref<HTMLButtonElement>();
let drawerRange: MediaQueryList | null = null;
async function openDrawer() {
  drawerOpen.value = true;
  await nextTick();
  sideClose.value?.focus();
}
function closeDrawer(returnFocus = false) {
  if (!drawerOpen.value) return;
  drawerOpen.value = false;
  if (returnFocus) nextTick(() => drawerButton.value?.focus());
}
function drawerKey(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    closeDrawer(true);
    return;
  }
  if (event.key !== "Tab" || !side.value) return;
  const items = [...side.value.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")].filter(
    (el) => el.getClientRects().length > 0,
  );
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  const inside = side.value.contains(document.activeElement);
  if (!inside || (event.shiftKey && document.activeElement === first)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
function drawerRangeChange(event: MediaQueryListEvent) {
  if (!event.matches) closeDrawer();
}
watch(drawerOpen, (open) => {
  if (open) document.addEventListener("keydown", drawerKey);
  else document.removeEventListener("keydown", drawerKey);
});
function openSearch() {
  trigger =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  searchOpen.value = true;
}
async function closeSearch(to?: string) {
  searchOpen.value = false;
  if (to) {
    await router.push(to);
    await nextTick();
    main.value?.focus();
  } else {
    await nextTick();
    if (trigger?.isConnected) trigger.focus();
    else searchButton.value?.focus();
  }
}
function shortcut(event: KeyboardEvent) {
  const target = event.target as HTMLElement;
  const editable = Boolean(
    target?.closest(
      'input,textarea,select,[contenteditable]:not([contenteditable="false"])',
    ),
  );
  const action = searchShortcut(event, editable);
  if (!action || event.defaultPrevented) return;
  event.preventDefault();
  if (action === "toggle" && searchOpen.value) closeSearch();
  else openSearch();
}
watch(
  () => route.fullPath,
  () => {
    searchOpen.value = false;
    menuOpen.value = false;
    drawerOpen.value = false;
    nextTick(revealTab);
  },
);
onMounted(() => {
  window.addEventListener("keydown", shortcut);
  drawerRange = window.matchMedia("(min-width: 768px) and (max-width: 1099px)");
  drawerRange.addEventListener("change", drawerRangeChange);
  revealTab();
  // Static payloads contain the build-time guest, never the current session.
  if (nuxtApp.payload.prerenderedAt) void fetchCurrentUser(true);
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", shortcut);
  document.removeEventListener("pointerdown", outsidePointer, true);
  document.removeEventListener("keydown", drawerKey);
  drawerRange?.removeEventListener("change", drawerRangeChange);
});
await fetchCurrentUser();
</script>
<template>
  <div
    class="rework-shell"
    :class="{ 'has-tabs': tabs.length, 'has-bottom-nav': showMobileNav, 'is-legacy': legacyPage, 'drawer-open': drawerOpen }"
  >
    <a href="#viewer-main" class="skip-link" @click.prevent="main?.focus()">{{
      t("rework.skip")
    }}</a>
    <div v-if="drawerOpen" class="side-scrim" aria-hidden="true" @click="closeDrawer(true)" />
    <aside
      id="rework-side"
      ref="side"
      class="rework-side"
      :class="{ 'is-open': drawerOpen }"
      :role="drawerOpen ? 'dialog' : undefined"
      :aria-modal="drawerOpen ? 'true' : undefined"
      :aria-label="drawerOpen ? t('rework.mainNav') : undefined"
    >
      <div class="side-head">
        <div class="side-brand-row">
          <NuxtLink :to="localePath('/')" class="side-brand" aria-label="Taiko Viewer"
            ><img src="/optimized/logo-168.webp" alt="" width="40" height="40" decoding="async" /><span
              class="side-word"
              aria-hidden="true"
              >Taiko Viewer</span
            ></NuxtLink
          ><button
            ref="sideClose"
            type="button"
            class="side-close"
            :aria-label="t('rework.shell.closeMenu')"
            @click="closeDrawer(true)"
          >
            <ReworkIcon name="close" />
          </button>
        </div>
        <div class="side-sync">
          <template v-if="accountUser"
            ><NuxtLink
              class="side-sync__btn sync-control"
              :class="syncKind ? `is-${syncKind}` : undefined"
              :to="localePath('/account/sync')"
              :aria-label="syncLabel"
              :aria-current="path === '/account/sync' ? 'page' : undefined"
              data-sync-control
              :data-sync-state="syncKind || undefined"
              ><ReworkIcon name="sync" /><span>{{ t("rework.shell.syncScores") }}</span
              ><span v-if="syncMark" class="sync-dot" :class="`is-${syncMark}`" aria-hidden="true" /></NuxtLink
            ><span v-if="syncKind" class="side-sync__state" aria-hidden="true">{{ syncState }}</span></template
          ><NuxtLink v-else class="side-sync__btn" :to="localePath('/account')">{{ t("rework.login") }}</NuxtLink>
        </div>
      </div>
      <div class="side-scroll">
        <nav class="side-nav" :aria-label="t('rework.mainNav')">
          <ul class="side-list">
            <li v-for="entry in MAIN_NAV" :key="entry.key">
              <NuxtLink
                v-if="entry.kind === 'link'"
                class="side-link"
                :to="localePath(entry.to)"
                :aria-current="tabCurrent(entry, path) ? 'page' : undefined"
                ><ReworkIcon :name="entry.icon" /><span>{{ t(entry.labelKey) }}</span></NuxtLink
              >
              <template v-else
                ><button
                  type="button"
                  class="side-link side-group"
                  :class="{ 'is-current': currentGroup === entry.key }"
                  :aria-expanded="groupOpen(entry.key)"
                  :aria-controls="`side-group-${entry.key}`"
                  @click="toggleGroup(entry.key)"
                >
                  <ReworkIcon :name="entry.icon" /><span>{{ t(entry.labelKey) }}</span
                  ><ReworkIcon name="chevron" class="side-chev" /></button
                ><ul v-show="groupOpen(entry.key)" :id="`side-group-${entry.key}`" class="side-sub">
                  <li v-for="item in entry.items" :key="item.to">
                    <NuxtLink
                      class="side-sublink"
                      :to="localePath(item.to)"
                      :aria-current="tabCurrent(item, path) ? 'page' : undefined"
                      >{{ t(item.labelKey) }}</NuxtLink
                    >
                  </li>
                </ul></template
              >
            </li>
            <li>
              <NuxtLink
                class="side-link"
                :to="localePath(ALL_FEATURES.to)"
                :aria-current="path === ALL_FEATURES.to ? 'page' : undefined"
                ><ReworkIcon name="grid" /><span>{{ t(ALL_FEATURES.labelKey) }}</span></NuxtLink
              >
            </li>
          </ul>
        </nav>
        <div class="side-foot">
          <NuxtLink
            v-for="link in FOOTER_LINKS"
            :key="link.key"
            class="side-foot__link"
            :to="localePath(link.to)"
            :aria-current="path === link.to ? 'page' : undefined"
            >{{ t(link.labelKey) }}</NuxtLink
          >
          <span class="side-foot__tools"
            ><NuxtLink
              class="side-tool"
              :to="switchLocalePath(alternateLocale(locale)) || localePath('/')"
              :aria-label="t('rework.language')"
              >{{ t("rework.nextLanguage") }}</NuxtLink
            ><button
              class="side-tool"
              type="button"
              :aria-label="t('rework.theme')"
              @click="setTheme(theme === 'dark' ? 'light' : 'dark')"
            >
              <ReworkIcon name="theme" /></button
          ></span>
        </div>
      </div>
    </aside>
    <header v-if="!route.meta.composerHeader" class="rework-bar">
      <button
        ref="drawerButton"
        type="button"
        class="icon-button menu-button"
        :aria-label="t('rework.shell.menu')"
        aria-haspopup="dialog"
        :aria-expanded="drawerOpen"
        aria-controls="rework-side"
        @click="openDrawer"
      >
        <ReworkIcon name="menu" />
      </button>
      <NuxtLink
        v-if="backHref"
        :to="backHref"
        class="icon-button back"
        :aria-label="t('rework.back')"
        ><ReworkIcon name="back" /></NuxtLink
      ><NuxtLink
        v-else
        :to="localePath('/')"
        class="mobile-brand"
        aria-label="Taiko Viewer"
        ><img src="/optimized/logo-168.webp" alt="" width="36" height="36" decoding="async"
      /></NuxtLink>
      <button
        ref="searchButton"
        class="search-trigger"
        type="button"
        :aria-label="t('rework.search')"
        aria-keyshortcuts="Control+K Meta+K /"
        aria-haspopup="dialog"
        :aria-expanded="searchOpen"
        @click="openSearch"
      >
        <ReworkIcon name="search" /><span>{{
          t("rework.searchPlaceholder")
        }}</span
        ><kbd>Ctrl K</kbd>
      </button>
      <div class="bar-actions">
        <NuxtLink
          class="icon-button bell"
          :to="localePath('/forum/notifications')"
          :aria-label="unreadCount ? `${t('rework.notifications')} (${unreadCount})` : t('rework.notifications')"
          :aria-current="path === '/forum/notifications' ? 'page' : undefined"
          ><ReworkIcon name="bell" /><span v-if="unreadCount" class="bell-dot num" aria-hidden="true">{{ unreadCount > 99 ? "99+" : unreadCount }}</span></NuxtLink
        ><div v-if="accountUser" class="account-menu"
          ><button
            :id="'rework-account-button'"
            ref="menuButton"
            type="button"
            class="account-link"
            :aria-label="t('rework.accountMenu')"
            aria-haspopup="menu"
            :aria-expanded="menuOpen"
            aria-controls="rework-account-menu"
            data-account-menu
            @click="menuOpen ? closeMenu() : openMenu()"
            @keydown="menuButtonKey"
          ><DsPlayerAvatar :src="accountUser.avatarUrl" :size="32" /></button
          ><ul
            v-show="menuOpen"
            id="rework-account-menu"
            ref="menuList"
            class="account-menu__list"
            role="menu"
            aria-labelledby="rework-account-button"
            @keydown="menuKey"
          >
            <li role="none"><NuxtLink role="menuitem" tabindex="-1" :to="localePath('/account/profile')"><ReworkIcon name="my" />{{ t("account.profile") }}</NuxtLink></li>
            <li role="none"><NuxtLink role="menuitem" tabindex="-1" :to="localePath('/account/sync')"><ReworkIcon name="sync" />{{ t("account.sync") }}</NuxtLink></li>
            <li role="none"><NuxtLink role="menuitem" tabindex="-1" :to="localePath('/settings')"><ReworkIcon name="settings" />{{ t("nav.settings") }}</NuxtLink></li>
            <li role="none" class="account-menu__sep"><button role="menuitem" tabindex="-1" type="button" :disabled="signingOut" :aria-busy="signingOut" @click="menuSignOut"><ReworkIcon name="logout" />{{ t("rework.account.profile.signOut") }}</button></li>
          </ul></div
        ><NuxtLink
          v-else
          class="account-link"
          :to="localePath('/account')"
          :aria-label="t('rework.my')"
          ><span>{{ t("rework.login") }}</span></NuxtLink
        >
      </div>
    </header>
    <nav
      v-if="tabs.length"
      ref="tabBox"
      class="rework-tabs mobile-tabs"
      :aria-label="t('rework.sectionNav')"
    >
      <NuxtLink
        v-for="tab in tabs"
        :key="tab.to"
        :to="localePath(tab.to)"
        :aria-current="tabCurrent(tab, path) ? 'page' : undefined"
        >{{ t(tab.labelKey) }}</NuxtLink
      >
    </nav>
    <main
      id="viewer-main"
      ref="main"
      class="rework-main"
      :class="`rework-main--${contentLayout}`"
      tabindex="-1"
    >
      <div class="viewer-content" :class="`viewer-content--${contentLayout}`">
        <slot />
      </div>
    </main>
    <div id="viewer-shell-dock" />
    <nav
      v-if="showMobileNav"
      class="rework-bottom"
      :aria-label="t('rework.mainNav')"
    >
      <NuxtLink
        v-for="item in MOBILE_TABS"
        :key="item.key"
        :to="localePath(item.to)"
        :aria-current="currentTab === item.key ? 'page' : undefined"
        ><span class="bottom-pill"><ReworkIcon :name="item.icon" /></span><span>{{
          t(item.labelKey)
        }}</span></NuxtLink
      >
    </nav>
    <ClientOnly
      ><ReworkSearchPanel :open="searchOpen" @close="closeSearch"
    /></ClientOnly>
  </div>
</template>
<style scoped>
.rework-shell {
  min-height: 100dvh;
  padding-left: var(--rail-w);
  background: var(--bg);
  color: var(--ink);
}
/* Pages outside the rework (isLegacyPage) keep the page background they had before the slice G tuning. */
.rework-shell.is-legacy {
  background: var(--chrome-bg);
}
/* The frame: a dark sidebar in both themes (--side-*), the top bar, tabs and phone bottom bar on --chrome-*. */
.rework-side,
.rework-bar,
.rework-tabs,
.rework-bottom {
  font-family: var(--font-ui);
}
.rework-shell :is(a, button) {
  -webkit-tap-highlight-color: transparent;
}
.rework-shell :is(a, button):focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 3px;
}
/* ---------- Sidebar (≥ 1100 px; the same element is the drawer at 768–1099 px) ---------- */
.rework-side {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: var(--z-rail);
  width: 256px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  background: var(--side-bg);
  color: var(--side-ink);
  font-size: var(--fs-14);
}
.side-head {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px 14px 12px;
}
.side-brand-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.side-brand {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 6px;
  color: var(--side-ink-strong);
  text-decoration: none;
  border-radius: var(--r-ctl);
}
.side-brand img {
  width: 40px;
  height: 40px;
  object-fit: contain;
  flex: none;
}
.side-word {
  font-size: 17px;
  font-weight: 800;
  letter-spacing: 0.2px;
  white-space: nowrap;
}
.side-close {
  display: none;
}
.side-sync {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  border-radius: var(--r-panel);
  background: var(--side-surface);
}
.side-sync__btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 40px;
  padding: 0 12px;
  border-radius: var(--r-ctl);
  background: var(--action-bg);
  color: var(--action-ink);
  font-size: var(--fs-14);
  font-weight: 700;
  text-decoration: none;
}
.side-sync__btn:hover {
  background: var(--action-bg-hover);
}
.side-sync__btn:active,
.side-sync__btn[aria-current] {
  background: var(--action-bg-active);
}
.side-sync__btn svg {
  width: 18px;
  height: 18px;
}
.side-sync__state {
  font-size: var(--fs-12);
  color: var(--side-ink-2);
  text-align: center;
}
.sync-dot {
  position: absolute;
  top: 6px;
  right: 8px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  box-shadow: 0 0 0 2px var(--side-ink-strong);
}
.sync-dot.is-warn {
  background: var(--warn);
}
.sync-dot.is-danger {
  background: var(--danger);
}
@media (prefers-reduced-motion: no-preference) {
  .sync-control.is-running svg {
    animation: rework-sync-turn 1.2s linear infinite;
  }
}
@keyframes rework-sync-turn {
  to {
    transform: rotate(360deg);
  }
}
.side-scroll {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  padding: 4px 14px 16px;
}
.side-list,
.side-sub {
  margin: 0;
  padding: 0;
  list-style: none;
}
.side-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.side-link {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 40px;
  padding: 0 10px 0 12px;
  box-sizing: border-box;
  border: 0;
  border-radius: var(--r-ctl);
  background: transparent;
  color: var(--side-ink);
  font: inherit;
  font-size: 15px;
  font-weight: 500;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
}
.side-link svg {
  width: 19px;
  height: 19px;
}
.side-link span {
  flex: 1;
  min-width: 0;
}
.side-link:hover,
.side-sublink:hover,
.side-foot__link:hover,
.side-tool:hover {
  background: var(--side-surface);
  color: var(--side-ink-strong);
}
.side-link[aria-current],
.side-sublink[aria-current] {
  background: var(--nav-active-bg);
  color: var(--nav-active-ink);
  font-weight: 700;
}
.side-group.is-current {
  background: var(--side-surface);
  color: var(--side-ink-strong);
  font-weight: 700;
}
.side-chev {
  width: 16px;
  height: 16px;
  color: var(--side-ink-2);
  transform: rotate(-90deg);
}
.side-group.is-current .side-chev {
  color: currentColor;
}
.side-group[aria-expanded="true"] .side-chev {
  transform: none;
}
.side-sub {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 2px 0 6px 21px;
  padding-left: 10px;
  border-left: 1px solid var(--side-line);
}
.side-sublink {
  display: flex;
  align-items: center;
  min-height: 36px;
  padding: 0 12px;
  border-radius: var(--r-ctl);
  color: var(--side-ink);
  font-weight: 500;
  text-decoration: none;
}
.side-foot {
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid var(--side-line);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}
.side-foot__link {
  display: flex;
  align-items: center;
  min-height: 32px;
  padding: 0 9px;
  border-radius: var(--r-ctl);
  color: var(--side-ink);
  font-size: var(--fs-13);
  text-decoration: none;
}
.side-foot__link[aria-current] {
  color: var(--side-ink-strong);
  font-weight: 700;
}
.side-foot__tools {
  margin-left: auto;
  display: flex;
  gap: 4px;
}
.side-tool {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: var(--r-ctl);
  background: var(--side-surface);
  color: var(--side-ink);
  font: inherit;
  font-size: var(--fs-13);
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
}
.side-tool svg {
  width: 16px;
  height: 16px;
}
.rework-side :is(a, button):focus-visible {
  outline-offset: 1px;
}
.side-scrim {
  position: fixed;
  inset: 0;
  z-index: calc(var(--z-sheet) - 1);
  background: var(--scrim);
}
/* ---------- Top bar ---------- */
.icon-button {
  width: 44px;
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 0;
  background: transparent;
  color: var(--ink-2);
  text-decoration: none;
  border-radius: var(--r-ctl);
  cursor: pointer;
}
.icon-button:hover {
  background: var(--chrome-sunk);
}
.bell {
  position: relative;
}
.bell[aria-current] {
  color: var(--nav-active-text);
}
.bell-dot {
  position: absolute;
  top: 4px;
  right: 2px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  box-sizing: border-box;
  border-radius: var(--r-note);
  background: var(--action-bg);
  color: var(--action-ink);
  font-size: 11px;
  line-height: 18px;
  text-align: center;
}
.rework-bar {
  position: sticky;
  top: 0;
  z-index: var(--z-bar);
  height: var(--bar-h);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 var(--gutter);
  background: var(--chrome-bg);
  border-bottom: 1px solid var(--chrome-line);
}
.menu-button,
.mobile-brand {
  display: none;
}
.mobile-brand {
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: var(--r-ctl);
}
.mobile-brand img {
  width: 36px;
  height: 36px;
  object-fit: contain;
}
.search-trigger {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  flex: 1 1 280px;
  min-width: 0;
  max-width: 520px;
  padding: 0 12px 0 14px;
  box-sizing: border-box;
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--chrome-sunk);
  color: var(--ink-3);
  font: inherit;
  font-size: var(--fs-14);
  cursor: pointer;
}
.search-trigger:hover {
  border-color: var(--line-strong);
}
.search-trigger svg {
  width: 18px;
  height: 18px;
}
.search-trigger span {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}
.search-trigger kbd {
  flex: none;
  white-space: nowrap;
  padding: 2px 7px;
  border: 1px solid var(--line-strong);
  border-radius: var(--r-xs);
  background: var(--surface);
  color: var(--ink-2);
  font: inherit;
  font-size: var(--fs-12);
  font-weight: 600;
}
.bar-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}
.account-link {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  color: var(--link);
  font-size: 14px;
  text-decoration: none;
}
.account-menu {
  position: relative;
}
button.account-link {
  border: 0;
  padding: 0;
  background: transparent;
  border-radius: 50%;
  cursor: pointer;
}
.account-menu__list {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: var(--z-palette);
  min-width: 200px;
  margin: 0;
  padding: var(--overlay-pad-sm);
  list-style: none;
  border: 1px solid var(--overlay-line);
  border-radius: var(--overlay-radius);
  background: var(--overlay-bg);
  box-shadow: var(--overlay-shadow);
  font-family: var(--font-ui);
}
.account-menu__list :is(a, button) {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: var(--hit);
  padding: 0 12px;
  border: 0;
  border-radius: var(--r-ctl);
  background: transparent;
  color: var(--ink);
  font: inherit;
  font-size: var(--fs-14);
  text-align: left;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
}
.account-menu__list :is(a, button):is(:hover, :focus-visible) {
  background: var(--bg-sunk);
}
.account-menu__list :is(a, button):focus-visible {
  outline-offset: -2px;
}
.account-menu__list svg {
  color: var(--ink-2);
}
.account-menu__list button:disabled {
  color: var(--disabled-ink);
  cursor: default;
}
.account-menu__sep {
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid var(--line);
}
/* ---------- Section tabs (below 1100 px) ---------- */
.rework-tabs {
  display: flex;
  gap: 4px;
  overflow: auto;
  scrollbar-width: thin;
  padding: 0 var(--gutter);
  background: var(--chrome-bg);
  border-bottom: 1px solid var(--chrome-line);
  position: sticky;
  top: var(--bar-h);
  z-index: calc(var(--z-bar) - 1);
}
.rework-tabs a {
  display: flex;
  align-items: center;
  min-height: 44px;
  padding: 0 12px;
  color: var(--ink-2);
  text-decoration: none;
  white-space: nowrap;
  border-bottom: 3px solid transparent;
  font-size: 14px;
}
.rework-tabs a[aria-current] {
  border-color: var(--tab-line);
  color: var(--ink);
  font-weight: 700;
}
.rework-main {
  padding: 24px var(--gutter) 48px;
  min-width: 0;
  outline-offset: -3px;
}
.rework-main--immersive {
  padding: 0;
}
.rework-bottom {
  display: none;
}
.skip-link {
  position: fixed;
  top: -100px;
  left: calc(var(--rail-w) + 16px);
  z-index: 100;
  padding: 12px;
  background: var(--chrome-surface);
  color: var(--link);
}
.skip-link:focus {
  top: 8px;
}
@media (min-width: 1100px) {
  .rework-tabs {
    display: none;
  }
}
@media (max-width: 1099px) {
  .rework-side {
    display: none;
  }
  .rework-side.is-open {
    display: flex;
    z-index: var(--z-sheet);
    width: min(300px, calc(100vw - 48px));
    box-shadow: var(--shadow-pop);
  }
  .rework-side.is-open .side-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 44px;
    height: 44px;
    border: 0;
    border-radius: var(--r-ctl);
    background: transparent;
    color: var(--side-ink);
    cursor: pointer;
  }
  .rework-side.is-open :is(.side-link, .side-sync__btn) {
    min-height: 44px;
  }
  .rework-side.is-open :is(.side-sublink, .side-foot__link) {
    min-height: 44px;
  }
  .rework-side.is-open .side-tool {
    width: 44px;
    height: 44px;
  }
  .menu-button,
  .mobile-brand {
    display: inline-flex;
  }
  .rework-bar {
    gap: 8px;
  }
  .search-trigger kbd {
    display: none;
  }
}
@media (max-width: 767px) {
  .menu-button {
    display: none;
  }
  .rework-bar {
    height: var(--bar-h-m);
    padding: 0 12px;
    gap: 8px;
  }
  .mobile-brand {
    margin-left: -4px;
  }
  .search-trigger {
    flex: 1 1 auto;
    max-width: none;
    border-radius: var(--r-note);
    padding: 0 14px;
    gap: 8px;
  }
  .account-link,
  .account-menu {
    display: none;
  }
  .bar-actions {
    gap: 0;
    margin-left: 0;
  }
  .rework-tabs {
    padding: 0 12px;
    top: var(--bar-h-m);
  }
  .rework-main {
    padding: 20px 16px 32px;
  }
  .rework-main--immersive {
    padding: 0;
  }
  .has-bottom-nav .rework-main {
    padding-bottom: calc(88px + env(safe-area-inset-bottom));
  }
  .rework-bottom {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: var(--z-bar);
    padding: 4px 6px calc(4px + env(safe-area-inset-bottom));
    border-top: 1px solid var(--chrome-line);
    background: var(--chrome-surface);
  }
  .rework-bottom a {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-width: 0;
    min-height: 56px;
    color: var(--ink-2);
    font-size: 11.5px;
    font-weight: 600;
    text-decoration: none;
    white-space: nowrap;
  }
  .bottom-pill {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 30px;
    border-radius: var(--r-note);
  }
  .bottom-pill svg {
    width: 21px;
    height: 21px;
  }
  .rework-bottom [aria-current] {
    color: var(--nav-active-text);
    font-weight: 800;
  }
  .rework-bottom [aria-current] .bottom-pill {
    background: var(--brand-soft);
  }
  .skip-link {
    left: 8px;
  }
}
</style>
