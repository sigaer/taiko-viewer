<script setup lang="ts">
import "~/assets/css/ds/tokens.css";
import "~/assets/css/ds/fonts.css";
import "~/assets/css/ds/element-plus.css";
import "~/assets/css/ds/rework.css";
import {
  desktopDestinations,
  mobileDestinations,
  activeDestination,
  withoutLocale,
  alternateLocale,
  SONGS_TABS,
  TOOLS_TABS,
  tabCurrent,
  isLegacyPage,
} from "~/utils/rework/navigation";
import { searchShortcut } from "~/utils/rework/search";
import { PLAY_TABS } from "~/utils/rework/scores";
import { GROWTH_TABS } from "~/utils/rework/today";
import { COMMUNITY_TABS } from "~/utils/rework/community";
import { SYNC_INDICATOR_KEY, syncIndicatorMark, type SyncIndicatorState } from "~/utils/rework/sync";
const props = defineProps<{
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
// The sync control shows what /account/sync last read for this account and binding (slice E2): a dot when the next
// step is the player's or the last sync failed, a turning icon while the page's request runs. It never reads the sync
// API itself (no polling); before the sync page has been opened it is the plain link, as before.
const bindingGeneration = useState("account-binding-generation", () => 0);
const syncIndicator = useState<SyncIndicatorState | null>(SYNC_INDICATOR_KEY, () => null);
const syncKind = computed(() => {
  const s = syncIndicator.value;
  const user = accountUser.value;
  return s && user && s.userId === user.id && s.generation === bindingGeneration.value ? s.kind : null;
});
const syncMark = computed(() => syncIndicatorMark(syncKind.value));
const syncLabel = computed(() =>
  syncKind.value ? t("rework.account.sync.indicator.label", { state: t(`rework.account.sync.indicator.${syncKind.value}`) }) : t("rework.sync"),
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
const moduleTitle = computed(() =>
  active.value ? t(`rework.${active.value}`) : props.title,
);
const path = computed(() => withoutLocale(route.path));
// Secondary tabs per destination. `labelKey` (slice F) labels a tab with its page's own title; otherwise rework.<key>.
// `prefix` tabs stay current on their sub-pages (the dan courses, the guide star pages).
const secondary: Record<string, { key: string; to: string; labelKey?: string; prefix?: boolean }[]> = {
  songs: [...SONGS_TABS],
  play: [...PLAY_TABS],
  growth: [...GROWTH_TABS],
  community: [...COMMUNITY_TABS],
  tools: [...TOOLS_TABS],
};
const tabs = computed(() =>
  route.meta.composerHeader ||
  /^\/(songs\/\d+|forum\/thread\/)/.test(path.value)
    ? []
    : secondary[active.value || ""] || [],
);
const tabBox = ref<HTMLElement>();
const desktopTabBox = ref<HTMLElement>();
function revealTab() {
  for (const box of [tabBox.value, desktopTabBox.value]) {
    const item = box?.querySelector<HTMLElement>('[aria-current="page"]');
    if (box && item && box.clientWidth) {
      if (item.offsetLeft < box.scrollLeft) box.scrollLeft = item.offsetLeft;
      else if (
        item.offsetLeft + item.offsetWidth >
        box.scrollLeft + box.clientWidth
      )
        box.scrollLeft = item.offsetLeft + item.offsetWidth - box.clientWidth;
    }
  }
}
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
    nextTick(revealTab);
  },
);
onMounted(() => {
  window.addEventListener("keydown", shortcut);
  revealTab();
  // Static payloads contain the build-time guest, never the current session.
  if (nuxtApp.payload.prerenderedAt) void fetchCurrentUser(true);
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", shortcut);
  document.removeEventListener("pointerdown", outsidePointer, true);
});
await fetchCurrentUser();
</script>
<template>
  <div
    class="rework-shell"
    :class="{ 'has-tabs': tabs.length, 'has-bottom-nav': showMobileNav, 'is-legacy': legacyPage }"
  >
    <a href="#viewer-main" class="skip-link" @click.prevent="main?.focus()">{{
      t("rework.skip")
    }}</a>
    <nav class="rework-rail" :aria-label="t('rework.mainNav')">
      <NuxtLink :to="localePath('/')" class="brand" aria-label="Taiko Viewer"
        ><ReworkBrand
      /></NuxtLink>
      <NuxtLink
        v-for="item in desktopDestinations"
        :key="item.key"
        :to="localePath(item.to)"
        class="rail-item"
        :aria-current="active === item.key ? 'page' : undefined"
        ><span class="rail-pill"><ReworkIcon :name="item.key" /></span
        ><span>{{ t(`rework.${item.key}`) }}</span></NuxtLink
      >
      <div class="rail-footer">
        <NuxtLink
          class="icon-button"
          :to="switchLocalePath(alternateLocale(locale)) || localePath('/')"
          :aria-label="t('rework.language')"
          >{{ t("rework.nextLanguage") }}</NuxtLink
        ><button
          class="icon-button"
          type="button"
          :aria-label="t('rework.theme')"
          @click="setTheme(theme === 'dark' ? 'light' : 'dark')"
        >
          <ReworkIcon name="theme" />
        </button>
      </div>
    </nav>
    <header v-if="!route.meta.composerHeader" class="rework-bar">
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
        ><ReworkBrand
      /></NuxtLink>
      <strong class="module-title">{{ moduleTitle }}</strong>
      <nav
        v-if="tabs.length"
        ref="desktopTabBox"
        class="rework-tabs desktop-tabs"
        :aria-label="t('rework.sectionNav')"
      >
        <NuxtLink
          v-for="tab in tabs"
          :key="tab.to"
          :to="localePath(tab.to)"
          :aria-current="tabCurrent(tab, path) ? 'page' : undefined"
          >{{ t(tab.labelKey || `rework.${tab.key}`) }}</NuxtLink
        >
      </nav>
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
        <button
          v-if="!showMobileNav"
          class="icon-button mobile-search"
          type="button"
          :aria-label="t('rework.search')"
          @click="openSearch"
        >
          <ReworkIcon name="search" /></button
        ><NuxtLink
          class="icon-button sync-control"
          :class="syncKind ? `is-${syncKind}` : undefined"
          :to="localePath('/account/sync')"
          :aria-label="syncLabel"
          :aria-current="path === '/account/sync' ? 'page' : undefined"
          data-sync-control
          :data-sync-state="syncKind || undefined"
          ><ReworkIcon name="sync" /><span v-if="syncMark" class="sync-dot" :class="`is-${syncMark}`" aria-hidden="true" /></NuxtLink
        ><NuxtLink
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
        >{{ t(tab.labelKey || `rework.${tab.key}`) }}</NuxtLink
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
      <template v-for="item in mobileDestinations" :key="item.key"
        ><button
          v-if="item.key === 'search'"
          type="button"
          class="don-search"
          :aria-label="t('rework.search')"
          aria-haspopup="dialog"
          @click="openSearch"
        >
          <span class="don-face"><ReworkIcon name="search" /></span></button
        ><NuxtLink
          v-else
          :to="localePath(item.to)"
          :aria-current="
            active === item.key ||
            (item.key === 'my' &&
              (!active || ['play', 'growth', 'tools'].includes(active)))
              ? 'page'
              : undefined
          "
          ><ReworkIcon :name="item.key" /><span>{{
            t(`rework.${item.key}`)
          }}</span></NuxtLink
        ></template
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
/* The frame (rail, top bar, tabs, phone bottom bar) keeps the teal tint: --chrome-* (slice G tuning). */
.rework-rail,
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
.rework-rail {
  position: fixed;
  inset: 0 auto 0 0;
  width: var(--rail-w);
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 4px;
  background: var(--chrome-surface);
  border-right: 1px solid var(--chrome-line);
  z-index: var(--z-rail);
  padding: 12px 4px;
}
.brand {
  display: grid;
  place-items: center;
  height: 56px;
  margin-bottom: 12px;
}
.rail-item {
  width: 72px;
  min-height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 3px;
  color: var(--ink-2);
  font-size: 12px;
  text-decoration: none;
  border-radius: var(--r-ctl);
}
.rail-pill {
  display: grid;
  place-items: center;
  width: 52px;
  height: 34px;
  border-radius: var(--r-note);
}
.rail-item:hover .rail-pill {
  background: var(--chrome-sunk);
}
.rail-item[aria-current] .rail-pill {
  background: var(--nav-active-bg);
  color: var(--nav-active-ink);
}
.rail-item[aria-current] {
  color: var(--nav-active-text);
  font-weight: 700;
}
.rail-footer {
  margin-top: auto;
  display: flex;
  flex-direction: column;
}
.icon-button {
  width: 44px;
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
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
.bell,
.sync-control {
  position: relative;
}
.sync-control[aria-current],
.sync-control.is-running {
  color: var(--nav-active-text);
}
.sync-dot {
  position: absolute;
  top: 9px;
  right: 9px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  box-shadow: 0 0 0 2px var(--chrome-bg);
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
  gap: 16px;
  padding: 0 var(--gutter);
  background: var(--chrome-bg);
  border-bottom: 1px solid var(--chrome-line);
}
.module-title {
  font-size: 18px;
  white-space: nowrap;
}
.search-trigger {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  width: clamp(220px, 24vw, 320px);
  flex-shrink: 0;
  margin-left: auto;
  padding: 0 12px;
  border: 1px solid var(--line-strong);
  border-radius: var(--r-note);
  background: var(--chrome-surface);
  color: var(--ink-3);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.search-trigger span {
  flex: 1;
  text-align: left;
}
.search-trigger kbd {
  white-space: nowrap;
  font-size: 11px;
}
.bar-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
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
.rework-tabs {
  display: flex;
  gap: 4px;
  overflow: auto;
  scrollbar-width: thin;
  padding: 0 var(--gutter);
  background: var(--chrome-bg);
  border-bottom: 1px solid var(--chrome-line);
  position: relative;
}
.desktop-tabs {
  height: 100%;
  flex: 1;
  min-width: 0;
  padding: 0;
  border-bottom: 0;
}
.mobile-tabs {
  display: none;
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
.mobile-brand,
.mobile-search,
.rework-bottom {
  display: none;
}
.skip-link {
  position: fixed;
  top: -100px;
  left: 100px;
  z-index: 100;
  padding: 12px;
  background: var(--chrome-surface);
  color: var(--link);
}
.skip-link:focus {
  top: 8px;
}
@media (max-width: 1099px) {
  .search-trigger {
    width: 44px;
    padding: 0;
    justify-content: center;
  }
  .search-trigger span,
  .search-trigger kbd {
    display: none;
  }
  .rework-bar {
    gap: 8px;
  }
}
@media (max-width: 767px) {
  .rework-shell {
    padding-left: 0;
  }
  .rework-rail {
    display: none;
  }
  .rework-bar {
    height: var(--bar-h-m);
    padding: 0 12px;
    gap: 8px;
  }
  .module-title {
    margin-right: auto;
    min-width: 0;
    font-size: 16px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .mobile-brand,
  .mobile-search {
    display: inline-flex;
  }
  .mobile-brand {
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    margin: 0 -8px;
  }
  .mobile-brand svg {
    width: 28px;
    height: 28px;
  }
  .search-trigger,
  .account-link,
  .account-menu {
    display: none;
  }
  .bar-actions {
    gap: 0;
  }
  .desktop-tabs {
    display: none;
  }
  .mobile-tabs {
    display: flex;
    padding: 0 12px;
    position: sticky;
    top: var(--bar-h-m);
    z-index: calc(var(--z-bar) - 1);
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
  .rework-bottom a,
  .rework-bottom button {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    min-height: 56px;
    border: 0;
    background: transparent;
    color: var(--ink-2);
    font: inherit;
    font-size: 11px;
    text-decoration: none;
    cursor: pointer;
  }
  .rework-bottom [aria-current] {
    color: var(--nav-active-text);
    font-weight: 700;
  }
  .rework-bottom [aria-current] svg {
    background: var(--nav-active-bg);
    color: var(--nav-active-ink);
    border-radius: var(--r-ctl);
    box-sizing: content-box;
    padding: 3px 10px;
  }
  .don-search .don-face {
    display: grid;
    place-items: center;
    width: 54px;
    height: 54px;
    margin-top: -18px;
    border-radius: 50%;
    background: var(--don);
    color: var(--note-ring);
    box-shadow:
      inset 0 0 0 4px color-mix(in srgb, var(--note-ring) 92%, transparent),
      0 0 0 2px var(--note-outline),
      var(--shadow-lift);
  }
  .don-search:active .don-face {
    transform: scale(0.9);
  }
  .skip-link {
    left: 8px;
  }
}
</style>
